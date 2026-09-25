'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Customer } from '@/types';
import { formatDate, formatIDR, maskPhone } from '@/lib/utils';
import Link from 'next/link';

export default function AdminCustomersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'unclaimed' | 'blocked'>('all');

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && user && !['admin_region', 'super_admin'].includes(user.role ?? '')) {
      router.replace('/');
      return;
    }
    if (!loading && user) loadCustomers();
  }, [user, loading, filter]);

  const loadCustomers = async () => {
    setDataLoading(true);
    try {
      let q = query(
        collection(db, 'customers'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      if (filter !== 'all') {
        q = query(
          collection(db, 'customers'),
          where('status', '==', filter),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
      }

      const snap = await getDocs(q);
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Customer[]);
    } finally {
      setDataLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="gradient-hero px-6 pt-12 pb-8">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-white/80 hover:text-white">←</Link>
          <h1 className="text-xl font-bold text-white">Manajemen Customer</h1>
        </div>
      </div>

      <div className="px-6 -mt-4 pb-8 space-y-4">
        {/* Filter Tabs */}
        <div className="bg-white rounded-3xl shadow-sm p-2 flex gap-1 overflow-x-auto">
          {(['all', 'active', 'unclaimed', 'blocked'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-4 py-2 rounded-2xl text-xs font-semibold transition-all ${
                filter === f ? 'gradient-hero text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'all' ? 'Semua' : f === 'active' ? 'Aktif' : f === 'unclaimed' ? 'Belum Klaim' : 'Diblokir'}
            </button>
          ))}
        </div>

        {/* Customer List */}
        {dataLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
          </div>
        ) : customers.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm p-8 text-center">
            <p className="text-4xl mb-2">👥</p>
            <p className="text-gray-500">Tidak ada data customer</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 px-1">{customers.length} ditampilkan (maks 50)</p>
            {customers.map(customer => (
              <Link
                key={customer.id}
                href={`/admin/customers/${customer.id}`}
                className="block bg-white rounded-3xl shadow-sm p-4 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl gradient-hero flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {customer.fullName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{customer.fullName}</p>
                    <p className="text-xs text-gray-500">{maskPhone(customer.phone)}</p>
                    <p className="text-xs text-gray-400">No. {customer.memberNo}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      customer.status === 'active' ? 'bg-green-100 text-green-700' :
                      customer.status === 'unclaimed' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {customer.status === 'active' ? 'Aktif' : customer.status === 'unclaimed' ? 'Belum Klaim' : 'Diblokir'}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">{customer.purchaseCount} pembelian</p>
                    <p className="text-xs font-semibold text-purple-600">{formatIDR(customer.totalSpent)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
