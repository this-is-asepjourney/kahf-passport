'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { formatIDR } from '@/lib/utils';
import type { Product } from '@/types';

export default function BaProductsPage() {
  const { user, loading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!loading && user) {
      loadProducts();
    }
  }, [user, loading]);

  const loadProducts = async () => {
    try {
      const q = query(collection(db, 'products'), where('isActive', '==', true));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[];
      setProducts(list);
    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  };

  if (loading || dataLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-[#E2F0EF] border-t-[#2C5C59] animate-spin" />
      </div>
    );
  }

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Katalog Produk</h1>
          <p className="text-sm text-gray-500 mt-1">Daftar produk aktif untuk direkomendasikan ke pelanggan.</p>
        </div>
        
        <div className="relative w-full md:w-80 shrink-0">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari produk atau kategori..." 
            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(p => (
          <div key={p.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
            <div className="h-48 bg-gray-50 flex items-center justify-center p-6 border-b border-gray-50">
              <span className="text-6xl drop-shadow-sm">🧴</span>
            </div>
            <div className="p-5 flex flex-col flex-1">
              <span className="text-xs font-bold text-[#6DB9B2] uppercase tracking-wider mb-1">{p.category}</span>
              <h3 className="font-bold text-gray-900 text-lg leading-tight mb-2">{p.name}</h3>
              <p className="text-sm text-gray-500 line-clamp-2 mb-4 flex-1">{p.description}</p>
              
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
                <span className="font-bold text-[#2C5C59]">{formatIDR(p.defaultPrice)}</span>
                <span className="text-xs text-gray-400">SKU: {p.sku}</span>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500">
            Tidak ada produk yang sesuai pencarian.
          </div>
        )}
      </div>
    </div>
  );
}
