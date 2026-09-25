'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

interface CustomerResult {
  id: string;
  fullName: string;
  phoneDisplay: string;
  memberNo: string;
  status: string;
  purchaseCount: number;
  lastPurchaseAt: string | null;
}

export default function BaCustomersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (query.trim().length < 3) return;
    setLoading(true);
    setSearched(true);
    try {
      const idToken = await (await import('firebase/auth')).getAuth().currentUser?.getIdToken();
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      setResults(data.customers ?? []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="gradient-hero px-6 pt-12 pb-8">
        <div className="flex items-center gap-3">
          <Link href="/ba" className="text-white/80 hover:text-white">←</Link>
          <h1 className="text-xl font-bold text-white">Cari Customer</h1>
        </div>
      </div>

      <div className="px-6 -mt-4 pb-8 space-y-4">
        {/* Search Box */}
        <div className="bg-white rounded-3xl shadow-sm p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Nama atau nomor HP..."
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm"
            />
            <button
              onClick={handleSearch}
              disabled={loading || query.trim().length < 3}
              className="px-4 py-3 gradient-hero text-white rounded-xl font-semibold disabled:opacity-50 hover:opacity-90 transition-all active:scale-95 flex-shrink-0"
            >
              {loading ? '...' : '🔍'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 px-1">Minimal 3 karakter</p>
        </div>

        {/* Register New Customer CTA */}
        <Link
          href="/ba/customers/new"
          className="block bg-purple-600 rounded-3xl shadow-sm p-4 text-white hover:bg-purple-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-lg">➕</div>
            <div>
              <p className="font-semibold">Daftar Customer Baru</p>
              <p className="text-sm text-white/70">Customer belum terdaftar di sistem</p>
            </div>
          </div>
        </Link>

        {/* Results */}
        {searched && !loading && (
          <div>
            {results.length === 0 ? (
              <div className="bg-white rounded-3xl shadow-sm p-6 text-center">
                <p className="text-3xl mb-2">🔍</p>
                <p className="text-gray-600 font-medium">Customer tidak ditemukan</p>
                <p className="text-sm text-gray-400 mt-1">Coba daftar sebagai customer baru</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 px-1">{results.length} hasil ditemukan</p>
                {results.map((customer) => (
                  <Link
                    key={customer.id}
                    href={`/ba/customers/${customer.id}`}
                    className="block bg-white rounded-3xl shadow-sm p-4 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl gradient-hero flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                          {customer.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{customer.fullName}</p>
                          <p className="text-xs text-gray-500">{customer.phoneDisplay}</p>
                          <p className="text-xs text-gray-400">No. {customer.memberNo}</p>
                        </div>
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
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
