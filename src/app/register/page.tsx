'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { registerSchema, type RegisterFormValues } from '@/lib/validators/schemas';
import { normalizePhone } from '@/lib/utils';

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const detailsForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', phone: '' },
  });

  const handleRegister = async (data: RegisterFormValues) => {
    setLoading(true);
    setError('');
    try {
      // Create Firebase Auth user using phone as email
      const normalizedPhone = normalizePhone(data.phone);
      const email = `${normalizedPhone.replace('+', '')}@kahf.id`;
      
      const credential = await createUserWithEmailAndPassword(auth, email, data.password);
      const idToken = await credential.user.getIdToken();

      // Register customer profile
      const res = await fetch('/api/customers/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          fullName: data.fullName,
          phone: normalizedPhone,
          password: data.password,
          birthDate: data.birthDate,
          gender: data.gender,
          city: data.city,
          consentVersion: '1.0',
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? 'Gagal mendaftar');

      router.replace('/passport');
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') {
        setError('Nomor HP ini sudah terdaftar. Silakan login.');
      } else {
        setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="h-2 gradient-hero" />

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl gradient-hero flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📋</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Daftar Akun</h1>
            <p className="text-sm text-gray-500 mt-1">Buat Khaf Passport Anda</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm animate-in">
              {error}
            </div>
          )}

          <form onSubmit={detailsForm.handleSubmit(handleRegister)} className="space-y-4 animate-in">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nomor WhatsApp <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                placeholder="08xxxxxxxxxx"
                {...detailsForm.register('phone')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
              />
              {detailsForm.formState.errors.phone && (
                <p className="text-xs text-red-500 mt-1">{detailsForm.formState.errors.phone.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Nama sesuai KTP"
                {...detailsForm.register('fullName')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
              />
              {detailsForm.formState.errors.fullName && (
                <p className="text-xs text-red-500 mt-1">{detailsForm.formState.errors.fullName.message}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                placeholder="Minimal 6 karakter"
                {...detailsForm.register('password')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
              />
              {detailsForm.formState.errors.password && (
                <p className="text-xs text-red-500 mt-1">{detailsForm.formState.errors.password.message}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tanggal Lahir
              </label>
              <input
                type="date"
                {...detailsForm.register('birthDate')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Kota</label>
              <input
                type="text"
                placeholder="Jakarta"
                {...detailsForm.register('city')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
              />
            </div>

            {/* Consent */}
            <div className="p-4 rounded-xl bg-purple-50 border border-purple-100">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  {...detailsForm.register('consentAgreed')}
                  className="mt-0.5 w-5 h-5 rounded accent-purple-600 flex-shrink-0"
                />
                <span className="text-xs text-gray-600">
                  Saya menyetujui{' '}
                  <Link href="/privacy" className="text-purple-600 font-semibold underline" target="_blank">
                    Kebijakan Privasi
                  </Link>{' '}
                  dan pemrosesan data pribadi saya untuk keperluan layanan Khaf Passport.
                </span>
              </label>
              {detailsForm.formState.errors.consentAgreed && (
                <p className="text-xs text-red-500 mt-2">{detailsForm.formState.errors.consentAgreed.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl gradient-hero text-white font-semibold disabled:opacity-50 hover:opacity-90 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 shadow-lg"
            >
              {loading ? 'Mendaftarkan...' : '🎉 Buat Passport Saya'}
            </button>
            <p className="text-center text-sm text-gray-500 mt-4">
              Sudah punya akun?{' '}
              <Link href="/login" className="text-purple-600 font-semibold hover:text-purple-700">
                Masuk
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
