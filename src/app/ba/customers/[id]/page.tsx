'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { recordPurchaseSchema, type RecordPurchaseFormValues } from '@/lib/validators/schemas';
import type { Customer, Purchase, Product } from '@/types';
import { formatIDR, formatDateTime, formatDate, maskPhone } from '@/lib/utils';
import Link from 'next/link';

export default function BaCustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);

  const form = useForm<RecordPurchaseFormValues>({
    resolver: zodResolver(recordPurchaseSchema),
    defaultValues: {
      invoiceNo: '',
      purchasedAt: new Date().toISOString().slice(0, 16),
      items: [{ productId: '', qty: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      // Load customer
      const customerDoc = await getDoc(doc(db, 'customers', id));
      if (customerDoc.exists()) {
        setCustomer({ id: customerDoc.id, ...customerDoc.data() } as Customer);
      }

      // Load purchases
      const purchasesQ = query(
        collection(db, 'purchases'),
        where('customerId', '==', id),
        orderBy('purchasedAt', 'desc')
      );
      const purchasesSnap = await getDocs(purchasesQ);
      const allPurchases = purchasesSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        purchasedAt: d.data().purchasedAt?.toDate?.()?.toISOString() ?? d.data().purchasedAt,
      })) as Purchase[];
      setPurchases(allPurchases);

      // Load active products
      const productsQ = query(collection(db, 'products'), where('isActive', '==', true));
      const productsSnap = await getDocs(productsQ);
      const allProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[];
      setProducts(allProducts);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: RecordPurchaseFormValues) => {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const { getAuth } = await import('firebase/auth');
      const idToken = await getAuth().currentUser?.getIdToken();

      const res = await fetch('/api/purchases/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          customerId: id,
          ...data,
          purchasedAt: new Date(data.purchasedAt).toISOString(),
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? 'Gagal mencatat pembelian');

      setSuccess('Pembelian berhasil dicatat!');
      setShowForm(false);
      form.reset();
      loadData(); // Refresh
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoid = async (purchaseId: string) => {
    const reason = prompt('Alasan void:');
    if (!reason || reason.trim().length < 5) return;

    try {
      const { getAuth } = await import('firebase/auth');
      const idToken = await getAuth().currentUser?.getIdToken();

      const res = await fetch('/api/purchases/void', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ purchaseId, reason }),
      });

      if (res.ok) {
        setSuccess('Pembelian berhasil divoid');
        loadData();
      }
    } catch (err) {
      setError('Gagal void pembelian');
    }
  };

  const watchedItems = form.watch('items');
  const totalAmount = watchedItems.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-4xl mb-2">🔍</p>
          <p className="text-gray-600">Customer tidak ditemukan</p>
          <Link href="/ba/customers" className="mt-4 block text-purple-600 text-sm">← Kembali</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="gradient-hero px-6 pt-12 pb-16 relative overflow-hidden">
        <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/ba/customers" className="text-white/80 hover:text-white">←</Link>
            <h1 className="text-xl font-bold text-white">Profil Customer</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 glass flex items-center justify-center text-2xl font-bold text-white">
              {customer.fullName.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{customer.fullName}</h2>
              <p className="text-white/70 text-sm">{maskPhone(customer.phone)}</p>
              <p className="text-white/60 text-xs">No. {customer.memberNo}</p>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                customer.status === 'active' ? 'bg-green-400/30 text-green-100' :
                'bg-yellow-400/30 text-yellow-100'
              }`}>
                {customer.status === 'active' ? 'Aktif' : 'Belum Klaim'}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-4 mt-4">
            <div className="glass rounded-xl p-3 text-center flex-1">
              <p className="text-white font-bold text-lg">{customer.purchaseCount}</p>
              <p className="text-white/60 text-xs">Pembelian</p>
            </div>
            <div className="glass rounded-xl p-3 text-center flex-1">
              <p className="text-white font-bold text-lg">{formatIDR(customer.totalSpent)}</p>
              <p className="text-white/60 text-xs">Total Belanja</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-6 pb-8 space-y-4">
        {/* Alerts */}
        {error && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm animate-in">{error}</div>
        )}
        {success && (
          <div className="p-3 rounded-2xl bg-green-50 border border-green-200 text-green-700 text-sm animate-in">{success}</div>
        )}

        {/* Input Purchase CTA */}
        {!showForm && (
          <div className="space-y-3">
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-4 rounded-3xl gradient-hero text-white font-semibold hover:opacity-90 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 shadow-lg flex items-center justify-center gap-2"
            >
              ➕ Input Pembelian Baru
            </button>
            <Link
              href={`/ba/customers/${customer.id}/consultation`}
              className="w-full py-4 rounded-3xl bg-white border-2 border-[#6DB9B2] text-[#6DB9B2] font-semibold hover:bg-[#6DB9B2] hover:text-white transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
            >
              🧴 Konsultasi Kulit
            </Link>
          </div>
        )}

        {/* Purchase Form */}
        {showForm && (
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="bg-white rounded-3xl shadow-sm p-5 space-y-4 animate-in"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Input Pembelian</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-sm">✕ Tutup</button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No. Struk <span className="text-red-500">*</span></label>
              <input
                type="text"
                placeholder="INV-2024-001"
                {...form.register('invoiceNo')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm"
              />
              {form.formState.errors.invoiceNo && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.invoiceNo.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal & Waktu Pembelian</label>
              <input
                type="datetime-local"
                {...form.register('purchasedAt')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm"
              />
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Item Produk <span className="text-red-500">*</span></label>
                <button
                  type="button"
                  onClick={() => append({ productId: '', qty: 1, unitPrice: 0 })}
                  className="text-xs text-purple-600 font-semibold hover:text-purple-700"
                >
                  + Tambah Item
                </button>
              </div>
              <div className="space-y-3">
                {fields.map((field, index) => {
                  const selectedProduct = products.find(p => p.id === form.watch(`items.${index}.productId`));
                  return (
                    <div key={field.id} className="p-3 rounded-2xl bg-gray-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Item {index + 1}</span>
                        {fields.length > 1 && (
                          <button type="button" onClick={() => remove(index)} className="text-xs text-red-500 hover:text-red-700">
                            Hapus
                          </button>
                        )}
                      </div>
                      <select
                        {...form.register(`items.${index}.productId`)}
                        onChange={(e) => {
                          form.setValue(`items.${index}.productId`, e.target.value);
                          const product = products.find(p => p.id === e.target.value);
                          if (product) form.setValue(`items.${index}.unitPrice`, product.defaultPrice);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
                      >
                        <option value="">Pilih Produk...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} — {formatIDR(p.defaultPrice)}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-xs text-gray-500">Qty</label>
                          <input
                            type="number"
                            min={1}
                            {...form.register(`items.${index}.qty`, { valueAsNumber: true })}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-500">Harga/pcs</label>
                          <input
                            type="number"
                            min={0}
                            {...form.register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
                          />
                        </div>
                      </div>
                      {selectedProduct && (
                        <p className="text-xs text-gray-400">
                          Subtotal: {formatIDR((form.watch(`items.${index}.qty`) || 0) * (form.watch(`items.${index}.unitPrice`) || 0))}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              {form.formState.errors.items && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.items.message}</p>
              )}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between p-3 rounded-2xl gradient-card border border-purple-100">
              <span className="font-bold text-gray-900">Total</span>
              <span className="font-bold text-purple-700 text-lg">{formatIDR(totalAmount)}</span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-2xl gradient-hero text-white font-semibold disabled:opacity-50 hover:opacity-90 transition-all duration-200 active:scale-95 shadow-lg"
            >
              {submitting ? 'Menyimpan...' : '✓ Simpan Pembelian'}
            </button>
          </form>
        )}

        {/* Purchase History */}
        <div className="bg-white rounded-3xl shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-4">Riwayat Pembelian</h3>
          {purchases.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-3xl mb-2">🛒</p>
              <p className="text-sm text-gray-400">Belum ada riwayat</p>
            </div>
          ) : (
            <div className="space-y-3">
              {purchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className={`p-3 rounded-2xl border ${
                    purchase.status === 'void' ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-purple-50 border-purple-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{formatDateTime(purchase.purchasedAt)}</p>
                      <p className="text-xs text-gray-500">{purchase.items.length} item · No. {purchase.invoiceNo}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-purple-700">{formatIDR(purchase.totalAmount)}</p>
                      <span className={`text-xs ${purchase.status === 'void' ? 'text-red-500' : 'text-green-600'}`}>
                        {purchase.status === 'void' ? 'Void' : 'Valid'}
                      </span>
                    </div>
                  </div>
                  {purchase.status === 'valid' && (
                    <button
                      onClick={() => handleVoid(purchase.id)}
                      className="mt-2 text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Void Pembelian
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
