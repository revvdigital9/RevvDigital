'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { Car, ArrowLeft, Image as ImageIcon, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type GalleryItem = { id: string; url: string; name: string; createdAt?: string; dateFolder?: string };
type GalleryGroup = { date: string; items: GalleryItem[] };

export default function GalleryPage() {
  const router = useRouter();
  const params = useParams();
  const dealerId = useMemo(() => (Array.isArray(params?.dealerId) ? params.dealerId[0] : (params?.dealerId as string)), [params]);
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      router.replace('/auth/login');
    },
  });

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [groups, setGroups] = useState<GalleryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const handleDownload = (url: string, name: string) => {
    // Force download by fetching as blob and using an object URL
    fetch(url)
      .then(async (res) => {
        const blob = await res.blob();
        const obj = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = obj;
        a.download = name || 'image.jpg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(obj);
      })
      .catch((e) => console.error('Download error:', e));
  };

  const handleDownloadSelected = () => {
    const sel = items.filter((i) => selected[i.id]);
    if (!sel.length) return;
    sel.forEach((it, i) => setTimeout(() => handleDownload(it.url, it.name), i * 120));
  };

  const handleDeleteSelected = async () => {
    const sel = items.filter((i) => selected[i.id]);
    if (!sel.length) return;
    const paths = sel.map((i) => i.id);
    const { error } = await supabase.storage.from('posts').remove(paths);
    if (error) {
      console.error('Delete error:', error);
      return;
    }
    await loadGallery();
    setSelected({});
    setSelectionMode(false);
  };

  const loadGallery = async () => {
    if (!dealerId) return;
    setLoading(true);
    try {
      // List top-level under dealerId
      const prefix = `${dealerId}`; // no trailing slash
      const { data: level1, error: e1 } = await supabase.storage
        .from('posts')
        .list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'desc' } });
      if (e1) throw e1;

      // Fallback: some setups require a trailing slash to detect folder
      let topLevel = level1;
      if (!topLevel || topLevel.length === 0) {
        const { data: alt, error: eAlt } = await supabase.storage
          .from('posts')
          .list(`${dealerId}/`, { limit: 1000, sortBy: { column: 'name', order: 'desc' } });
        if (!eAlt && alt) topLevel = alt;
      }

      // Fallback 2: list root and find dealerId folder explicitly
      if (!topLevel || topLevel.length === 0) {
        const { data: root, error: eRoot } = await supabase.storage
          .from('posts')
          .list('', { limit: 1000, sortBy: { column: 'name', order: 'desc' } });
        if (!eRoot && root) {
          const hasDealerFolder = root.some((r) => r.name === dealerId && !('id' in r));
          if (hasDealerFolder) {
            const { data: alt2, error: eAlt2 } = await supabase.storage
              .from('posts')
              .list(`${dealerId}`, { limit: 1000, sortBy: { column: 'name', order: 'desc' } });
            if (!eAlt2 && alt2) topLevel = alt2;
          }
        }
      }

      const all: GalleryItem[] = [];
      for (const entry of topLevel || []) {
        const name = entry.name;
        const isFolder = !entry.id; // folders have no id
        if (isFolder) {
          const folderPath = `${dealerId}/${name}`;
          const { data: files, error: e2 } = await supabase.storage
            .from('posts')
            .list(folderPath, { limit: 1000, sortBy: { column: 'name', order: 'desc' } });
          if (e2) continue;
          for (const f of files || []) {
            if (!f.id) continue; // skip nested folders
            const path = `${folderPath}/${f.name}`;
            const { data } = supabase.storage.from('posts').getPublicUrl(path);
            all.push({ id: path, url: data.publicUrl, name: f.name, createdAt: (f as any).created_at, dateFolder: name });
          }
        } else {
          // File directly under dealerId (unlikely in our flow, but supported)
          const path = `${dealerId}/${name}`;
          const { data } = supabase.storage.from('posts').getPublicUrl(path);
          all.push({ id: path, url: data.publicUrl, name, createdAt: (entry as any).created_at, dateFolder: 'Unknown' });
        }
      }
      // Group by date folder and sort dates desc (YYYY-MM-DD)
      const map = new Map<string, GalleryItem[]>();
      for (const it of all) {
        const key = it.dateFolder || 'Unknown';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(it);
      }
      const grouped: GalleryGroup[] = Array.from(map.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([date, arr]) => ({ date, items: arr }));
      console.log('Gallery items loaded:', all.length, 'groups:', grouped.length);
      setItems(all);
      setGroups(grouped);
    } catch (err) {
      console.error('Gallery load error:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGallery();
  }, [dealerId]);

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950">
        <div className="w-12 h-12 border-2 border-neutral-700 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button
                variant="outline"
                size="sm"
                className="bg-neutral-800/50 border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <ImageIcon className="w-6 h-6 text-neutral-400" />
              <h1 className="text-2xl font-bold text-white">Image Gallery</h1>
            </div>
            <div className="ml-auto">
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={loadGallery} className="bg-white text-black hover:bg-neutral-200">Refresh</Button>
                {!selectionMode ? (
                  <Button size="sm" onClick={() => setSelectionMode(true)} className="bg-blue-600 hover:bg-blue-700 text-white">Select</Button>
                ) : (
                  <>
                    <Button size="sm" onClick={handleDownloadSelected} className="bg-green-600 hover:bg-green-700 text-white">Download Selected</Button>
                    <Button size="sm" onClick={handleDeleteSelected} className="bg-red-600 hover:bg-red-700 text-white">Delete Selected</Button>
                    <Button size="sm" onClick={() => { setSelectionMode(false); setSelected({}); }} className="bg-neutral-800 hover:bg-neutral-700 text-white">Cancel</Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {groups.length > 0 ? (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.date}>
                <h3 className="text-sm font-semibold text-neutral-300 mb-2">{group.date}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                  {group.items.map((image) => (
                    <div key={image.id} className="bg-neutral-800/50 rounded-lg border border-neutral-700 overflow-hidden hover:border-neutral-600 transition-colors group relative">
                      <div className="aspect-square relative overflow-hidden block">
                        <img
                          src={image.url}
                          alt={image.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {selectionMode && (
                          <label className="absolute top-2 left-2 bg-neutral-900/70 backdrop-blur px-2 py-1 rounded text-xs text-white flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!selected[image.id]}
                              onChange={(e) => setSelected((s) => ({ ...s, [image.id]: e.target.checked }))}
                            />
                            Select
                          </label>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-neutral-300 truncate mb-2">{image.name}</p>
                        <div className="flex justify-between items-center">
                          <button onClick={() => handleDownload(image.url, image.name)} className="flex items-center gap-2 text-xs text-white hover:text-neutral-300 transition-colors">
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="bg-neutral-900/50 backdrop-blur-xl rounded-xl border border-neutral-800 overflow-hidden">
            <div className="px-6 py-16 sm:p-20 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-neutral-800/50 mb-6">
                <ImageIcon className="w-10 h-10 text-neutral-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">No images yet</h3>
              <p className="text-neutral-400 max-w-sm mx-auto mb-8">
                Generate some images in the dashboard to see them here.
              </p>
              <Link href="/dashboard">
                <Button className="bg-white hover:bg-neutral-200 text-black font-medium">
                  <Car className="w-4 h-4 mr-2" />
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}