'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Package, ReceiptText, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Navbar() {
  const pathname = usePathname();

  const navItems = [
    {
      name: 'Public Search',
      href: '/',
      icon: Search,
      badge: 'Live',
    },
    {
      name: 'Inventory',
      href: '/inventory',
      icon: Package,
      badge: null,
    },
    {
      name: 'POS Billing',
      href: '/billing',
      icon: ReceiptText,
      badge: '5% GST',
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Store Pill */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-sm shadow-teal-600/20 group-hover:bg-teal-700 transition-colors">
                <Activity className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-slate-900 group-hover:text-teal-700 transition-colors">
                  MediGrid
                </span>
                <span className="text-[10px] font-medium tracking-wide uppercase text-slate-400">
                  Pharmacy Network
                </span>
              </div>
            </Link>

            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Central Pharmacy &bull; OPEN</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {navItems.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname?.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all',
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm shadow-slate-900/10'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  )}
                >
                  <Icon className={cn('h-4 w-4', isActive ? 'text-teal-400' : 'text-slate-400')} />
                  <span>{item.name}</span>
                  {item.badge && (
                    <span
                      className={cn(
                        'hidden md:inline-block px-1.5 py-0.5 text-[10px] rounded font-mono uppercase tracking-wider',
                        isActive
                          ? 'bg-slate-800 text-teal-300'
                          : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
