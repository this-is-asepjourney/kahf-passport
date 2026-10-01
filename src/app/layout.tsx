import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { Toaster } from '@/components/ui/toaster';
import { ThemeToggle } from '@/components/ThemeToggle';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'Wardah Beauty Passport — Perjalanan Kecantikan Digital',
    template: '%s | Wardah Beauty Passport',
  },
  description:
    'Platform digital untuk pelanggan Wardah: lacak riwayat pembelian, konsultasi kulit, rekomendasi personal, dan loyalty reward eksklusif.',
  keywords: ['Wardah', 'Beauty Passport', 'riwayat pembelian', 'kecantikan', 'loyalty', 'skincare'],
  authors: [{ name: 'Wardah' }],
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#7C3AED',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>
            <AuthProvider>
              {children}
              <div className="fixed bottom-6 right-6 z-50 bg-white/80 dark:bg-black/50 backdrop-blur-md rounded-full shadow-lg border border-gray-200 dark:border-gray-800">
                <ThemeToggle />
              </div>
              <Toaster />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
