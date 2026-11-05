import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'MediGrid - Multi-Tenant Pharmacy Network & In-Store POS',
  description: 'Public location-based medicine discovery, partner pharmacy inventory & billing counter, and super admin governance fleet.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900 antialiased">
        <AuthProvider>
          <Navbar />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>
          <footer className="border-t border-slate-200/80 bg-white py-4 text-xs text-slate-500 font-sans">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                <span>MediGrid Pharmacy Network &copy; {new Date().getFullYear()} &bull; Real-Time Medicine Availability</span>
              </span>
              <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                <a href="/store/login" className="hover:text-teal-700 hover:underline transition">
                  Pharmacy Partner Login
                </a>
                <span>&bull;</span>
                <a href="/admin/login" className="hover:text-blue-700 hover:underline transition">
                  Platform Administration
                </a>
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
