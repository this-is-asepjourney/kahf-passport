/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Product, ProductCategory } from '@/types';
import { formatIDR } from '@/lib/utils';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productSchema, type ProductFormValues } from '@/lib/validators/schemas';
import { ImageUpload } from '@/components/ImageUpload';

export default function AdminProductsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      isActive: true,
      sku: `PRD-${Math.random().toString(36).substring(2, 8).toUpperCase()}` // simple random SKU
    }
  });

  const loadData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user && !['admin_region', 'super_admin'].includes(user.role ?? '')) {
      router.replace('/');
      return;
    }
    if (!loading && user) loadData();
  }, [user, loading, router, loadData]);

  const toggleActive = async (product: Product) => {
    if (user?.role !== 'super_admin') return;
    await updateDoc(doc(db, 'products', product.id), { isActive: !product.isActive });
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isActive: !p.isActive } : p));
  };

  const openAddModal = () => {
    setEditingProduct(null);
    reset({
      isActive: true,
      sku: `PRD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    });
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    reset({
      name: product.name,
      description: product.description || '',
      categoryId: product.categoryId,
      sku: product.sku,
      defaultPrice: product.defaultPrice,
      imageUrl: product.imageUrl,
      isActive: product.isActive,
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: ProductFormValues) => {
    if (user?.role !== 'super_admin') return;
    setIsSubmitting(true);
    try {
      if (editingProduct) {
        // Edit mode
        await updateDoc(doc(db, 'products', editingProduct.id), data);
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...data } : p));
      } else {
        // Add mode
        const newProduct = {
          ...data,
          createdAt: serverTimestamp(),
        };
        const docRef = await addDoc(collection(db, 'products'), newProduct);
        setProducts(prev => [{
          id: docRef.id,
          ...data,
          createdAt: new Date().toISOString()
        } as unknown as Product, ...prev]);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Gagal menyimpan produk.');
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
            onClick={openAddModal}
            className="px-4 py-2 bg-[#2C5C59] text-white font-medium rounded-xl hover:bg-[#1f4240] transition-colors shadow-sm"
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
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-xl object-cover shadow-sm border border-gray-100" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-[#E2F0EF] text-[#2C5C59] flex items-center justify-center text-lg">
                            🧴
                          </div>
                        )}
                        <div>
                          <p 
                            className="font-bold text-gray-900 cursor-pointer hover:text-[#2C5C59] transition-colors"
                            onClick={() => user?.role === 'super_admin' && openEditModal(product)}
                          >
                            {product.name}
                          </p>
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

      {/* Add/Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10 sm:rounded-t-3xl rounded-t-3xl">
              <h2 className="font-bold text-lg text-gray-900">
                {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center font-bold">✕</button>
            </div>
            
            <div className="overflow-y-auto flex-1">
              <form id="product-form" onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 text-center">Foto Produk (Opsional)</label>
                  <Controller
                    name="imageUrl"
                    control={control}
                    render={({ field }) => (
                      <ImageUpload
                        onUploadSuccess={(url) => field.onChange(url)}
                        folder="products"
                        currentImage={field.value}
                        className="w-full max-w-[140px] mx-auto aspect-square rounded-2xl overflow-hidden shadow-sm border border-gray-200"
                        label="Unggah Foto"
                      />
                    )}
                  />
                  {errors.imageUrl && <p className="text-xs text-red-500 mt-1 text-center">{errors.imageUrl.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nama Produk <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="Mis. Kahf Face Wash"
                    {...register('name')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none transition-all"
                  />
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Deskripsi Produk</label>
                  <textarea
                    placeholder="Deskripsi singkat produk..."
                    {...register('description')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none transition-all resize-none h-24"
                  />
                  {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Kategori <span className="text-red-500">*</span></label>
                    <select
                      {...register('categoryId')}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none transition-all bg-white"
                    >
                      <option value="">Pilih Kategori...</option>
                      {categories.length > 0 ? categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      )) : (
                        <option value="umum">Umum</option>
                      )}
                    </select>
                    {errors.categoryId && <p className="text-xs text-red-500 mt-1">{errors.categoryId.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">SKU / Kode <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      {...register('sku')}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none transition-all font-mono text-sm"
                    />
                    {errors.sku && <p className="text-xs text-red-500 mt-1">{errors.sku.message}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Harga (IDR) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    placeholder="Mis. 45000"
                    {...register('defaultPrice', { valueAsNumber: true })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none transition-all font-medium text-gray-900"
                  />
                  {errors.defaultPrice && <p className="text-xs text-red-500 mt-1">{errors.defaultPrice.message}</p>}
                </div>
              </form>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3 sm:rounded-b-3xl shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-[1] px-4 py-3.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
              >
                Batal
              </button>
              <button
                type="submit"
                form="product-form"
                disabled={isSubmitting}
                className="flex-[2] px-4 py-3.5 bg-[#2C5C59] text-white font-bold rounded-xl hover:bg-[#1f4240] disabled:opacity-50 transition-colors shadow-lg shadow-[#2C5C59]/20"
              >
                {isSubmitting ? 'Menyimpan...' : (editingProduct ? 'Simpan Perubahan' : 'Tambah Produk')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
