'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Package,
  Plus,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Building2,
  X,
  ReceiptText,
  ChevronLeft,
  Calendar,
  Layers,
  MapPin,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { listStoreMedicines, addStoreMedicine } from '@/lib/api';
import { Medicine } from '@/lib/types';
import { formatINR, cn } from '@/lib/utils';

const CATEGORIES = [
  'All',
  'Antibiotics',
  'Pain Relief',
  'Cardiology',
  'Diabetes',
  'Allergy / Cold',
  'Respiratory',
  'Antacid / Gastro',
  'Vitamins',
];

export default function StoreInventoryPage() {
  const router = useRouter();
  const { storeSession, isInitialized } = useAuth();

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [source, setSource] = useState<'api' | 'fallback'>('api');
  const [, startTransition] = useTransition();

  // Add Medicine Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    genericName: '',
    category: 'Pain Relief',
    batchNumber: '',
    expiryDate: '',
    price: '',
    stockQuantity: '',
    reorderLevel: '15',
    locationRack: 'Shelf A-1',
  });

  useEffect(() => {
    if (!isInitialized) return;
    if (!storeSession?.store?.id) {
      router.replace('/store/login');
      return;
    }

    loadData();
  }, [storeSession, isInitialized, selectedCategory]);

  const loadData = async () => {
    if (!storeSession?.store?.id) return;
    setLoading(true);
    try {
      const res = await listStoreMedicines(storeSession.store.id, selectedCategory);
      setMedicines(res.data);
      setSource(res.source);
    } catch (err) {
      console.error('Failed to load store inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeSession?.store?.id) return;
    setModalError(null);
    setSubmitting(true);

    try {
      const priceNum = parseFloat(formData.price);
      const stockNum = parseInt(formData.stockQuantity, 10);
      const reorderNum = parseInt(formData.reorderLevel, 10) || 10;

      if (isNaN(priceNum) || priceNum <= 0) {
        throw new Error('Price must be a valid positive number');
      }
      if (isNaN(stockNum) || stockNum < 0) {
        throw new Error('Stock quantity must be a non-negative integer');
      }

      await addStoreMedicine({
        storeId: storeSession.store.id,
        name: formData.name.trim(),
        genericName: formData.genericName.trim(),
        category: formData.category,
        batchNumber: formData.batchNumber.trim(),
        expiryDate: formData.expiryDate,
        price: priceNum,
        stockQuantity: stockNum,
        reorderLevel: reorderNum,
        locationRack: formData.locationRack.trim(),
      });

      setIsModalOpen(false);
      setFormData({
        name: '',
        genericName: '',
        category: 'Pain Relief',
        batchNumber: '',
        expiryDate: '',
        price: '',
        stockQuantity: '',
        reorderLevel: '15',
        locationRack: 'Shelf A-1',
      });
      loadData();
    } catch (err: any) {
      setModalError(err.message || 'Failed to add medicine');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMedicines = medicines.filter((m) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.genericName.toLowerCase().includes(q) ||
      m.batchNumber.toLowerCase().includes(q) ||
      m.locationRack.toLowerCase().includes(q)
    );
  });

  if (!isInitialized || !storeSession?.store) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-sm text-slate-500 animate-pulse">Loading store inventory...</div>
      </div>
    );
  }

  const store = storeSession.store;

  return (
    <div className="space-y-6 pb-16">
      {/* Breadcrumb & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/store/dashboard"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Store Inventory
          </h1>
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200/70 text-slate-700">
            {store.id}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/store/pos"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition"
          >
            <ReceiptText className="h-3.5 w-3.5 text-blue-600" />
            <span>Switch to POS Billing</span>
          </Link>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition active:scale-[0.99]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Add Medicine to My Store</span>
          </button>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search medicine, generic formula, batch, or rack..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        {/* Category Pills / Dropdown */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={loadData}
            title="Refresh Catalog"
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Inventory Dense Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] uppercase tracking-wider font-semibold text-slate-500">
              <tr>
                <th className="py-3 px-4">Medicine & Formulation</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Shelf / Rack</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-right">Available Qty</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading medicine catalog for {store.name}...
                  </td>
                </tr>
              ) : filteredMedicines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    No medicines match the selected filter. Click &ldquo;+ Add Medicine to My Store&rdquo; to add a new SKU.
                  </td>
                </tr>
              ) : (
                filteredMedicines.map((med) => {
                  const isOutOfStock = med.stockQuantity <= 0 || !med.inStock;
                  const isLowStock = !isOutOfStock && med.stockQuantity <= med.reorderLevel;

                  return (
                    <tr key={med.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{med.name}</div>
                        <div className="text-[11px] text-slate-500 italic">
                          {med.genericName}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-medium">
                          {med.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                        {med.batchNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {med.expiryDate}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-teal-700 font-medium">
                        {med.locationRack}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatINR(med.price)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold">
                        <span
                          className={cn(
                            isOutOfStock
                              ? 'text-rose-600'
                              : isLowStock
                              ? 'text-amber-600'
                              : 'text-slate-900'
                          )}
                        >
                          {med.stockQuantity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Out of Stock
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            In Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Medicine Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900">
                  + Add Medicine to My Store ({store.id})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Brand Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Dolo 650mg"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Generic Composition *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.genericName}
                    onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                    placeholder="e.g. Paracetamol (650mg)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Batch Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.batchNumber}
                    onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                    placeholder="BATCH-2026-X1"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expiry Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="35.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Stock Qty *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.stockQuantity}
                    onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                    placeholder="100"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Shelf / Rack *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.locationRack}
                    onChange={(e) => setFormData({ ...formData, locationRack: e.target.value })}
                    placeholder="Shelf B-2"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition disabled:opacity-60"
                >
                  {submitting ? 'Adding Medicine...' : 'Add to Catalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
