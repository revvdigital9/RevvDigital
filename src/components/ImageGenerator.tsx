'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Camera, Download, Trash2, Settings, Image as ImageIcon, Palette, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';

type CarDetails = {
  brand: string;
  model: string;
  color: string;
  fuelType: string;
  mileage: string;
  price: string;
  year: string;
  transmission: string;
  place: string;
};

type GeneratedImage = {
  id: string;
  url: string;
  caption: string;
  srcIndex: number;
};

type GeneratedReel = {
  id: string;
  url: string; // blob URL (mp4 or webm)
  mime: string;
  caption: string;
  thumb?: string;
};

type GenConfig = {
  theme: 'white' | 'black';
  outWidth: number;
  marginPct: number;
  textArea: number;
  titleSize: number;
  tagSize: number;
  logoSize: number;
  logoPad: number;
  logoPos: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left' | 'top-center';
  outlinePx?: number;
};

export default function ImageGenerator() {
  const [images, setImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [styledPreviews, setStyledPreviews] = useState<string[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [generatedReels, setGeneratedReels] = useState<GeneratedReel[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'details' | 'design'>('details');
  const [isDragActive, setIsDragActive] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [mode, setMode] = useState<'image' | 'video'>('image');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [trimEndSec, setTrimEndSec] = useState<number>(30);
  const [reelFps, setReelFps] = useState<24 | 30>(24);
  const [includeAudio, setIncludeAudio] = useState<boolean>(false);
  const [recordProgress, setRecordProgress] = useState<number>(0);
  const cancelRef = useRef<{ cancel: () => void } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [infoMsg, setInfoMsg] = useState<string>('');

  const [carDetails, setCarDetails] = useState<CarDetails>({
    brand: '',
    model: '',
    color: '',
    fuelType: '',
    mileage: '',
    price: '',
    year: '',
    transmission: '',
    place: '',
  });

  const [genCfg, setGenCfg] = useState<GenConfig>({
    theme: 'white',
    outWidth: 1080,
    marginPct: 5,
    textArea: 220,
    titleSize: 56,
    tagSize: 24,
    logoSize: 80,
    logoPad: 40,
    logoPos: 'top-right',
    outlinePx: 2,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const pathname = usePathname();

  const startOver = useCallback(() => {
    try {
      // Revoke object URLs
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      generatedImages.forEach(img => URL.revokeObjectURL(img.url));
      if (logoUrl) URL.revokeObjectURL(logoUrl);
    } catch {}

    // Reset inputs and state
    if (fileInputRef.current) fileInputRef.current.value = '';
    setImages([]);
    setPreviewUrls([]);
    setStyledPreviews([]);
    setGeneratedImages([]);
    setCurrentPreviewIndex(0);
    setActiveTab('details');
    setLogoUrl('');
    logoImgRef.current = null;
    setLogoLoaded(false);
    setCarDetails({
      brand: '',
      model: '',
      color: '',
      fuelType: '',
      mileage: '',
      price: '',
      year: '',
      transmission: '',
      place: '',
    });
    // Optionally keep design settings; comment next block to preserve
    setGenCfg(p => ({ ...p }));

    try { sessionStorage.removeItem('generatedImages'); } catch {}
    try { sessionStorage.removeItem('carDetails'); } catch {}
    try { sessionStorage.removeItem('genCfg'); } catch {}
    try { sessionStorage.removeItem('previewUrls'); } catch {}
    try { sessionStorage.removeItem('logoUrl'); } catch {}
    try { sessionStorage.removeItem('currentPreviewIndex'); } catch {}
    try { sessionStorage.removeItem('activeTab'); } catch {}
  }, [previewUrls, generatedImages, logoUrl]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('generatedImages');
      if (raw) {
        const parsed: GeneratedImage[] = JSON.parse(raw);
        if (Array.isArray(parsed)) setGeneratedImages(parsed);
      }
      const rawReels = sessionStorage.getItem('generatedReels');
      if (rawReels) {
        const parsed: GeneratedReel[] = JSON.parse(rawReels);
        if (Array.isArray(parsed)) setGeneratedReels(parsed);
      }
      const rawDetails = sessionStorage.getItem('carDetails');
      if (rawDetails) {
        const parsed = JSON.parse(rawDetails);
        if (parsed && typeof parsed === 'object') setCarDetails((p) => ({ ...p, ...parsed }));
      }
      const rawCfg = sessionStorage.getItem('genCfg');
      if (rawCfg) {
        const parsed = JSON.parse(rawCfg);
        if (parsed && typeof parsed === 'object') setGenCfg((p) => ({ ...p, ...parsed }));
      }
      const rawPreviews = sessionStorage.getItem('previewUrls');
      if (rawPreviews) {
        const parsed: string[] = JSON.parse(rawPreviews);
        if (Array.isArray(parsed)) setPreviewUrls(parsed);
      }
      const savedLogo = sessionStorage.getItem('logoUrl');
      if (savedLogo) setLogoUrl(savedLogo);
      const savedIdx = sessionStorage.getItem('currentPreviewIndex');
      if (savedIdx) setCurrentPreviewIndex(Number(savedIdx) || 0);
      const savedTab = sessionStorage.getItem('activeTab');
      if (savedTab === 'details' || savedTab === 'design') setActiveTab(savedTab);
    } catch {}
  }, []);

  // Rounded rectangle path
  const roundedRectPath = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }, []);

  // Text wrapping with center alignment
  const wrapCenter = useCallback((
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) => {
    const words = text.split(/\s+/);
    let line = '';
    let ly = y;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + (line ? ' ' : '') + words[i];
      if (ctx.measureText(testLine).width > maxWidth && i > 0) {
        ctx.fillText(line, cx, ly);
        line = words[i];
        ly += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) ctx.fillText(line, cx, ly);
  }, []);

  // Draw outlined centered text with adjustable outlinePx
  const drawOutlinedCenter = useCallback((
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    y: number,
    maxWidth: number,
    lineH: number,
    outlinePx: number
  ) => {
    const r = Math.max(1, Math.floor(outlinePx || 1));
    ctx.fillStyle = '#000';
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (dx === 0 && dy === 0) continue;
        wrapCenter(ctx, text, cx + dx, y + dy, maxWidth, lineH);
      }
    }
    ctx.fillStyle = '#fff';
    wrapCenter(ctx, text, cx, y, maxWidth, lineH);
  }, [wrapCenter]);

  // Core drawing function
  const drawPoster = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    img: HTMLImageElement,
    cfg: GenConfig,
    details: CarDetails,
    logo?: HTMLImageElement | null
  ) => {
    const margin = Math.round(width * (cfg.marginPct / 100));
    const textAreaH = Math.max(100, Math.floor(cfg.textArea));
    const bg = cfg.theme === 'black' ? '#000000' : '#ffffff';
    const ink = cfg.theme === 'black' ? '#ffffff' : '#000000';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const boxW = width - margin * 2;
    const boxH = height - margin * 2 - textAreaH;
    const ratio = Math.min(boxW / img.width, boxH / img.height);
    const imgWidth = Math.round(img.width * ratio);
    const imgHeight = Math.round(img.height * ratio);
    const offsetX = Math.round(margin + (boxW - imgWidth) / 2);
    const offsetY = Math.round(margin + (boxH - imgHeight) / 2);
    const radius = Math.round(Math.min(imgWidth, imgHeight) * 0.03);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = Math.round(width * 0.012);
    ctx.shadowOffsetY = Math.round(width * 0.004);
    roundedRectPath(ctx, offsetX, offsetY, imgWidth, imgHeight, radius);
    ctx.clip();
    ctx.drawImage(img, offsetX, offsetY, imgWidth, imgHeight);
    ctx.restore();

    ctx.lineWidth = 2;
    ctx.strokeStyle = cfg.theme === 'black' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    roundedRectPath(ctx, offsetX, offsetY, imgWidth, imgHeight, radius);
    ctx.stroke();

    ctx.fillStyle = bg;
    ctx.fillRect(0, height - textAreaH, width, textAreaH);

    ctx.fillStyle = ink;
    ctx.textAlign = 'center';

    const title = [details.brand, details.model].filter(Boolean).join(' ').trim();
    const parts = [
      details.price ? `₹${details.price}` : '',
      details.mileage ? `${details.mileage} km` : '',
      details.fuelType || '',
      details.year || '',
      details.transmission || '',
      details.color || '',
      details.place ? `Available at ${details.place}` : '',
    ].filter(Boolean);
    const meta = parts.join(' • ');

    const maxWidth = width * 0.88;
    const titleSize = Math.max(28, Math.min(96, cfg.titleSize));

    if (title) {
      ctx.font = `900 ${titleSize}px Arial, sans-serif`;
      const titleY = height - textAreaH + titleSize + 35;
      drawOutlinedCenter(ctx, title, width / 2, titleY, maxWidth, Math.round(titleSize * 1.15), genCfg.outlinePx || 2);
    }

    if (meta) {
      const tagSize = Math.max(18, Math.min(48, cfg.tagSize));
      ctx.font = `700 ${tagSize}px Arial, sans-serif`;
      const detailsY = height - textAreaH + titleSize + (title ? Math.round(titleSize * 0.85) : 0) + tagSize + 35;
      drawOutlinedCenter(ctx, meta, width / 2, detailsY, maxWidth, Math.round(tagSize * 1.25), genCfg.outlinePx || 2);
    }

    if (logo) {
      const size = Math.max(16, Math.min(600, Math.floor(cfg.logoSize)));
      const pad = Math.max(0, Math.floor(cfg.logoPad));
      let x = pad;
      let y = pad;
      switch (cfg.logoPos) {
        case 'top-center':
          x = Math.floor((width - size) / 2);
          y = pad;
          break;
        case 'top-right':
          x = width - size - pad;
          y = pad;
          break;
        case 'bottom-right':
          x = width - size - pad;
          y = height - size - pad;
          break;
        case 'bottom-left':
          x = pad;
          y = height - size - pad;
          break;
        default:
          break;
      }
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = Math.round(width * 0.005);
      ctx.drawImage(logo, x, y, size, size);
      ctx.restore();
    }
  }, [roundedRectPath, wrapCenter]);

  // Live preview effect
  useEffect(() => {
    const pc = previewCanvasRef.current;
    if (!pc || !previewUrls.length) return;

    if (currentPreviewIndex >= previewUrls.length) {
      setCurrentPreviewIndex(0);
      return;
    }

    const isVideo = mode === 'video';
    const width = 1080;
    const height = isVideo ? 1920 : 1350;
    const previewW = isVideo ? 360 : 420;
    const previewH = isVideo ? 640 : 525;

    pc.width = previewW;
    pc.height = previewH;

    const ctxPrev = pc.getContext('2d');
    if (!ctxPrev) return;

    ctxPrev.fillStyle = isVideo ? '#000' : (genCfg.theme === 'black' ? '#000' : '#fff');
    ctxPrev.fillRect(0, 0, previewW, previewH);

    const img = new Image();
    img.onload = () => {
      const off = document.createElement('canvas');
      off.width = width;
      off.height = height;
      const offCtx = off.getContext('2d');
      if (!offCtx) return;

      if (!isVideo) {
        // Image mode: use existing poster renderer (4:5)
        drawPoster(offCtx, width, height, img, genCfg, carDetails, logoImgRef.current);
      } else {
        // Video mode: draw the frame to cover 9:16, then overlays
        const fitCover = (vw: number, vh: number) => {
          const rC = width / height, rV = vw / vh;
          let dw = width, dh = height;
          if (rV > rC) { dh = height; dw = Math.round(height * rV); } else { dw = width; dh = Math.round(width / rV); }
          const dx = Math.round((width - dw) / 2), dy = Math.round((height - dh) / 2);
          return { dx, dy, dw, dh };
        };
        const { dx, dy, dw, dh } = fitCover(img.naturalWidth || img.width, img.naturalHeight || img.height);
        offCtx.fillStyle = '#000';
        offCtx.fillRect(0, 0, width, height);
        offCtx.drawImage(img, dx, dy, dw, dh);

        // center alignment for text
        offCtx.textAlign = 'center';
        offCtx.textBaseline = 'alphabetic';

        const margin = Math.round((genCfg.marginPct / 100) * Math.min(width, height));
        const textAreaH = Math.max(120, Math.min(640, Math.floor(genCfg.textArea)));
        const titleSize = Math.max(24, Math.min(96, Math.floor(genCfg.titleSize)));
        const tagSize = Math.max(18, Math.min(48, Math.floor(genCfg.tagSize)));
        const maxWidth = width - margin * 2;
        const { brand, model, price, mileage, fuelType, year, transmission, place } = carDetails;
        const title = [brand, model].filter(Boolean).join(' ').trim();
        if (title) {
          offCtx.font = `700 ${titleSize}px Arial, sans-serif`;
          const titleY = height - textAreaH + titleSize + 10;
          // outline: black around, white center
          offCtx.fillStyle = '#000';
          wrapCenter(offCtx, title, (width / 2) - 1, titleY, maxWidth, titleSize);
          wrapCenter(offCtx, title, (width / 2) + 1, titleY, maxWidth, titleSize);
          wrapCenter(offCtx, title, (width / 2), titleY - 1, maxWidth, titleSize);
          wrapCenter(offCtx, title, (width / 2), titleY + 1, maxWidth, titleSize);
          offCtx.fillStyle = '#fff';
          wrapCenter(offCtx, title, width / 2, titleY, maxWidth, titleSize);
        }
        const metaParts = [price?`₹${price}`:'', mileage?`${mileage} km`:'', fuelType||'', year||'', transmission||'', place||''].filter(Boolean);
        const meta = metaParts.join(' • ');
        if (meta) {
          offCtx.font = `700 ${tagSize}px Arial, sans-serif`;
          const detailsY = height - textAreaH + titleSize + (title ? Math.round(titleSize*0.85) : 0) + tagSize + 35;
          offCtx.fillStyle = '#000';
          wrapCenter(offCtx, meta, (width / 2) - 1, detailsY, maxWidth, Math.round(tagSize*1.25));
          wrapCenter(offCtx, meta, (width / 2) + 1, detailsY, maxWidth, Math.round(tagSize*1.25));
          wrapCenter(offCtx, meta, (width / 2), detailsY - 1, maxWidth, Math.round(tagSize*1.25));
          wrapCenter(offCtx, meta, (width / 2), detailsY + 1, maxWidth, Math.round(tagSize*1.25));
          offCtx.fillStyle = '#fff';
          wrapCenter(offCtx, meta, width / 2, detailsY, maxWidth, Math.round(tagSize*1.25));
        }
        if (logoImgRef.current) {
          const size = Math.max(16, Math.min(600, Math.floor(genCfg.logoSize)));
          const pad = Math.max(0, Math.floor(genCfg.logoPad));
          let x = pad, y = pad;
          switch (genCfg.logoPos) {
            case 'top-center': x = Math.floor((width - size) / 2); y = pad; break;
            case 'top-right': x = width - size - pad; y = pad; break;
            case 'bottom-right': x = width - size - pad; y = height - size - pad; break;
            case 'bottom-left': x = pad; y = height - size - pad; break;
            default: break;
          }
          offCtx.drawImage(logoImgRef.current, x, y, size, size);
        }
      }

      ctxPrev.drawImage(off, 0, 0, previewW, previewH);
    };
    img.src = previewUrls[currentPreviewIndex];
  }, [mode, previewUrls, currentPreviewIndex, genCfg, carDetails, drawPoster, logoLoaded]);

  // Generate styled thumbnails
  useEffect(() => {
    if (!previewUrls.length) {
      setStyledPreviews([]);
      return;
    }

    const generateStyledPreviews = async () => {
      const newStyledPreviews: string[] = [];

      for (let i = 0; i < previewUrls.length; i++) {
        const img = new Image();

        try {
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              try {
                const width = 1080;
                const height = 1350;
                const previewW = 180;
                const previewH = 225;

                const canvas = document.createElement('canvas');
                canvas.width = previewW;
                canvas.height = previewH;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                  reject(new Error('No context'));
                  return;
                }

                const off = document.createElement('canvas');
                off.width = width;
                off.height = height;
                const offCtx = off.getContext('2d');
                if (!offCtx) {
                  reject(new Error('No offscreen context'));
                  return;
                }

                drawPoster(offCtx, width, height, img, genCfg, carDetails, logoImgRef.current);
                ctx.drawImage(off, 0, 0, previewW, previewH);
                newStyledPreviews[i] = canvas.toDataURL('image/jpeg', 0.75);
                resolve();
              } catch (err) {
                reject(err);
              }
            };

            img.onerror = reject;
            img.src = previewUrls[i];
          });
        } catch {
          newStyledPreviews[i] = previewUrls[i];
        }
      }

      setStyledPreviews(newStyledPreviews);
    };

    generateStyledPreviews();
  }, [previewUrls, genCfg, carDetails, drawPoster, logoLoaded]);

  // File input handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      if (mode === 'image') {
        const onlyImages = files.filter(f => f.type.startsWith('image/'));
        if (!onlyImages.length) return;
        setImages(prev => [...prev, ...onlyImages]);
        const urls = onlyImages.map(file => URL.createObjectURL(file));
        setPreviewUrls(prev => [...prev, ...urls]);
      }
    }
  };

  // Capture a still for preview from video and validate <= 30s
  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    if (!file.type.startsWith('video/')) { alert('Please select a video file'); return; }
    // Read duration
    const url = URL.createObjectURL(file);
    try {
      const v = document.createElement('video');
      v.preload = 'metadata'; v.muted = true; (v as any).playsInline = true; v.src = url; v.load();
      await new Promise<void>((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('timeout')), 8000);
        v.onloadedmetadata = () => { clearTimeout(to); resolve(); };
        v.onerror = () => { clearTimeout(to); reject(new Error('Video metadata error')); };
      });
      setVideoDuration(isFinite(v.duration) ? v.duration : 0);
      setTrimEndSec(Math.min(30, isFinite(v.duration) ? v.duration : 30));
      if (v.duration > 30.5) { /* allow quick trim via UI instead of blocking */ }

      // Generate a preview frame ~1s in
      v.currentTime = Math.min(1, Math.max(0, v.duration - 0.1));
      await new Promise<void>((resolve) => { v.onseeked = () => resolve(); });
      const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
      const cx = c.getContext('2d'); if (!cx) return;
      cx.drawImage(v, 0, 0, c.width, c.height);
      const frameUrl = c.toDataURL('image/jpeg', 0.9);
      setPreviewUrls([frameUrl]);
      setImages([]); // ensure image flow doesn’t conflict
      setVideoFile(file);
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (mode === 'image') {
      const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
      if (files.length > 0) {
        setImages(prev => [...prev, ...files]);
        const urls = files.map(file => URL.createObjectURL(file));
        setPreviewUrls(prev => [...prev, ...urls]);
      }
    }
  };

  // Cleanup URLs
  useEffect(() => {
    return () => {
      // Do not revoke preview/logo URLs on unmount so Live Preview remains when navigating back.
      // Memory is cleaned when user clicks Start Over, or on full page reload.
    };
  }, []);

  // Load logo image element
  useEffect(() => {
    setLogoLoaded(false);
    if (!logoUrl) {
      logoImgRef.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      logoImgRef.current = img;
      setLogoLoaded(true);
    };
    img.src = logoUrl;
  }, [logoUrl]);

  // Remove image handler
  const removeImage = useCallback((index: number) => {
    const newUrls = [...previewUrls];
    const newImages = [...images];
    URL.revokeObjectURL(newUrls[index]);
    newUrls.splice(index, 1);
    newImages.splice(index, 1);
    setPreviewUrls(newUrls);
    setImages(newImages);
    if (currentPreviewIndex >= newUrls.length) {
      setCurrentPreviewIndex(Math.max(0, newUrls.length - 1));
    }
  }, [previewUrls, images, currentPreviewIndex]);

  // Generate images
  const generateImage = async () => {
    if (!images.length || !canvasRef.current) return;
    if (!logoImgRef.current) {
      alert('Please upload a logo before generating.');
      return;
    }

    generatedImages.forEach(img => URL.revokeObjectURL(img.url));
    setGeneratedImages([]);

    setIsGenerating(true);
    const newGeneratedImages: GeneratedImage[] = [];
    // Compute a stable caption locally to avoid scope issues
    const { brand, model, price, mileage, fuelType, year, transmission, color, place } = carDetails;
    const titleLocal = [brand, model].filter(Boolean).join(' ').trim();
    const partsLocal = [
      price ? `₹${price}` : '',
      mileage ? `${mileage} km` : '',
      fuelType || '',
      year || '',
      transmission || '',
      color || '',
      place ? `Available at ${place}` : '',
    ].filter(Boolean);
    const imageCaption = [titleLocal, partsLocal.join(' • ')].filter(Boolean).join(' | ');

    try {
      for (let i = 0; i < images.length; i++) {
        const img = new Image();

        await new Promise<void>((resolve) => {
          img.onload = async () => {
            const canvas = canvasRef.current!;
            const ctx = canvas.getContext('2d')!;

            const width = 1080;
            const height = 1350;
            const dpr = 2;

            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            drawPoster(ctx, width, height, img, genCfg, carDetails, logoImgRef.current);

            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                newGeneratedImages.push({
                  id: `img-${Date.now()}-${i}`,
                  url,
                  caption: imageCaption,
                  srcIndex: i,
                });
              }
              resolve();
            }, 'image/jpeg', 0.92);
          };

          img.src = URL.createObjectURL(images[i]);
        });
      }

      setGeneratedImages(newGeneratedImages);
      alert(`✓ Generated ${newGeneratedImages.length} Instagram post${newGeneratedImages.length > 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Generation error:', error);
      alert('✗ Failed to generate images');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `car-listing-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate Reel (try MP4, fallback WebM), 9:16, max 30s
  const generateReel = async () => {
    if (mode !== 'video' || !videoFile) return;
    if (!logoImgRef.current) { alert('Please upload a logo before generating.'); return; }

    const videoUrl = URL.createObjectURL(videoFile);
    const canvas = document.createElement('canvas');
    const width = 1080, height = 1920;
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    // improve scaling quality
    // @ts-ignore
    ctx.imageSmoothingEnabled = true; // modern browsers
    // @ts-ignore
    ctx.imageSmoothingQuality = 'high';

    const fps = reelFps;
    const stream = canvas.captureStream(fps);
    const preferMp4 = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4;codecs=avc1','video/mp4'].find(MediaRecorder.isTypeSupported as any) as string | undefined;
    const mime = preferMp4 || (MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm;codecs=vp8');
    const chunks: BlobPart[] = [];
    // Try higher bitrate and fall back if config unsupported
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime, bitsPerSecond: 6_000_000 } as any);
    } catch (err) {
      try {
        recorder = new MediaRecorder(stream, { mimeType: mime } as any);
      } catch (err2) {
        try {
          recorder = new MediaRecorder(stream);
        } catch (err3) {
          console.error('MediaRecorder unsupported', err3);
          alert('Recording is not supported in this browser. Please try Chrome/Edge with MP4 or WebM.');
          return;
        }
      }
    }
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    const done = new Promise<void>(resolve => recorder.onstop = () => resolve());

    const vid = document.createElement('video');
    vid.muted = true; (vid as any).playsInline = true; vid.preload = 'metadata'; vid.src = videoUrl; vid.load();
    try {
      await new Promise<void>((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('timeout')), 8000);
        vid.onloadedmetadata = () => { clearTimeout(to); resolve(); };
        vid.onerror = () => { clearTimeout(to); reject(new Error('Video load error')); };
      });
    } catch (err) {
      setIsRecording(false);
      URL.revokeObjectURL(videoUrl);
      alert('Unsupported or unreadable video. Please use MP4 (H.264) or WebM and try again.');
      return;
    }

    const maxDuration = Math.min(30, isFinite(vid.duration) ? vid.duration : 30);
    const targetDuration = Math.min(trimEndSec || maxDuration, maxDuration);
    // Attach optional audio from the source video when supported
    if (includeAudio && typeof (vid as any).captureStream === 'function') {
      try {
        const vStream: MediaStream = (vid as any).captureStream();
        const audioTracks = vStream.getAudioTracks();
        audioTracks.forEach(t => stream.addTrack(t));
      } catch (e) { console.warn('Audio attach failed', e); }
    }
    const fitCover = (vw: number, vh: number) => {
      const rC = width/height, rV = vw/vh; let dw=width, dh=height;
      if (rV > rC) { dh = height; dw = Math.round(height * rV); } else { dw = width; dh = Math.round(width / rV); }
      const dx = Math.round((width - dw)/2), dy = Math.round((height - dh)/2); return {dx,dy,dw,dh};
    };
    const drawFrame = () => {
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,width,height);
      const {dx,dy,dw,dh} = fitCover(vid.videoWidth, vid.videoHeight);
      ctx.drawImage(vid, dx, dy, dw, dh);
      // Overlays (reuse sizes from image flow)
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const margin = Math.round((genCfg.marginPct / 100) * Math.min(width, height));
      const textAreaH = Math.max(120, Math.min(640, Math.floor(genCfg.textArea)));
      const titleSize = Math.max(24, Math.min(96, Math.floor(genCfg.titleSize)));
      const tagSize = Math.max(18, Math.min(48, Math.floor(genCfg.tagSize)));
      const maxWidth = width - margin * 2;
      const { brand, model, price, mileage, fuelType, year, transmission, place } = carDetails;
      const title = [brand, model].filter(Boolean).join(' ').trim();
      if (title) {
        ctx.font = `700 ${titleSize}px Arial, sans-serif`;
        const titleY = height - textAreaH + titleSize + 10;
        // outline: draw black around then white center
        ctx.fillStyle = '#000';
        wrapCenter(ctx, title, (width / 2) - 1, titleY, maxWidth, titleSize);
        wrapCenter(ctx, title, (width / 2) + 1, titleY, maxWidth, titleSize);
        wrapCenter(ctx, title, (width / 2), titleY - 1, maxWidth, titleSize);
        wrapCenter(ctx, title, (width / 2), titleY + 1, maxWidth, titleSize);
        ctx.fillStyle = '#fff';
        wrapCenter(ctx, title, width / 2, titleY, maxWidth, titleSize);
      }
      const metaParts = [price?`₹${price}`:'', mileage?`${mileage} km`:'', fuelType||'', year||'', transmission||'', place||''].filter(Boolean);
      const meta = metaParts.join(' • ');
      if (meta) {
        ctx.font = `700 ${tagSize}px Arial, sans-serif`;
        const detailsY = height - textAreaH + titleSize + (title ? Math.round(titleSize*0.85) : 0) + tagSize + 35;
        ctx.fillStyle = '#000';
        wrapCenter(ctx, meta, (width / 2) - 1, detailsY, maxWidth, Math.round(tagSize*1.25));
        wrapCenter(ctx, meta, (width / 2) + 1, detailsY, maxWidth, Math.round(tagSize*1.25));
        wrapCenter(ctx, meta, (width / 2), detailsY - 1, maxWidth, Math.round(tagSize*1.25));
        wrapCenter(ctx, meta, (width / 2), detailsY + 1, maxWidth, Math.round(tagSize*1.25));
        ctx.fillStyle = '#fff';
        wrapCenter(ctx, meta, width / 2, detailsY, maxWidth, Math.round(tagSize*1.25));
      }
      if (logoImgRef.current) {
        const size = Math.max(16, Math.min(600, Math.floor(genCfg.logoSize)));
        const pad = Math.max(0, Math.floor(genCfg.logoPad));
        let x = pad, y = pad;
        switch (genCfg.logoPos) {
          case 'top-center': x = Math.floor((width - size)/2); y = pad; break;
          case 'top-right': x = width - size - pad; y = pad; break;
          case 'bottom-right': x = width - size - pad; y = height - size - pad; break;
          case 'bottom-left': x = pad; y = height - size - pad; break;
          default: break;
        }
        ctx.drawImage(logoImgRef.current, x, y, size, size);
      }
    };

    setIsRecording(true);
    setRecordProgress(0);
    recorder.start(0);
    vid.playbackRate = 1;
    try {
      await vid.play();
    } catch (err) {
      try {
        vid.muted = true;
        await vid.play();
      } catch (err2) {
        setIsRecording(false);
        URL.revokeObjectURL(videoUrl);
        console.error('Video play failed', err2);
        alert('Autoplay blocked or video cannot play. Click anywhere and try again, or use MP4/WebM.');
        return;
      }
    }
    const startT = performance.now();
    const startVideoT = vid.currentTime || 0;
    let running = true;
    cancelRef.current = { cancel: () => { running = false; stopRecord(); } };
    // Prefer syncing to decoded video frames when available to avoid jitter
    const useRVFC = typeof (vid as any).requestVideoFrameCallback === 'function';
    const scheduleRAF = () => requestAnimationFrame(tickRAF);
    const scheduleRVFC = () => (vid as any).requestVideoFrameCallback(tickRVFC);
    const stopRecord = () => { try { recorder.stop(); } catch {} try { vid.pause(); } catch {} };
    const tickCommon = () => {
      const elapsed = (performance.now() - startT) / 1000;
      const videoElapsed = (vid.currentTime || 0) - startVideoT;
      // progress update
      if (targetDuration > 0) {
        const p = Math.max(0, Math.min(100, (videoElapsed / targetDuration) * 100));
        setRecordProgress(p);
      }
      if (videoElapsed >= targetDuration || vid.ended) {
        running = false;
        stopRecord();
        return true;
      }
      return false;
    };
    const tickRAF = () => {
      if (!running) return;
      drawFrame();
      if (!tickCommon()) scheduleRAF();
    };
    const tickRVFC = (_now?: any, _metadata?: any) => {
      if (!running) return;
      drawFrame();
      if (!tickCommon()) scheduleRVFC();
    };
    useRVFC ? scheduleRVFC() : scheduleRAF();
    await done;
    setIsRecording(false);
    setRecordProgress(100);
    URL.revokeObjectURL(videoUrl);

    const blob = new Blob(chunks, { type: recorder.mimeType });
    const outUrl = URL.createObjectURL(blob);
    // Create a poster thumbnail from the first frame
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 360; thumbCanvas.height = 640;
    const tctx = thumbCanvas.getContext('2d');
    if (tctx) {
      tctx.fillStyle = '#000'; tctx.fillRect(0,0,thumbCanvas.width, thumbCanvas.height);
      try {
        // draw first frame approximation by seeking to 0.2s
        vid.currentTime = Math.min(0.2, Math.max(0, vid.duration - 0.1));
        await new Promise<void>(res => vid.onseeked = () => res());
        const rC = thumbCanvas.width/thumbCanvas.height, rV = vid.videoWidth/vid.videoHeight;
        let dw=thumbCanvas.width, dh=thumbCanvas.height, dx=0, dy=0;
        if (rV > rC) { dh = thumbCanvas.height; dw = Math.round(dh * rV); dx = Math.round((thumbCanvas.width - dw)/2); }
        else { dw = thumbCanvas.width; dh = Math.round(dw / rV); dy = Math.round((thumbCanvas.height - dh)/2); }
        tctx.drawImage(vid, dx, dy, dw, dh);
      } catch {}
    }
    const thumbUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);
    // Build a local caption for the reel
    const { brand, model, price, mileage, fuelType, year, transmission, color, place } = carDetails;
    const titleLocalR = [brand, model].filter(Boolean).join(' ').trim();
    const partsLocalR = [
      price ? `₹${price}` : '',
      mileage ? `${mileage} km` : '',
      fuelType || '',
      year || '',
      transmission || '',
      color || '',
      place ? `Available at ${place}` : '',
    ].filter(Boolean);
    const reelCaption = [titleLocalR, partsLocalR.join(' • ')].filter(Boolean).join(' | ');
    // Keep only the latest reel
    setGeneratedReels([{ id: `reel-${Date.now()}`, url: outUrl, mime: recorder.mimeType, caption: reelCaption, thumb: thumbUrl }]);
    alert(`✓ Reel generated (${recorder.mimeType.includes('mp4') ? 'MP4' : 'WebM'})`);
  };


  // Supabase upload helpers
  const getDealerIdFromPath = useCallback(() => {
    // Expecting path like /dashboard/<dealerId>/...
    if (!pathname) return undefined;
    const parts = pathname.split('/').filter(Boolean);
    const dashIndex = parts.indexOf('dashboard');
    if (dashIndex >= 0 && parts.length > dashIndex + 1) {
      return parts[dashIndex + 1];
    }
    return undefined;
  }, [pathname]);

  const toYmdFolder = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const objectUrlToBlob = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch object URL');
    return await res.blob();
  };

  const uploadGeneratedImage = async (img: GeneratedImage) => {
    const dealerId = getDealerIdFromPath();
    if (!dealerId) throw new Error('Dealer ID not found in URL');
    const blob = await objectUrlToBlob(img.url);
    const filePath = `${dealerId}/${toYmdFolder()}/${img.id}.jpg`;
    const { error } = await supabase.storage.from('posts').upload(filePath, blob, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/jpeg',
    });
    if (error) throw error;
    return filePath;
  };

  const saveAllToLibrary = async () => {
    if (generatedImages.length === 0) return;
    setIsSaving(true);
    try {
      for (let i = 0; i < generatedImages.length; i++) {
        await uploadGeneratedImage(generatedImages[i]);
      }
      alert('✓ Saved all images to library');
    } catch (e) {
      console.error(e);
      alert('✗ Failed to save some images');
    } finally {
      setIsSaving(false);
    }
  };

  const saveOneToLibrary = async (img: GeneratedImage) => {
    setIsSaving(true);
    try {
      await uploadGeneratedImage(img);
      alert('✓ Saved to library');
    } catch (e) {
      console.error(e);
      alert('✗ Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid = carDetails.brand && carDetails.model && (mode === 'image' ? images.length > 0 : !!videoFile) && !!logoImgRef.current;

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-7xl bg-gradient-to-br from-neutral-900/90 to-neutral-900/60 backdrop-blur-xl border border-neutral-800/50 rounded-2xl shadow-2xl p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Section 1: Controls */}
          <div className="w-full lg:w-1/3 space-y-6">
            <div className="flex gap-2">
              <div className="flex-1 flex rounded-md overflow-hidden border border-neutral-800">
                <button
                  className={`flex-1 py-2 text-sm ${mode==='image' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-neutral-800'}`}
                  onClick={() => setMode('image')}
                >Image</button>
                <button
                  className={`flex-1 py-2 text-sm ${mode==='video' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-neutral-800'}`}
                  onClick={() => setMode('video')}
                >Video</button>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => (mode==='image' ? fileInputRef.current?.click() : videoInputRef.current?.click())}
                className="flex-1 px-3 py-2 rounded-md bg-neutral-800 text-neutral-200 hover:bg-neutral-700 text-sm flex items-center justify-center gap-2"
              >
                <ImageIcon className="w-4 h-4" />
                {mode==='image' ? 'Upload Image' : 'Upload Video'}
              </button>
              <label className="flex-1 px-3 py-2 rounded-md bg-neutral-800 text-neutral-200 hover:bg-neutral-700 text-sm cursor-pointer flex items-center justify-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Upload Logo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (logoUrl) URL.revokeObjectURL(logoUrl);
                      const url = URL.createObjectURL(file);
                      setLogoUrl(url);
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>


            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />

            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoChange}
              className="hidden"
            />

            {previewUrls.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-neutral-300">{previewUrls.length} image{previewUrls.length > 1 ? 's' : ''}</span>
                  <button
                    onClick={() => {
                      previewUrls.forEach(url => URL.revokeObjectURL(url));
                      setImages([]);
                      setPreviewUrls([]);
                      setCurrentPreviewIndex(0);
                    }}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Clear all
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {previewUrls.map((url, index) => (
                    <div key={index} className="relative group aspect-square">
                      <img
                        src={url}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg border border-neutral-800"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(index);
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-neutral-900/60 rounded-xl p-4">
              <div className="flex border-b border-neutral-800 mb-4">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`flex-1 py-2 text-sm font-medium ${
                    activeTab === 'details' ? 'bg-blue-500 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Car Details
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('design')}
                  className={`flex-1 py-2 text-sm font-medium ${
                    activeTab === 'design' ? 'bg-blue-500 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Settings className="w-4 h-4" />
                    Design
                  </div>
                </button>
              </div>

              {activeTab === 'details' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-neutral-300 mb-1">Brand *</label>
                      <input
                        type="text"
                        value={carDetails.brand}
                        onChange={(e) => setCarDetails(p => ({ ...p, brand: e.target.value }))}
                        className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-sm focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-300 mb-1">Model *</label>
                      <input
                        type="text"
                        value={carDetails.model}
                        onChange={(e) => setCarDetails(p => ({ ...p, model: e.target.value }))}
                        className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-sm focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-300 mb-1">Location</label>
                    <input
                      type="text"
                      value={carDetails.place}
                      onChange={(e) => setCarDetails(p => ({ ...p, place: e.target.value }))}
                      className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-sm focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-neutral-300 mb-1">Year</label>
                      <input
                        type="number"
                        value={carDetails.year}
                        onChange={(e) => setCarDetails(p => ({ ...p, year: e.target.value }))}
                        className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-sm focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-300 mb-1">Color</label>
                      <input
                        type="text"
                        value={carDetails.color}
                        onChange={(e) => setCarDetails(p => ({ ...p, color: e.target.value }))}
                        className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-sm focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-neutral-300 mb-1">Fuel Type</label>
                      <select
                        value={carDetails.fuelType}
                        onChange={(e) => setCarDetails(p => ({ ...p, fuelType: e.target.value }))}
                        className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-sm focus:border-blue-500 outline-none"
                      >
                        <option value="">Select</option>
                        <option value="Petrol">Petrol</option>
                        <option value="Diesel">Diesel</option>
                        <option value="CNG">CNG</option>
                        <option value="Electric">Electric</option>
                        <option value="Hybrid">Hybrid</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-300 mb-1">Transmission</label>
                      <select
                        value={carDetails.transmission}
                        onChange={(e) => setCarDetails(p => ({ ...p, transmission: e.target.value }))}
                        className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-sm focus:border-blue-500 outline-none"
                      >
                        <option value="">Select</option>
                        <option value="Manual">Manual</option>
                        <option value="Automatic">Automatic</option>
                        <option value="AMT">AMT</option>
                        <option value="CVT">CVT</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-neutral-300 mb-1">KM Driven</label>
                      <input
                        type="number"
                        value={carDetails.mileage}
                        onChange={(e) => setCarDetails(p => ({ ...p, mileage: e.target.value }))}
                        className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-sm focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-300 mb-1">Price (₹)</label>
                      <input
                        type="number"
                        value={carDetails.price}
                        onChange={(e) => setCarDetails(p => ({ ...p, price: e.target.value }))}
                        className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-sm focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-neutral-300 mb-1">Theme</label>
                    <select
                      value={genCfg.theme}
                      onChange={(e) => setGenCfg(p => ({ ...p, theme: e.target.value as 'white' | 'black' }))}
                      className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-sm focus:border-blue-500 outline-none"
                    >
                      <option value="white">White Border</option>
                      <option value="black">Black Border</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-300 mb-1">Border Margin: {genCfg.marginPct}%</label>
                    <input
                      type="range"
                      min={2}
                      max={15}
                      step={1}
                      value={genCfg.marginPct}
                      onChange={(e) => setGenCfg(p => ({ ...p, marginPct: Number(e.target.value) }))}
                      className="w-full h-2 bg-neutral-800 rounded-lg cursor-pointer accent-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-300 mb-1">Text Area Height: {genCfg.textArea}px</label>
                    <input
                      type="range"
                      min={60}
                      max={640}
                      step={10}
                      value={genCfg.textArea}
                      onChange={(e) => setGenCfg(p => ({ ...p, textArea: Number(e.target.value) }))}
                      className="w-full h-2 bg-neutral-800 rounded-lg cursor-pointer accent-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-300 mb-1">Title Size: {genCfg.titleSize}px</label>
                    <input
                      type="range"
                      min={48}
                      max={244}
                      step={2}
                      value={genCfg.titleSize}
                      onChange={(e) => setGenCfg(p => ({ ...p, titleSize: Number(e.target.value) }))}
                      className="w-full h-2 bg-neutral-800 rounded-lg cursor-pointer accent-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-300 mb-1">Details Size: {genCfg.tagSize}px</label>
                    <input
                      type="range"
                      min={18}
                      max={48}
                      step={1}
                      value={genCfg.tagSize}
                      onChange={(e) => setGenCfg(p => ({ ...p, tagSize: Number(e.target.value) }))}
                      className="w-full h-2 bg-neutral-800 rounded-lg cursor-pointer accent-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-300 mb-1">Logo Size: {genCfg.logoSize}px</label>
                    <input
                      type="range"
                      min={24}
                      max={300}
                      step={1}
                      value={genCfg.logoSize}
                      onChange={(e) => setGenCfg(p => ({ ...p, logoSize: Number(e.target.value) }))}
                      className="w-full h-2 bg-neutral-800 rounded-lg cursor-pointer accent-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-300 mb-1">Logo Position</label>
                    <select
                      value={genCfg.logoPos === 'top-center' ? 'top-center' : (genCfg.logoPos.endsWith('left') ? 'left' : 'right')}
                      onChange={(e) => {
                        const val = e.target.value as 'left' | 'right' | 'top-center';
                        if (val === 'top-center') {
                          setGenCfg(p => ({ ...p, logoPos: 'top-center' }));
                        } else {
                          setGenCfg(p => {
                            const isTop = p.logoPos === 'top-center' ? true : p.logoPos.startsWith('top-');
                            const newPos = `${isTop ? 'top' : 'bottom'}-${val}` as GenConfig['logoPos'];
                            return { ...p, logoPos: newPos };
                          });
                        }
                      }}
                      className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-sm focus:border-blue-500 outline-none"
                    >
                      <option value="center">Center</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </div>

                  {/* Video Settings */}
                  {mode==='video' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-neutral-300 mb-1">FPS</label>
                        <select
                          value={reelFps}
                          onChange={(e) => setReelFps(Number(e.target.value) === 30 ? 30 : 24)}
                          className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-sm focus:border-blue-500 outline-none"
                        >
                          <option value={24}>24 fps (recommended)</option>
                          <option value={30}>30 fps</option>
                        </select>
                      </div>
                      <div className="flex items-end">
                        <label className="inline-flex items-center gap-2 text-xs text-neutral-300">
                          <input type="checkbox" className="accent-blue-500" checked={includeAudio} onChange={(e)=>setIncludeAudio(e.target.checked)} />
                          Include audio
                        </label>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-neutral-300 mb-1">Trim End: {Math.min(trimEndSec, Math.max(0, Math.floor(videoDuration)))}s {videoDuration>0 && `(of ${Math.min(30, Math.floor(videoDuration))}s)`}</label>
                        <input
                          type="range"
                          min={1}
                          max={Math.max(1, Math.min(30, Math.floor(videoDuration || 30)))}
                          step={1}
                          value={Math.min(trimEndSec, Math.min(30, Math.floor(videoDuration || 30)))}
                          onChange={(e)=>setTrimEndSec(Number(e.target.value))}
                          className="w-full h-2 bg-neutral-800 rounded-lg cursor-pointer accent-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {mode==='image' ? (
              <button
                onClick={generateImage}
                disabled={isGenerating || !isFormValid}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-gradient-to-r hover:from-blue-600 hover:to-purple-700 transition-all"
              >
                <Camera className="w-5 h-5" />
                {isGenerating ? 'Generating...' : 'Generate Instagram Posts'}
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={generateReel}
                  disabled={isRecording || !isFormValid}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2 hover:from-emerald-600 hover:to-teal-700 transition-all"
                >
                  <Camera className="w-5 h-5" />
                  {isRecording ? 'Generating Reel…' : 'Generate Reel (9:16)'}
                </button>
                {isRecording && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-neutral-800 rounded">
                      <div className="h-2 bg-emerald-600 rounded" style={{ width: `${Math.min(100, Math.max(0, Math.floor(recordProgress))) }%` }} />
                    </div>
                    <button
                      onClick={()=>cancelRef.current?.cancel()}
                      className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                    >Cancel</button>
                  </div>
                )}
              </div>
            )}
            
          </div>

          {/* Section 2: Live Preview */}
          <div className="w-full lg:w-1/3 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Palette className="w-5 h-5 text-purple-400" />
              Live Preview
            </h2>
            {previewUrls.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-neutral-800 rounded-lg bg-neutral-900/30">
                <ImageIcon className="w-8 h-8 text-neutral-600 mb-2" />
                <p className="text-sm text-neutral-300">No images loaded</p>
                <p className="text-xs text-neutral-500">Upload car photos to see the preview</p>
              </div>
            ) : (
              <div className="space-y-4">
                {styledPreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {styledPreviews.map((url, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentPreviewIndex(index)}
                        className={`rounded-lg border-2 ${index === currentPreviewIndex ? 'border-blue-500' : 'border-neutral-800'} hover:border-blue-400 transition-all`}
                      >
                        <img src={url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover rounded" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex justify-center">
                  <canvas ref={previewCanvasRef} className="max-w-full h-auto rounded-lg border border-neutral-800 shadow-lg" />
                </div>
                <p className="text-xs text-neutral-500 text-center">Instagram format (4:5) • 1080×1350px</p>
                <div className="flex justify-center">
                  <button
                    onClick={startOver}
                    className="px-3 py-1.5 text-sm bg-neutral-800 hover:bg-red-700 text-white rounded-md border border-neutral-700"
                  >
                    🔄 Start Over
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Generated (Images or Reels) */}
          <div className="w-full lg:w-1/3 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-green-400" />
                Generated {mode==='image'
                  ? (generatedImages.length > 0 ? `(${generatedImages.length})` : '')
                  : (generatedReels.length > 0 ? `(${generatedReels.length})` : '')}
              </h2>
              <div className="flex items-center gap-2">
                {mode==='image' && generatedImages.length > 0 && (
                  <button
                    onClick={() => generatedImages.forEach((img, i) => setTimeout(() => handleDownload(img.url), i * 120))}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm flex items-center gap-2 hover:bg-blue-900 transition-all"
                  >
                    {/* <Download className="w-4 h-4" /> */}
                    Download All
                  </button>
                )}
                {mode==='image' && generatedImages.length > 0 && (
                  <button
                    onClick={saveAllToLibrary}
                    disabled={isSaving}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm flex items-center gap-2 hover:bg-green-900 transition-all disabled:opacity-50"
                  >
                    Save All
                  </button>
                )}
              </div>
            </div>
            {mode==='image' ? (
              generatedImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {generatedImages.map((img) => (
                    <div key={img.id} className="relative rounded-lg border border-neutral-800 bg-neutral-900/60">
                      <img src={img.url} alt="Generated car listing" className="w-full h-auto rounded" />
                      <div className="p-2 bg-neutral-900/80 border-t border-neutral-800">
                        <p className="text-xs text-neutral-400 truncate mb-2">{img.caption}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDownload(img.url)}
                            className="flex-1 py-1 bg-blue-600 text-white rounded text-sm flex items-center justify-center gap-1 hover:bg-blue-700 transition-all"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => saveOneToLibrary(img)}
                            disabled={isSaving}
                            className="flex-1 py-1 bg-green-600 text-white rounded text-sm flex items-center justify-center gap-1 hover:bg-green-700 transition-all disabled:opacity-50"
                          >
                            🗃️
                          </button>
                          <button
                            onClick={() => setGeneratedImages(prev => prev.filter(g => g.id !== img.id))}
                            className="px-2 py-1 bg-neutral-800 text-neutral-300 rounded hover:bg-red-600 hover:text-white transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-neutral-800 rounded-lg bg-neutral-900/30">
                  <ImageIcon className="w-8 h-8 text-neutral-600 mb-2" />
                  <p className="text-sm text-neutral-300">No generated images yet</p>
                  <p className="text-xs text-neutral-500 text-center">Generate to create Instagram-ready posts</p>
                </div>
              )
            ) : (
              generatedReels.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {generatedReels.map((reel) => (
                    <div key={reel.id} className="relative rounded-lg border border-neutral-800 bg-neutral-900/60 p-2">
                      <video src={reel.url} controls className="w-full rounded" />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => { const a=document.createElement('a'); a.href=reel.url; a.download=`${reel.id}.${reel.mime.includes('mp4')?'mp4':'webm'}`; a.click(); }}
                          className="flex-1 py-1 bg-blue-600 text-white rounded text-sm flex items-center justify-center gap-1 hover:bg-blue-700 transition-all"
                        >
                          <Download className="w-4 h-4" /> Download
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const dealerId = getDealerIdFromPath(); if (!dealerId) throw new Error('Dealer ID not found in URL');
                              const res = await fetch(reel.url); const blob = await res.blob();
                              const path = `${dealerId}/${toYmdFolder()}/${reel.id}.${reel.mime.includes('mp4')?'mp4':'webm'}`;
                              const { error } = await supabase.storage.from('posts').upload(path, blob, { contentType: reel.mime, upsert: false });
                              if (error) throw error; alert('✓ Reel saved to library');
                            } catch (e) { console.error(e); alert('✗ Failed to save reel'); }
                          }}
                          className="flex-1 py-1 bg-green-600 text-white rounded text-sm flex items-center justify-center gap-1 hover:bg-green-700 transition-all"
                        >
                          🗃️ Save
                        </button>
                        <button
                          onClick={() => setGeneratedReels(prev => prev.filter(r => r.id !== reel.id))}
                          className="px-2 py-1 bg-neutral-800 text-neutral-300 rounded hover:bg-red-600 hover:text-white transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-neutral-800 rounded-lg bg-neutral-900/30">
                  <ImageIcon className="w-8 h-8 text-neutral-600 mb-2" />
                  <p className="text-sm text-neutral-300">No generated reels yet</p>
                  <p className="text-xs text-neutral-500 text-center">Generate to create Instagram-ready reels</p>
                </div>
              )
            )}
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
