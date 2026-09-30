'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import Link from 'next/link';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import jsQR from 'jsqr';
import {
  Camera,
  RefreshCw,
  Zap,
  ZapOff,
  Search,
  ArrowLeft,
  AlertCircle,
  Play,
  Pause,
  UploadCloud,
  CheckCircle2,
} from 'lucide-react';

export default function BaScanPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Scanner States - Live streaming active by default
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStarting, setStreamStarting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [isSecureContextEnv, setIsSecureContextEnv] = useState(true);

  // Manual Input State
  const [manualCode, setManualCode] = useState('');
  const [manualSearching, setManualSearching] = useState(false);
  const [showManualSection, setShowManualSection] = useState(false);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Check user role
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
      return;
    }
    if (!loading && user && !['ba', 'admin_region', 'super_admin'].includes(user.role ?? '')) {
      router.replace('/');
    }
  }, [user, loading, router]);

  // Environment checks
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isSec =
        window.isSecureContext ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
      setIsSecureContextEnv(Boolean(isSec));
    }
  }, []);

  // Stop camera media stream
  const stopCameraStream = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setStreamStarting(false);
    setTorchOn(false);
  }, []);

  // Audio & Haptic Feedback on successful QR detection
  const triggerSuccessFeedback = () => {
    // 1. Haptic vibration (mobile devices)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([60, 40, 90]);
      } catch {}
    }

    // 2. Synthesize a pleasant chime tone via Web Audio API (zero external assets needed)
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12); // E6 note
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.16);
      }
    } catch {}
  };

  // Helper to resolve customer from QR text, URL, token, memberNo, or phone
  const resolveCustomer = async (rawText: string) => {
    const text = rawText.trim();
    if (!text) {
      throw new Error('Kode QR tidak terbaca atau kosong.');
    }

    // 1. Try URL pattern: .../p/{token}
    let token = '';
    const urlMatch = text.match(/\/p\/([^/?#]+)/);
    if (urlMatch) {
      token = urlMatch[1];
    } else if (text.startsWith('http://') || text.startsWith('https://')) {
      try {
        const u = new URL(text);
        token = u.searchParams.get('token') || u.searchParams.get('qr') || '';
      } catch {
        // continue
      }
    }

    if (!token) {
      token = text;
    }

    // Parallel Primary Lookup: Direct Customer ID, qrTokenId, qrTokens doc, and memberNo
    const directCustomerPromise = getDoc(doc(db, 'customers', token))
      .then((snap) => (snap.exists() ? snap.id : null))
      .catch(() => null);

    const qrTokenIdPromise = getDocs(query(collection(db, 'customers'), where('qrTokenId', '==', token)))
      .then((snap) => (!snap.empty ? snap.docs[0].id : null))
      .catch(() => null);

    const qrTokensPromise = getDoc(doc(db, 'qrTokens', token))
      .then((snap) => (snap.exists() && snap.data()?.customerId ? snap.data().customerId : null))
      .catch(() => null);

    const memberNoPromise = getDocs(
      query(collection(db, 'customers'), where('memberNo', '==', token.toUpperCase()))
    )
      .then((snap) => (!snap.empty ? snap.docs[0].id : null))
      .catch(() => null);

    const primaryResults = await Promise.all([
      directCustomerPromise,
      qrTokenIdPromise,
      qrTokensPromise,
      memberNoPromise,
    ]);

    for (const foundId of primaryResults) {
      if (foundId) return foundId;
    }

    // Secondary Lookup (Phone or PublicId if primary did not match)
    const cleanPhone = token.replace(/[^0-9]/g, '');
    const phonePromise =
      cleanPhone.length >= 8
        ? getDocs(query(collection(db, 'customers'), where('phone', '==', cleanPhone)))
            .then((snap) => (!snap.empty ? snap.docs[0].id : null))
            .catch(() => null)
        : Promise.resolve(null);

    const publicIdPromise = getDocs(
      query(collection(db, 'customers'), where('publicId', '==', token.toLowerCase()))
    )
      .then((snap) => (!snap.empty ? snap.docs[0].id : null))
      .catch(() => null);

    const secondaryResults = await Promise.all([phonePromise, publicIdPromise]);
    for (const foundId of secondaryResults) {
      if (foundId) return foundId;
    }

    throw new Error('Data QR atau Customer tidak ditemukan. Pastikan QR valid atau cari secara manual.');
  };

  // Handle successful QR detection
  const handleSuccess = useCallback(
    async (decodedText: string) => {
      if (processing) return;
      setProcessing(true);
      setError(null);

      // Trigger feedback (sound + vibration)
      triggerSuccessFeedback();

      // Stop camera streaming immediately to freeze on success
      stopCameraStream();

      try {
        const customerId = await resolveCustomer(decodedText);
        router.prefetch(`/ba/customers/${customerId}`);
        router.push(`/ba/customers/${customerId}`);
      } catch (err: any) {
        setError(err.message || 'Gagal memproses QR Code.');
        setProcessing(false);
      }
    },
    [processing, router, stopCameraStream]
  );

  // High-performance real-time video frame scanner loop
  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2 || video.paused) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const now = performance.now();
    // Throttle scan rate to every 85ms (~12 scans/sec) for instant detection with zero UI lag
    if (now - lastScanTimeRef.current >= 85) {
      lastScanTimeRef.current = now;

      if (video.videoWidth > 0 && video.videoHeight > 0) {
        // Downscale to max 640px width for 4x faster jsQR execution
        const scale = Math.min(1, 640 / video.videoWidth);
        const targetW = Math.round(video.videoWidth * scale);
        const targetH = Math.round(video.videoHeight * scale);

        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (ctx) {
          ctx.drawImage(video, 0, 0, targetW, targetH);

          // Priority 1: Hardware-accelerated native BarcodeDetector (Chrome, Edge, Android)
          let detected = false;
          if (typeof (window as any).BarcodeDetector !== 'undefined') {
            try {
              const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
              detector
                .detect(canvas)
                .then((barcodes: any[]) => {
                  if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                    detected = true;
                    handleSuccess(barcodes[0].rawValue);
                  }
                })
                .catch(() => {});
            } catch {}
          }

          // Priority 2: jsQR decoding fallback (universally works on iOS Safari & all browsers)
          if (!detected) {
            try {
              const imageData = ctx.getImageData(0, 0, targetW, targetH);
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
              });

              if (code && code.data && code.data.trim()) {
                handleSuccess(code.data.trim());
                return; // Stop scheduling frames while redirecting
              }
            } catch {}
          }
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  }, [handleSuccess]);

  // Start live camera streaming with multi-tier hardware resilience
  const startCameraStream = async (targetFacing: 'environment' | 'user' = facingMode) => {
    setError(null);
    setStreamStarting(true);

    // Stop any existing stream
    stopCameraStream();

    // Verify mediaDevices availability
    if (!navigator?.mediaDevices?.getUserMedia) {
      setStreamStarting(false);
      setError(
        'Browser membatasi streaming kamera pada protokol ini. Gunakan http://localhost:3000 atau buka via HTTPS untuk live camera streaming.'
      );
      return;
    }

    try {
      let stream: MediaStream | null = null;

      // Strategy 1: Ideal facingMode with 720p HD resolution
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (err1) {
        console.warn('Strategy 1 (ideal facingMode) failed:', err1);
      }

      // Strategy 2: Exact facingMode without resolution constraints
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: targetFacing },
            audio: false,
          });
        } catch (err2) {
          console.warn('Strategy 2 (exact facingMode) failed:', err2);
        }
      }

      // Strategy 3: Universal fallback (any available camera on laptops/webcams)
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch (err3) {
          console.warn('Strategy 3 (generic video) failed:', err3);
          throw err3;
        }
      }

      streamRef.current = stream;

      // Check flashlight/torch capability
      const track = stream.getVideoTracks()[0];
      const caps = (track?.getCapabilities?.() as any) || {};
      setHasTorch(Boolean(caps.torch));

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.setAttribute('autoplay', 'true');
        videoRef.current.muted = true;

        await videoRef.current.play();

        setIsStreaming(true);
        setStreamStarting(false);
        lastScanTimeRef.current = 0;
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: any) {
      console.error('Camera streaming init failed:', err);
      stopCameraStream();

      const errMsg = String(err?.message || err?.name || err).toLowerCase();
      if (errMsg.includes('notallowederror') || errMsg.includes('permission')) {
        setError('Izin kamera ditolak. Silakan izinkan akses kamera pada ikon gembok di address bar browser Anda.');
      } else if (errMsg.includes('notfounderror') || errMsg.includes('devicesnotfound')) {
        setError('Kamera tidak terdeteksi pada perangkat ini. Pastikan webcam/kamera terhubung.');
      } else if (errMsg.includes('notreadableerror') || errMsg.includes('could not start')) {
        setError('Kamera sedang digunakan oleh aplikasi lain (Zoom, Teams, atau tab lain). Tutup aplikasi tersebut dan coba lagi.');
      } else {
        setError('Gagal memulai streaming kamera: ' + (err?.message || String(err)));
      }
    }
  };

  // Auto-start streaming camera on mount
  useEffect(() => {
    let active = true;
    if (!loading && user && ['ba', 'admin_region', 'super_admin'].includes(user.role ?? '')) {
      const timer = setTimeout(() => {
        if (active) {
          startCameraStream('environment');
        }
      }, 250);

      return () => {
        active = false;
        clearTimeout(timer);
        stopCameraStream();
      };
    }
  }, [loading, user]);

  // Flip front/back camera
  const handleToggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCameraStream(nextMode);
  };

  // Toggle Torch/Flashlight
  const handleToggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch toggle error:', e);
    }
  };

  // Image File / Snapshot fallback handler
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('Gagal membaca gambar QR.');
          setProcessing(false);
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code && code.data) {
          handleSuccess(code.data);
        } else {
          setError('QR Code tidak terdeteksi dari foto ini. Pastikan foto fokus dan jelas.');
          setProcessing(false);
        }
      };
      img.onerror = () => {
        setError('Gagal membaca file foto.');
        setProcessing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Manual search by code or phone
  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    setManualSearching(true);
    setError(null);
    try {
      const customerId = await resolveCustomer(manualCode.trim());
      router.push(`/ba/customers/${customerId}`);
    } catch (err: any) {
      setError(err.message || 'Customer tidak ditemukan.');
    } finally {
      setManualSearching(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="w-8 h-8 rounded-full border-4 border-[#E2F0EF] border-t-[#2C5C59] animate-spin" />
      </div>
    );
  }

  const isHttpLan =
    !isSecureContextEnv &&
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="bg-gradient-to-r from-[#2C5C59] to-[#1F4240] px-6 pt-12 pb-10 text-white shadow-md">
        <div className="flex items-center gap-3">
          <Link
            href="/ba"
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span>Scan QR Passport</span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-[#6DB9B2]/30 text-[#A2E0DB] border border-[#6DB9B2]/40">
                Live Stream
              </span>
            </h1>
            <p className="text-white/70 text-xs mt-0.5">
              Mode streaming kamera langsung aktif untuk memindai Beauty Passport customer
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 -mt-5 space-y-4 max-w-xl mx-auto">
        {/* Error Notification Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3 shadow-sm animate-in">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Kendala Kamera</p>
              <p className="mt-1 leading-relaxed">{error}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => startCameraStream(facingMode)}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-colors shadow-sm"
                >
                  Coba Lagi
                </button>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-rose-200 text-rose-700 font-semibold text-xs hover:bg-rose-100 transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HTTP / LAN IP Notice */}
        {isHttpLan && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5 shadow-sm">
            <p className="font-bold flex items-center gap-1.5">
              <span>⚠️</span>
              <span>Akses Jaringan HTTP Terdeteksi</span>
            </p>
            <p className="text-[11px] leading-relaxed text-amber-800">
              Browser modern membatasi fitur streaming kamera jika dibuka via IP HTTP biasa. Buka via{' '}
              <strong>http://localhost:3000</strong> di laptop atau aktifkan HTTPS untuk streaming langsung di HP.
            </p>
          </div>
        )}

        {/* Processing State Overlay / Screen */}
        {processing && (
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 text-center animate-in">
            <div className="w-12 h-12 rounded-full border-4 border-[#E2F0EF] border-t-[#2C5C59] animate-spin mx-auto mb-3" />
            <div className="flex items-center justify-center gap-1.5 text-[#2C5C59] font-bold text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>QR Code Terdeteksi!</span>
            </div>
            <p className="text-gray-400 text-xs mt-1">Menghubungkan ke data Beauty Passport customer...</p>
          </div>
        )}

        {/* Main Live Camera Streaming Viewport */}
        {!processing && (
          <div className="bg-black rounded-3xl shadow-xl border border-gray-900 overflow-hidden relative min-h-[420px] flex flex-col justify-between">
            {/* Live HTML5 Video Stream */}
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              autoPlay
              muted
            />

            {/* Viewfinder Target & Laser Scanline Overlay */}
            {isStreaming && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-64 h-64 border-2 border-dashed border-[#6DB9B2]/50 rounded-3xl flex items-center justify-center shadow-2xl">
                  {/* High-visibility Brand Corner Accents */}
                  <div className="absolute -top-1 -left-1 w-9 h-9 border-t-4 border-l-4 border-[#6DB9B2] rounded-tl-2xl shadow-sm" />
                  <div className="absolute -top-1 -right-1 w-9 h-9 border-t-4 border-r-4 border-[#6DB9B2] rounded-tr-2xl shadow-sm" />
                  <div className="absolute -bottom-1 -left-1 w-9 h-9 border-b-4 border-l-4 border-[#6DB9B2] rounded-bl-2xl shadow-sm" />
                  <div className="absolute -bottom-1 -right-1 w-9 h-9 border-b-4 border-r-4 border-[#6DB9B2] rounded-br-2xl shadow-sm" />

                  {/* Pulsing Scan Laser Line */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#6DB9B2] to-transparent animate-pulse shadow-[0_0_16px_#6DB9B2]" />
                </div>
              </div>
            )}

            {/* Inactive / Camera Permission Prompt Overlay */}
            {!isStreaming && !streamStarting && (
              <div className="absolute inset-0 bg-[#162726]/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center text-white">
                <div className="w-16 h-16 rounded-3xl bg-[#2C5C59] border border-[#6DB9B2]/30 flex items-center justify-center text-3xl mb-4 shadow-lg">
                  <Camera className="w-8 h-8 text-[#A2E0DB]" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">Mode Streaming Kamera</h3>
                <p className="text-xs text-white/70 max-w-xs mb-6 leading-relaxed">
                  Posisikan QR Code pelanggan di depan kamera. Scanner akan otomatis mendeteksi kode secara real-time.
                </p>
                <button
                  type="button"
                  onClick={() => startCameraStream(facingMode)}
                  className="px-6 py-3.5 bg-gradient-to-r from-[#2C5C59] to-[#3a7975] text-white font-bold text-sm rounded-2xl hover:brightness-110 transition-all shadow-lg shadow-[#2C5C59]/40 flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Mulai Streaming Kamera</span>
                </button>
              </div>
            )}

            {/* Starting / Loading Overlay */}
            {streamStarting && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-white">
                <div className="w-10 h-10 rounded-full border-4 border-[#2C5C59] border-t-[#6DB9B2] animate-spin mb-3" />
                <p className="text-xs font-semibold text-white/90">Menghubungkan ke Kamera...</p>
              </div>
            )}

            {/* Top Bar Controls */}
            <div className="relative z-10 p-3.5 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
              {/* Status Badge */}
              <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-[11px] font-semibold flex items-center gap-2 border border-white/10">
                <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                <span>{isStreaming ? 'Streaming Aktif' : 'Kamera Siap'}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Torch Button (if hardware supported) */}
                {hasTorch && (
                  <button
                    type="button"
                    onClick={handleToggleTorch}
                    className={`p-2 rounded-full backdrop-blur-md transition-all ${
                      torchOn
                        ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/30'
                        : 'bg-black/60 text-white hover:bg-black/80 border border-white/20'
                    }`}
                    title={torchOn ? 'Matikan Senter' : 'Nyalakan Senter'}
                  >
                    {torchOn ? <ZapOff className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                  </button>
                )}

                {/* Flip Camera Button */}
                <button
                  type="button"
                  onClick={handleToggleFacingMode}
                  className="px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-[11px] font-semibold border border-white/20 transition-all flex items-center gap-1.5"
                  title="Ganti kamera belakang/depan"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{facingMode === 'environment' ? 'Belakang' : 'Depan'}</span>
                </button>
              </div>
            </div>

            {/* Bottom Bar: Quick Pause & Alternate Upload Option */}
            <div className="relative z-10 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between gap-3">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={stopCameraStream}
                  className="py-2 px-3.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-medium text-xs backdrop-blur-md border border-white/20 transition-all flex items-center gap-1.5"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Jeda Kamera</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startCameraStream(facingMode)}
                  className="py-2 px-3.5 rounded-xl bg-[#2C5C59] hover:bg-[#234b48] text-white font-semibold text-xs transition-all flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Lanjutkan Streaming</span>
                </button>
              )}

              {/* Secondary Upload Photo Fallback */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 text-[11px] font-medium transition-all flex items-center gap-1 border border-white/10"
                title="Pilih foto QR dari galeri jika kamera terkendala"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload Foto</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFile}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Manual Code / Phone Input Toggle & Form */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-[#2C5C59]" />
              <h3 className="font-bold text-gray-900 text-sm">Cari Manual Customer</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowManualSection(!showManualSection)}
              className="text-xs font-semibold text-[#2C5C59] hover:underline"
            >
              {showManualSection ? 'Sembunyikan' : 'Buka Pencarian'}
            </button>
          </div>

          {showManualSection && (
            <div className="mt-3 pt-3 border-t border-gray-100 animate-in">
              <p className="text-[11px] text-gray-500 mb-3">
                Masukkan Nomor HP pelanggan atau Nomor Member Kahf (contoh: KHF-...) jika customer tidak dapat menunjukkan QR.
              </p>
              <form onSubmit={handleManualSearch} className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="08123456789 atau KHF-..."
                  className="flex-1 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#6DB9B2] focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={manualSearching || !manualCode.trim()}
                  className="px-4 py-2.5 bg-[#2C5C59] text-white font-bold text-xs rounded-xl hover:bg-[#1f4240] transition-colors disabled:opacity-50 shrink-0 shadow-sm"
                >
                  {manualSearching ? 'Mencari...' : 'Cari'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Customer Database Navigation Link */}
        <div className="text-center pt-1">
          <Link
            href="/ba/customers"
            className="text-xs font-bold text-[#2C5C59] hover:underline inline-flex items-center gap-1.5"
          >
            <span>Buka Database Semua Customer →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

