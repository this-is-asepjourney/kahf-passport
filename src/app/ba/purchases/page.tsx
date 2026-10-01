'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Purchase } from '@/types';
import { formatIDR, formatDateTime } from '@/lib/utils';
import Link from 'next/link';

type PeriodFilter = 'today' | '7days' | '30days' | 'month' | 'all';

export default function BaPurchasesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [allPurchases, setAllPurchases] = useState<Purchase[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>('today');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'void'>('all');

  useEffect(() => {
    const loadPurchases = async () => {
      if (!user) return;
      setDataLoading(true);
      try {
        const q = query(
          collection(db, 'purchases'),
          where('baId', '==', user.uid)
        );

        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          purchasedAt: d.data().purchasedAt?.toDate?.()?.toISOString() ?? d.data().purchasedAt,
        })) as Purchase[];

        // Sort descending by purchasedAt
        list.sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());
        setAllPurchases(list);
      } catch (err) {
        console.error('Error fetching BA purchases:', err);
      } finally {
        setDataLoading(false);
      }
    };

    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user) loadPurchases();
  }, [user, loading, router]);

  // Filter by selected period and search keyword
  const filteredPurchases = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    return allPurchases.filter(p => {
      // Status filter
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;

      // Period filter
      const pTime = new Date(p.purchasedAt).getTime();
      const pDate = new Date(p.purchasedAt);

      if (period === 'today') {
        if (pTime < todayStart) return false;
      } else if (period === '7days') {
        if (pTime < sevenDaysAgo) return false;
      } else if (period === '30days') {
        if (pTime < thirtyDaysAgo) return false;
      } else if (period === 'month') {
        if (pDate.getMonth() !== now.getMonth() || pDate.getFullYear() !== now.getFullYear()) {
          return false;
        }
      }

      // Keyword search (Customer name or invoice)
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = p.customerNameSnapshot?.toLowerCase().includes(q);
        const matchesInvoice = p.invoiceNo?.toLowerCase().includes(q);
        const matchesPhone = p.customerPhoneSnapshot?.includes(q);
        if (!matchesName && !matchesInvoice && !matchesPhone) return false;
      }

      return true;
    });
  }, [allPurchases, period, search, statusFilter]);

  const totalValidAmount = filteredPurchases
    .filter(p => p.status === 'valid')
    .reduce((sum, p) => sum + p.totalAmount, 0);

  const totalValidCount = filteredPurchases.filter(p => p.status === 'valid').length;
  const totalVoidCount = filteredPurchases.filter(p => p.status === 'void').length;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      
      {/* Header */}
      <div className="gradient-hero px-6 pt-12 pb-8">
        <div className="flex items-center gap-3">
          <Link href="/ba" className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors">
            ←
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Laporan & Riwayat Transaksi</h1>
            <p className="text-white/70 text-xs mt-0.5">
              Riwayat penjualan pribadi Anda sebagai Beauty Advisor Wardah
            </p>
          </div>
        </div>

        {/* Quick Stats in Banner */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-white">
            <p className="text-[11px] text-white/70 font-medium">Total Penjualan Valid</p>
            <p className="text-xl font-bold mt-0.5">{formatIDR(totalValidAmount)}</p>
            <p className="text-[10px] text-white/60 mt-1">{totalValidCount} transaksi berhasil</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-white">
            <p className="text-[11px] text-white/70 font-medium">Status Transaksi</p>
            <p className="text-xl font-bold mt-0.5">{filteredPurchases.length} Total</p>
            <p className="text-[10px] text-white/60 mt-1">
              {totalVoidCount > 0 ? `${totalVoidCount} void` : 'Semua transaksi aktif'}
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-3 space-y-4">
        
        {/* Period Filter Tabs */}
        <div className="bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 flex gap-1 overflow-x-auto">
          {[
            { id: 'today', label: 'Hari Ini' },
            { id: '7days', label: '7 Hari' },
            { id: 'month', label: 'Bulan Ini' },
            { id: '30days', label: '30 Hari' },
            { id: 'all', label: 'Semua Riwayat' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setPeriod(tab.id as PeriodFilter)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex-1 text-center ${
                period === tab.id
                  ? 'bg-[#2C5C59] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar & Status Filter */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari customer / nomor invoice..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#6DB9B2] shadow-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#6DB9B2]"
          >
            <option value="all">Semua Status</option>
            <option value="valid">Hanya Valid</option>
            <option value="void">Hanya Void</option>
          </select>
        </div>

        {/* Transaction List */}
        {dataLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-4 border-[#E2F0EF] border-t-[#2C5C59] animate-spin" />
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm p-8 text-center border border-gray-100">
            <p className="text-4xl mb-2">📋</p>
            <p className="text-gray-800 font-bold text-sm">Tidak ada transaksi</p>
            <p className="text-gray-400 text-xs mt-1">
              {search ? 'Tidak ditemukan transaksi yang cocok dengan kata kunci.' : 'Belum ada transaksi pada periode yang dipilih.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPurchases.map(purchase => (
              <div
                key={purchase.id}
                className={`bg-white rounded-3xl shadow-sm p-4 border border-gray-100 hover:shadow-md transition-shadow ${
                  purchase.status === 'void' ? 'opacity-60 bg-gray-50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900 text-sm">{purchase.customerNameSnapshot}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        purchase.status === 'void' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {purchase.status === 'void' ? 'Void' : 'Valid'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">{formatDateTime(purchase.purchasedAt)}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      No. {purchase.invoiceNo} · {purchase.items?.length || 0} produk
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-[#2C5C59] text-base">{formatIDR(purchase.totalAmount)}</p>
                    <Link
                      href={`/ba/customers/${purchase.customerId}`}
                      className="inline-block mt-1 text-[11px] font-bold text-[#6DB9B2] hover:underline"
                    >
                      Lihat Customer →
                    </Link>
                  </div>
                </div>

                {/* Items Preview */}
                {purchase.items && purchase.items.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-1.5">
                    {purchase.items.map((item, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] bg-gray-50 text-gray-600 px-2 py-1 rounded-lg border border-gray-100"
                      >
                        {item.qty}x {item.productName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
