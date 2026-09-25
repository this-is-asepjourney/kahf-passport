'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

export default function BaLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { signOutUser } = useAuth();

  const menuItems = [
    { name: 'Beranda', href: '/ba', icon: '🏠' },
    { name: 'Customer Database', href: '/ba/customers', icon: '👥' },
    { name: 'Konsultasi', href: '/ba/consultation', icon: '💬' },
    { name: 'Rekomendasi Produk', href: '/ba/products', icon: '🧴' },
    { name: 'Follow Up', href: '/ba/follow-up', icon: '🗓️' },
    { name: 'Laporan / Riwayat', href: '/ba/purchases', icon: '📋' },
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shrink-0 h-full overflow-y-auto">
        <div className="p-6">
          <Link href="/ba" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-[#2C5C59] tracking-tight">Kahf</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                  isActive
                    ? 'bg-[#E2F0EF] text-[#2C5C59]'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
            <Link href="/ba/settings" className="flex items-center gap-3 text-gray-700 hover:text-gray-900 transition-colors">
              <span className="text-lg">⚙️</span>
              <span className="text-sm font-medium">Pengaturan</span>
            </Link>
            <button
              onClick={signOutUser}
              className="text-gray-400 hover:text-red-500 transition-colors"
              title="Keluar"
            >
              🚪
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
