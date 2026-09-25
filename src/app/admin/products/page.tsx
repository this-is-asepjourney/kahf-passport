'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Product, ProductCategory } from '@/types';
import { formatIDR } from '@/lib/utils';
import Link from 'next/link';

export default function AdminProductsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user && !['admin_region', 'super_admin'].includes(user.role ?? '')) {
      router.replace('/');
      return;
    }
    if (!loading && user) loadData();
  }, [user, loading]);

  const loadData = async () => {
    try {
      const [productsSnap, categoriesSnap] = await Promise.all([
        getDocs(query(collection(db, 'products'), orderBy('name', 'asc'))),
        getDocs(collection(db, 'productCategories')),
      ]);
      setProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]);
      setCategories(categoriesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as ProductCategory[]);
    } finally {
      setDataLoading(false);
    }
  };

  const toggleActive = async (product: Product) => {
    if (user?.role !== 'super_admin') return;
    await updateDoc(doc(db, 'products', product.id), { isActive: !product.isActive });
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isActive: !p.isActive } : p));
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name ?? '-';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="gradient-hero px-6 pt-12 pb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-white/80 hover:text-white">←</Link>
            <h1 className="text-xl font-bold text-white">Master Produk</h1>
          </div>
          <p className="text-white/60 text-sm">{products.length} produk</p>
        </div>
      </div>

      <div className="px-6 -mt-4 pb-8 space-y-3">
        {dataLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm p-8 text-center">
            <p className="text-4xl mb-2">📦</p>
            <p className="text-gray-500">Belum ada produk</p>
          </div>
        ) : (
          products.map(product => (
            <div
              key={product.id}
              className={`bg-white rounded-3xl shadow-sm p-4 transition-all ${!product.isActive ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl gradient-hero flex items-center justify-center text-xl flex-shrink-0">
                    💄
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                    <p className="text-xs text-gray-400">{getCategoryName(product.categoryId)}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-purple-700 text-sm">{formatIDR(product.defaultPrice)}</p>
                  {user?.role === 'super_admin' && (
                    <button
                      onClick={() => toggleActive(product)}
                      className={`mt-1 text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${
                        product.isActive
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {product.isActive ? 'Aktif' : 'Nonaktif'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
