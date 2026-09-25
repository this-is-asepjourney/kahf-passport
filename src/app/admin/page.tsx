'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import {
  collection, query, where, orderBy, limit, getDocs,
  getAggregateFromServer, count, sum
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { formatIDR, formatCompact, formatDate } from '@/lib/utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts';
import Link from 'next/link';
import type { DailySalesSummary, DailyProductSummary } from '@/types';

interface KpiData {
  totalCustomers: number;
  totalSales: number;
  totalOrders: number;
  newCustomersToday: number;
}

interface TrendData {
  date: string;
  sales: number;
  orders: number;
}

interface TopProduct {
  productId: string;
  productName: string;
  qty: number;
  sales: number;
}

export default function AdminDashboardPage() {
  const { user, loading, signOutUser } = useAuth();
  const router = useRouter();
  const [kpi, setKpi] = useState<KpiData>({ totalCustomers: 0, totalSales: 0, totalOrders: 0, newCustomersToday: 0 });
  const [trend, setTrend] = useState<TrendData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user && !['admin_region', 'super_admin'].includes(user.role ?? '')) {
      router.replace('/');
      return;
    }
    if (!loading && user) loadData();
  }, [user, loading, dateRange]);

  const loadData = async () => {
    setDataLoading(true);
    try {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const dates: string[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().slice(0, 10));
      }
      const startDate = dates[0];
      const endDate = dates[dates.length - 1];

      // Build summary query (filter by region if admin_region)
      let summaryQuery = query(
        collection(db, 'dailySalesSummary'),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'asc')
      );

      if (user?.role === 'admin_region' && user.regionId) {
        summaryQuery = query(
          collection(db, 'dailySalesSummary'),
          where('regionId', '==', user.regionId),
          where('date', '>=', startDate),
          where('date', '<=', endDate),
          orderBy('date', 'asc')
        );
      }

      const summarySnap = await getDocs(summaryQuery);
      const summaries = summarySnap.docs.map(d => d.data() as DailySalesSummary);

      // Aggregate by date
      const dateMap = new Map<string, { sales: number; orders: number }>();
      dates.forEach(d => dateMap.set(d, { sales: 0, orders: 0 }));
      summaries.forEach(s => {
        const existing = dateMap.get(s.date) ?? { sales: 0, orders: 0 };
        dateMap.set(s.date, {
          sales: existing.sales + s.totalSales,
          orders: existing.orders + s.totalOrders,
        });
      });

      const trendData: TrendData[] = [...dateMap.entries()].map(([date, data]) => ({
        date: date.slice(5), // MM-DD
        ...data,
      }));
      setTrend(trendData);

      // Total KPIs from summaries
      const totalSales = summaries.reduce((s, d) => s + d.totalSales, 0);
      const totalOrders = summaries.reduce((s, d) => s + d.totalOrders, 0);

      // Today's new customers
      const todaySummaries = summaries.filter(s => s.date === endDate);
      const newCustomersToday = todaySummaries.reduce((s, d) => s + (d.newCustomers ?? 0), 0);

      // Total customer count (lightweight)
      let customerCountQuery = query(collection(db, 'customers'));
      if (user?.role === 'admin_region' && user.regionId) {
        customerCountQuery = query(
          collection(db, 'customers'),
          where('regionId', '==', user.regionId)
        );
      }
      const countResult = await getAggregateFromServer(customerCountQuery, { count: count() });
      const totalCustomers = countResult.data().count;

      setKpi({ totalCustomers, totalSales, totalOrders, newCustomersToday });

      // Top products
      let productQuery = query(
        collection(db, 'dailyProductSummary'),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      const productSnap = await getDocs(productQuery);
      const productMap = new Map<string, TopProduct>();

      productSnap.docs.forEach(d => {
        const data = d.data() as DailyProductSummary;
        const existing = productMap.get(data.productId) ?? {
          productId: data.productId,
          productName: data.productName,
          qty: 0,
          sales: 0,
        };
        productMap.set(data.productId, {
          ...existing,
          qty: existing.qty + data.qty,
          sales: existing.sales + data.sales,
        });
      });

      const sortedProducts = [...productMap.values()]
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);
      setTopProducts(sortedProducts);
    } catch (err) {
      console.error('[admin-dashboard]', err);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="gradient-hero px-6 pt-12 pb-8 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard Admin</h1>
            <p className="text-white/60 text-sm mt-1">
              {user?.role === 'super_admin' ? 'Seluruh Wilayah' : `Wilayah ${user?.regionId ?? '-'}`}
            </p>
          </div>
          <button
            onClick={signOutUser}
            className="glass rounded-xl px-3 py-2 text-white/80 text-sm hover:text-white transition-colors"
          >
            Keluar
          </button>
        </div>
      </div>

      <div className="px-6 -mt-4 pb-8 space-y-4">
        {/* Date Range Filter */}
        <div className="bg-white rounded-3xl shadow-sm p-2 flex gap-1">
          {(['7d', '30d', '90d'] as const).map(range => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`flex-1 py-2 rounded-2xl text-sm font-semibold transition-all ${
                dateRange === range
                  ? 'gradient-hero text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {range === '7d' ? '7 Hari' : range === '30d' ? '30 Hari' : '90 Hari'}
            </button>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-3xl shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">Total Customer</p>
            <p className="text-2xl font-bold text-gradient">{formatCompact(kpi.totalCustomers)}</p>
            <p className="text-xs text-green-500 mt-1">+{kpi.newCustomersToday} hari ini</p>
          </div>
          <div className="bg-white rounded-3xl shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">Total Penjualan</p>
            <p className="text-xl font-bold text-gradient">{formatIDR(kpi.totalSales)}</p>
            <p className="text-xs text-gray-400 mt-1">{dateRange}</p>
          </div>
          <div className="bg-white rounded-3xl shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">Total Transaksi</p>
            <p className="text-2xl font-bold text-gradient">{formatCompact(kpi.totalOrders)}</p>
            <p className="text-xs text-gray-400 mt-1">{dateRange}</p>
          </div>
          <div className="bg-white rounded-3xl shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">Avg Transaksi</p>
            <p className="text-xl font-bold text-gradient">
              {kpi.totalOrders > 0 ? formatIDR(kpi.totalSales / kpi.totalOrders) : formatIDR(0)}
            </p>
          </div>
        </div>

        {/* Sales Trend Chart */}
        <div className="bg-white rounded-3xl shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-4">Tren Penjualan</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} />
              <Tooltip
                formatter={(value: any) => [formatIDR(value as number), 'Penjualan']}
                labelStyle={{ fontSize: 12 }}
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
              />
              <Line
                type="monotone"
                dataKey="sales"
                stroke="#7C3AED"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#7C3AED' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-3xl shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-4">Produk Terlaris</h2>
          {topProducts.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-3xl mb-2">📦</p>
              <p className="text-sm text-gray-400">Belum ada data produk</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topProducts.map((product, i) => (
                <div key={product.productId} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl gradient-hero flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{product.productName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div
                        className="h-1.5 rounded-full gradient-hero"
                        style={{ width: `${(product.qty / topProducts[0].qty) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-purple-700">{product.qty} pcs</p>
                    <p className="text-xs text-gray-400">{formatIDR(product.sales)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <div className="bg-white rounded-3xl shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-4">Manajemen</h2>
          <div className="grid grid-cols-2 gap-3">
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gray-50 hover:bg-purple-50 hover:border-purple-100 border border-transparent transition-all"
              >
                <span className="text-2xl">{link.icon}</span>
                <span className="text-xs text-gray-600 font-medium text-center">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const adminLinks = [
  { href: '/admin/customers', icon: '👥', label: 'Customer' },
  { href: '/admin/purchases', icon: '🛍️', label: 'Transaksi' },
  { href: '/admin/products', icon: '📦', label: 'Produk' },
  { href: '/admin/stores', icon: '🏪', label: 'Counter' },
  { href: '/admin/ba', icon: '👩‍💼', label: 'Brand Ambassador' },
  { href: '/admin/users', icon: '🔑', label: 'Pengguna & Role' },
  { href: '/admin/audit-logs', icon: '📋', label: 'Audit Log' },
  { href: '/admin/regions', icon: '🗺️', label: 'Wilayah' },
];
