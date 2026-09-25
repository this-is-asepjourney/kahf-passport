'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { registerSchema, phoneSchema, otpSchema, type RegisterFormValues, type PhoneFormValues, type OtpFormValues } from '@/lib/validators/schemas';

type Step = 'phone' | 'otp' | 'details';

export default function RegisterPage() {
  const [step, setStep] = useState<Step>('phone');
  const [phoneValue, setPhoneValue] = useState('');
  const [customToken, setCustomToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const phoneForm = useForm<PhoneFormValues>({ resolver: zodResolver(phoneSchema) });
  const otpForm = useForm<OtpFormValues>({ resolver: zodResolver(otpSchema) });
  const detailsForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', phone: '' },
  });

  const handleSendOtp = async (data: PhoneFormValues) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: data.phone }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? 'Gagal mengirim OTP');
      setPhoneValue(data.phone);
      detailsForm.setValue('phone', data.phone);
      setStep('otp');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (data: OtpFormValues) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneValue, otp: data.otp }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? 'OTP tidak valid');
      setCustomToken(result.customToken);
      setStep('details');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (data: RegisterFormValues) => {
    setLoading(true);
    setError('');
    try {
      // Sign in with custom token to get Firebase ID token
      const credential = await signInWithCustomToken(auth, customToken);
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
          phone: data.phone,
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = ['Nomor HP', 'Verifikasi', 'Data Diri'];
  const currentStepIndex = step === 'phone' ? 0 : step === 'otp' ? 1 : 2;

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

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {stepLabels.map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={`flex flex-col items-center gap-1 ${
                    i <= currentStepIndex ? 'opacity-100' : 'opacity-40'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      i <= currentStepIndex
                        ? 'gradient-hero text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {i < currentStepIndex ? '✓' : i + 1}
                  </div>
                  <span className="text-xs text-gray-500">{label}</span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div
                    className={`w-8 h-0.5 mb-4 rounded transition-all ${
                      i < currentStepIndex ? 'bg-purple-400' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm animate-in">
              {error}
            </div>
          )}

          {/* Step 1: Phone */}
          {step === 'phone' && (
            <form onSubmit={phoneForm.handleSubmit(handleSendOtp)} className="space-y-4 animate-in">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nomor WhatsApp
                </label>
                <input
                  type="tel"
                  placeholder="08xxxxxxxxxx"
                  {...phoneForm.register('phone')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
                />
                {phoneForm.formState.errors.phone && (
                  <p className="text-xs text-red-500 mt-1">{phoneForm.formState.errors.phone.message}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Kode OTP akan dikirim via WhatsApp
                </p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl gradient-hero text-white font-semibold disabled:opacity-50 hover:opacity-90 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 shadow-lg"
              >
                {loading ? 'Mengirim...' : 'Kirim Kode OTP'}
              </button>
              <p className="text-center text-sm text-gray-500">
                Sudah punya akun?{' '}
                <Link href="/login" className="text-purple-600 font-semibold hover:text-purple-700">
                  Masuk
                </Link>
              </p>
            </form>
          )}

          {/* Step 2: OTP */}
          {step === 'otp' && (
            <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} className="space-y-4 animate-in">
              <div className="text-center mb-2">
                <p className="text-sm text-gray-600">Kode OTP dikirim ke</p>
                <p className="font-semibold text-gray-900">{phoneValue}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                  Masukkan Kode OTP
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  {...otpForm.register('otp')}
                  className="w-full px-4 py-4 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-center text-2xl font-bold tracking-widest"
                />
                {otpForm.formState.errors.otp && (
                  <p className="text-xs text-red-500 mt-1 text-center">{otpForm.formState.errors.otp.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl gradient-hero text-white font-semibold disabled:opacity-50 hover:opacity-90 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 shadow-lg"
              >
                {loading ? 'Memverifikasi...' : 'Verifikasi OTP'}
              </button>
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
              >
                ← Ganti nomor HP
              </button>
            </form>
          )}

          {/* Step 3: Details */}
          {step === 'details' && (
            <form onSubmit={detailsForm.handleSubmit(handleRegister)} className="space-y-4 animate-in">
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
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
