'use client';

import Link from 'next/link';
import { useNotifications } from '@/hooks/useNotifications';
import { Bell, Home, QrCode, User } from 'lucide-react';

interface PassportBottomNavProps {
  activeTab?: 'home' | 'qr' | 'notifications' | 'profile';
}

export function PassportBottomNav({ activeTab = 'home' }: PassportBottomNavProps) {
  const { unreadCount } = useNotifications();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div className="w-full max-w-lg bg-white/95 backdrop-blur-md border-t border-gray-100 px-6 py-2.5 flex justify-between items-center safe-bottom shadow-[0_-4px_25px_rgba(0,0,0,0.04)] pointer-events-auto">
        {/* Home */}
        <Link
          href="/passport"
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'home' ? 'text-[#277A73] font-bold scale-105' : 'text-gray-400 hover:text-[#277A73]'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">Home</span>
        </Link>

        {/* Passport / Scan Barcode BA */}
        <Link
          href="/passport/qr"
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'qr' ? 'text-[#277A73] font-bold scale-105' : 'text-gray-400 hover:text-[#277A73]'
          }`}
        >
          <QrCode className="w-5 h-5" />
          <span className="text-[10px]">Passport</span>
        </Link>

        {/* Notifications with Live Badge */}
        <Link
          href="/passport/notifications"
          className={`flex flex-col items-center gap-1 relative transition-all ${
            activeTab === 'notifications' ? 'text-[#277A73] font-bold scale-105' : 'text-gray-400 hover:text-[#277A73]'
          }`}
        >
          <div className="relative">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-white animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Notifikasi</span>
        </Link>

        {/* Akun */}
        <Link
          href="/passport/profile"
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'profile' ? 'text-[#277A73] font-bold scale-105' : 'text-gray-400 hover:text-[#277A73]'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px]">Akun</span>
        </Link>
      </div>
    </div>
  );
}
