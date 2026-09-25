'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { formatIDR, formatDate } from '@/lib/utils';
import Link from 'next/link';

interface DayStats {
  totalSales: number;
  totalOrders: number;
  newCustomers: number;
}

export default function BaHomePage() {
  const { user, loading, signOutUser } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DayStats>({ totalSales: 0, totalOrders: 0, newCustomers: 0 });
  const [storeName, setStoreName] = useState('');
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user && !['ba', 'admin_region', 'super_admin'].includes(user.role ?? '')) {
      router.replace('/');
      return;
    }
    if (!loading && user) loadData();
  }, [user, loading]);

  const loadData = async () => {
    if (!user?.storeId) return setDataLoading(false);
    try {
      const today = new Date().toISOString().slice(0, 10);

      // Get today's summary
      const summaryId = `${today}_${user.storeId}`;
      const summaryDoc = await getDoc(doc(db, 'dailySalesSummary', summaryId));
      if (summaryDoc.exists()) {
        const data = summaryDoc.data();
        setStats({
          totalSales: data.totalSales ?? 0,
          totalOrders: data.totalOrders ?? 0,
          newCustomers: data.newCustomers ?? 0,
        });
      }

      // Get store name
      const storeDoc = await getDoc(doc(db, 'stores', user.storeId));
      if (storeDoc.exists()) setStoreName(storeDoc.data()!.name);
    } finally {
      setDataLoading(false);
    }
  };

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
      </div>
    );
  }

  const today = formatDate(new Date().toISOString());

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="gradient-hero px-6 pt-12 pb-20 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <p className="text-white/70 text-sm">Selamat bekerja,</p>
            <h1 className="text-2xl font-bold text-white mt-1">{user?.displayName ?? 'BA'}</h1>
            <p className="text-white/60 text-sm mt-1">🏪 {storeName}</p>
            <p className="text-white/50 text-xs mt-0.5">{today}</p>
          </div>
          <button
            onClick={signOutUser}
            className="glass rounded-xl px-3 py-2 text-white/80 text-sm hover:text-white transition-colors"
          >
            Keluar
          </button>
        </div>
      </div>

      <div className="px-6 -mt-12 space-y-4 pb-8">
        {/* Today Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-dark bg-white rounded-3xl shadow-sm p-4 text-center">
            <p className="text-purple-600 text-2xl font-bold">{stats.totalOrders}</p>
            <p className="text-xs text-gray-500 mt-1">Transaksi</p>
          </div>
          <div className="bg-white rounded-3xl shadow-sm p-4 text-center">
            <p className="text-purple-600 text-lg font-bold">{formatIDR(stats.totalSales)}</p>
            <p className="text-xs text-gray-500 mt-1">Penjualan</p>
          </div>
          <div className="bg-white rounded-3xl shadow-sm p-4 text-center">
            <p className="text-purple-600 text-2xl font-bold">{stats.newCustomers}</p>
            <p className="text-xs text-gray-500 mt-1">Customer Baru</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-3xl shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-4">Aksi Cepat</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/ba/scan"
              className="flex flex-col items-center gap-3 p-4 rounded-2xl gradient-hero text-white hover:opacity-90 transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
            >
              <span className="text-3xl">📷</span>
              <span className="text-sm font-semibold">Scan QR</span>
            </Link>
            <Link
              href="/ba/customers"
              className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-purple-50 border border-purple-100 text-purple-700 hover:bg-purple-100 transition-all duration-200 active:scale-95"
            >
              <span className="text-3xl">🔍</span>
              <span className="text-sm font-semibold">Cari Customer</span>
            </Link>
            <Link
              href="/ba/customers/new"
              className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 hover:bg-rose-100 transition-all duration-200 active:scale-95"
            >
              <span className="text-3xl">➕</span>
              <span className="text-sm font-semibold">Customer Baru</span>
            </Link>
            <Link
              href="/ba/purchases"
              className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 hover:bg-amber-100 transition-all duration-200 active:scale-95"
            >
              <span className="text-3xl">📋</span>
              <span className="text-sm font-semibold">Riwayat Hari Ini</span>
            </Link>
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-sm text-blue-700">
            💡 Scan QR customer atau cari nomor HP untuk mencatat pembelian baru.
          </p>
        </div>
      </div>
    </div>
  );
}
