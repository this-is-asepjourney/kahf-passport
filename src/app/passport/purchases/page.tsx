'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Purchase } from '@/types';
import Link from 'next/link';
import { formatIDR, formatDateTime } from '@/lib/utils';
import { PassportBottomNav } from '@/components/passport/PassportBottomNav';
import { ArrowLeft, CheckCircle2, ShoppingBag, ChevronDown, Sparkles } from 'lucide-react';

export default function PurchasesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="w-8 h-8 rounded-full border-4 border-[#E2F0EF] border-t-[#277A73] animate-spin" />
        </div>
      }
    >
      <PurchasesContent />
    </Suspense>
  );
}

function PurchasesContent() {
  const { user, customer, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryC = searchParams.get('c') || searchParams.get('customerId') || searchParams.get('code');
  const isScanned = searchParams.get('scanned') === 'true';

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showScanSuccessBanner, setShowScanSuccessBanner] = useState(isScanned);
  const [scannedCustomer, setScannedCustomer] = useState<{
    fullName?: string;
    memberNo?: string;
    purchaseCount?: number;
    totalSpent?: number;
  } | null>(null);
  const [scannedLoyalty, setScannedLoyalty] = useState<{
    currentPoints?: number;
    tier?: string;
  } | null>(null);

  const fetchedTargetIdRef = useRef<string>('');

  useEffect(() => {
    const targetCustomerId = queryC || customer?.id;

    // Jika tidak ada parameter barcode dan user belum login, arahkan ke login
    if (!queryC && !loading && !user) {
      router.replace('/login');
      return;
    }

    if (!targetCustomerId) {
      if (!loading) setDataLoading(false);
      return;
    }

    if (fetchedTargetIdRef.current === targetCustomerId) {
      return;
    }
    fetchedTargetIdRef.current = targetCustomerId;

    const loadPurchases = async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        const res = await fetch(`/api/purchases?customerId=${encodeURIComponent(targetCustomerId)}`, {
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
        });
        const data = await res.json();
        if (data.purchases) {
          setPurchases(data.purchases);
        }
        if (data.customer) {
          setScannedCustomer(data.customer);
        }
        if (data.loyalty) {
          setScannedLoyalty(data.loyalty);
        }
      } catch (err) {
        console.error('Error fetching purchases:', err);
      } finally {
        setDataLoading(false);
      }
    };

    loadPurchases();
  }, [user, customer?.id, queryC, loading, router]);

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 rounded-full border-4 border-[#E2F0EF] border-t-[#277A73] animate-spin" />
      </div>
    );
  }

  const validCount = purchases.filter((p) => p.status === 'valid').length;
  const activeCustomerName = scannedCustomer?.fullName || customer?.fullName || 'Customer Wardah';
  const activeMemberNo = scannedCustomer?.memberNo || customer?.memberNo || '-';

  return (
    <div className="min-h-screen bg-[#F8FBFB] flex flex-col relative pb-28">
      {/* Background Shapes */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#E2F5F3] rounded-full filter blur-3xl opacity-50" />
      </div>

      {/* Header */}
      <div className="px-6 pt-10 pb-5 z-10 relative bg-white/70 backdrop-blur-md border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/passport" className="text-[#277A73] p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Riwayat Pembelian</h1>
            <p className="text-xs text-gray-500">{validCount} transaksi tercatat</p>
          </div>
        </div>

        <span className="text-sm font-bold text-[#277A73] font-serif">Wardah</span>
      </div>

      <div className="px-5 py-5 space-y-4 z-10 relative max-w-lg mx-auto w-full">
        {/* Banner if Customer Just Scanned Barcode from BA */}
        {showScanSuccessBanner && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-[#277A73] text-white shadow-md flex items-start justify-between gap-3 animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold">Barcode Berhasil Dipindai!</p>
                <p className="text-[11px] text-white/90 mt-0.5 leading-snug">
                  Riwayat transaksi terbaru Anda di counter Wardah telah tersinkronisasi langsung ke Beauty Passport.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowScanSuccessBanner(false)}
              className="text-white/80 hover:text-white text-xs font-bold px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Customer Passport Info Badge */}
        <div className="bg-white rounded-3xl p-4.5 border border-[#277A73]/15 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#E8F6F4] text-[#277A73] flex items-center justify-center font-bold text-lg">
              {activeCustomerName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">{activeCustomerName}</p>
              <p className="text-[11px] text-gray-500 font-mono">ID: {activeMemberNo}</p>
            </div>
          </div>
          {scannedLoyalty && (
            <div className="text-right">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#277A73] bg-[#E8F6F4] px-2.5 py-1 rounded-full">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>{scannedLoyalty.currentPoints ?? 0} Poin</span>
              </span>
              <p className="text-[10px] text-gray-400 capitalize mt-0.5 font-medium">
                {scannedLoyalty.tier ?? 'Bronze'} Member
              </p>
            </div>
          )}
        </div>

        {/* Unauthenticated / Unclaimed Customer Claim Banner */}
        {!user && queryC && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
            <p className="font-bold flex items-center gap-1.5">
              <span>✨</span>
              <span>Klaim Akun Beauty Passport Anda</span>
            </p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Transaksi counter di atas tercatat atas nama Anda. Masuk atau buat akun untuk menyimpan riwayat ini dan menukarkan poin reward Anda!
            </p>
            <Link
              href="/login"
              className="inline-block mt-1 px-4 py-2 bg-[#277A73] text-white font-bold text-xs rounded-xl shadow-xs hover:bg-[#1E6560] transition-colors"
            >
              Masuk / Daftarkan Akun
            </Link>
          </div>
        )}

        {purchases.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-xs p-8 text-center border border-gray-100">
            <span className="text-4xl mb-3 block">🛍️</span>
            <h2 className="font-bold text-gray-900 text-base mb-1">Belum Ada Riwayat Belanja</h2>
            <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto">
              Pembelian produk Wardah Anda di counter resmi akan otomatis dicatat oleh Beauty Advisor dan muncul di sini.
            </p>
            <Link
              href="/passport/qr"
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-[#277A73] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#1E6560] transition-colors"
            >
              <span>Scan Barcode BA</span>
            </Link>
          </div>
        ) : (
          purchases.map((purchase, index) => (
            <PurchaseCard key={purchase.id} purchase={purchase} defaultExpanded={index === 0 && isScanned} />
          ))
        )}
      </div>

      {/* Slogan */}
      <div className="px-6 pt-6 pb-2 text-center text-[#277A73] text-xs font-medium italic relative z-10">
        Your Beauty Journey Our Priority 💙
      </div>

      {/* Bottom Navigation */}
      <PassportBottomNav activeTab="home" />
    </div>
  );
}

function PurchaseCard({ purchase, defaultExpanded = false }: { purchase: Purchase; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      className={`bg-white rounded-3xl shadow-xs overflow-hidden transition-all border border-gray-100 ${
        purchase.status === 'void' ? 'opacity-60' : ''
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4.5 text-left focus:outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#E8F6F4] flex items-center justify-center text-[#277A73] shrink-0 shadow-xs">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-snug">
                {purchase.storeNameSnapshot || 'Counter Resmi Wardah'}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">{formatDateTime(purchase.purchasedAt)}</p>
              <p className="text-[10px] text-gray-400 font-mono mt-1 uppercase">No. {purchase.invoiceNo}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-[#277A73] text-sm">{formatIDR(purchase.totalAmount)}</p>
            {purchase.status === 'void' ? (
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] bg-red-50 text-red-600 font-bold border border-red-100">
                Void
              </span>
            ) : (
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                Valid
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-50 text-xs text-gray-500">
          <p className="text-[11px]">
            {purchase.items?.length || 0} item · BA: <span className="font-bold text-gray-700">{purchase.baNameSnapshot || 'Beauty Advisor'}</span>
          </p>
          <span className="text-[#277A73] bg-[#E8F6F4] p-1 rounded-full">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-3.5 space-y-2.5 bg-gray-50/50 text-xs">
          {purchase.items?.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div>
                <p className="font-semibold text-gray-900">{item.productName}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {item.sku} · {item.qty} × {formatIDR(item.unitPrice)}
                </p>
              </div>
              <p className="font-bold text-gray-800">{formatIDR(item.subtotal)}</p>
            </div>
          ))}

          <div className="pt-2.5 border-t border-dashed border-gray-200 flex justify-between items-center">
            <p className="font-bold text-gray-700">Total Pembayaran</p>
            <p className="font-extrabold text-[#277A73] text-sm">{formatIDR(purchase.totalAmount)}</p>
          </div>

          {purchase.status === 'void' && purchase.voidReason && (
            <div className="mt-2 p-2.5 rounded-xl bg-red-50 border border-red-100 text-xs text-red-600 font-medium">
              Alasan void: {purchase.voidReason}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
