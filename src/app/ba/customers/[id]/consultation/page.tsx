'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import type { Customer, Product, SkinType } from '@/types';

const SKIN_TYPES: { value: SkinType; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'oily', label: 'Berminyak' },
  { value: 'dry', label: 'Kering' },
  { value: 'combination', label: 'Kombinasi' },
  { value: 'sensitive', label: 'Sensitif' },
];

const COMMON_CONCERNS = ['Jerawat', 'Kulit Kusam', 'Flek Hitam', 'Kulit Kering', 'Berminyak', 'Pori Besar', 'Kerutan', 'Sensitif'];

export default function BaConsultationPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [skinType, setSkinType] = useState<SkinType>('normal');
  const [concerns, setConcerns] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<{ productId: string; productName: string; sku: string; reason: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user?.role !== 'ba') { router.replace('/'); return; }
    if (!loading && user) loadData();
  }, [user, loading]);

  const loadData = async () => {
    try {
      const [custDoc, productsSnap] = await Promise.all([
        getDocs(query(collection(db, 'customers'), where('__name__', '==', customerId))),
        getDocs(query(collection(db, 'products'), where('isActive', '==', true))),
      ]);
      if (!custDoc.empty) {
        setCustomer({ id: custDoc.docs[0].id, ...custDoc.docs[0].data() } as Customer);
      }
      setProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]);
    } finally {
      setDataLoading(false);
    }
  };

  const toggleConcern = (c: string) => {
    setConcerns(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const addProductRec = (product: Product) => {
    if (selectedProducts.find(p => p.productId === product.id)) return;
    setSelectedProducts(prev => [...prev, { productId: product.id, productName: product.name, sku: product.sku, reason: '' }]);
  };

  const updateReason = (productId: string, reason: string) => {
    setSelectedProducts(prev => prev.map(p => p.productId === productId ? { ...p, reason } : p));
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.productId !== productId));
  };

  const handleSubmit = async () => {
    if (concerns.length === 0) { alert('Pilih minimal 1 concern'); return; }
    setSubmitting(true);
    try {
      const idToken = await (await import('firebase/auth')).getAuth().currentUser?.getIdToken();
      const res = await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          customerId,
          skinType,
          concerns,
          notes,
          recommendedProducts: selectedProducts,
        }),
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
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-[#2C5C59] mb-2">Konsultasi Tersimpan!</h2>
        <p className="text-sm text-gray-500 mb-6">Skin profile dan rekomendasi telah diperbarui.</p>
        <Link href={`/ba/customers/${customerId}`} className="py-3 px-6 bg-[#6DB9B2] text-white rounded-full font-semibold">
          Kembali ke Profil Customer
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <div className="px-6 pt-12 pb-6 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Link href={`/ba/customers/${customerId}`} className="text-[#2C5C59] p-2 -ml-2 rounded-full hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#2C5C59]">Konsultasi</h1>
            {customer && <p className="text-sm text-gray-500">{customer.fullName}</p>}
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6 pb-32">
        {/* Skin Type */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-[#2C5C59] mb-4">Jenis Kulit</h3>
          <div className="grid grid-cols-3 gap-2">
            {SKIN_TYPES.map(st => (
              <button
                key={st.value}
                onClick={() => setSkinType(st.value)}
                className={`py-3 px-4 rounded-2xl text-sm font-medium transition-all border ${
                  skinType === st.value
                    ? 'bg-[#6DB9B2] text-white border-[#6DB9B2]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#6DB9B2]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Concerns */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-[#2C5C59] mb-4">Concern Kulit</h3>
          <div className="flex flex-wrap gap-2">
            {COMMON_CONCERNS.map(c => (
              <button
                key={c}
                onClick={() => toggleConcern(c)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                  concerns.includes(c)
                    ? 'bg-[#FAEBEC] text-[#D88C95] border-[#D88C95]/30'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-[#D88C95]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-[#2C5C59] mb-4">Catatan</h3>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Catatan tambahan untuk konsultasi..."
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-[#6DB9B2] resize-none"
          />
        </div>

        {/* Recommend Products */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-[#2C5C59] mb-4">Rekomendasi Produk</h3>

          {selectedProducts.map(sp => (
            <div key={sp.productId} className="flex items-start gap-3 p-3 mb-2 bg-[#E2F0EF] rounded-2xl">
              <div className="flex-1">
                <p className="text-sm font-medium text-[#2C5C59]">{sp.productName}</p>
                <input
                  type="text"
                  placeholder="Alasan rekomendasi..."
                  value={sp.reason}
                  onChange={e => updateReason(sp.productId, e.target.value)}
                  className="mt-1 w-full text-xs px-3 py-2 rounded-xl border border-[#6DB9B2]/30 bg-white focus:outline-none"
                />
              </div>
              <button onClick={() => removeProduct(sp.productId)} className="text-red-400 text-xs mt-1">✕</button>
            </div>
          ))}

          <div className="mt-3 max-h-40 overflow-y-auto space-y-1">
            {products.filter(p => !selectedProducts.find(sp => sp.productId === p.id)).map(product => (
              <button
                key={product.id}
                onClick={() => addProductRec(product)}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 text-sm text-gray-600 flex items-center gap-2 transition-colors"
              >
                <span className="text-[#6DB9B2]">＋</span> {product.name} <span className="text-xs text-gray-400 ml-auto">{product.sku}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-4 safe-bottom z-50">
        <button
          onClick={handleSubmit}
          disabled={submitting || concerns.length === 0}
          className="w-full py-4 bg-[#6DB9B2] text-white font-semibold rounded-full disabled:opacity-50 hover:bg-[#5AA9A2] transition-colors"
        >
          {submitting ? 'Menyimpan...' : 'Simpan Konsultasi'}
        </button>
      </div>
    </div>
  );
}
