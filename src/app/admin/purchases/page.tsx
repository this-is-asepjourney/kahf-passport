'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Purchase } from '@/types';
import { formatIDR, formatDateTime } from '@/lib/utils';
import Link from 'next/link';

export default function AdminPurchasesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user && !['admin_region', 'super_admin'].includes(user.role ?? '')) {
      router.replace('/'); return;
    }
    if (!loading && user) {
      getDocs(query(collection(db, 'purchases'), orderBy('purchasedAt', 'desc'), limit(100)))
        .then(snap => setPurchases(snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          purchasedAt: d.data().purchasedAt?.toDate?.()?.toISOString() ?? d.data().purchasedAt,
        })) as Purchase[]))
        .finally(() => setDataLoading(false));
    }
  }, [user, loading]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="gradient-hero px-6 pt-12 pb-8">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-white/80 hover:text-white">←</Link>
          <h1 className="text-xl font-bold text-white">Riwayat Transaksi</h1>
        </div>
        <p className="text-white/60 text-sm mt-1 ml-8">100 transaksi terakhir</p>
      </div>

      <div className="px-6 -mt-4 pb-8 space-y-3">
        {dataLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
          </div>
        ) : purchases.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm p-8 text-center">
            <p className="text-4xl mb-2">🛍️</p>
            <p className="text-gray-500">Belum ada transaksi</p>
          </div>
        ) : (
          purchases.map(purchase => (
            <div key={purchase.id} className={`bg-white rounded-3xl shadow-sm p-4 ${purchase.status === 'void' ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{purchase.customerNameSnapshot}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(purchase.purchasedAt)}</p>
                  <p className="text-xs text-gray-400 mt-1">BA: {purchase.baNameSnapshot} · {purchase.storeNameSnapshot}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-purple-700">{formatIDR(purchase.totalAmount)}</p>
                  <span className={`text-xs ${purchase.status === 'void' ? 'text-red-500' : 'text-green-600'}`}>
                    {purchase.status === 'void' ? 'Void' : 'Valid'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
