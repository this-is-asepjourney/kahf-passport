'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useState } from 'react';

export default function BaLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { signOutUser } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r border-gray-100 flex flex-col shrink-0 transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 h-16 flex items-center border-b border-gray-50">
          <Link href="/ba" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-[#2C5C59] tracking-tight">Kahf</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto py-4">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
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
              className="flex items-center gap-2 px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors font-medium text-sm"
              title="Keluar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile Header (Only visible on small screens) */}
        <header className="lg:hidden h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              className="p-2 -ml-2 text-gray-500 rounded-lg hover:bg-gray-50"
              onClick={() => setIsSidebarOpen(true)}
            >
              ☰
            </button>
            <span className="text-lg font-bold text-[#2C5C59]">Kahf BA</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
