'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, getAggregateFromServer, count } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { formatCompact, formatIDR, formatDate } from '@/lib/utils';
import Link from 'next/link';

interface BaStats {
  totalCustomers: number;
  ordersToday: number;
  pendingFollowUp: number;
  repeatPurchaseRate: number;
  totalSales: number;
  customersGrowth: number;
  ordersGrowth: number;
}

interface RecentCustomer {
  id: string;
  fullName: string;
  lastPurchaseAt: string | null;
  status: string;
}

export default function BaDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [stats, setStats] = useState<BaStats>({ 
    totalCustomers: 0, 
    ordersToday: 0, 
    pendingFollowUp: 0, 
    repeatPurchaseRate: 0,
    totalSales: 0,
    customersGrowth: 0,
    ordersGrowth: 0
  });
  const [storeName, setStoreName] = useState('');
  const [recentCustomers, setRecentCustomers] = useState<RecentCustomer[]>([]);
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
      // 1. Get Store Name
      const storeDoc = await getDoc(doc(db, 'stores', user.storeId));
      if (storeDoc.exists()) setStoreName(storeDoc.data()!.name);

      // 2. Get Today's Sales
      const today = new Date().toISOString().slice(0, 10);
      const summaryId = `${today}_${user.storeId}`;
      const summaryDoc = await getDoc(doc(db, 'dailySalesSummary', summaryId));
      
      let ordersToday = 0;
      let totalSales = 0;
      if (summaryDoc.exists()) {
        const data = summaryDoc.data();
        ordersToday = data.totalOrders ?? 0;
        totalSales = data.totalSales ?? 0;
      }

      // 3. Get BA's Customers count
      const customerQuery = query(collection(db, 'customers'), where('registeredByBaId', '==', user.uid));
      const countSnap = await getAggregateFromServer(customerQuery, { count: count() });
      const totalCustomers = countSnap.data().count;

      // Repeat Purchase (purchaseCount > 1)
      const repeatQuery = query(collection(db, 'customers'), where('registeredByBaId', '==', user.uid), where('purchaseCount', '>', 1));
      const repeatSnap = await getAggregateFromServer(repeatQuery, { count: count() });
      const repeatCount = repeatSnap.data().count;
      const repeatPurchaseRate = totalCustomers > 0 ? Math.round((repeatCount / totalCustomers) * 100) : 0;

      // 4. Get Recent Customers
      const recentQuery = query(
        collection(db, 'customers'),
        where('registeredByBaId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const recentDocs = await getDocs(recentQuery);
      const recentList = recentDocs.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          fullName: data.fullName || 'Tanpa Nama',
          lastPurchaseAt: data.lastPurchaseAt ? data.lastPurchaseAt.toDate().toISOString() : null,
          status: data.status
        };
      });

      // Update State
      setStats({
        totalCustomers,
        ordersToday,
        totalSales,
        pendingFollowUp: 7, // Dummy for now
        repeatPurchaseRate,
        customersGrowth: 12, // Dummy for now
        ordersGrowth: 20 // Dummy for now
      });
      setRecentCustomers(recentList);

    } catch (err) {
      console.error('[ba-dashboard]', err);
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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      
      {/* Header & Search */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Halo, {user?.displayName ?? 'BA'}!</h1>
          <p className="text-sm text-gray-500 mt-1">Brand Ambassador - {storeName}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-80">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input 
              type="text" 
              placeholder="Cari nama pelanggan..." 
              className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 transition-all shadow-sm"
            />
          </div>
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center font-bold text-[#2C5C59] border border-gray-200 shrink-0">
            {user?.displayName ? user.displayName.charAt(0) : 'BA'}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-[#E2F0EF] text-[#2C5C59] flex items-center justify-center text-xl shrink-0">👥</div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Customer</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">{formatCompact(stats.totalCustomers)}</h3>
            </div>
          </div>
          <p className="text-xs text-[#2C5C59] font-medium mt-6 bg-[#E2F0EF]/50 inline-block w-fit px-2.5 py-1 rounded-md">
            +{stats.customersGrowth}% dari bulan lalu
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">📋</div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Transaksi Hari Ini</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">{stats.ordersToday}</h3>
            </div>
          </div>
          <p className="text-xs text-blue-600 font-medium mt-6 bg-blue-50/80 inline-block w-fit px-2.5 py-1 rounded-md">
            +{stats.ordersGrowth}% dari kemarin
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-xl shrink-0">💬</div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Follow Up Pending</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">{stats.pendingFollowUp}</h3>
            </div>
          </div>
          <p className="text-xs text-red-500 font-medium mt-6 bg-red-50/80 inline-block w-fit px-2.5 py-1 rounded-md">
            Perlu ditindaklanjuti
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-xl shrink-0">🔄</div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Repeat Purchase</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">{stats.repeatPurchaseRate}%</h3>
            </div>
          </div>
          <p className="text-xs text-purple-600 font-medium mt-6 bg-purple-50/80 inline-block w-fit px-2.5 py-1 rounded-md">
            +{Math.floor(stats.repeatPurchaseRate / 3)}% dari bulan lalu
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        
        {/* Customer Terbaru */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-bold text-gray-900 text-lg">Customer Terbaru</h2>
            <Link href="/ba/customers" className="text-sm text-[#2C5C59] font-semibold hover:underline">
              Lihat Semua
            </Link>
          </div>
          
          <div className="space-y-5">
            {recentCustomers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Belum ada customer.</p>
            ) : (
              recentCustomers.map((c) => (
                <Link key={c.id} href={`/ba/customers/${c.id}`} className="flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-[#2C5C59] font-bold shrink-0">
                      {c.fullName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 group-hover:text-[#2C5C59] transition-colors">{c.fullName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {c.lastPurchaseAt ? `${formatDate(c.lastPurchaseAt)} - Pembelian` : 'Belum transaksi'}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
          <Link href="/ba/customers" className="block w-full text-center mt-6 text-sm text-[#2C5C59] font-semibold py-2 hover:bg-[#E2F0EF]/30 rounded-xl transition-colors">
            Lihat Semua Customer
          </Link>
        </div>

        {/* Rekomendasi Produk */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-col">
          <h2 className="font-bold text-gray-900 text-lg mb-6">Rekomendasi Produk</h2>
          <div className="flex-1 rounded-2xl flex items-center justify-center p-6 flex-col border border-gray-100">
            <div className="w-40 h-40 bg-[#E2F0EF]/30 rounded-full mb-6 flex items-center justify-center">
               <span className="text-6xl">🧴</span>
            </div>
            <h3 className="font-bold text-gray-900 text-center text-lg">Kahf Face Wash Series</h3>
            <p className="text-sm text-gray-500 text-center mt-2">Untuk kulit berjerawat & berminyak</p>
            <Link href="/ba/customers/new" className="mt-8 w-full text-center px-4 py-3 bg-[#2C5C59] text-white text-sm font-semibold rounded-xl hover:bg-[#1f4240] transition-colors shadow-lg shadow-[#6DB9B2]/20">
              Lihat Detail
            </Link>
          </div>
        </div>

        {/* Notifikasi Follow Up */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 text-lg mb-6">Notifikasi Follow Up</h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-orange-100 flex items-center justify-center overflow-hidden shrink-0">
                <span className="text-lg">👩</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Elsa Nanda</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">30 hari sejak pembelian face wash. Waktunya repurchase.</p>
              </div>
            </div>
            <hr className="border-gray-50" />
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden shrink-0">
                <span className="text-lg">👩</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Rani Septiani</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">Produk hampir habis, tawarkan promo paket bundel.</p>
              </div>
            </div>
            <hr className="border-gray-50" />
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-pink-100 flex items-center justify-center overflow-hidden shrink-0">
                <span className="text-lg">👩</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Dewi Lestari</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">Ada rekomendasi produk sunscreen baru untuk kulit sensitif.</p>
              </div>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
