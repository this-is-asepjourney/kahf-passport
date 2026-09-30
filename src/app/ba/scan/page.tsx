'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Scanner } from '@yudiel/react-qr-scanner';

export default function BaScanPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user && !['ba', 'admin_region', 'super_admin'].includes(user.role ?? '')) {
      router.replace('/');
    }
  }, [user, loading, router]);

  const handleScan = async (detectedCodes: any[]) => {
    if (processing || !detectedCodes || detectedCodes.length === 0) return;
    
    const decodedText = detectedCodes[0].rawValue;
    if (!decodedText) return;

    setProcessing(true);
    setScanning(false); // Stop scanner immediately for UX

    // Extract token from URL
    const match = decodedText.match(/\/p\/([^/?]+)/);
    if (!match) {
      setError('QR tidak dikenali. Pastikan ini adalah QR Passport Kahf.');
      setProcessing(false);
      return;
    }

    const token = match[1];
    try {
      const tokenDoc = await getDoc(doc(db, 'qrTokens', token));
      if (!tokenDoc.exists() || !tokenDoc.data()?.isActive) {
        setError('QR Code tidak valid atau sudah kadaluarsa.');
        setProcessing(false);
        return;
      }
      const customerId = tokenDoc.data()?.customerId;
      // Preload halaman customer untuk transisi yang jauh lebih cepat
      router.prefetch(`/ba/customers/${customerId}`);
      router.push(`/ba/customers/${customerId}`);
    } catch (e) {
      console.error(e);
      setError('Gagal memproses QR Code.');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
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
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm animate-in">
            {error}
          </div>
        )}

        {/* QR Scanner Container */}
        <div className="bg-white dark:bg-card rounded-3xl shadow-sm overflow-hidden animate-in">
          {!scanning && !processing ? (
            <div className="p-8 text-center">
              <div className="w-24 h-24 gradient-hero rounded-3xl flex items-center justify-center mx-auto mb-6">
                <span className="text-5xl">📷</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Siap Scan QR</h2>
              <p className="text-sm text-gray-500 mb-6">
                Klik tombol di bawah untuk membuka kamera dan scan QR Passport customer.
              </p>
              <button
                onClick={() => {
                  setError('');
                  setScanning(true);
                }}
                className="w-full py-4 rounded-2xl gradient-hero text-white font-semibold hover:opacity-90 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 shadow-lg"
              >
                📷 Mulai Scan
              </button>
            </div>
          ) : processing ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Memproses QR...</p>
            </div>
          ) : null}

          {scanning && (
            <div className="relative">
              <Scanner 
                onScan={handleScan}
                onError={(err) => {
                  console.error(err);
                  // Jangan hentikan scan untuk error minor, biarkan user mencoba lagi
                }}
                formats={['qr_code']}
                components={{
                  audio: false,
                  finder: true, // Menampilkan kotak target
                }}
              />
              <div className="p-4 absolute bottom-0 left-0 right-0 z-10 bg-black/50 backdrop-blur-sm">
                <button
                  onClick={() => setScanning(false)}
                  className="w-full py-3 rounded-2xl bg-white/10 text-white font-semibold hover:bg-white/20 transition-all"
                >
                  ✕ Batal
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Manual search fallback */}
        <div className="bg-white dark:bg-card rounded-3xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Tidak bisa scan?</h3>
          <p className="text-sm text-gray-500 mb-3">Cari customer berdasarkan nomor HP atau nama.</p>
          <Link
            href="/ba/customers"
            className="block w-full py-3 px-4 rounded-2xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 text-purple-700 dark:text-purple-400 font-semibold text-sm text-center hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
          >
            🔍 Cari Customer Manual
          </Link>
        </div>
      </div>
    </div>
  );
}
