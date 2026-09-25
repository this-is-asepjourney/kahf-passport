'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { loginSchema, loginPhoneSchema, otpSchema, phoneSchema, type LoginFormValues, type LoginPhoneFormValues, type OtpFormValues, type PhoneFormValues } from '@/lib/validators/schemas';
import { useAuth } from '@/lib/auth/AuthContext';
import { normalizePhone } from '@/lib/utils';

type LoginMode = 'choose' | 'phone_pass' | 'phone_otp_send' | 'phone_otp_verify' | 'email';

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('choose');
  const [phoneValue, setPhoneValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const router = useRouter();
  const { user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      if (user.role === 'customer') router.replace('/passport');
      else if (user.role === 'ba') router.replace('/ba');
      else if (user.role?.includes('admin')) router.replace('/admin');
    }
  }, [user, router]);

  const loginPhoneForm = useForm<LoginPhoneFormValues>({ resolver: zodResolver(loginPhoneSchema) });
  const phoneForm = useForm<PhoneFormValues>({ resolver: zodResolver(phoneSchema) });
  const otpForm = useForm<OtpFormValues>({ resolver: zodResolver(otpSchema) });
  const emailForm = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const handlePhonePassLogin = async (data: LoginPhoneFormValues) => {
    setLoading(true);
    setError('');
    try {
      const normalizedPhone = normalizePhone(data.phone);
      const email = `${normalizedPhone.replace('+', '')}@kahf.id`;
      const credential = await signInWithEmailAndPassword(auth, email, data.password);
      
      const tokenResult = await credential.user.getIdTokenResult();
      const role = tokenResult.claims.role as string;

      if (role === 'ba') router.replace('/ba');
      else if (role?.includes('admin')) router.replace('/admin');
      else router.replace('/passport');
    } catch (e: unknown) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      
      if (newAttempts >= 5) {
        setError('Terlalu banyak percobaan gagal. Silakan gunakan Login OTP.');
        setPhoneValue(data.phone);
        setMode('phone_otp_send');
      } else {
        setError(`Nomor HP atau password salah. (Percobaan gagal: ${newAttempts}/5)`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (data: PhoneFormValues) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: data.phone || phoneValue }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? 'Gagal mengirim OTP');
      setPhoneValue(data.phone || phoneValue);
      setMode('phone_otp_verify');
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

      // Sign in with custom token
      await signInWithCustomToken(auth, result.customToken);
      router.replace('/passport');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (data: LoginFormValues) => {
    setLoading(true);
    setError('');
    try {
      const credential = await signInWithEmailAndPassword(auth, data.email, data.password);
      const tokenResult = await credential.user.getIdTokenResult();
      const role = tokenResult.claims.role as string;

      if (role === 'ba') router.replace('/ba');
      else if (role?.includes('admin')) router.replace('/admin');
      else router.replace('/passport');
    } catch (e: unknown) {
      setError('Email atau password salah');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header gradient strip */}
      <div className="h-2 gradient-hero" />

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Brand */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl gradient-hero flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✨</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Selamat Datang</h1>
            <p className="text-sm text-gray-500 mt-1">Masuk ke Khaf Passport</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm animate-in">
              {error}
            </div>
          )}

          {/* Mode: Choose */}
          {mode === 'choose' && (
            <div className="space-y-3 animate-in">
              <button
                onClick={() => setMode('phone_pass')}
                className="w-full py-4 px-6 rounded-2xl gradient-hero text-white font-semibold hover:opacity-90 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 shadow-lg"
              >
                📱 Masuk dengan Nomor HP
              </button>
              <button
                onClick={() => setMode('email')}
                className="w-full py-4 px-6 rounded-2xl border-2 border-gray-200 text-gray-700 font-semibold hover:border-purple-300 hover:text-purple-700 transition-all duration-200 active:scale-95"
              >
                📧 Masuk BA / Admin (Email)
              </button>
              <div className="text-center pt-4">
                <span className="text-sm text-gray-500">Belum punya akun? </span>
                <Link href="/register" className="text-sm font-semibold text-purple-600 hover:text-purple-700">
                  Daftar di sini
                </Link>
              </div>
            </div>
          )}

          {/* Mode: Phone Pass */}
          {mode === 'phone_pass' && (
            <form onSubmit={loginPhoneForm.handleSubmit(handlePhonePassLogin)} className="space-y-4 animate-in">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nomor WhatsApp
                </label>
                <input
                  type="tel"
                  placeholder="08xxxxxxxxxx"
                  {...loginPhoneForm.register('phone')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
                />
                {loginPhoneForm.formState.errors.phone && (
                  <p className="text-xs text-red-500 mt-1">{loginPhoneForm.formState.errors.phone.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  {...loginPhoneForm.register('password')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
                />
                {loginPhoneForm.formState.errors.password && (
                  <p className="text-xs text-red-500 mt-1">{loginPhoneForm.formState.errors.password.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl gradient-hero text-white font-semibold disabled:opacity-50 hover:opacity-90 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 shadow-lg"
              >
                {loading ? 'Masuk...' : 'Masuk'}
              </button>
              <div className="flex flex-col gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setMode('phone_otp_send')}
                  className="w-full text-sm text-purple-600 font-medium hover:text-purple-700 py-2"
                >
                  Lupa Password / Login via OTP WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setMode('choose')}
                  className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
                >
                  ← Kembali
                </button>
              </div>
            </form>
          )}

          {/* Mode: Phone OTP Send */}
          {mode === 'phone_otp_send' && (
            <form onSubmit={phoneForm.handleSubmit(handleSendOtp)} className="space-y-4 animate-in">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nomor WhatsApp untuk OTP
                </label>
                <input
                  type="tel"
                  placeholder="08xxxxxxxxxx"
                  defaultValue={phoneValue}
                  {...phoneForm.register('phone')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
                />
                {phoneForm.formState.errors.phone && (
                  <p className="text-xs text-red-500 mt-1">{phoneForm.formState.errors.phone.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl gradient-hero text-white font-semibold disabled:opacity-50 hover:opacity-90 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 shadow-lg"
              >
                {loading ? 'Mengirim OTP...' : 'Kirim Kode OTP'}
              </button>
              <button
                type="button"
                onClick={() => setMode('phone_pass')}
                className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
              >
                ← Kembali ke Password
              </button>
            </form>
          )}

          {/* Mode: Phone Step 2 (OTP) */}
          {mode === 'phone_otp_verify' && (
            <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} className="space-y-4 animate-in">
              <div className="text-center mb-2">
                <p className="text-sm text-gray-600">
                  Kode OTP dikirim via WhatsApp ke
                </p>
                <p className="font-semibold text-gray-900">{phoneValue}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Masukkan Kode OTP (6 digit)
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
                onClick={() => setMode('phone_otp_send')}
                className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
              >
                Kirim ulang OTP
              </button>
            </form>
          )}

          {/* Mode: Email (BA/Admin) */}
          {mode === 'email' && (
            <form onSubmit={emailForm.handleSubmit(handleEmailLogin)} className="space-y-4 animate-in">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  placeholder="email@khaf.com"
                  {...emailForm.register('email')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
                />
                {emailForm.formState.errors.email && (
                  <p className="text-xs text-red-500 mt-1">{emailForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  {...emailForm.register('password')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
                />
                {emailForm.formState.errors.password && (
                  <p className="text-xs text-red-500 mt-1">{emailForm.formState.errors.password.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl gradient-hero text-white font-semibold disabled:opacity-50 hover:opacity-90 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 shadow-lg"
              >
                {loading ? 'Masuk...' : 'Masuk'}
              </button>
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
              >
                ← Kembali
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
