'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOutUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) return null;
  if (!user || (!user.role?.includes('admin') && user.role !== 'ba')) return null;

  const navItems = [
    { href: '/admin', label: 'Dashboard Nasional', icon: '🏠' },
    { href: '/admin/customers', label: 'Customer Insight', icon: '👥' },
    { href: '/admin/products', label: 'Product Insight', icon: '📦' },
    { href: '/admin/ba', label: 'BA Performance', icon: '👩‍💼' },
    { href: '/admin/reports', label: 'Regional Report', icon: '📊' },
    { href: '/admin/settings', label: 'Pengaturan', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r border-gray-100 flex flex-col transition-transform duration-300 shrink-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo Area */}
        <div className="h-16 flex items-center px-6 border-b border-gray-50">
          <span className="text-xl font-bold text-[#2C5C59] tracking-tight">Kahf</span>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map(item => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive 
                    ? 'bg-[#E2F0EF] text-[#2C5C59]' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              className="lg:hidden p-2 -ml-2 text-gray-500 rounded-lg hover:bg-gray-50"
              onClick={() => setIsSidebarOpen(true)}
            >
              ☰
            </button>
            <div className="hidden md:block">
              {/* Optional spacer if needed */}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-gray-900">Halo, {user?.email?.split('@')[0] || 'Admin'}!</p>
              <p className="text-xs text-gray-500">{user?.role === 'super_admin' ? 'Super Admin' : 'Admin Regional'}</p>
            </div>
            <button 
              onClick={signOutUser}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
              title="Keluar"
            >
              U
            </button>
          </div>
        </header>

        {/* Page Content area */}
        <div className="flex-1 overflow-auto p-4 lg:p-8 bg-[#F8FAFC]">
          {children}
        </div>
      </main>
    </div>
  );
}
