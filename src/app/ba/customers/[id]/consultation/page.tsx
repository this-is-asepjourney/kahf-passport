'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import type { Customer, Product, SkinType, SkinProfile } from '@/types';

const SKIN_TYPES: { value: SkinType; label: string; icon: string }[] = [
  { value: 'normal', label: 'Normal', icon: '🌿' },
  { value: 'oily', label: 'Berminyak', icon: '💧' },
  { value: 'dry', label: 'Kering', icon: '🏜️' },
  { value: 'combination', label: 'Kombinasi', icon: '☯️' },
  { value: 'sensitive', label: 'Sensitif', icon: '🌸' },
];

const COMMON_CONCERNS = [
  { label: 'Jerawat', icon: '🔴' },
  { label: 'Kulit Kusam', icon: '🌑' },
  { label: 'Flek Hitam', icon: '⬛' },
  { label: 'Kulit Kering', icon: '🏜️' },
  { label: 'Berminyak', icon: '💧' },
  { label: 'Pori Besar', icon: '⭕' },
  { label: 'Kerutan', icon: '〰️' },
  { label: 'Sensitif', icon: '🌸' },
];

export default function BaConsultationPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [existingProfile, setExistingProfile] = useState<SkinProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [skinType, setSkinType] = useState<SkinType>('normal');
  const [concerns, setConcerns] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<{ productId: string; productName: string; sku: string; reason: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user) {
      const loadData = async () => {
        try {
          const [custSnap, productsSnap, profileDoc] = await Promise.all([
            getDocs(query(collection(db, 'customers'), where('__name__', '==', customerId))),
            getDocs(query(collection(db, 'products'), where('isActive', '==', true))),
            getDoc(doc(db, 'skinProfiles', customerId)),
          ]);
          if (!custSnap.empty) {
            setCustomer({ id: custSnap.docs[0].id, ...custSnap.docs[0].data() } as Customer);
          }
          setProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]);
          if (profileDoc.exists()) {
            const profile = { id: profileDoc.id, ...profileDoc.data() } as SkinProfile;
            setExistingProfile(profile);
            setSkinType(profile.skinType);
            setConcerns(profile.concerns ?? []);
          }
        } finally {
          setDataLoading(false);
        }
      };
      loadData();
    }
  }, [user, loading, router, customerId]);

  const toggleConcern = (c: string) => {
    setConcerns(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const addProductRec = (product: Product) => {
    if (selectedProducts.find(p => p.productId === product.id)) return;
    setSelectedProducts(prev => [...prev, { productId: product.id, productName: product.name, sku: product.sku, reason: '' }]);
    setProductSearch('');
  };

  const updateReason = (productId: string, reason: string) => {
    setSelectedProducts(prev => prev.map(p => p.productId === productId ? { ...p, reason } : p));
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.productId !== productId));
  };

  const handleSubmit = async () => {
    if (concerns.length === 0) { alert('Pilih minimal 1 concern kulit'); return; }
    setSubmitting(true);
    try {
      const idToken = await (await import('firebase/auth')).getAuth().currentUser?.getIdToken();
      const res = await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ customerId, skinType, concerns, notes, recommendedProducts: selectedProducts }),
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        const result = await res.json();
        alert(result.error ?? 'Gagal menyimpan');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products
    .filter(p => !selectedProducts.find(sp => sp.productId === p.id))
    .filter(p => productSearch.length === 0 || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase()));

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 rounded-full border-4 border-[#E8C5C8] border-t-[#6DB9B2] animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-white">
        <div className="w-24 h-24 bg-[#E2F0EF] rounded-full flex items-center justify-center text-5xl mb-6">✅</div>
        <h2 className="text-xl font-bold text-[#2C5C59] mb-2">Konsultasi Tersimpan!</h2>
        <p className="text-sm text-gray-500 mb-2">Skin profile customer telah diperbarui.</p>
        <p className="text-xs text-gray-400 mb-8">
          {selectedProducts.length > 0 ? `${selectedProducts.length} rekomendasi produk telah dikirim ke passport customer.` : 'Tidak ada rekomendasi produk.'}
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link href={`/ba/customers/${customerId}`} className="py-3 px-6 bg-[#6DB9B2] text-white rounded-full font-semibold text-center">Kembali ke Profil Customer</Link>
          <Link href="/ba/consultation" className="py-3 px-6 border border-gray-200 text-gray-600 rounded-full font-semibold text-center">Konsultasi Lainnya</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="px-6 pt-12 pb-6 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Link href={`/ba/customers/${customerId}`} className="text-[#2C5C59] p-2 -ml-2 rounded-full hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[#2C5C59]">Konsultasi Kulit</h1>
            {customer && <p className="text-sm text-gray-500">{customer.fullName}</p>}
          </div>
          {existingProfile && <span className="text-xs px-3 py-1 bg-[#E2F0EF] text-[#2C5C59] rounded-full font-medium">Update Profil</span>}
        </div>
      </div>

      <div className="px-6 py-6 space-y-4 pb-32">
        {existingProfile && (
          <div className="bg-[#E2F0EF] rounded-2xl p-4 flex items-start gap-3">
            <span className="text-2xl">ℹ️</span>
            <div>
              <p className="text-sm font-semibold text-[#2C5C59]">Profil kulit sudah ada</p>
              <p className="text-xs text-[#2C5C59]/70 mt-0.5">Form diisi dari data sebelumnya. Perbarui jika ada perubahan kondisi kulit.</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-[#2C5C59] mb-4">Jenis Kulit</h3>
          <div className="grid grid-cols-3 gap-2">
            {SKIN_TYPES.map(st => (
              <button key={st.value} onClick={() => setSkinType(st.value)}
                className={`py-3 px-3 rounded-2xl text-sm font-medium transition-all border flex flex-col items-center gap-1 ${skinType === st.value ? 'bg-[#6DB9B2] text-white border-[#6DB9B2] shadow-lg shadow-[#6DB9B2]/20' : 'bg-white text-gray-600 border-gray-200 hover:border-[#6DB9B2]'}`}>
                <span className="text-lg">{st.icon}</span>
                <span>{st.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#2C5C59]">Concern Kulit</h3>
            {concerns.length > 0 && <span className="text-xs bg-[#FAEBEC] text-[#D88C95] px-2 py-1 rounded-full font-medium">{concerns.length} dipilih</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {COMMON_CONCERNS.map(c => (
              <button key={c.label} onClick={() => toggleConcern(c.label)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all border flex items-center gap-1.5 ${concerns.includes(c.label) ? 'bg-[#FAEBEC] text-[#D88C95] border-[#D88C95]/30' : 'bg-white text-gray-500 border-gray-200 hover:border-[#D88C95]'}`}>
                <span>{c.icon}</span> {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-[#2C5C59] mb-4">Catatan Konsultasi</h3>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Catatan kondisi kulit, keluhan khusus, atau hasil pengamatan..."
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-[#6DB9B2] resize-none" />
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#2C5C59]">Rekomendasi Produk</h3>
            {selectedProducts.length > 0 && <span className="text-xs bg-[#E2F0EF] text-[#2C5C59] px-2 py-1 rounded-full font-medium">{selectedProducts.length} produk</span>}
          </div>
          {selectedProducts.length > 0 && (
            <div className="space-y-2 mb-4">
              {selectedProducts.map(sp => (
                <div key={sp.productId} className="flex items-start gap-3 p-3 bg-[#E2F0EF] rounded-2xl">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#2C5C59]">{sp.productName}</p>
                    <input type="text" placeholder="Alasan rekomendasi untuk customer..." value={sp.reason}
                      onChange={e => updateReason(sp.productId, e.target.value)}
                      className="mt-1 w-full text-xs px-3 py-2 rounded-xl border border-[#6DB9B2]/30 bg-white focus:outline-none focus:border-[#6DB9B2]" />
                  </div>
                  <button onClick={() => removeProduct(sp.productId)} className="text-red-400 text-sm mt-1 font-bold">✕</button>
                </div>
              ))}
            </div>
          )}
          <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)}
            placeholder="🔍 Cari produk untuk direkomendasikan..."
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-[#6DB9B2] bg-gray-50" />
          {filteredProducts.length > 0 && (
            <div className="mt-2 max-h-44 overflow-y-auto divide-y divide-gray-50">
              {filteredProducts.map(product => (
                <button key={product.id} onClick={() => addProductRec(product)}
                  className="w-full text-left px-4 py-3 hover:bg-[#E2F0EF]/50 text-sm text-gray-600 flex items-center gap-2 transition-colors">
                  <span className="text-[#6DB9B2] font-bold text-base">＋</span>
                  <span className="flex-1">{product.name}</span>
                  <span className="text-xs text-gray-400">{product.sku}</span>
                </button>
              ))}
            </div>
          )}
          {products.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Belum ada produk aktif.</p>}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-4 safe-bottom z-50">
        <div className="max-w-md mx-auto">
          <button onClick={handleSubmit} disabled={submitting || concerns.length === 0}
            className="w-full py-4 bg-[#6DB9B2] text-white font-semibold rounded-full disabled:opacity-50 hover:bg-[#5AA9A2] active:scale-[0.99] transition-all shadow-lg shadow-[#6DB9B2]/20">
            {submitting ? 'Menyimpan...' : existingProfile ? '💾 Perbarui Skin Profile & Simpan' : '✅ Simpan Konsultasi'}
          </button>
        </div>
      </div>
    </div>
  );
}