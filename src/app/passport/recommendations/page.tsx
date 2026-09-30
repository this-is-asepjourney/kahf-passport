'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatIDR } from '@/lib/utils';
import type { Customer, SkinProfile, Consultation, Product } from '@/types';

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

export default function PersonalRecommendationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [skinProfile, setSkinProfile] = useState<SkinProfile | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
      return;
    }
    if (!loading && user?.role !== 'customer') {
      router.replace('/');
      return;
    }

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

        // 2. Fetch skin profile
        const profileDoc = await getDoc(doc(db, 'skinProfiles', custData.id));
        if (profileDoc.exists()) {
          setSkinProfile({ id: profileDoc.id, ...profileDoc.data() } as SkinProfile);
        }

        // 3. Fetch past consultations
        const consultQ = query(
          collection(db, 'consultations'),
          where('customerId', '==', custData.id),
          orderBy('createdAt', 'desc')
        );
        const consultSnap = await getDocs(consultQ);
        setConsultations(
          consultSnap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? d.data().createdAt,
          })) as Consultation[]
        );

        // 4. Fetch all active products
        const prodSnap = await getDocs(
          query(collection(db, 'products'), where('isActive', '==', true))
        );
        setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]);
      } catch (err) {
        console.error('Failed to load personal recommendations data:', err);
      } finally {
        setDataLoading(false);
      }
    };

    if (!loading && user) loadData();
  }, [user, loading, router]);

  // Compute smart routine based on skin profile
  const recommendedRoutine = useMemo(() => {
    if (!skinProfile) return [];

    const skinType = skinProfile.skinType || 'normal';
    const concerns = skinProfile.concerns || [];

    // Helper to find best matching product in catalog
    const findProduct = (keywords: string[]) => {
      return (
        products.find(p => {
          const text = (p.name + ' ' + (p.description || '')).toLowerCase();
          return keywords.some(k => text.includes(k.toLowerCase()));
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

    // Step 2: Moisturizer / Serum
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
        benefit: skinType === 'oily' ? 'Membersihkan minyak berlebih & cegah jerawat' : 'Membersihkan debu & kotoran tanpa membuat kulit kering',
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

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-[#E2F0EF] border-t-[#2C5C59] animate-spin" />
          <p className="text-xs text-gray-500 font-medium">Menyusun rekomendasi personal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 relative overflow-hidden">
      
      {/* Background shape */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#E2F0EF] rounded-full mix-blend-multiply filter blur-[90px] opacity-60 pointer-events-none" />

      {/* Header */}
      <div className="px-6 pt-12 pb-6 relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/passport" className="p-2 bg-white rounded-xl shadow-sm text-gray-700 hover:bg-gray-50 transition-colors">
            ←
          </Link>
          <span className="text-xs font-bold text-[#6DB9B2] uppercase tracking-wider">Kahf Personal Guide</span>
        </div>
        <h1 className="text-2xl font-bold text-[#2C5C59]">Rekomendasi Personal</h1>
        <p className="text-xs text-gray-500 mt-1">
          Rangkaian produk pilihan yang disesuaikan khusus dengan kondisi kulit & saran Brand Ambassador Anda.
        </p>
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
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-center">
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

        {/* Latest BA Recommendation Note (if exists) */}
        {latestConsultation && latestConsultation.recommendedProducts && latestConsultation.recommendedProducts.length > 0 && (
          <div className="bg-[#E2F0EF]/60 rounded-3xl p-6 border border-[#6DB9B2]/30 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">👩‍💼</span>
              <div>
                <h4 className="font-bold text-[#2C5C59] text-sm">
                  Rekomendasi dari BA: {latestConsultation.baNameSnapshot}
                </h4>
                <p className="text-[10px] text-gray-500">
                  Konsultasi di {latestConsultation.storeNameSnapshot} · {new Date(latestConsultation.createdAt).toLocaleDateString('id-ID')}
                </p>
              </div>
            </div>

            {latestConsultation.notes && (
              <p className="text-xs text-gray-700 bg-white/80 p-3 rounded-2xl border border-[#6DB9B2]/20 mb-4 italic">
                &ldquo;{latestConsultation.notes}&rdquo;
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {latestConsultation.recommendedProducts.map((rp, idx) => (
                <div key={idx} className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E2F0EF] text-[#2C5C59] flex items-center justify-center font-bold text-sm shrink-0">
                    🧴
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-xs">{rp.productName}</p>
                    <p className="text-[10px] text-[#6DB9B2] font-semibold mt-0.5">{rp.reason || 'Rekomendasi utama'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step-by-Step Personalized Kahf Routine */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-[#2C5C59]">Rutinitas Perawatan Harian Kahf</h2>
              <p className="text-xs text-gray-500">4 langkah praktis untuk hasil maksimal sesuai kulit pria</p>
            </div>
          </div>

          <div className="space-y-4">
            {recommendedRoutine.map(item => (
              <div
                key={item.step}
                className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-[#E2F0EF] text-[#2C5C59] flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                    0{item.step}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#6DB9B2] uppercase tracking-wider">
                      {item.stepName}
                    </span>
                    <h4 className="font-bold text-gray-900 text-base mt-0.5">
                      {item.product?.name || 'Kahf Men Care'}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {item.benefit}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between md:flex-col md:items-end gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-gray-50">
                  <span className="font-bold text-[#2C5C59] text-sm">
                    {item.product?.defaultPrice ? formatIDR(item.product.defaultPrice) : 'Harga Standar'}
                  </span>
                  <span className="text-[10px] text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">
                    SKU: {item.product?.sku || 'KAHF-01'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Call-to-Action to consult BA */}
        <div className="bg-gradient-to-r from-[#6DB9B2] to-[#4FA39B] rounded-3xl p-6 text-white text-center shadow-lg">
          <h3 className="text-lg font-bold">Ingin Konsultasi Langsung?</h3>
          <p className="text-xs text-white/90 mt-1 max-w-md mx-auto">
            Kunjungi store Kahf terdekat dan tunjukkan QR Passport Anda kepada Brand Ambassador kami untuk analisa kulit langsung.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/passport/qr"
              className="px-5 py-2.5 bg-white text-[#2C5C59] text-xs font-bold rounded-xl shadow hover:bg-gray-50 transition-colors"
            >
              📱 Buka QR Passport
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
