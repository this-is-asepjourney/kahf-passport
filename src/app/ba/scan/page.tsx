'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import Link from 'next/link';

export default function BaScanPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const scannerRef = useRef<{ clear: () => void } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user && !['ba', 'admin_region', 'super_admin'].includes(user.role ?? '')) {
      router.replace('/');
    }
  }, [user, loading]);

  const startScanner = async () => {
    setError('');
    setScanning(true);

    try {
      const { Html5QrcodeScanner } = await import('html5-qrcode');
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scanner.render(
        async (decodedText: string) => {
          if (processing) return;
          setProcessing(true);
          scanner.clear();
          scannerRef.current = null;
          setScanning(false);

          // Extract token from URL
          const match = decodedText.match(/\/p\/([^/?]+)/);
          if (!match) {
            setError('QR tidak dikenali. Pastikan ini adalah QR Passport Khaf.');
            setProcessing(false);
            return;
          }

          const token = match[1];
          try {
            // Import doc & getDoc dynamically or statically (we already import from 'firebase/firestore' in the file or we can just import them)
            const { doc, getDoc } = await import('firebase/firestore');
            const { db } = await import('@/lib/firebase/client');
            
            const tokenDoc = await getDoc(doc(db, 'qrTokens', token));
            if (!tokenDoc.exists() || !tokenDoc.data()?.isActive) {
              setError('QR Code tidak valid atau sudah kadaluarsa.');
              setProcessing(false);
              return;
            }
            const customerId = tokenDoc.data()?.customerId;
            router.push(`/ba/customers/${customerId}`);
          } catch (e) {
            setError('Gagal memproses QR Code.');
            setProcessing(false);
          }
        },
        (err: string) => {
          // Ignore scan errors (just means QR not found in frame yet)
        }
      );
      scannerRef.current = scanner;
    } catch {
      setError('Gagal memulai kamera. Pastikan izin kamera sudah diberikan.');
      setScanning(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScanning(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="gradient-hero px-6 pt-12 pb-8">
        <div className="flex items-center gap-3">
          <Link href="/ba" className="text-white/80 hover:text-white transition-colors">←</Link>
          <h1 className="text-xl font-bold text-white">Scan QR Passport</h1>
        </div>
        <p className="text-white/60 text-sm mt-1 ml-8">Arahkan kamera ke QR customer</p>
      </div>

      <div className="px-6 -mt-4 pb-8 space-y-4">
        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm animate-in">
            {error}
          </div>
        )}

        {/* QR Scanner Container */}
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden animate-in">
          {!scanning && !processing ? (
            <div className="p-8 text-center">
              <div className="w-24 h-24 gradient-hero rounded-3xl flex items-center justify-center mx-auto mb-6">
                <span className="text-5xl">📷</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Siap Scan QR</h2>
              <p className="text-sm text-gray-500 mb-6">
                Klik tombol di bawah untuk membuka kamera dan scan QR Passport customer.
              </p>
              <button
                onClick={startScanner}
                className="w-full py-4 rounded-2xl gradient-hero text-white font-semibold hover:opacity-90 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 shadow-lg"
              >
                📷 Mulai Scan
              </button>
            </div>
          ) : processing ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Memproses QR...</p>
            </div>
          ) : null}

          {/* QR Reader element */}
          <div id="qr-reader" ref={containerRef} className={scanning ? 'block' : 'hidden'} />

          {scanning && (
            <div className="p-4">
              <button
                onClick={stopScanner}
                className="w-full py-3 rounded-2xl border-2 border-gray-200 text-gray-700 font-semibold hover:border-red-300 hover:text-red-600 transition-all"
              >
                ✕ Batal
              </button>
            </div>
          )}
        </div>

        {/* Manual search fallback */}
        <div className="bg-white rounded-3xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-2">Tidak bisa scan?</h3>
          <p className="text-sm text-gray-500 mb-3">Cari customer berdasarkan nomor HP atau nama.</p>
          <Link
            href="/ba/customers"
            className="block w-full py-3 px-4 rounded-2xl bg-purple-50 border border-purple-100 text-purple-700 font-semibold text-sm text-center hover:bg-purple-100 transition-colors"
          >
            🔍 Cari Customer Manual
          </Link>
        </div>
      </div>
    </div>
  );
}
