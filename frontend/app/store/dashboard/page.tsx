'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Package,
  ReceiptText,
  Building2,
  MapPin,
  Phone,
  FileText,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  PlusCircle,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { listStoreMedicines } from '@/lib/api';
import { Medicine } from '@/lib/types';
import { formatINR } from '@/lib/utils';

export default function StoreDashboardPage() {
  const router = useRouter();
  const { storeSession, isInitialized } = useAuth();

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isInitialized) return;
    if (!storeSession?.store?.id) {
      router.replace('/store/login');
      return;
    }

    const loadStoreData = async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      try {
        const res = await listStoreMedicines(storeSession.store.id);
        setMedicines(res.data);
      } catch (err) {
        console.error('Failed to load store inventory:', err);
      } finally {
        if (!isBackground) setLoading(false);
      }
    };

    loadStoreData();
    const timer = setInterval(() => {
      loadStoreData(true);
    }, 4000);
    return () => clearInterval(timer);
  }, [storeSession, isInitialized, router]);

  if (!isInitialized || !storeSession?.store) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-sm text-slate-500 animate-pulse">Loading store dashboard...</div>
      </div>
    );
  }

  const store = storeSession.store;
  const totalItems = medicines.length;
  const lowStockCount = medicines.filter(
    (m) => m.stockQuantity <= m.reorderLevel && m.stockQuantity > 0
  ).length;
  const outOfStockCount = medicines.filter(
    (m) => m.stockQuantity <= 0 || !m.inStock
  ).length;

  return (
    <div className="space-y-8 pb-16">
      {/* Store Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {store.name}
                </h1>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                  {store.id}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  <span>{store.status || 'ACTIVE'}</span>
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap pt-0.5">
                {(store.address || store.city) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>{[store.address || '', store.city || ''].filter(Boolean).join(', ')}</span>
                  </span>
                )}
                {store.licenseNumber && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-mono">{store.licenseNumber}</span>
                  </span>
                )}
                {store.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>{store.phone}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/store/inventory"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
            >
              <Package className="h-4 w-4 text-teal-600" />
              <span>Manage Inventory</span>
            </Link>
            <Link
              href="/store/pos"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-xs font-semibold text-white shadow-xs transition"
            >
              <ReceiptText className="h-4 w-4" />
              <span>Launch POS Counter</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Quick Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Module 1: Inventory Management */}
        <Link
          href="/store/inventory"
          className="group bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-teal-500/80 hover:shadow-md transition p-6 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition">
                <Package className="h-5 w-5" />
              </div>
              <span className="text-xs font-mono font-medium text-slate-400 group-hover:text-teal-600 transition flex items-center gap-1">
                Open &rarr;
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 group-hover:text-teal-700 transition">
                📦 My Inventory Management
              </h2>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                Filter and maintain this store&apos;s active catalog, track batch expiry dates, shelf rack allocations, and restock levels.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="font-mono text-slate-700">
                <strong>{totalItems}</strong> SKUs
              </span>
              {lowStockCount > 0 && (
                <span className="font-mono text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  ⚠️ {lowStockCount} Low
                </span>
              )}
            </div>
            <span className="text-slate-400 text-[11px]">Route: /store/inventory</span>
          </div>
        </Link>

        {/* Module 2: In-Store POS & Billing */}
        <Link
          href="/store/pos"
          className="group bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-teal-500/80 hover:shadow-md transition p-6 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition">
                <ReceiptText className="h-5 w-5" />
              </div>
              <span className="text-xs font-mono font-medium text-slate-400 group-hover:text-blue-600 transition flex items-center gap-1">
                Open &rarr;
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition">
                🧾 In-Store POS & Billing Counter
              </h2>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                High-speed split-screen cashier terminal. Automatic 5% GST tax calculation, immediate inventory deduction, and customer invoice receipts.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>Live Port :5002 Integration</span>
            </div>
            <span className="text-slate-400 text-[11px]">Route: /store/pos</span>
          </div>
        </Link>
      </div>

      {/* Snapshot Table: Low Stock Watchlist */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900">
              Store Stock Health Snapshot
            </h3>
          </div>
          <Link
            href="/store/inventory"
            className="text-xs font-medium text-teal-600 hover:text-teal-700"
          >
            View Full Inventory &rarr;
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] uppercase tracking-wider font-semibold text-slate-500">
              <tr>
                <th className="py-3 px-4">Medicine</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Batch / Expiry</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4 text-right">Price</th>
                <th className="py-3 px-4 text-right">Stock</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    Loading stock metrics...
                  </td>
                </tr>
              ) : medicines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No medicines found in this store catalog. Click &ldquo;Manage Inventory&rdquo; to add your first medicine.
                  </td>
                </tr>
              ) : (
                medicines.slice(0, 5).map((med) => (
                  <tr key={med.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {med.name}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{med.category}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {med.batchNumber} &bull; {med.expiryDate}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {med.locationRack}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatINR(med.price)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold">
                      {med.stockQuantity}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {med.stockQuantity <= 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          Out of Stock
                        </span>
                      ) : med.stockQuantity <= med.reorderLevel ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          Low Stock
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Healthy
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
