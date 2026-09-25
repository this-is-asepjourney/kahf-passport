'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { quickRegisterCustomerSchema, type QuickRegisterCustomerFormValues } from '@/lib/validators/schemas';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function BaNewCustomerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const form = useForm<QuickRegisterCustomerFormValues>({
    resolver: zodResolver(quickRegisterCustomerSchema),
  });

  const handleSubmit = async (data: QuickRegisterCustomerFormValues) => {
    setLoading(true);
    setError('');
    try {
      const { getAuth } = await import('firebase/auth');
      const idToken = await getAuth().currentUser?.getIdToken();

      const res = await fetch('/api/customers/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(data),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? 'Gagal mendaftarkan customer');

      if (result.action === 'existing') {
        router.push(`/ba/customers/${result.customerId}`);
      } else {
        router.push(`/ba/customers/${result.customerId}`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="gradient-hero px-6 pt-12 pb-8">
        <div className="flex items-center gap-3">
          <Link href="/ba/customers" className="text-white/80 hover:text-white">←</Link>
          <h1 className="text-xl font-bold text-white">Customer Baru</h1>
        </div>
        <p className="text-white/60 text-sm mt-1 ml-8">Daftarkan customer ke sistem</p>
      </div>

      <div className="px-6 -mt-4 pb-8">
        <div className="bg-white rounded-3xl shadow-sm p-6 animate-in">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Nama customer"
                {...form.register('fullName')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
              />
              {form.formState.errors.fullName && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.fullName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nomor HP <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                placeholder="08xxxxxxxxxx"
                {...form.register('phone')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
              />
              {form.formState.errors.phone && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.phone.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Kota</label>
              <input
                type="text"
                placeholder="Jakarta"
                {...form.register('city')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
              />
            </div>

            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
              <p className="text-xs text-blue-700">
                ℹ️ Nomor HP ini akan digunakan customer untuk klaim akun Khaf Passport mereka.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl gradient-hero text-white font-semibold disabled:opacity-50 hover:opacity-90 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 shadow-lg"
            >
              {loading ? 'Mendaftarkan...' : '✓ Daftarkan Customer'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
