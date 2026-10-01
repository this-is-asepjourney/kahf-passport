'use client';

import { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { auth } from '@/lib/firebase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  UserPlus,
  Phone,
  QrCode,
  FileText,
  User,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  X,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

interface CustomerResult {
  id: string;
  fullName: string;
  phone: string;
  phoneDisplay: string;
  memberNo: string;
  city?: string;
  status: string;
  purchaseCount: number;
  lastPurchaseAt: string | null;
  createdAt?: string | null;
}

function CustomerSearchContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<CustomerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'unclaimed'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'purchases' | 'name'>('newest');

  // Search Function
  const fetchCustomers = useCallback(async (searchStr: string) => {
    setLoading(true);
    setSearched(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(searchStr.trim())}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      setResults(data.customers ?? []);
    } catch (err) {
      console.error('Customer search error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced live search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers(query);
    }, 280);

    return () => clearTimeout(timer);
  }, [query, fetchCustomers]);

  // Auth Guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Client-side filtering & sorting
  const filteredResults = useMemo(() => {
    let list = [...results];

    if (statusFilter !== 'all') {
      list = list.filter((c) => c.status === statusFilter);
    }

    if (sortBy === 'purchases') {
      list.sort((a, b) => (b.purchaseCount || 0) - (a.purchaseCount || 0));
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.fullName.localeCompare(b.fullName, 'id', { sensitivity: 'base' }));
    }

    return list;
  }, [results, statusFilter, sortBy]);

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/ba"
              className="p-2 bg-white rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              ←
            </Link>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              Customer Database
            </h1>
            <span className="text-xs font-bold bg-[#E2F0EF] text-[#277A73] px-3 py-1 rounded-full border border-[#6DB9B2]/30">
              Wardah
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1 ml-11">
            Pencarian cepat pelanggan Wardah berdasarkan nama, nomor HP, nomor member, atau kota.
          </p>
        </div>

        {/* CTA to Register New Customer */}
        <Link
          href="/ba/customers/new"
          className="px-5 py-3 bg-[#277A73] hover:bg-[#1E6560] text-white text-xs font-bold rounded-2xl shadow-lg shadow-[#277A73]/25 transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Daftarkan Customer Baru</span>
        </Link>
      </div>

      {/* Search Bar & Filters Card */}
      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
        {/* Big Search Input */}
        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-3.5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama pelanggan, nomor HP (08xx / +62), nomor member (WRD-xx), atau kota..."
            className="w-full pl-12 pr-12 py-3.5 bg-gray-50/70 border border-gray-200 rounded-2xl text-sm font-medium text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#277A73] focus:border-transparent transition-all"
            autoFocus
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-3.5 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div className="absolute right-4 top-3.5 text-xs text-gray-400 font-mono">
              Live Search
            </div>
          )}
        </div>

        {/* Filter & Sort Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="font-bold text-gray-500 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              Status:
            </span>
            {[
              { id: 'all', label: 'Semua Status' },
              { id: 'active', label: 'Aktif' },
              { id: 'unclaimed', label: 'Belum Klaim Akun' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors whitespace-nowrap ${
                  statusFilter === f.id
                    ? 'bg-[#277A73] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400">Urutkan:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#277A73]"
            >
              <option value="newest">Paling Baru Terdaftar</option>
              <option value="purchases">Paling Sering Belanja</option>
              <option value="name">Nama (A - Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1 text-xs text-gray-500">
          <span>
            {loading
              ? 'Mencari database customer...'
              : `Menampilkan ${filteredResults.length} customer ${
                  query ? `untuk "${query}"` : 'terbaru'
                }`}
          </span>
          {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#277A73]" />}
        </div>

        {loading && results.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
            <div className="w-10 h-10 rounded-full border-4 border-[#E2F0EF] border-t-[#277A73] animate-spin mx-auto mb-3" />
            <p className="text-xs font-bold text-gray-700">Mencari di seluruh database Wardah...</p>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto text-3xl">
              🔍
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">
                Customer &quot;{query}&quot; Tidak Ditemukan
              </h3>
              <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                Customer belum terdaftar di sistem. Anda dapat langsung mendaftarkannya sekarang agar mendapat poin reward dan riwayat belanja.
              </p>
            </div>
            <Link
              href="/ba/customers/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#277A73] hover:bg-[#1E6560] text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>Daftarkan Sebagai Customer Baru</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredResults.map((customer) => {
              const cleanPhone = customer.phone ? customer.phone.replace(/[^0-9]/g, '') : '';

              return (
                <div
                  key={customer.id}
                  className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 group"
                >
                  {/* Top: Customer Identity */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#277A73] to-[#1E6560] text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0 mt-0.5">
                        {customer.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/ba/customers/${customer.id}`}
                          className="font-bold text-gray-900 text-base hover:text-[#277A73] transition-colors truncate block group-hover:underline"
                        >
                          {customer.fullName}
                        </Link>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          <span className="font-mono text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg border border-gray-200">
                            {customer.memberNo}
                          </span>
                          {customer.city && (
                            <span className="text-[11px] text-gray-400">📍 {customer.city}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        customer.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {customer.status === 'active' ? 'Aktif' : 'Belum Klaim'}
                    </span>
                  </div>

                  {/* Middle: Contact & Stats */}
                  <div className="p-3 bg-gray-50/70 rounded-2xl border border-gray-100 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">
                        Kontak WhatsApp
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-semibold text-gray-800 truncate">
                          {customer.phoneDisplay || customer.phone || '-'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">
                        Aktivitas Belanja
                      </span>
                      <p className="font-bold text-[#277A73] mt-0.5">
                        {customer.purchaseCount}x Transaksi
                      </p>
                    </div>
                  </div>

                  {/* Bottom: Quick Actions for BA */}
                  <div className="pt-2 border-t border-gray-50 flex items-center justify-between gap-2">
                    {cleanPhone && (
                      <Link
                        href={`https://wa.me/${cleanPhone}?text=Halo%20Kak%20${encodeURIComponent(
                          customer.fullName
                        )},%20ada%20yang%20bisa%20kami%20bantu%20dari%20Beauty%20Advisor%20Wardah?`}
                        target="_blank"
                        className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 transition-colors flex items-center gap-1"
                        title="Chat WhatsApp"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </Link>
                    )}

                    <div className="flex items-center gap-1.5 ml-auto">
                      {/* Go to Kasir & Barcode */}
                      <Link
                        href={`/ba/scan?customerId=${customer.id}`}
                        className="px-3 py-2 rounded-xl bg-[#E2F0EF] hover:bg-[#d0e6e4] text-[#277A73] text-xs font-bold border border-[#6DB9B2]/30 transition-colors flex items-center gap-1"
                        title="Buka Kasir & Tampilkan Barcode"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Barcode</span>
                      </Link>

                      {/* Go to Consultation */}
                      <Link
                        href={`/ba/customers/${customer.id}/consultation`}
                        className="px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold border border-gray-200 transition-colors flex items-center gap-1"
                        title="Mulai Konsultasi Kulit"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Konsultasi</span>
                      </Link>

                      {/* Go to Detail Profile */}
                      <Link
                        href={`/ba/customers/${customer.id}`}
                        className="p-2 rounded-xl bg-[#277A73] hover:bg-[#1E6560] text-white transition-colors"
                        title="Lihat Profil Lengkap"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BaCustomersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-4 border-[#E2F0EF] border-t-[#277A73] animate-spin" />
        </div>
      }
    >
      <CustomerSearchContent />
    </Suspense>
  );
}
