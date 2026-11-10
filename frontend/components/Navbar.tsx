'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  LogOut,
  Building2,
  Shield,
  Package,
  Receipt,
  LayoutDashboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { storeSession, adminSession, logoutStore, logoutAdmin } = useAuth();

  const isStoreLoggedIn = Boolean(storeSession?.store?.id);
  const isAdminLoggedIn = Boolean(adminSession?.admin?.email);

  const isStoreSpace = pathname?.startsWith('/store');
  const isAdminSpace = pathname?.startsWith('/admin');

  const handleStoreLogout = () => {
    logoutStore();
    router.push('/store/login');
  };

  const handleAdminLogout = () => {
    logoutAdmin();
    router.push('/admin/login');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Context Tag */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-sm shadow-teal-600/25 group-hover:bg-teal-700 transition-colors">
                <Activity className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-bold tracking-tight text-slate-900 group-hover:text-teal-700 transition-colors">
                    MediGrid
                  </span>
                  {isAdminSpace ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      Super Admin
                    </span>
                  ) : isStoreSpace ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Partner Console
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200/60">
                      Verified Network
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium tracking-wide uppercase text-slate-400">
                  {isAdminSpace
                    ? 'Platform Governance Console'
                    : isStoreSpace
                    ? 'Medical Store Portal'
                    : 'Public Medicine Availability'}
                </span>
              </div>
            </Link>
          </div>

          {/* Contextual Navigation - Strictly Role-Isolated */}
          <div className="flex items-center gap-2">
            {/* 1. Super Admin Navigation (Only shown when inside /admin) */}
            {isAdminSpace && (
              <div className="flex items-center gap-2 sm:gap-3">
                {isAdminLoggedIn && (
                  <>
                    <Link
                      href="/admin/dashboard"
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition',
                        pathname === '/admin/dashboard' || pathname === '/admin/stores'
                          ? 'bg-blue-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      )}
                    >
                      Fleet Management
                    </Link>
                    <button
                      onClick={handleAdminLogout}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </button>
                  </>
                )}
                <Link
                  href="/"
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-600 transition"
                >
                  Exit &rarr;
                </Link>
              </div>
            )}

            {/* 2. Store Partner Navigation (Only shown when inside /store) */}
            {isStoreSpace && (
              <div className="flex items-center gap-2 sm:gap-3">
                {isStoreLoggedIn && (
                  <>
                    <Link
                      href="/store/dashboard"
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition',
                        pathname === '/store/dashboard'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      )}
                    >
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Overview</span>
                    </Link>
                    <Link
                      href="/store/inventory"
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition',
                        pathname === '/store/inventory'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      )}
                    >
                      <Package className="h-3.5 w-3.5" />
                      <span>Inventory</span>
                    </Link>
                    <Link
                      href="/store/pos"
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition',
                        pathname === '/store/pos'
                          ? 'bg-teal-700 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      )}
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      <span>POS Billing</span>
                    </Link>
                    <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                      <span className="hidden md:inline font-semibold text-xs text-slate-800 truncate max-w-[150px]">
                        {storeSession?.store?.name}
                      </span>
                      <button
                        onClick={handleStoreLogout}
                        title="Logout Store"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Logout</span>
                      </button>
                    </div>
                  </>
                )}
                <Link
                  href="/"
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-600 transition"
                >
                  Exit &rarr;
                </Link>
              </div>
            )}

            {/* 3. Consumer Public View (Default on localhost:3000) */}
            {!isStoreSpace && !isAdminSpace && (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Pharmacy Stock Network
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
