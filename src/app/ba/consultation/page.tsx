'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function BaConsultationIndexPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim().length < 3) return;
    
    setLoading(true);
    // Since we just want to jump to a customer's consultation page, we'll route to the search page with a query, 
    // or just let them search here and redirect them to the first match's consultation page.
    // For simplicity, we just redirect to the main customer search and let them click the customer.
    router.push(`/ba/customers?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mulai Konsultasi</h1>
        <p className="text-sm text-gray-500 mt-1">Cari pelanggan untuk mencatat profil kulit dan memberikan rekomendasi produk.</p>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center max-w-2xl mx-auto mt-12">
        <div className="w-20 h-20 bg-[#E2F0EF] rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">🧴</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Cari Customer</h2>
        <p className="text-sm text-gray-500 mb-8">Masukkan nama atau nomor HP pelanggan untuk memulai sesi konsultasi.</p>
        
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="0812xxx atau Nama..."
            className="flex-1 px-4 py-4 rounded-xl border border-gray-200 focus:border-[#6DB9B2] focus:ring-2 focus:ring-[#6DB9B2]/20 outline-none transition-all"
          />
          <button
            type="submit"
            disabled={loading || query.trim().length < 3}
            className="px-8 py-4 bg-[#2C5C59] text-white rounded-xl font-semibold disabled:opacity-50 hover:bg-[#1f4240] transition-colors shrink-0"
          >
            {loading ? 'Mencari...' : 'Cari'}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-gray-50">
          <p className="text-sm text-gray-500 mb-4">Atau mulai dengan cara memindai QR Passport mereka.</p>
          <Link
            href="/ba/scan"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-[#6DB9B2] text-[#6DB9B2] rounded-xl font-semibold hover:bg-[#6DB9B2] hover:text-white transition-colors"
          >
            <span>📷</span> Scan QR Customer
          </Link>
        </div>
      </div>
    </div>
  );
}
