'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Layers,
  ArrowUpDown,
  X,
  PlusCircle,
  MinusCircle,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { Medicine } from '@/lib/types';
import { listMedicines, addMedicine, adjustMedicineStock } from '@/lib/api';
import { formatINR } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

export default function InventoryPage() {
  const { storeSession } = useAuth();
  const currentStoreId = storeSession?.store?.id || 'store-001';
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'fallback'>('api');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW' | 'OUT'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  // New medicine form state
  const [formData, setFormData] = useState({
    name: '',
    genericName: '',
    category: 'Antibiotics',
    batchNumber: '',
    expiryDate: '',
    price: '',
    stockQuantity: '',
    reorderLevel: '10',
    locationRack: 'Shelf A-1',
  });
  const [formError, setFormError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listMedicines();
      setMedicines(res.data);
      setSource(res.source);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered medicines
  const filteredMedicines = useMemo(() => {
    return medicines.filter((med) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        med.name.toLowerCase().includes(q) ||
        med.genericName.toLowerCase().includes(q) ||
        med.batchNumber.toLowerCase().includes(q) ||
        med.locationRack.toLowerCase().includes(q);

      // Category
      const matchesCategory =
        selectedCategory === 'All' ||
        med.category.toLowerCase() === selectedCategory.toLowerCase();

      // Stock filter
      let matchesStock = true;
      const isOut = med.stockQuantity === 0 || !med.inStock;
      const isLow = !isOut && med.stockQuantity <= med.reorderLevel;

      if (stockFilter === 'OUT') matchesStock = isOut;
      else if (stockFilter === 'LOW') matchesStock = isLow;
      else if (stockFilter === 'IN_STOCK') matchesStock = !isOut && !isLow;

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [medicines, searchQuery, selectedCategory, stockFilter]);

  // Inventory summary stats
  const stats = useMemo(() => {
    let totalStock = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    medicines.forEach((m) => {
      totalStock += m.stockQuantity;
      if (m.stockQuantity === 0 || !m.inStock) {
        outOfStockCount++;
      } else if (m.stockQuantity <= m.reorderLevel) {
        lowStockCount++;
      }
    });

    return {
      totalSKUs: medicines.length,
      totalStock,
      lowStockCount,
      outOfStockCount,
    };
  }, [medicines]);

  // Handle Quick Inline Stock Adjust
  const handleStockAdjust = async (id: string, action: 'DEDUCT' | 'RESTOCK', qty: number) => {
    setAdjustingId(id);
    try {
      const res = await adjustMedicineStock(id, action, qty);
      setMedicines((prev) =>
        prev.map((m) => (m.id === id ? res.data : m))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Stock update failed';
      alert(message);
    } finally {
      setAdjustingId(null);
    }
  };

  // Submit New Medicine
  const handleSubmitNewMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Medicine name is required.');
      return;
    }
    const priceNum = parseFloat(formData.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      setFormError('Valid unit price (> 0) is required.');
      return;
    }
    const stockNum = parseInt(formData.stockQuantity, 10);
    if (isNaN(stockNum) || stockNum < 0) {
      setFormError('Valid stock quantity (>= 0) is required.');
      return;
    }
    const reorderNum = parseInt(formData.reorderLevel, 10);
    if (isNaN(reorderNum) || reorderNum < 0) {
      setFormError('Valid reorder level (>= 0) is required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await addMedicine({
        name: formData.name.trim(),
        genericName: formData.genericName.trim(),
        category: formData.category,
        batchNumber: formData.batchNumber.trim() || `BATCH-${Date.now().toString().slice(-4)}`,
        expiryDate: formData.expiryDate || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
        price: priceNum,
        stockQuantity: stockNum,
        reorderLevel: reorderNum,
        locationRack: formData.locationRack.trim() || 'Shelf Main',
        storeId: currentStoreId,
      });

      setMedicines((prev) => [res.data, ...prev]);
      setIsModalOpen(false);
      setFormData({
        name: '',
        genericName: '',
        category: 'Antibiotics',
        batchNumber: '',
        expiryDate: '',
        price: '',
        stockQuantity: '',
        reorderLevel: '10',
        locationRack: 'Shelf A-1',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add medicine.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header and Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>Staff Inventory Management</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-slate-100 text-slate-600 border border-slate-200">
              Store: {currentStoreId}
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time batch tracking, stock levels, and physical rack management.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 shadow-sm shadow-teal-600/20 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Add Medicine</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total SKUs</span>
            <Package className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {stats.totalSKUs}
          </div>
          <span className="text-[11px] text-slate-400">Unique pharmaceutical lines</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Units</span>
            <Layers className="h-4 w-4 text-teal-600" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-teal-700">
            {stats.totalStock}
          </div>
          <span className="text-[11px] text-slate-400">Items across all shelves</span>
        </div>

        <div
          onClick={() => setStockFilter(stockFilter === 'LOW' ? 'ALL' : 'LOW')}
          className={`bg-white p-4 rounded-xl border shadow-sm cursor-pointer transition-all ${
            stockFilter === 'LOW' ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200/80 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800">Low Stock</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-700">
            {stats.lowStockCount}
          </div>
          <span className="text-[11px] text-amber-600">At or below reorder level</span>
        </div>

        <div
          onClick={() => setStockFilter(stockFilter === 'OUT' ? 'ALL' : 'OUT')}
          className={`bg-white p-4 rounded-xl border shadow-sm cursor-pointer transition-all ${
            stockFilter === 'OUT' ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200/80 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-800">Out of Stock</span>
            <XCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-rose-700">
            {stats.outOfStockCount}
          </div>
          <span className="text-[11px] text-rose-600">Immediate re-order needed</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by medicine, generic name, batch #, or shelf rack..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {/* Category Selector */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-teal-600"
          >
            <option value="All">All Categories</option>
            <option value="Antibiotics">Antibiotics</option>
            <option value="Pain Relief">Pain Relief</option>
            <option value="Cardiology">Cardiology</option>
            <option value="Diabetes">Diabetes</option>
            <option value="Vitamins">Vitamins</option>
            <option value="Gastrointestinal">Gastrointestinal</option>
            <option value="Antiallergic">Antiallergic</option>
          </select>

          {/* Stock Filter Pill */}
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-teal-600"
          >
            <option value="ALL">All Stock Levels</option>
            <option value="IN_STOCK">Adequate Stock</option>
            <option value="LOW">Low Stock</option>
            <option value="OUT">Out of Stock</option>
          </select>

          <button
            onClick={loadData}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh Table"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-teal-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dense Enterprise Data Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Medicine Details</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Batch No</th>
                <th className="py-3 px-4">Expiry</th>
                <th className="py-3 px-4">Rack</th>
                <th className="py-3 px-4 text-right">Price</th>
                <th className="py-3 px-4 text-center">Current Stock</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Quick Stock Adjust</th>
                <th className="py-3 px-4 text-right">POS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-teal-600" />
                      <span>Loading medicine inventory...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredMedicines.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No matching medicines in inventory.
                  </td>
                </tr>
              ) : (
                filteredMedicines.map((med) => {
                  const isOut = med.stockQuantity === 0 || !med.inStock;
                  const isLow = !isOut && med.stockQuantity <= med.reorderLevel;
                  const isAdjusting = adjustingId === med.id;

                  return (
                    <tr
                      key={med.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Name & Generic */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 group-hover:text-teal-700 transition-colors">
                          {med.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {med.genericName}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
                          {med.category}
                        </span>
                      </td>

                      {/* Batch */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {med.batchNumber}
                      </td>

                      {/* Expiry */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {med.expiryDate}
                      </td>

                      {/* Rack Location */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {med.locationRack}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                        {formatINR(med.price)}
                      </td>

                      {/* Current Stock */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="font-mono text-sm font-bold tabular-nums text-slate-900">
                          {med.stockQuantity}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          Min: {med.reorderLevel}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            In Stock
                          </span>
                        )}
                      </td>

                      {/* Quick Adjust Buttons */}
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <div className="inline-flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                          <button
                            disabled={med.stockQuantity === 0 || isAdjusting}
                            onClick={() => handleStockAdjust(med.id, 'DEDUCT', 1)}
                            className="p-1 text-slate-600 hover:text-rose-600 hover:bg-white rounded transition-colors disabled:opacity-40"
                            title="Deduct 1 unit"
                          >
                            <MinusCircle className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-[11px] font-mono px-1 font-semibold text-slate-700">
                            &plusmn;1
                          </span>
                          <button
                            disabled={isAdjusting}
                            onClick={() => handleStockAdjust(med.id, 'RESTOCK', 10)}
                            className="p-1 text-slate-600 hover:text-teal-600 hover:bg-white rounded transition-colors disabled:opacity-40"
                            title="Restock 10 units"
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Quick POS Add */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/billing?quickAdd=${med.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-800"
                        >
                          <span>Bill</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="py-3 px-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-800">{filteredMedicines.length}</span> of{' '}
            <span className="font-semibold text-slate-800">{medicines.length}</span> medicines
          </div>
          <div className="font-mono text-[11px]">
            API: {source === 'api' ? 'Connected (Port 5001)' : 'Local Storage Fallback'}
          </div>
        </div>
      </div>

      {/* Add Medicine Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add New Medicine</h3>
                  <p className="text-xs text-slate-500">Register new batch in store inventory</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewMedicine} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Medicine Brand Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Augmentin 625 Duo"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Generic Composition / Salt
                  </label>
                  <input
                    type="text"
                    value={formData.genericName}
                    onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                    placeholder="e.g. Amoxicillin (500mg) + Clavulanic Acid (125mg)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Therapeutic Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:border-teal-600 focus:outline-none bg-white"
                  >
                    <option value="Antibiotics">Antibiotics</option>
                    <option value="Pain Relief">Pain Relief</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Diabetes">Diabetes</option>
                    <option value="Vitamins">Vitamins</option>
                    <option value="Gastrointestinal">Gastrointestinal</option>
                    <option value="Antiallergic">Antiallergic</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rack / Shelf Location
                  </label>
                  <input
                    type="text"
                    value={formData.locationRack}
                    onChange={(e) => setFormData({ ...formData, locationRack: e.target.value })}
                    placeholder="e.g. Shelf B-2"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Batch Number
                  </label>
                  <input
                    type="text"
                    value={formData.batchNumber}
                    onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                    placeholder="e.g. AUG-2024-98"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit Price (₹ MRP) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="e.g. 150.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Stock Count *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.stockQuantity}
                    onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                    placeholder="e.g. 50"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Low Stock Reorder Threshold
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.reorderLevel}
                    onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                    placeholder="10"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Register Medicine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
