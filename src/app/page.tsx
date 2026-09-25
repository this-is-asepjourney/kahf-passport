import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Khaf Passport — Your Beauty Journey Starts Here',
  description: 'Satu platform terintegrasi untuk mendukung layanan personal dan berkelanjutan.',
};

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col bg-white relative overflow-hidden">
      {/* Background Shapes */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Soft Peach Top-Right */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#E8C5C8] rounded-full mix-blend-multiply filter blur-3xl opacity-50" />
        {/* Mint Green Bottom-Left */}
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-[#6DB9B2] rounded-full mix-blend-multiply filter blur-3xl opacity-50" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        {/* Brand Text */}
        <div className="text-center mb-12">
          <h2 className="text-xl text-[#2C5C59] font-medium tracking-wide mb-1">Khaf</h2>
          <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#6DB9B2] to-[#E8C5C8] tracking-tight">
            FIND ME<span className="text-[#E8C5C8]">✨</span>
          </h1>
        </div>

        {/* Tagline */}
        <div className="text-center max-w-sm mb-16 space-y-4">
          <p className="text-lg font-medium text-[#2C5C59]">
            From Beauty Consultation<br/>to Personalized Beauty Experience
          </p>
          <p className="text-sm text-gray-500 leading-relaxed">
            Satu platform terintegrasi untuk mendukung Beauty Advisor memberikan pelayanan yang lebih cepat, personal, dan berkelanjutan kepada setiap pelanggan Khaf di seluruh Indonesia.
          </p>
        </div>

        {/* Buttons */}
        <div className="w-full max-w-xs space-y-3 mt-8">
          <Link
            href="/login"
            className="flex w-full items-center justify-center py-4 px-6 bg-[#6DB9B2] text-white font-semibold rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="flex w-full items-center justify-center py-4 px-6 bg-white border-2 border-[#6DB9B2] text-[#6DB9B2] font-semibold rounded-full hover:bg-gray-50 transition-all active:scale-95"
          >
            Daftar
          </Link>
        </div>
        
        {/* Guest Link */}
        <div className="mt-6">
          <Link href="/login" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            Lanjut sebagai Tamu
          </Link>
        </div>
      </div>
    </main>
  );
}
