'use client';

import React, { useState, useEffect, useTransition, useRef } from 'react';
import {
  Search,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Store as StoreIcon,
  ShoppingBag,
  Sparkles,
  Compass,
  ArrowRight,
  Info,
} from 'lucide-react';
import { PublicSearchResult } from '@/lib/types';
import { searchPublicMedicines } from '@/lib/api';
import { formatINR, cn } from '@/lib/utils';
import { resolveLocation } from '@/lib/geo-resolver';

const DEFAULT_COORDS = { lat: 12.9784, lng: 77.6408, label: 'Bangalore Central' };

const QUICK_SUGGESTIONS = [
  'Dolo 650',
  'Augmentin',
  'Cetzine',
  'Pan 40',
  'Glycomet 500',
  'Montair LC',
  'Telma 40',
];

export default function PublicDiscoveryPage() {
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(DEFAULT_COORDS);
  const [locationLabel, setLocationLabel] = useState('Bangalore (12.9784, 77.6408)');
  const [cityInput, setCityInput] = useState('');
  const [radiusKm, setRadiusKm] = useState<number>(15);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  const [results, setResults] = useState<PublicSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'fallback'>('api');
  const [, startTransition] = useTransition();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener: ⌘K or /
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

  const handleUseCurrentLocation = () => {
    setLocating(true);
    setLocationMessage(null);

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = parseFloat(position.coords.latitude.toFixed(4));
          const lng = parseFloat(position.coords.longitude.toFixed(4));
          setCoords({ lat, lng });
          setLocationLabel(`Device GPS (${lat}, ${lng})`);
          setLocationMessage('Location detected via device GPS.');
          setLocating(false);
        },
        (error) => {
          console.warn('Geolocation warning/error:', error.message);
          setCoords(DEFAULT_COORDS);
          setLocationLabel('Bangalore Default (12.9784, 77.6408)');
          setLocationMessage('GPS permission denied or unavailable. Fallback: Bangalore coordinates applied.');
          setLocating(false);
        },
        { timeout: 7000, enableHighAccuracy: false }
      );
    } else {
      setCoords(DEFAULT_COORDS);
      setLocationLabel('Bangalore Default (12.9784, 77.6408)');
      setLocationMessage('Geolocation not supported by browser. Fallback: Bangalore default applied.');
      setLocating(false);
    }
  };

  const loadData = async (medQuery: string, currentCoords: { lat: number; lng: number }, radius: number, city: string) => {
    setLoading(true);
    try {
      const res = await searchPublicMedicines({
        medicine: medQuery,
        lat: currentCoords.lat,
        lng: currentCoords.lng,
        radius,
        city: city || undefined,
      });
      setResults(res.data);
      setSource(res.source);
    } catch (err) {
      console.error('Failed to query public search:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        loadData(query, coords, radiusKm, cityInput);
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [query, coords, radiusKm, cityInput]);

  // Auto-resolve Google Plus Codes or PIN codes in the location bar
  useEffect(() => {
    const trimmed = cityInput.trim();
    if (!trimmed) return;

    const isPlusCode = /[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,3}/i.test(trimmed);
    const isPincode = /^[1-9][0-9]{5}$/.test(trimmed);

    if (isPlusCode || isPincode) {
      const timer = setTimeout(async () => {
        const resolved = await resolveLocation(trimmed);
        if (resolved) {
          setCoords({ lat: resolved.lat, lng: resolved.lng });
          setLocationLabel(`${resolved.city || 'Pinpoint Location'} (${resolved.lat}, ${resolved.lng})`);
          setLocationMessage(resolved.method === 'plus_code' ? 'Targeted via Google Maps Plus Code' : 'Targeted via Postal PIN code');
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [cityInput]);

  // When search query is empty, cleanly surface each nearby active store with its exact details
  const displayItems = React.useMemo(() => {
    if (!query.trim()) {
      const seen = new Set<string>();
      const storesOnly: PublicSearchResult[] = [];
      for (const item of results) {
        if (!seen.has(item.storeId)) {
          seen.add(item.storeId);
          storesOnly.push({
            ...item,
            medicineName: item.medicineName === 'Full Pharmacy Counter' ? 'Full Pharmacy Counter' : 'Full Pharmacy Dispensary',
            genericName: 'All General & Prescription Medicines Available In-Store',
            price: 0,
            stockStatus: 'IN_STOCK',
            inStock: true,
          });
        }
      }
      return storesOnly;
    }
    return results;
  }, [results, query]);

  return (
    <div className="space-y-8 pb-16">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto pt-4 sm:pt-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 mb-4 shadow-2xs">
          <Sparkles className="h-3.5 w-3.5 text-teal-600 animate-pulse" />
          <span>Public Live Medicine Discovery Network</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Find Genuine Medicines Nearby
        </h1>
        <p className="mt-2.5 text-base text-slate-600 leading-relaxed">
          Locate verified medical stores carrying your prescription in real time. Compare prices and check distance before visiting the counter.
        </p>
      </div>

      {/* Main Search & Location Controller Card */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-6 space-y-4">
        {/* Medicine Search Bar */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
            <Search className="h-5 w-5" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search medicine brand or generic name (e.g. Dolo 650, Augmentin, Cetzine)..."
            className="w-full pl-11 pr-24 py-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm sm:text-base font-medium transition"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="hidden sm:inline-flex items-center px-2 py-1 text-xs font-mono font-medium text-slate-400 bg-white border border-slate-200 rounded">
              ⌘K
            </span>
          </div>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-400">Suggestions:</span>
          {QUICK_SUGGESTIONS.map((sug) => (
            <button
              key={sug}
              type="button"
              onClick={() => setQuery(sug)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                query.toLowerCase() === sug.toLowerCase()
                  ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
              )}
            >
              {sug}
            </button>
          ))}
        </div>

        <div className="border-t border-slate-100 pt-3"></div>

        {/* Location Selector Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Button: Use Current Location */}
          <div className="md:col-span-5">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locating}
              className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-medium transition active:scale-[0.99] disabled:opacity-60"
            >
              <Navigation className={cn('h-4 w-4 text-teal-600', locating && 'animate-spin')} />
              <span>{locating ? 'Locating device...' : '📍 Use My Current Location'}</span>
            </button>
          </div>

          {/* Manual City / Area Filter */}
          <div className="md:col-span-4 relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <MapPin className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="City, PIN, or Plus Code (e.g. Kollam 691531 or XQP9+36H)"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
            />
          </div>

          {/* Radius Selector */}
          <div className="md:col-span-3 flex items-center gap-2 justify-end">
            <label className="text-xs text-slate-500 whitespace-nowrap">Radius:</label>
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
            >
              <option value={5}>Within 5 km</option>
              <option value={15}>Within 15 km</option>
              <option value={30}>Within 30 km</option>
              <option value={50}>Within 50 km</option>
              <option value={0}>Any Distance (All)</option>
            </select>
          </div>
        </div>

        {/* Location Status Badge / Feedback */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <Compass className="h-3.5 w-3.5 text-teal-600" />
            <span className="font-mono text-slate-700">{locationLabel}</span>
            {locationMessage && (
              <span className="text-teal-700 italic ml-1 font-sans">({locationMessage})</span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 sm:mt-0">
            Source: <span className="font-mono">{source === 'api' ? 'Catalog API (:5001)' : 'Offline Local Fallback'}</span>
          </div>
        </div>
      </div>

      {/* Privacy Notice Banner */}
      <div className="max-w-4xl mx-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-100/70 border border-slate-200/80 text-xs text-slate-600">
        <ShieldCheck className="h-4 w-4 text-teal-600 shrink-0" />
        <span>
          <strong>Patient Privacy Protected:</strong> Batch numbers, procurement suppliers, and physical rack allocations are strictly masked for public discovery and reserved for registered pharmacy staff.
        </span>
      </div>

      {/* Results Header */}
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900">
            {query.trim() ? `Pharmacies with "${query.trim()}"` : 'Nearby Medical Stores & Pharmacies'}
          </h2>
          <span className="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-200 text-slate-700">
            {displayItems.length} {displayItems.length === 1 ? 'store' : 'stores'} found
          </span>
        </div>
        <span className="text-xs text-slate-400">Sorted by proximity (closest first)</span>
      </div>

      {/* Results Cards List */}
      <div className="max-w-4xl mx-auto space-y-3.5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-white rounded-xl border border-slate-200/80 p-5 animate-pulse flex flex-col gap-3"
              >
                <div className="h-5 bg-slate-200 rounded w-1/3"></div>
                <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                <div className="h-4 bg-slate-100 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        ) : displayItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <StoreIcon className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              {query.trim() ? `No medical stores found carrying "${query}"` : 'No medical stores found in this area'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Try searching with another medicine brand or generic name, increasing the search radius, or selecting a different city.
            </p>
          </div>
        ) : (
          displayItems.map((item, idx) => {
            const isLowStock = item.stockStatus === 'LOW_STOCK';
            const isOutOfStock = item.stockStatus === 'OUT_OF_STOCK';

            return (
              <div
                key={`${item.storeId}-${item.medicineName}-${idx}`}
                className="bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Store & Medicine Information */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-bold text-slate-900 text-base">
                      {item.storeName}
                    </span>
                    {typeof item.distanceKm === 'number' && item.distanceKm !== null && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-teal-50 text-teal-700 border border-teal-200">
                        <MapPin className="h-3 w-3" />
                        <span>{item.distanceKm} km away</span>
                      </span>
                    )}
                    {/* Status Pill */}
                    {isOutOfStock ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <XCircle className="h-3 w-3 text-rose-500" />
                        <span>Out of Stock</span>
                      </span>
                    ) : isLowStock ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        <span>🟡 Low Stock</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        <span>🟢 {item.medicineName === 'Full Pharmacy Counter' ? 'Pharmacy Open' : 'In Stock'}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 text-sm">
                      {item.medicineName === 'Full Pharmacy Counter' ? '🏪 Verified Medical Store' : item.medicineName}
                    </span>
                    {item.genericName && (
                      <span className="text-xs text-slate-500 italic">
                        ({item.genericName})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{item.storeAddress || 'Address on file'}</span>
                  </div>
                </div>

                {/* Pricing & Store Actions */}
                <div className="flex md:flex-col items-center md:items-end justify-between gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <div className="text-left md:text-right">
                    <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
                      {item.price > 0 ? formatINR(item.price) : 'In-Store POS'}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      <ShoppingBag className="h-3 w-3 text-slate-400" />
                      <span>Visit Store for In-Person Purchase</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.storePhone && (
                      <a
                        href={`tel:${item.storePhone}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium transition"
                      >
                        <Phone className="h-3.5 w-3.5 text-teal-600" />
                        <span>📞 Call Store ({item.storePhone})</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
