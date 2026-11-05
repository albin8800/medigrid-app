'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search,
  Store as StoreIcon,
  Shield,
  Activity,
  LogOut,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { storeSession, adminSession, logoutStore, logoutAdmin } = useAuth();

  const isStoreLoggedIn = Boolean(storeSession?.store?.id);
  const isAdminLoggedIn = Boolean(adminSession?.admin?.email);

  const storeHref = isStoreLoggedIn ? '/store/dashboard' : '/store/login';
  const adminHref = isAdminLoggedIn ? '/admin/dashboard' : '/admin/login';

  const navLinks = [
    {
      name: 'Find Medicine (Public)',
      shortName: 'Public Search',
      href: '/',
      icon: Search,
      roleBadge: 'Public',
      isActive: pathname === '/',
    },
    {
      name: 'Store Portal',
      shortName: 'Store Portal',
      href: storeHref,
      icon: StoreIcon,
      roleBadge: isStoreLoggedIn ? 'Logged In' : 'Partner',
      isActive: pathname?.startsWith('/store'),
    },
    {
      name: 'Super Admin',
      shortName: 'Super Admin',
      href: adminHref,
      icon: Shield,
      roleBadge: isAdminLoggedIn ? 'Active' : 'Gov',
      isActive: pathname?.startsWith('/admin'),
    },
  ];

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
          {/* Brand Logo & Tag */}
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
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200/60">
                    Network
                  </span>
                </div>
                <span className="text-[10px] font-medium tracking-wide uppercase text-slate-400">
                  Pharmacy Network
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links with Role Indicators */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {navLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all',
                    item.isActive
                      ? 'bg-slate-900 text-white shadow-sm shadow-slate-900/10'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4',
                      item.isActive ? 'text-teal-400' : 'text-slate-400'
                    )}
                  />
                  <span className="hidden md:inline">{item.name}</span>
                  <span className="md:hidden">{item.shortName}</span>
                  <span
                    className={cn(
                      'hidden lg:inline-block px-1.5 py-0.5 text-[10px] rounded font-mono uppercase tracking-wider',
                      item.isActive
                        ? 'bg-slate-800 text-teal-300'
                        : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {item.roleBadge}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Active Session Badges & Actions */}
          <div className="flex items-center gap-2">
            {isStoreLoggedIn && (
              <div className="flex items-center gap-1.5 sm:gap-2 bg-emerald-50 border border-emerald-200/80 rounded-lg px-2 sm:px-3 py-1">
                <div className="flex items-center gap-1.5 text-xs text-emerald-800">
                  <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-semibold truncate max-w-[140px] sm:max-w-[200px]">
                    {storeSession?.store?.name}
                  </span>
                  <span className="hidden sm:inline font-mono text-[11px] text-emerald-600">
                    ({storeSession?.store?.id})
                  </span>
                </div>
                <button
                  onClick={handleStoreLogout}
                  title="Logout Store"
                  className="p-1 rounded text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100/60 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {isAdminLoggedIn && !isStoreLoggedIn && (
              <div className="flex items-center gap-1.5 sm:gap-2 bg-blue-50 border border-blue-200/80 rounded-lg px-2 sm:px-3 py-1">
                <div className="flex items-center gap-1.5 text-xs text-blue-800">
                  <Shield className="h-3.5 w-3.5 text-blue-600" />
                  <span className="font-semibold">Super Admin</span>
                </div>
                <button
                  onClick={handleAdminLogout}
                  title="Logout Super Admin"
                  className="p-1 rounded text-blue-700 hover:text-blue-900 hover:bg-blue-100/60 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
