'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatIDR } from '@/lib/utils';
import type { Customer, SkinProfile, Consultation, Product, Purchase } from '@/types';
import {
  ShoppingBag,
  Sparkles,
  CheckCircle2,
  Plus,
  Minus,
  Trash2,
  X,
  CreditCard,
  QrCode,
  Store,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

const SKIN_TYPE_LABELS: Record<string, string> = {
  normal: 'Kulit Normal',
  oily: 'Kulit Berminyak',
  dry: 'Kulit Kering',
  combination: 'Kulit Kombinasi',
  sensitive: 'Kulit Sensitif',
};

const SKIN_TYPE_DESCRIPTIONS: Record<string, string> = {
  normal: 'Kondisi kulit seimbang, tidak terlalu berminyak atau terlalu kering.',
  oily: 'Produksi sebum berlebih, rentan terhadap kilap dan pori-pori tersumbat.',
  dry: 'Membutuhkan hidrasi ekstra untuk menjaga kelembapan pelindung kulit.',
  combination: 'Berminyak di area T-zone (dahi, hidung) dan normal/kering di pipi.',
  sensitive: 'Mudah reaktif terhadap paparan sinar matahari, polusi, atau formula keras.',
};

interface CartItem {
  product: Product;
  qty: number;
  reason?: string;
  routineStepName?: string;
}

export default function PersonalRecommendationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [skinProfile, setSkinProfile] = useState<SkinProfile | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchasedProductIds, setPurchasedProductIds] = useState<Set<string>>(new Set());
  const [dataLoading, setDataLoading] = useState(true);

  // Checkout Modal State
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'qris' | 'counter' | 'ewallet' | 'va'>('qris');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [successData, setSuccessData] = useState<{
    invoiceNo: string;
    purchaseId: string;
    pointsEarned: number;
    totalAmount: number;
  } | null>(null);

  const loadData = async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      // 1. Fetch customer profile
      const custQ = query(collection(db, 'customers'), where('uid', '==', user.uid));
      const custSnap = await getDocs(custQ);
      if (custSnap.empty) return;

      const custData = { id: custSnap.docs[0].id, ...custSnap.docs[0].data() } as Customer;
      setCustomer(custData);

      // 2. Parallel fetch: skin profile, consultations, products, and purchases
      const [profileDoc, consultSnap, prodSnap, purchSnap] = await Promise.all([
        getDoc(doc(db, 'skinProfiles', custData.id)),
        getDocs(
          query(
            collection(db, 'consultations'),
            where('customerId', '==', custData.id),
            orderBy('createdAt', 'desc')
          )
        ),
        getDocs(query(collection(db, 'products'), where('isActive', '==', true))),
        getDocs(
          query(
            collection(db, 'purchases'),
            where('customerId', '==', custData.id),
            where('status', '==', 'valid')
          )
        ),
      ]);

      if (profileDoc.exists()) {
        setSkinProfile({ id: profileDoc.id, ...profileDoc.data() } as SkinProfile);
      }

      setConsultations(
        consultSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? d.data().createdAt,
        })) as Consultation[]
      );

      const allProds = prodSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[];
      setProducts(allProds);

      const boughtIds = new Set<string>();
      purchSnap.docs.forEach((d) => {
        const items = d.data().items || [];
        items.forEach((it: { productId: string }) => {
          if (it.productId) boughtIds.add(it.productId);
        });
      });
      setPurchasedProductIds(boughtIds);
    } catch (err) {
      console.error('Failed to load personal recommendations data:', err);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
      return;
    }
    if (!loading && user?.role !== 'customer') {
      router.replace('/');
      return;
    }

    if (!loading && user) loadData();
  }, [user, loading, router]);

  // Compute smart routine based on skin profile
  const recommendedRoutine = useMemo(() => {
    if (!products.length) return [];

    const skinType = skinProfile?.skinType || 'normal';
    const concerns = skinProfile?.concerns || [];

    const findProduct = (keywords: string[]) => {
      return (
        products.find((p) => {
          // Check suitableSkinTypes or suitableConcerns first
          const matchesSkin = p.suitableSkinTypes?.includes(skinType);
          const matchesConcern = p.suitableConcerns?.some((c) => concerns.includes(c));
          if (matchesSkin || matchesConcern) return true;

          const text = (p.name + ' ' + (p.description || '')).toLowerCase();
          return keywords.some((k) => text.includes(k.toLowerCase()));
        }) || products[0]
      );
    };

    // Step 1: Cleanser
    let cleanserKeywords = ['face wash', 'cleanser'];
    if (skinType === 'oily' || concerns.includes('jerawat') || concerns.includes('minyak')) {
      cleanserKeywords = ['oil and acne care', 'acne', 'oil', 'face wash'];
    } else if (skinType === 'dry') {
      cleanserKeywords = ['hydrating', 'energizing', 'face wash'];
    } else if (concerns.includes('kusam')) {
      cleanserKeywords = ['brightening', 'exfoliating', 'face wash'];
    }

    // Step 2: Treatment / Serum
    let treatmentKeywords = ['moisturizer', 'serum', 'cream'];
    if (skinType === 'oily' || concerns.includes('komedo')) {
      treatmentKeywords = ['triple action', 'comedo', 'oil control', 'moisturizer'];
    } else if (concerns.includes('kusam')) {
      treatmentKeywords = ['brightening', 'radiance', 'moisturizer'];
    }

    // Step 3: Sunscreen & Protection
    const sunscreenKeywords = ['sunscreen', 'uv', 'shield', 'protection'];

    // Step 4: Grooming / Fragrance
    const fragranceKeywords = ['eau de toilette', 'perfume', 'beard', 'fragrance'];

    return [
      {
        step: 1,
        stepName: 'Pembersih Wajah (Face Wash)',
        benefit:
          skinType === 'oily'
            ? 'Membersihkan minyak berlebih & cegah jerawat'
            : 'Membersihkan debu & kotoran tanpa membuat kulit kering',
        product: findProduct(cleanserKeywords),
      },
      {
        step: 2,
        stepName: 'Pelembap & Serum (Treatment)',
        benefit: 'Menjaga kelembapan skin barrier serta menutrisi kulit secara mendalam',
        product: findProduct(treatmentKeywords),
      },
      {
        step: 3,
        stepName: 'Tabir Surya (Sunscreen)',
        benefit: 'Perlindungan maksimal dari radiasi UV matahari & polusi kota',
        product: findProduct(sunscreenKeywords),
      },
      {
        step: 4,
        stepName: 'Perawatan Tambahan & Grooming',
        benefit: 'Menyegarkan aroma tubuh dan menyempurnakan penampilan sehari-hari',
        product: findProduct(fragranceKeywords),
      },
    ];
  }, [skinProfile, products]);

  // Latest consultation recommendations from BA
  const latestConsultation = consultations[0];

  // Helper to open checkout with products
  const handleOpenCheckout = (items: CartItem[]) => {
    setCartItems(items);
    setCheckoutError('');
    setCheckoutOpen(true);
  };

  // 1-Click: Buy all recommended products from BA consultation
  const handleBuyAllBaRecommendations = () => {
    if (!latestConsultation?.recommendedProducts?.length) return;

    const items: CartItem[] = [];
    latestConsultation.recommendedProducts.forEach((rp) => {
      const prod = products.find(
        (p) => p.id === rp.productId || p.name.toLowerCase() === rp.productName.toLowerCase()
      );
      if (prod) {
        items.push({
          product: prod,
          qty: 1,
          reason: rp.reason || 'Rekomendasi Utama BA',
        });
      }
    });

    if (items.length > 0) {
      handleOpenCheckout(items);
    }
  };

  // 1-Click: Buy full 4-step routine bundle
  const handleBuyFullRoutine = () => {
    const items: CartItem[] = recommendedRoutine
      .filter((r) => r.product)
      .map((r) => ({
        product: r.product!,
        qty: 1,
        routineStepName: r.stepName,
      }));

    if (items.length > 0) {
      handleOpenCheckout(items);
    }
  };

  // Cart Qty Adjustments
  const handleUpdateQty = (productId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCartItems((prev) => prev.filter((i) => i.product.id !== productId));
  };

  // Calculate cart total
  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (item.product.defaultPrice || 0) * item.qty, 0);
  }, [cartItems]);

  const pointsToEarn = useMemo(() => {
    return Math.floor(cartTotal / 10000);
  }, [cartTotal]);

  // Submit Checkout to /api/purchases
  const handleConfirmCheckout = async () => {
    if (cartItems.length === 0) return;
    setIsSubmitting(true);
    setCheckoutError('');

    try {
      const idToken = await (await import('firebase/auth')).getAuth().currentUser?.getIdToken();
      if (!idToken) throw new Error('Sesi autentikasi berakhir. Silakan login kembali.');

      const payload = {
        items: cartItems.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          sku: item.product.sku || 'KAHF-DEFAULT',
          qty: item.qty,
          unitPrice: item.product.defaultPrice || 45000,
        })),
        paymentMethod,
        recommendationId: latestConsultation?.id,
      };

      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses transaksi.');
      }

      // Success
      setSuccessData({
        invoiceNo: data.invoiceNo,
        purchaseId: data.purchaseId,
        pointsEarned: data.pointsEarned || pointsToEarn,
        totalAmount: data.totalAmount || cartTotal,
      });
      setCheckoutOpen(false);
      setCartItems([]);
      await loadData();
    } catch (err: any) {
      console.error('Checkout error:', err);
      setCheckoutError(err.message || 'Terjadi kesalahan sistem saat checkout.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-[#E2F0EF] border-t-[#2C5C59] animate-spin" />
          <p className="text-xs text-gray-500 font-medium">Menyusun rekomendasi personal Kahf...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-28 relative overflow-hidden">
      {/* Background shape */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#E2F0EF] rounded-full mix-blend-multiply filter blur-[90px] opacity-60 pointer-events-none" />

      {/* Header */}
      <div className="px-6 pt-12 pb-6 relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/passport"
            className="p-2 bg-white rounded-xl shadow-xs text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ←
          </Link>
          <span className="text-xs font-bold text-[#6DB9B2] uppercase tracking-wider">
            Kahf Personal Guide & Store
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#2C5C59]">Rekomendasi Personal</h1>
            <p className="text-xs text-gray-500 mt-1">
              Rangkaian produk pilihan berdasarkan saran Brand Ambassador & analisis kulit Anda.
            </p>
          </div>
          <Link
            href="/passport/purchases"
            className="p-3 bg-white text-[#2C5C59] hover:bg-[#E2F0EF] rounded-2xl border border-gray-200 shadow-xs flex items-center gap-1.5 text-xs font-bold transition-colors shrink-0"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Riwayat Belanja</span>
          </Link>
        </div>
      </div>

      <div className="px-6 space-y-6 relative z-10">
        {/* Customer Skin Profile Overview Card */}
        {skinProfile ? (
          <div className="bg-gradient-to-br from-[#2C5C59] to-[#1F4240] rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full translate-x-10 -translate-y-10 pointer-events-none" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold text-[#6DB9B2] uppercase tracking-wider">
                  Profil Kulit Terverifikasi
                </span>
                <h3 className="text-2xl font-bold mt-1">
                  {SKIN_TYPE_LABELS[skinProfile.skinType] || 'Kulit Normal'}
                </h3>
                <p className="text-xs text-white/80 mt-1 max-w-md">
                  {SKIN_TYPE_DESCRIPTIONS[skinProfile.skinType] || 'Kondisi kulit pria aktif sehari-hari.'}
                </p>
              </div>

              <Link
                href="/passport/skin-profile"
                className="self-start sm:self-center px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 transition-colors whitespace-nowrap"
              >
                ✏️ Perbarui Tes Kulit
              </Link>
            </div>

            {/* Concern Tags */}
            {skinProfile.concerns && skinProfile.concerns.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-[11px] text-white/60 mb-2 font-medium">Fokus Masalah yang Ditangani:</p>
                <div className="flex flex-wrap gap-2">
                  {skinProfile.concerns.map((concern, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-white/15 rounded-full text-xs font-medium text-white/90 border border-white/10"
                    >
                      🎯 {concern}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 shadow-xs border border-gray-100 text-center">
            <div className="text-4xl mb-2">📋</div>
            <h3 className="font-bold text-gray-900 text-base">Belum Ada Data Profil Kulit</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              Lengkapi kuesioner profil kulit untuk mendapatkan rekomendasi produk Kahf yang 100% tepat sasaran.
            </p>
            <Link
              href="/passport/skin-profile"
              className="inline-block mt-4 px-6 py-2.5 bg-[#2C5C59] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#1f4240] transition-colors"
            >
              Isi Profil Kulit Sekarang
            </Link>
          </div>
        )}

        {/* ============================================================== */}
        {/* LATEST BA RECOMMENDATIONS SECTION (WITH DIRECT CHECKOUT)        */}
        {/* ============================================================== */}
        {latestConsultation &&
          latestConsultation.recommendedProducts &&
          latestConsultation.recommendedProducts.length > 0 && (
            <div className="bg-gradient-to-br from-[#E2F0EF]/80 to-white rounded-3xl p-6 border border-[#6DB9B2]/40 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#2C5C59] text-white flex items-center justify-center font-bold text-lg shadow-xs">
                    👩‍💼
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-[#2C5C59] text-sm">
                        Rekomendasi dari Brand Advisor ({latestConsultation.baNameSnapshot})
                      </h4>
                      <span className="text-[10px] bg-[#2C5C59] text-white px-2 py-0.5 rounded-full font-bold">
                        Resmi
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500">
                      Counter: {latestConsultation.storeNameSnapshot || 'Kahf Store'} ·{' '}
                      {new Date(latestConsultation.createdAt).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                </div>

                {/* 1-Click Buy All BA Recommendations */}
                <button
                  type="button"
                  onClick={handleBuyAllBaRecommendations}
                  className="px-4 py-2.5 bg-[#2C5C59] hover:bg-[#1f4240] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-[#2C5C59]/20 transition-all active:scale-95"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Beli Semua Rekomendasi BA ({latestConsultation.recommendedProducts.length})</span>
                </button>
              </div>

              {latestConsultation.notes && (
                <div className="text-xs text-gray-700 bg-white/90 p-3.5 rounded-2xl border border-[#6DB9B2]/20 italic flex items-start gap-2 shadow-2xs">
                  <span className="text-base text-[#6DB9B2]">💬</span>
                  <p>&ldquo;{latestConsultation.notes}&rdquo;</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {latestConsultation.recommendedProducts.map((rp, idx) => {
                  const prod = products.find(
                    (p) => p.id === rp.productId || p.name.toLowerCase() === rp.productName.toLowerCase()
                  );
                  const isBought = prod ? purchasedProductIds.has(prod.id) : false;

                  return (
                    <div
                      key={idx}
                      className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-[#E2F0EF] text-[#2C5C59] flex items-center justify-center font-bold text-lg shrink-0">
                          🧴
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-gray-900 text-xs truncate">{rp.productName}</p>
                            {isBought && (
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md font-bold whitespace-nowrap">
                                ✓ Sudah Dibeli
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#6DB9B2] font-semibold mt-0.5">
                            {rp.reason || 'Rekomendasi utama sesuai profil kulit'}
                          </p>
                          <p className="text-xs font-extrabold text-[#2C5C59] mt-1.5">
                            {prod?.defaultPrice ? formatIDR(prod.defaultPrice) : 'Rp 45.000'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                        {prod ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenCheckout([
                                {
                                  product: prod,
                                  qty: 1,
                                  reason: rp.reason,
                                },
                              ])
                            }
                            className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                              isBought
                                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                : 'bg-[#2C5C59] hover:bg-[#1f4240] text-white shadow-xs'
                            }`}
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>{isBought ? 'Beli Ulang (Repurchase)' : 'Checkout Produk Ini'}</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400">Tersedia di Counter Kahf</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        {/* ============================================================== */}
        {/* STEP-BY-STEP PERSONALIZED ROUTINE                             */}
        {/* ============================================================== */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#2C5C59]">Rutinitas Perawatan Harian Kahf</h2>
              <p className="text-xs text-gray-500">4 langkah praktis untuk hasil maksimal sesuai kulit pria</p>
            </div>

            {/* Bundle Checkout Button */}
            <button
              type="button"
              onClick={handleBuyFullRoutine}
              className="self-start sm:self-center px-4 py-2.5 bg-gradient-to-r from-[#2C5C59] to-[#3B7A75] hover:opacity-95 text-white rounded-2xl text-xs font-bold flex items-center gap-2 shadow-md shadow-[#2C5C59]/25 transition-all active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Beli Paket Rutinitas Lengkap (4 Langkah)</span>
            </button>
          </div>

          <div className="space-y-3.5">
            {recommendedRoutine.map((item) => {
              const isBought = item.product ? purchasedProductIds.has(item.product.id) : false;

              return (
                <div
                  key={item.step}
                  className="bg-white rounded-3xl p-5 shadow-xs border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-[#E2F0EF] text-[#2C5C59] flex items-center justify-center font-bold text-sm shrink-0 mt-0.5 shadow-2xs">
                      0{item.step}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-[#6DB9B2] uppercase tracking-wider">
                          {item.stepName}
                        </span>
                        {isBought && (
                          <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Sudah Dimiliki
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-gray-900 text-base mt-0.5">
                        {item.product?.name || 'Kahf Men Care'}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1 max-w-lg leading-relaxed">{item.benefit}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:flex-col md:items-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-gray-50">
                    <div className="text-left md:text-right">
                      <span className="font-bold text-[#2C5C59] text-base block">
                        {item.product?.defaultPrice ? formatIDR(item.product.defaultPrice) : 'Harga Standar'}
                      </span>
                      <span className="text-[10px] text-gray-400 bg-gray-50 px-2.5 py-0.5 rounded-lg border border-gray-100">
                        SKU: {item.product?.sku || 'KAHF-01'}
                      </span>
                    </div>

                    {item.product && (
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenCheckout([
                            {
                              product: item.product!,
                              qty: 1,
                              routineStepName: item.stepName,
                            },
                          ])
                        }
                        className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                          isBought
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            : 'bg-[#2C5C59] hover:bg-[#1f4240] text-white shadow-xs'
                        }`}
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>{isBought ? 'Beli Lagi' : 'Beli Sekarang'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA to Consult In Store */}
        <div className="bg-gradient-to-r from-[#6DB9B2] to-[#4FA39B] rounded-3xl p-6 text-white text-center shadow-lg">
          <h3 className="text-lg font-bold">Ingin Konsultasi Langsung di Counter?</h3>
          <p className="text-xs text-white/90 mt-1 max-w-md mx-auto">
            Kunjungi store Kahf terdekat dan tunjukkan QR Passport Anda kepada Brand Ambassador kami untuk analisa
            kulit tatap muka.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/passport/qr"
              className="px-5 py-2.5 bg-white text-[#2C5C59] text-xs font-bold rounded-xl shadow-sm hover:bg-gray-50 transition-colors"
            >
              📱 Tampilkan QR Passport
            </Link>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* CHECKOUT MODAL                                                 */}
      {/* ============================================================== */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-[#2C5C59] to-[#1F4240] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Checkout Produk Rekomendasi</h3>
                  <p className="text-[11px] text-white/70">Transaksi disinkronkan langsung ke Beauty Passport</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Attribution Banner */}
              <div className="p-3.5 rounded-2xl bg-[#E2F0EF]/80 border border-[#6DB9B2]/30 flex items-start gap-2.5 text-xs text-[#2C5C59]">
                <Store className="w-4 h-4 text-[#2C5C59] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    Dilayani oleh Counter: {latestConsultation?.storeNameSnapshot || 'Kahf Flagship Store'}
                  </p>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    Konsultasi & Rekomendasi oleh BA:{' '}
                    <span className="font-bold text-[#2C5C59]">
                      {latestConsultation?.baNameSnapshot || 'Kahf Beauty Advisor'}
                    </span>
                  </p>
                </div>
              </div>

              {checkoutError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {/* Items List */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-2">
                  Item Belanja ({cartItems.length} Produk):
                </label>
                <div className="space-y-2.5">
                  {cartItems.map((item) => (
                    <div
                      key={item.product.id}
                      className="p-3.5 rounded-2xl border border-gray-100 bg-gray-50/70 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 text-xs truncate">{item.product.name}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {formatIDR(item.product.defaultPrice)} · SKU: {item.product.sku}
                        </p>
                        {item.reason && (
                          <p className="text-[10px] text-[#6DB9B2] font-semibold mt-0.5">
                            🎯 {item.reason}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Quantity Controls */}
                        <div className="flex items-center border border-gray-200 rounded-xl bg-white overflow-hidden shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.product.id, -1)}
                            className="p-1.5 hover:bg-gray-100 text-gray-600 transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 text-xs font-bold text-gray-800">{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.product.id, 1)}
                            className="p-1.5 hover:bg-gray-100 text-gray-600 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="text-xs font-bold text-[#2C5C59] min-w-[70px] text-right">
                          {formatIDR(item.product.defaultPrice * item.qty)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.product.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-2">Metode Pembayaran:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('qris')}
                    className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                      paymentMethod === 'qris'
                        ? 'border-[#2C5C59] bg-[#E2F0EF]/40 text-[#2C5C59] ring-2 ring-[#2C5C59]/20'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <QrCode className="w-4 h-4 text-[#2C5C59]" />
                    <div>
                      <p className="text-xs font-bold">QRIS Kahf</p>
                      <p className="text-[10px] text-gray-500">Scan Instant E-Wallet/Bank</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('counter')}
                    className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                      paymentMethod === 'counter'
                        ? 'border-[#2C5C59] bg-[#E2F0EF]/40 text-[#2C5C59] ring-2 ring-[#2C5C59]/20'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <Store className="w-4 h-4 text-[#2C5C59]" />
                    <div>
                      <p className="text-xs font-bold">Counter Kahf</p>
                      <p className="text-[10px] text-gray-500">Bayar Langsung di Kasir</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('ewallet')}
                    className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                      paymentMethod === 'ewallet'
                        ? 'border-[#2C5C59] bg-[#E2F0EF]/40 text-[#2C5C59] ring-2 ring-[#2C5C59]/20'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-[#2C5C59]" />
                    <div>
                      <p className="text-xs font-bold">E-Wallet</p>
                      <p className="text-[10px] text-gray-500">GoPay / ShopeePay / OVO</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('va')}
                    className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                      paymentMethod === 'va'
                        ? 'border-[#2C5C59] bg-[#E2F0EF]/40 text-[#2C5C59] ring-2 ring-[#2C5C59]/20'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-[#2C5C59]" />
                    <div>
                      <p className="text-xs font-bold">Virtual Account</p>
                      <p className="text-[10px] text-gray-500">BCA, Mandiri, BRI, BNI</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Price & Loyalty Calculation */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-2">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Subtotal Produk</span>
                  <span>{formatIDR(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Biaya Layanan & Pajak</span>
                  <span className="text-emerald-600 font-bold">GRATIS</span>
                </div>
                <div className="flex justify-between text-xs text-[#2C5C59] font-bold pt-2 border-t border-gray-200">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Poin Loyalty Didapatkan
                  </span>
                  <span className="text-amber-600">+{pointsToEarn} Poin</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-gray-900 pt-2 border-t border-gray-200">
                  <span>Total Pembayaran</span>
                  <span className="text-[#2C5C59]">{formatIDR(cartTotal)}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                className="w-1/3 py-3 rounded-2xl border border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-100 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting || cartItems.length === 0}
                onClick={handleConfirmCheckout}
                className="w-2/3 py-3 rounded-2xl bg-[#2C5C59] hover:bg-[#1f4240] disabled:bg-gray-300 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-[#2C5C59]/25 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Memproses Transaksi...</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Konfirmasi & Bayar ({formatIDR(cartTotal)})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CELEBRATION / SUCCESS MODAL                                    */}
      {/* ============================================================== */}
      {successData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in zoom-in-95">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl text-center space-y-4 relative overflow-hidden">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-3xl shadow-xs">
              🎉
            </div>

            <div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 uppercase tracking-wider">
                Pembelian Berhasil Terverifikasi
              </span>
              <h3 className="text-xl font-bold text-[#2C5C59] mt-2">Terima Kasih, Kahf Bro!</h3>
              <p className="text-xs text-gray-500 mt-1">
                Produk rekomendasi Anda telah tercatat dan transaksi tersinkronisasi ke seluruh sistem Kahf.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#E2F0EF]/60 border border-[#6DB9B2]/30 space-y-2 text-left">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">No. Invoice</span>
                <span className="font-mono font-bold text-[#2C5C59]">{successData.invoiceNo}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Total Pembayaran</span>
                <span className="font-bold text-gray-900">{formatIDR(successData.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-xs pt-2 border-t border-[#6DB9B2]/20 font-bold text-amber-700">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Poin Loyalty Kahf Didapat
                </span>
                <span>+{successData.pointsEarned} Poin</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Link
                href="/passport/purchases"
                className="w-full py-3 bg-[#2C5C59] hover:bg-[#1f4240] text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-[#2C5C59]/20 transition-colors"
              >
                <span>Lihat Riwayat Pembelian</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/passport/loyalty"
                className="w-full py-2.5 bg-white hover:bg-gray-50 text-[#2C5C59] rounded-2xl text-xs font-bold border border-gray-200 transition-colors block"
              >
                Cek Saldo Poin & Tier Loyalty
              </Link>
              <button
                type="button"
                onClick={() => setSuccessData(null)}
                className="text-xs text-gray-400 hover:text-gray-600 font-medium pt-1"
              >
                Tutup Jendela Ini
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
