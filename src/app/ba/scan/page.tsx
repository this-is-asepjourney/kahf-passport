'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import Link from 'next/link';
import { doc, getDoc, collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/client';
import QRCode from 'react-qr-code';
import jsQR from 'jsqr';
import type { Customer, Product, Purchase } from '@/types';
import { formatIDR, formatDate } from '@/lib/utils';
import {
  Search,
  ArrowLeft,
  QrCode,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Users,
  ExternalLink,
} from 'lucide-react';

export default function BaScanAndBarcodePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-4 border-[#E2F0EF] border-t-[#277A73] animate-spin" />
        </div>
      }
    >
      <BaScanAndBarcodeContent />
    </Suspense>
  );
}

function BaScanAndBarcodeContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramCustomerId = searchParams.get('customerId') || '';

  // Mode: 'generate' (BA selects customer and shows barcode) vs 'camera' (BA scans QR)
  const [activeTab, setActiveTab] = useState<'generate' | 'camera'>('generate');

  // Customer Search & Selection State
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerPurchases, setCustomerPurchases] = useState<Purchase[]>([]);

  // Purchase Recording Form State
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [cartItems, setCartItems] = useState<{ productId: string; productName: string; sku: string; qty: number; unitPrice: number; subtotal: number }[]>([]);
  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false);
  const [transactionSuccess, setTransactionSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Camera Scanner States (Alternative)
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isScanningActiveRef = useRef<boolean>(false);

  // Auth Guard
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
      return;
    }
    if (!loading && user && !['ba', 'admin_region', 'super_admin'].includes(user.role ?? '')) {
      router.replace('/');
    }
  }, [user, loading, router]);

  // Load purchases when a customer is selected
  const loadCustomerPurchases = useCallback(async (customerId: string) => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/purchases?customerId=${encodeURIComponent(customerId)}`, {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      });
      const data = await res.json();
      if (data.purchases) {
        setCustomerPurchases(data.purchases);
      }
      if (data.customer) {
        setSelectedCustomer((prev) => (prev && prev.id === customerId ? { ...prev, ...data.customer } : prev));
      }
    } catch (err) {
      console.error('Error loading customer purchases:', err);
    }
  }, []);

  const selectCustomer = useCallback((c: Customer) => {
    setSelectedCustomer(c);
    setCartItems([]);
    setTransactionSuccess(false);
    setErrorMsg(null);
    loadCustomerPurchases(c.id);
  }, [loadCustomerPurchases]);

  // Load Recent Customers and Products
  useEffect(() => {
    const initData = async () => {
      try {
        const [custSnap, prodSnap] = await Promise.all([
          getDocs(query(collection(db, 'customers'), orderBy('updatedAt', 'desc'), limit(8))),
          getDocs(query(collection(db, 'products'), where('status', '==', 'active'), limit(50))),
        ]);

        const custs = custSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));
        setRecentCustomers(custs);

        const prods = prodSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
        setProducts(prods);
        if (prods.length > 0) {
          setSelectedProductId(prods[0].id);
        }

        // Auto-select customer if customerId query param is provided
        if (paramCustomerId) {
          const directDoc = await getDoc(doc(db, 'customers', paramCustomerId));
          if (directDoc.exists()) {
            selectCustomer({ id: directDoc.id, ...directDoc.data() } as Customer);
          }
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    };

    if (user) {
      initData();
    }
  }, [user, paramCustomerId, selectCustomer]);

  // Handle Search using unified intelligent customer search API
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const qText = searchQuery.trim();
    if (!qText) return;

    setSearching(true);
    setErrorMsg(null);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(qText)}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      const matched = (data.customers || []) as Customer[];

      setSearchResults(matched);
      if (matched.length === 1) {
        selectCustomer(matched[0]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal mencari customer';
      setErrorMsg(message);
    } finally {
      setSearching(false);
    }
  };

  // Add Item to Purchase Cart
  const handleAddItem = () => {
    const product = products.find((p) => p.id === selectedProductId);
    if (!product || itemQty <= 0) return;

    const existingIdx = cartItems.findIndex((it) => it.productId === product.id);
    if (existingIdx >= 0) {
      const updated = [...cartItems];
      updated[existingIdx].qty += itemQty;
      updated[existingIdx].subtotal = updated[existingIdx].qty * updated[existingIdx].unitPrice;
      setCartItems(updated);
    } else {
      setCartItems((prev) => [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku || '',
          qty: itemQty,
          unitPrice: product.defaultPrice,
          subtotal: itemQty * product.defaultPrice,
        },
      ]);
    }
    setItemQty(1);
  };

  const handleRemoveItem = (index: number) => {
    setCartItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const totalAmount = cartItems.reduce((sum, item) => sum + item.subtotal, 0);

  // Submit Purchase
  const handleSubmitPurchase = async () => {
    if (!selectedCustomer || cartItems.length === 0) return;

    setIsSubmittingPurchase(true);
    setErrorMsg(null);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Sesi login telah berakhir');

      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          storeId: user?.storeId || undefined,
          invoiceNo: `WRD-${Date.now().toString().slice(-6)}`,
          purchasedAt: new Date().toISOString(),
          items: cartItems,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan transaksi');

      setTransactionSuccess(true);
      setCartItems([]);

      // Update selected customer state immediately
      if (data.customer) {
        setSelectedCustomer((prev) => (prev ? { ...prev, ...data.customer } : prev));
      }

      // Update recent customers in state to reflect purchase count and total spent
      setRecentCustomers((prev) =>
        prev.map((c) =>
          c.id === selectedCustomer.id
            ? {
                ...c,
                purchaseCount: (c.purchaseCount || 0) + 1,
                totalSpent: (c.totalSpent || 0) + totalAmount,
                lastPurchaseAt: new Date().toISOString(),
              }
            : c
        )
      );

      await loadCustomerPurchases(selectedCustomer.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan pembelian';
      setErrorMsg(message);
    } finally {
      setIsSubmittingPurchase(false);
    }
  };

  // Camera Scanner Functions (Alternative Mode)
  const stopCamera = useCallback(() => {
    isScanningActiveRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleCameraScanResult = useCallback(
    async (codeData: string) => {
      stopCamera();
      let customerId = '';
      if (codeData.includes('/p/')) {
        const token = codeData.split('/p/')[1].split('?')[0];
        const snap = await getDocs(
          query(collection(db, 'customers'), where('qrTokenId', '==', token), limit(1))
        );
        if (!snap.empty) {
          customerId = snap.docs[0].id;
        }
      } else if (codeData.includes('c=')) {
        customerId = new URL(codeData, window.location.origin).searchParams.get('c') || '';
      }

      if (customerId) {
        router.push(`/ba/customers/${customerId}`);
      } else {
        router.push(`/ba/customers/${codeData}`);
      }
    },
    [router, stopCamera]
  );

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
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height);
        if (code && code.data) {
          handleCameraScanResult(code.data);
          return;
        }
      }
    }
    if (isScanningActiveRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
    }
  }, [handleCameraScanResult]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        isScanningActiveRef.current = true;
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menyalakan kamera';
      setCameraError(message);
    }
  }, [scanFrame, stopCamera]);

  useEffect(() => {
    if (activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeTab, startCamera, stopCamera]);

  const barcodeCustomerUrl = selectedCustomer
    ? typeof window !== 'undefined'
      ? `${window.location.origin}/passport/purchases?c=${selectedCustomer.id}&scanned=true&v=${selectedCustomer.purchaseCount || 0}`
      : `${selectedCustomer.id}`
    : '';

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="bg-gradient-to-r from-[#277A73] to-[#1E6560] px-6 pt-10 pb-8 text-white shadow-md">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/ba" className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <span>Kasir & Barcode Riwayat</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white/20">
                  Wardah
                </span>
              </h1>
              <p className="text-white/80 text-xs mt-0.5">
                Pilih customer, update produk yang dibeli, dan tampilkan barcode untuk di-scan oleh customer
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex bg-black/20 p-1 rounded-xl border border-white/20">
            <button
              onClick={() => setActiveTab('generate')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'generate' ? 'bg-white text-[#277A73] shadow-xs' : 'text-white/80 hover:text-white'
              }`}
            >
              Barcode Riwayat
            </button>
            <button
              onClick={() => setActiveTab('camera')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'camera' ? 'bg-white text-[#277A73] shadow-xs' : 'text-white/80 hover:text-white'
              }`}
            >
              Scan Kamera BA
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 -mt-4 max-w-4xl mx-auto space-y-6">
        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="font-bold text-rose-500">✕</button>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 1: PILIH CUSTOMER, UPDATE BELANJA & TAMPILKAN BARCODE       */}
        {/* ============================================================== */}
        {activeTab === 'generate' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Search & Customer Selection (7 cols) */}
            <div className="lg:col-span-7 space-y-5">
              {/* Search Bar */}
              <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
                <label className="text-xs font-bold text-gray-700 block">
                  Cari Pelanggan (Nama / Nomor HP / Member ID)
                </label>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Ketik nomor HP (08...) atau nama..."
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#277A73] focus:ring-1 focus:ring-[#277A73]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={searching}
                    className="px-4 py-2.5 bg-[#277A73] text-white font-bold text-xs rounded-xl hover:bg-[#1E6560] transition-colors shrink-0 shadow-xs"
                  >
                    {searching ? 'Mencari...' : 'Cari'}
                  </button>
                </form>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="pt-2 border-t border-gray-50 space-y-2">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      Hasil Pencarian ({searchResults.length})
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {searchResults.map((cust) => (
                        <button
                          key={cust.id}
                          onClick={() => selectCustomer(cust)}
                          className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                            selectedCustomer?.id === cust.id
                              ? 'border-[#277A73] bg-[#E8F6F4]/50 font-bold'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold text-gray-900">{cust.fullName}</p>
                            <p className="text-[10px] text-gray-500">{cust.phone} • ID: {cust.memberNo}</p>
                          </div>
                          <span className="text-[11px] text-[#277A73] font-bold">Pilih →</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Pick: Recent Customers */}
              {!selectedCustomer && recentCustomers.length > 0 && (
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#277A73]" />
                    <span>Pilih Cepat Pelanggan Terakhir:</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {recentCustomers.map((cust) => (
                      <button
                        key={cust.id}
                        onClick={() => selectCustomer(cust)}
                        className="p-3 rounded-2xl border border-gray-100 hover:border-[#277A73] text-left hover:bg-[#E8F6F4]/30 transition-all flex items-center justify-between"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-gray-900 truncate">{cust.fullName}</p>
                          <p className="text-[10px] text-gray-500 font-mono mt-0.5">{cust.phone}</p>
                        </div>
                        <span className="text-xs text-[#277A73]">→</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Form Update Apa Saja yang Dibeli Customer */}
              {selectedCustomer && (
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div>
                      <span className="text-[10px] font-bold text-[#277A73] bg-[#E8F6F4] px-2 py-0.5 rounded-full">
                        Pelanggan Aktif
                      </span>
                      <h3 className="text-base font-bold text-gray-900 mt-1">{selectedCustomer.fullName}</h3>
                      <p className="text-xs text-gray-500 font-mono">{selectedCustomer.phone} • ID: {selectedCustomer.memberNo}</p>
                    </div>
                    <Link
                      href={`/ba/customers/${selectedCustomer.id}`}
                      className="text-xs text-[#277A73] font-bold hover:underline flex items-center gap-1"
                    >
                      <span>Profil Lengkap</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {/* Add Product Items to Purchase */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-700 block">
                      Update Apa Saja yang Dibeli Customer Hari Ini:
                    </label>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-[#277A73] bg-white"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {formatIDR(p.defaultPrice)}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={itemQty}
                          onChange={(e) => setItemQty(Math.max(1, Number(e.target.value)))}
                          className="w-16 px-2 py-2 text-xs border border-gray-200 rounded-xl text-center font-bold"
                          title="Jumlah item"
                        />
                        <button
                          type="button"
                          onClick={handleAddItem}
                          className="px-3.5 py-2 bg-[#277A73] text-white font-bold text-xs rounded-xl hover:bg-[#1E6560] transition-colors flex items-center gap-1 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah</span>
                        </button>
                      </div>
                    </div>

                    {/* Cart Items List */}
                    {cartItems.length > 0 && (
                      <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 space-y-2 mt-2">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          Daftar Pembelian Baru:
                        </p>
                        {cartItems.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                            <div>
                              <p className="font-semibold text-gray-900">{item.productName}</p>
                              <p className="text-[10px] text-gray-500">{item.qty} × {formatIDR(item.unitPrice)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#277A73]">{formatIDR(item.subtotal)}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-gray-400 hover:text-red-500 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}

                        <div className="pt-2 flex justify-between items-center font-bold text-sm text-gray-900 border-t border-gray-200">
                          <span>Total Belanja:</span>
                          <span className="text-[#277A73]">{formatIDR(totalAmount)}</span>
                        </div>

                        <button
                          type="button"
                          onClick={handleSubmitPurchase}
                          disabled={isSubmittingPurchase}
                          className="w-full mt-2 py-2.5 bg-[#277A73] hover:bg-[#1E6560] text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2"
                        >
                          {isSubmittingPurchase ? (
                            <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Simpan Transaksi & Update Barcode</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {transactionSuccess && (
                      <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Transaksi berhasil disimpan! Barcode di sebelah kanan telah diperbarui.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: High-Contrast Barcode for Customer to Scan (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm text-center space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <QrCode className="w-5 h-5 text-[#277A73]" />
                  <h3 className="font-bold text-sm text-gray-900">
                    Barcode Riwayat Customer
                  </h3>
                </div>

                {selectedCustomer ? (
                  <div className="space-y-4 animate-in fade-in">
                    <p className="text-xs text-gray-500">
                      Tunjukkan barcode ini kepada <strong>{selectedCustomer.fullName}</strong> untuk di-scan melalui aplikasi Beauty Passport mereka.
                    </p>

                    {/* QR Code Container */}
                    <div className="p-4 bg-white rounded-2xl border-2 border-[#277A73]/20 shadow-md inline-block mx-auto">
                      <QRCode
                        value={barcodeCustomerUrl}
                        size={210}
                        level="H"
                        fgColor="#277A73"
                      />
                    </div>

                    {/* Stats summary of current customer */}
                    <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl text-xs border border-gray-100">
                      <span className="text-gray-500 font-medium">Total Transaksi:</span>
                      <span className="font-bold text-[#277A73]">
                        {selectedCustomer.purchaseCount || 0}x ({formatIDR(selectedCustomer.totalSpent || 0)})
                      </span>
                    </div>

                    <div className="p-3 bg-[#E8F6F4] rounded-2xl text-[11px] text-[#277A73] font-medium leading-relaxed space-y-1">
                      <p>
                        📱 <strong>Customer cukup buka menu &apos;Passport&apos;</strong> di HP mereka dan scan barcode ini untuk melihat riwayat belanja terbarunya.
                      </p>
                      <a
                        href={barcodeCustomerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold underline text-[10px] mt-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Buka Riwayat Pelanggan (Preview Tampilan Customer)</span>
                      </a>
                    </div>

                    {/* Customer Quick Purchases Summary */}
                    <div className="text-left border-t border-gray-100 pt-3 space-y-2">
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        Riwayat Transaksi Sebelumnya:
                      </p>
                      {customerPurchases.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Belum ada transaksi sebelumnya.</p>
                      ) : (
                        customerPurchases.slice(0, 3).map((p) => (
                          <div key={p.id} className="flex justify-between items-center text-xs py-1 border-b border-gray-50">
                            <div>
                              <p className="font-semibold text-gray-800">{formatIDR(p.totalAmount)}</p>
                              <p className="text-[10px] text-gray-400">{formatDate(p.purchasedAt)}</p>
                            </div>
                            <span className="text-[10px] font-mono text-gray-400">#{p.invoiceNo || p.id.slice(0, 6)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 border-2 border-dashed border-gray-200 rounded-2xl text-center space-y-2">
                    <span className="text-4xl block mb-2">👈</span>
                    <p className="font-bold text-xs text-gray-700">Pilih Pelanggan Terlebih Dahulu</p>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Gunakan kotak pencarian atau daftar pelanggan di sebelah kiri untuk menampilkan barcode riwayat belanja mereka.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: SCANNER KAMERA ALTERNATIF BAGI BA                        */}
        {/* ============================================================== */}
        {activeTab === 'camera' && (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm max-w-md mx-auto space-y-4 text-center">
            <h3 className="font-bold text-sm text-gray-900">Scan Barcode / QR Customer</h3>
            <p className="text-xs text-gray-500">
              Arahkan kamera ke QR code customer jika customer ingin menunjukkan kartunya kepada Anda.
            </p>

            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-black shadow-inner">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-0 border-2 border-[#277A73]/70 pointer-events-none rounded-2xl" />
              {cameraError && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 text-white text-xs font-semibold">
                  {cameraError}
                </div>
              )}
            </div>

            <button
              onClick={() => setActiveTab('generate')}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
            >
              Kembali ke Pembuat Barcode Riwayat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
