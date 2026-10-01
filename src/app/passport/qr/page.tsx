/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { auth } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import Link from 'next/link';
import jsQR from 'jsqr';
import { PassportBottomNav } from '@/components/passport/PassportBottomNav';
import {
  Camera,
  QrCode as QrCodeIcon,
  Zap,
  ZapOff,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wardahbeauty.com';

export default function QrPage() {
  const { user, customer, setCustomer, loading } = useAuth();
  const router = useRouter();

  // Mode: 'scan' (Customer scans BA barcode) vs 'my_qr' (Customer views their own card)
  const [activeMode, setActiveMode] = useState<'scan' | 'my_qr'>('scan');
  const [regenerating, setRegenerating] = useState(false);

  // Camera Scanner States
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isScanningActiveRef = useRef<boolean>(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Stop camera media stream
  const stopCamera = useCallback(() => {
    isScanningActiveRef.current = false;
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
    setTorchOn(false);
  }, []);

  // Handle scanned result
  const handleScannedResult = useCallback((data: string) => {
    if (!data) return;

    // Haptic vibration
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([80, 50, 100]);
      } catch {}
    }

    setScanSuccess(true);
    stopCamera();

    // Redirect to purchases / riwayat
    setTimeout(() => {
      // Check if data is a URL or direct token
      if (data.includes('/p/') || data.includes('/passport/purchases')) {
        const url = new URL(data, window.location.origin);
        router.push(url.pathname + url.search);
      } else {
        router.push(`/passport/purchases?scanned=true&code=${encodeURIComponent(data)}`);
      }
    }, 700);
  }, [router, stopCamera]);

  // Scan frame loop using jsQR
  const scanFrame = useCallback(() => {
    if (!isScanningActiveRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          handleScannedResult(code.data);
          return;
        }
      }
    }

    if (isScanningActiveRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
    }
  }, [handleScannedResult]);

  // Start Camera Stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    setScanSuccess(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Perangkat Anda tidak mendukung akses kamera browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      // Check torch capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        setHasTorch(Boolean((capabilities as any).torch));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();

        setIsStreaming(true);
        isScanningActiveRef.current = true;
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setCameraError('Izin akses kamera ditolak. Silakan izinkan akses kamera di pengaturan browser.');
      } else {
        setCameraError('Gagal membuka kamera: ' + (err.message || 'Perangkat tidak tersedia'));
      }
    }
  }, [facingMode, scanFrame, stopCamera]);

  // Toggle Torch Flash
  const toggleTorch = async () => {
    if (!streamRef.current || !hasTorch) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        await (track as any).applyConstraints({
          advanced: [{ torch: !torchOn }],
        });
        setTorchOn(!torchOn);
      }
    } catch (e) {
      console.error('Torch toggle failed:', e);
    }
  };

  // Switch Camera
  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Start / Stop camera based on activeMode
  useEffect(() => {
    if (activeMode === 'scan') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [activeMode, startCamera, stopCamera]);

  // Re-run camera on facingMode change
  useEffect(() => {
    if (activeMode === 'scan') {
      startCamera();
    }
  }, [facingMode, activeMode, startCamera]);

  const handleRegenerate = async () => {
    if (!customer) return;
    setRegenerating(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/qr', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ customerId: customer.id }),
      });
      const result = await res.json();
      if (res.ok) {
        setCustomer({ ...customer, qrTokenId: result.newToken });
      }
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 rounded-full border-4 border-[#E2F0EF] border-t-[#277A73] animate-spin" />
      </div>
    );
  }

  const qrUrl = customer ? `${APP_URL}/p/${customer.qrTokenId}` : '';

  return (
    <div className="min-h-screen bg-[#F8FBFB] flex flex-col relative pb-24">
      {/* Hidden Canvas for QR frame processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header Bar */}
      <div className="px-6 pt-10 pb-4 z-20 relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/passport" className="text-[#277A73] p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Wardah Passport</h1>
            <p className="text-xs text-gray-500">Scan barcode atau tunjukkan kartu member</p>
          </div>
        </div>

        <span className="text-sm font-bold text-[#277A73] font-serif">Wardah</span>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="px-6 mb-4 z-20 relative">
        <div className="flex bg-gray-100/80 p-1 rounded-2xl border border-gray-200/60 max-w-sm mx-auto">
          <button
            type="button"
            onClick={() => setActiveMode('scan')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeMode === 'scan'
                ? 'bg-[#277A73] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Scan Barcode BA</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('my_qr')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeMode === 'my_qr'
                ? 'bg-[#277A73] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <QrCodeIcon className="w-3.5 h-3.5" />
            <span>Barcode Saya</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODE 1: CUSTOMER SCANS BA'S BARCODE (NEW CONCEPT)              */}
      {/* ============================================================== */}
      {activeMode === 'scan' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 z-10 relative">
          <div className="w-full max-w-sm space-y-4">
            {/* Viewfinder Container */}
            <div className="relative aspect-square w-full rounded-3xl overflow-hidden bg-black shadow-xl border-4 border-white">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
              />

              {/* Darkened Mask Overlays with Center Transparent Frame */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-8">
                <div className="w-64 h-64 border-2 border-white/60 rounded-2xl relative">
                  {/* Corner Accent Brackets (Signature Wardah Teal) */}
                  <div className="absolute -top-1 -left-1 w-7 h-7 border-t-4 border-l-4 border-[#277A73] rounded-tl-xl" />
                  <div className="absolute -top-1 -right-1 w-7 h-7 border-t-4 border-r-4 border-[#277A73] rounded-tr-xl" />
                  <div className="absolute -bottom-1 -left-1 w-7 h-7 border-b-4 border-l-4 border-[#277A73] rounded-bl-xl" />
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 border-b-4 border-r-4 border-[#277A73] rounded-br-xl" />

                  {/* Laser Scanning Animation Line */}
                  {isStreaming && !scanSuccess && (
                    <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#277A73] to-transparent animate-scan shadow-[0_0_12px_#277A73]" />
                  )}

                  {/* Scan Success Indicator */}
                  {scanSuccess && (
                    <div className="absolute inset-0 bg-[#277A73]/80 rounded-xl flex flex-col items-center justify-center text-white p-4 animate-in fade-in">
                      <CheckCircle2 className="w-12 h-12 mb-2 animate-bounce" />
                      <p className="font-bold text-sm text-center">Barcode Terdeteksi!</p>
                      <p className="text-[11px] text-white/80">Membuka riwayat belanja...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Camera Controls Overlay (Torch & Flip) */}
              <div className="absolute top-4 right-4 flex items-center gap-2 z-30">
                {hasTorch && (
                  <button
                    onClick={toggleTorch}
                    className="p-2.5 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition-colors"
                    title="Flashlight"
                  >
                    {torchOn ? <Zap className="w-4 h-4 text-amber-300" /> : <ZapOff className="w-4 h-4" />}
                  </button>
                )}
                <button
                  onClick={switchCamera}
                  className="p-2.5 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition-colors"
                  title="Putar Kamera"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Camera Error Display */}
              {cameraError && (
                <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center p-6 text-white text-center">
                  <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
                  <p className="text-xs font-semibold">{cameraError}</p>
                  <button
                    onClick={() => startCamera()}
                    className="mt-4 px-4 py-2 bg-[#277A73] rounded-xl text-xs font-bold"
                  >
                    Coba Lagi
                  </button>
                </div>
              )}
            </div>

            {/* Instruction Card */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs text-center space-y-1">
              <h3 className="font-bold text-xs text-gray-900">Arahkan ke Barcode Beauty Advisor</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Pindai barcode yang ditampilkan di layar Beauty Advisor untuk membuka riwayat transaksi & pembelian produk Wardah Anda.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODE 2: CUSTOMER'S OWN BARCODE & MEMBER CARD                   */}
      {/* ============================================================== */}
      {activeMode === 'my_qr' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 z-10 relative">
          <div className="text-center mb-6">
            <h2 className="text-xs text-[#277A73] font-bold tracking-widest uppercase mb-1">
              Kartu Digital Wardah
            </h2>
            <h1 className="text-2xl font-bold text-gray-900">
              Beauty Passport Member
            </h1>
          </div>

          {customer ? (
            <div className="flex flex-col items-center w-full max-w-xs">
              {/* QR Code Container */}
              <div className="relative p-6 bg-white shadow-xl rounded-3xl mb-6 border border-gray-100 text-center">
                <QRCode
                  value={qrUrl}
                  size={210}
                  level="H"
                  className="block mx-auto"
                  fgColor="#277A73"
                />

                {/* Corner markers */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#277A73] rounded-tl-3xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#277A73] rounded-tr-3xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#277A73] rounded-bl-3xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#277A73] rounded-br-3xl" />
              </div>

              <div className="text-center mb-6">
                <p className="text-base font-bold text-gray-900">{customer.fullName}</p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">ID: {customer.memberNo}</p>
              </div>

              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="py-2.5 px-6 bg-white border border-[#277A73] rounded-full text-[#277A73] font-bold text-xs hover:bg-[#277A73] hover:text-white transition-all disabled:opacity-50 shadow-xs"
              >
                {regenerating ? 'Memperbarui...' : 'Perbarui Barcode'}
              </button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-500 text-xs">Profil tidak ditemukan</p>
            </div>
          )}
        </div>
      )}

      {/* Slogan */}
      <div className="px-6 pt-4 pb-2 text-center text-[#277A73] text-xs font-medium italic relative z-10">
        Your Beauty Journey Our Priority 💙
      </div>

      {/* Bottom Navigation */}
      <PassportBottomNav activeTab="qr" />
    </div>
  );
}
