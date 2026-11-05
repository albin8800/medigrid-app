'use client';

import React, { useState, useEffect, useTransition, useRef } from 'react';
import Link from 'next/link';
import {
  Search,
  Sparkles,
  MapPin,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  ShoppingBag,
  Info,
} from 'lucide-react';
import { Medicine } from '@/lib/types';
import { searchMedicines } from '@/lib/api';
import { formatINR } from '@/lib/utils';

const CATEGORIES = [
  'All',
  'Antibiotics',
  'Pain Relief',
  'Cardiology',
  'Diabetes',
  'Vitamins',
];

export default function PublicSearchPage() {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'fallback'>('api');
  const [, startTransition] = useTransition();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener: ⌘K or Ctrl+K or / to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadData = async (searchQuery: string, category: string) => {
    setLoading(true);
    try {
      const res = await searchMedicines(
        searchQuery,
        category === 'All' ? undefined : category
      );
      setMedicines(res.data);
      setSource(res.source);
    } catch (err) {
      console.error('Failed to load medicines:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        loadData(query, selectedCategory);
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [query, selectedCategory]);

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto pt-4 sm:pt-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 mb-4">
          <Sparkles className="h-3.5 w-3.5 text-teal-600" />
          <span>Real-time Central Pharmacy Inventory</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Find Genuine Medicines In Real-Time
        </h1>
        <p className="mt-3 text-base text-slate-600">
          Check live shelf availability, batch-verified pricing, and physical rack locations across the MediGrid network.
        </p>

        {/* Prominent Search Bar */}
        <div className="mt-8 relative max-w-2xl mx-auto shadow-sm">
          <div className="relative flex items-center">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
              <Search className="h-5 w-5" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by medicine name, salt composition (e.g. Paracetamol, Augmentin)..."
              className="w-full rounded-xl border border-slate-300 bg-white py-3.5 pl-11 pr-24 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 transition-all shadow-sm"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-medium text-slate-500">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/20'
                    : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200/80 text-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="font-semibold text-slate-900 font-mono tabular-nums">
            {medicines.length}
          </span>
          <span>medicines cataloged</span>
          {query && (
            <span className="text-slate-400 font-normal">
              matching &ldquo;<span className="text-slate-700 font-medium">{query}</span>&rdquo;
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Source:</span>
            {source === 'api' ? (
              <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                Catalog API (Port 5001)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                Resilient Local Store
              </span>
            )}
          </div>
          <button
            onClick={() => loadData(query, selectedCategory)}
            className="text-slate-500 hover:text-slate-800 transition-colors p-1"
            title="Refresh Catalog"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-teal-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Medicine Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-48 rounded-xl bg-white border border-slate-200/80 p-5 animate-pulse flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="h-5 bg-slate-200 rounded w-2/3"></div>
                <div className="h-4 bg-slate-100 rounded w-full"></div>
              </div>
              <div className="h-8 bg-slate-100 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : medicines.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center max-w-md mx-auto">
          <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No medicines found</h3>
          <p className="mt-1 text-sm text-slate-500">
            We couldn&apos;t find any medicine matching your criteria. Try adjusting your search query or category filter.
          </p>
          <button
            onClick={() => {
              setQuery('');
              setSelectedCategory('All');
            }}
            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {medicines.map((med) => {
            const isOutOfStock = med.stockQuantity === 0 || !med.inStock;
            const isLowStock = !isOutOfStock && med.stockQuantity <= med.reorderLevel;

            return (
              <div
                key={med.id}
                className="group relative flex flex-col justify-between bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:border-slate-300 hover:shadow-md transition-all"
              >
                <div>
                  {/* Top line: Category & Stock badge */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
                      {med.category}
                    </span>

                    {/* Stock status badge according to modern-ui-designer tokens */}
                    {isOutOfStock ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                        Out of Stock
                      </span>
                    ) : isLowStock ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                        Low Stock: <span className="font-mono tabular-nums font-semibold">{med.stockQuantity}</span> left
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        In Stock: <span className="font-mono tabular-nums font-semibold">{med.stockQuantity}</span>
                      </span>
                    )}
                  </div>

                  {/* Brand name */}
                  <h3 className="text-base font-semibold text-slate-900 group-hover:text-teal-700 transition-colors">
                    {med.name}
                  </h3>

                  {/* Generic Composition */}
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                    {med.genericName || 'Standard Pharmaceutical Formulation'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                  {/* Rack location & Expiry */}
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <span className="inline-flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60 text-slate-700 font-medium">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      {med.locationRack || 'Shelf Storage'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <Clock className="h-3 w-3" />
                      Exp: {med.expiryDate || 'N/A'}
                    </span>
                  </div>

                  {/* Price and Action */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
                        Unit MRP
                      </span>
                      <span className="text-lg font-bold font-mono tabular-nums text-slate-900">
                        {formatINR(med.price)}
                      </span>
                    </div>

                    <Link
                      href={`/billing?quickAdd=${med.id}`}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isOutOfStock
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed pointer-events-none'
                          : 'bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-600 hover:text-white'
                      }`}
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      <span>Dispense</span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Feature banner */}
      <div className="mt-12 bg-white rounded-xl border border-slate-200/80 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 flex-shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">100% Genuine & Batch-Tracked</h4>
              <p className="mt-1 text-xs text-slate-500">Every medicine is checked against batch records and expiry timestamps.</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center md:items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 flex-shrink-0">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Exact Shelf Coordinates</h4>
              <p className="mt-1 text-xs text-slate-500">Instant rack navigation for fast pharmacist dispensing.</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center md:items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 flex-shrink-0">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">GST-Compliant POS</h4>
              <p className="mt-1 text-xs text-slate-500">Live item stock deduction and automatic 5% GST tax receipt generation.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
