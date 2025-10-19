'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ImageGenerator from '@/components/ImageGenerator';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Car, Upload, Image, LogOut, LayoutDashboard, Shield, Download } from 'lucide-react';

type GeneratedPost = {
  id: string;
  dealer_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      router.replace('/auth/login');
    },
  });

  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  useEffect(() => {
    const loadPosts = async () => {
      if (!session?.user?.id) return;
      setLoadingPosts(true);
      const { data, error } = await supabase
        .from('generated_posts')
        .select('*')
        .eq('dealer_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error && data) setPosts(data as unknown as GeneratedPost[]);
      setLoadingPosts(false);
    };
    loadPosts();
  }, [session?.user?.id]);

  return (
    <div className="min-h-screen bg-neutral-950">
      {status === 'loading' ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-12 h-12 border-2 border-neutral-700 border-t-white rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="sticky top-0 z-50 bg-neutral-950/70 backdrop-blur-xl border-b border-neutral-900/70">
            <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-white to-neutral-400/50 flex items-center justify-center">
                  <Car className="w-5 h-5 text-black" />
                </div>
                <h1 className="text-lg sm:text-xl font-semibold text-white">Dealer Dashboard</h1>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="hidden sm:inline text-sm text-neutral-400">{session?.user?.email}</span>
                <Link href={`/dashboard/${session?.user?.id}/upload`}>
                  <Button size="sm" className="bg-white text-black hover:bg-neutral-200">New Post</Button>
                </Link>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => signOut({ callbackUrl: '/auth/login' })}
                  className="bg-neutral-900/60 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white"
                >
                  Sign out
                </Button>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Sidebar */}
            <aside className="lg:col-span-2">
              <div className="bg-neutral-900/60 backdrop-blur-xl rounded-xl border border-neutral-800 p-3 sticky top-20">
                {/* User Profile */}
                <div className="flex items-center gap-3 pb-3 border-b border-neutral-800/70">
                  <div className="h-10 w-10 rounded-full bg-neutral-800 flex items-center justify-center text-white text-sm font-medium ring-1 ring-neutral-700">
                    {session?.user?.email?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{session?.user?.email}</div>
                    <div className="text-xs text-neutral-500">ID: {session?.user?.id?.slice(0, 8)}...</div>
                  </div>
                </div>

                {/* Navigation */}
                <nav className="mt-3 space-y-1.5">
                  <Link 
                    href="/dashboard" 
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Overview
                  </Link>
                  <Link 
                    href={`/dashboard/${session?.user?.id}/upload`} 
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Upload
                  </Link>
                  <Link 
                    href={`/dashboard/${session?.user?.id}/gallery`} 
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                  >
                    <Image className="w-4 h-4" />
                    Gallery
                  </Link>
                  {session?.user?.role === 'admin' && (
                    <Link 
                      href="/admin" 
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-neutral-300 hover:bg-neutral-800/50 hover:text-white transition-colors"
                    >
                      <Shield className="w-4 h-4" />
                      Admin
                    </Link>
                  )}
                </nav>

                {/* Logout Button */}
                <div className="mt-4 pt-4 border-t border-neutral-800/70">
                  <Button 
                    className="w-full bg-white hover:bg-neutral-200 text-black font-medium" 
                    onClick={() => signOut({ callbackUrl: '/auth/login' })}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <main className="lg:col-span-10 space-y-4">

              {/* Image Generator Section */}
              <div className="bg-neutral-900/50 backdrop-blur-xl rounded-xl border border-neutral-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-800">
                  <h2 className="text-base sm:text-lg font-semibold text-white">Generate Instagram Posts</h2>
                  <p className="mt-1 text-sm text-neutral-400">Upload images, fill details, and generate export-ready posts.</p>
                </div>
                <div className="p-4 sm:p-5">
                  <ImageGenerator />
                </div>
              </div>

              {/* Recent Posts Section */}
              <div className="bg-neutral-900/50 backdrop-blur-xl rounded-xl border border-neutral-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-800">
                  <h2 className="text-base sm:text-lg font-semibold text-white">Recent Generated Posts</h2>
                  <p className="mt-1 text-sm text-neutral-400">Your latest generated images appear here.</p>
                </div>
                <div className="p-4 sm:p-5">
                  {loadingPosts ? (
                    <div className="py-8 flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin"></div>
                    </div>
                  ) : posts.length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {posts.map((p) => (
                        <div key={p.id} className="rounded-lg border border-neutral-800 overflow-hidden bg-neutral-900/60 hover:bg-neutral-900 transition-colors group">
                          <div className="aspect-square relative overflow-hidden">
                            <img 
                              src={p.image_url} 
                              alt={p.caption || 'Generated image'} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                            />
                          </div>
                          <div className="p-3">
                            <p className="text-xs text-neutral-300 truncate mb-2">{p.caption || 'No caption'}</p>
                            <div className="flex justify-between items-center">
                              <a 
                                className="flex items-center gap-2 text-xs text-white hover:text-neutral-300 transition-colors" 
                                href={p.image_url} 
                                download
                              >
                                <Download className="w-3.5 h-3.5" />
                                Download
                              </a>
                              <span className="text-[10px] text-neutral-500">
                                {new Date(p.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <Car className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
                      <p className="text-neutral-400">No posts yet. Generate and save to see them here.</p>
                    </div>
                  )}
                </div>
              </div>
            </main>
          </div>
        </>
      )}
    </div>
  );
}