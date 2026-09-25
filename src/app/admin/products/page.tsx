'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Product, ProductCategory } from '@/types';
import { formatIDR } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productSchema, type ProductFormValues } from '@/lib/validators/schemas';

export default function AdminProductsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      isActive: true,
      sku: `PRD-${Math.random().toString(36).substring(2, 8).toUpperCase()}` // simple random SKU
    }
  });

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
        getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc'))),
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

  const onSubmit = async (data: ProductFormValues) => {
    if (user?.role !== 'super_admin') return;
    setIsSubmitting(true);
    try {
      const newProduct = {
        ...data,
        createdAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, 'products'), newProduct);
      
      // Update local state to reflect new product
      setProducts(prev => [{
        id: docRef.id,
        ...data,
        createdAt: new Date().toISOString()
      } as unknown as Product, ...prev]);
      
      // Close modal and reset
      setIsModalOpen(false);
      reset({
        isActive: true,
        sku: `PRD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      });
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Gagal menambah produk.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name ?? categoryId;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rekomendasi Produk</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola data produk yang tersedia</p>
        </div>
        {user?.role === 'super_admin' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-[#2C5C59] text-white font-medium rounded-xl hover:bg-[#1f4240] transition-colors"
          >
            + Tambah Produk
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {dataLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-4 border-[#E2F0EF] border-t-[#2C5C59] animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">📦</p>
            <h3 className="text-lg font-semibold text-gray-900">Belum ada produk</h3>
            <p className="text-sm text-gray-500 mt-1">Silakan tambah produk baru untuk mulai berjualan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">Nama Produk</th>
                  <th className="px-6 py-4 font-semibold">SKU / Kode</th>
                  <th className="px-6 py-4 font-semibold">Kategori</th>
                  <th className="px-6 py-4 font-semibold text-right">Harga</th>
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map(product => (
                  <tr key={product.id} className={`hover:bg-gray-50/50 transition-colors ${!product.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#E2F0EF] text-[#2C5C59] flex items-center justify-center text-lg">
                          🧴
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-500 max-w-xs truncate">{product.description || 'Tidak ada deskripsi'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{product.sku}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium">
                        {getCategoryName(product.categoryId)}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900 text-right">
                      {formatIDR(product.defaultPrice)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => toggleActive(product)}
                        disabled={user?.role !== 'super_admin'}
                        className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
                          product.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-50 text-red-600 hover:bg-red-100'
                        } ${user?.role !== 'super_admin' && 'cursor-default opacity-80'}`}
                      >
                        {product.isActive ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-in">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-lg text-gray-900">Tambah Produk Baru</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Produk</label>
                <input
                  type="text"
                  placeholder="Mis. Kahf Face Wash"
                  {...register('name')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none transition-all"
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi Produk</label>
                <textarea
                  placeholder="Deskripsi singkat produk..."
                  {...register('description')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none transition-all resize-none h-20"
                />
                {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                  <select
                    {...register('categoryId')}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none transition-all bg-white"
                  >
                    <option value="">Pilih Kategori</option>
                    {categories.length > 0 ? categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    )) : (
                      <option value="umum">Umum</option>
                    )}
                  </select>
                  {errors.categoryId && <p className="text-xs text-red-500 mt-1">{errors.categoryId.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU / Kode</label>
                  <input
                    type="text"
                    {...register('sku')}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none transition-all"
                  />
                  {errors.sku && <p className="text-xs text-red-500 mt-1">{errors.sku.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Harga (Rp)</label>
                <input
                  type="number"
                  placeholder="Mis. 45000"
                  {...register('defaultPrice', { valueAsNumber: true })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none transition-all"
                />
                {errors.defaultPrice && <p className="text-xs text-red-500 mt-1">{errors.defaultPrice.message}</p>}
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-[#2C5C59] text-white font-medium rounded-xl hover:bg-[#1f4240] disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
