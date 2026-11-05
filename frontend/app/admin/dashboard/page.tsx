'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Building2,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Search,
  Power,
  MapPin,
  FileText,
  Phone,
  Mail,
  X,
  CreditCard,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { listAllStores, updateStoreStatusApi, createStoreApi, getAdminAnalyticsApi } from '@/lib/api';
import { Store, AdminAnalytics } from '@/lib/types';
import { formatINR, cn } from '@/lib/utils';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { adminSession, isInitialized } = useAuth();

  const [stores, setStores] = useState<Store[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Onboard Store Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    licenseNumber: '',
    city: 'Bangalore',
    address: '',
    phone: '',
    email: '',
    password: 'store123',
    lat: '12.9279',
    lng: '77.6271',
    status: 'ACTIVE' as 'ACTIVE' | 'SUSPENDED',
  });

  useEffect(() => {
    if (!isInitialized) return;
    if (!adminSession?.admin?.email) {
      router.replace('/admin/login');
      return;
    }

    loadAdminData();
  }, [adminSession, isInitialized]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [storesRes, analyticsRes] = await Promise.all([
        listAllStores(),
        getAdminAnalyticsApi(),
      ]);
      setStores(storesRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (store: Store) => {
    const newStatus: 'ACTIVE' | 'SUSPENDED' = store.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setActionInProgress(store.id);
    setNotification(null);

    try {
      await updateStoreStatusApi(store.id, newStatus);
      setNotification({
        type: 'success',
        message: `Store '${store.name}' (${store.id}) updated to ${newStatus}. Public search availability updated instantly.`,
      });
      // Refresh list
      const updated = await listAllStores();
      setStores(updated.data);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to update store status',
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setSubmitting(true);

    try {
      const parsedLat = parseFloat(formData.lat);
      const parsedLng = parseFloat(formData.lng);

      if (isNaN(parsedLat) || isNaN(parsedLng)) {
        throw new Error('Valid latitude and longitude coordinates are required');
      }

      await createStoreApi({
        name: formData.name.trim(),
        licenseNumber: formData.licenseNumber.trim(),
        city: formData.city.trim(),
        address: formData.address.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        password: formData.password || 'store123',
        status: formData.status,
        coordinates: { lat: parsedLat, lng: parsedLng },
      });

      setIsModalOpen(false);
      setNotification({
        type: 'success',
        message: `Successfully onboarded store '${formData.name}'.`,
      });
      setFormData({
        name: '',
        licenseNumber: '',
        city: 'Bangalore',
        address: '',
        phone: '',
        email: '',
        password: 'store123',
        lat: '12.9279',
        lng: '77.6271',
        status: 'ACTIVE',
      });
      loadAdminData();
    } catch (err: any) {
      setModalError(err.message || 'Failed to onboard store');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isInitialized || !adminSession?.admin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-sm text-slate-500 animate-pulse">Loading super admin dashboard...</div>
      </div>
    );
  }

  const totalStoresCount = stores.length;
  const activeStoresCount = stores.filter((s) => s.status === 'ACTIVE').length;
  const suspendedStoresCount = stores.filter((s) => s.status === 'SUSPENDED').length;
  const platformRevenue = analytics?.totalRevenue || 0;

  const filteredStores = stores.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.licenseNumber.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8 pb-16">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Shield className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Super Admin Fleet Governance
            </h1>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Authority: Platform Root
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Real-time multi-tenant monitoring, tenant authorization, and centralized pharmacy fleet management.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAdminData}
            title="Refresh Platform Metrics"
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-2xs"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition active:scale-[0.99]"
          >
            <Plus className="h-4 w-4" />
            <span>+ Onboard New Medical Store</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={cn(
            'p-3.5 rounded-xl text-xs sm:text-sm flex items-center justify-between gap-2 border transition',
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          )}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-xs font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Platform Overview Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Registered Stores */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Total Fleet Stores
            </span>
            <Building2 className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-3xl font-extrabold font-mono tabular-nums text-slate-900">
            {totalStoresCount}
          </div>
          <div className="text-[11px] text-slate-400">
            Registered medical store tenants
          </div>
        </div>

        {/* Metric 2: Active Stores */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-2">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Active Stores
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold font-mono tabular-nums text-emerald-700">
            {activeStoresCount}
          </div>
          <div className="text-[11px] text-emerald-600/80">
            Visible in public customer search
          </div>
        </div>

        {/* Metric 3: Suspended Stores */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-2">
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Suspended Stores
            </span>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-3xl font-extrabold font-mono tabular-nums text-rose-700">
            {suspendedStoresCount}
          </div>
          <div className="text-[11px] text-rose-600/80">
            Masked & locked out by admin
          </div>
        </div>

        {/* Metric 4: Platform Revenue */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-2">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Platform Gross
            </span>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-blue-800 truncate">
            {formatINR(platformRevenue)}
          </div>
          <div className="text-[11px] text-blue-600/80">
            Aggregated POS billing volume
          </div>
        </div>
      </div>

      {/* Fleet Management Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Medical Store Fleet Authorization
            </h2>
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {filteredStores.length} stores
            </span>
          </div>

          {/* Search Table */}
          <div className="relative max-w-xs w-full">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search store name, ID, city..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Fleet Table */}
        <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] uppercase tracking-wider font-semibold text-slate-500">
              <tr>
                <th className="py-3 px-4">Store Entity</th>
                <th className="py-3 px-4">License Number</th>
                <th className="py-3 px-4">Location & Coordinates</th>
                <th className="py-3 px-4">Contact Phone & Email</th>
                <th className="py-3 px-4 text-center">Authorization Status</th>
                <th className="py-3 px-4 text-right">Admin Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading medical store fleet...
                  </td>
                </tr>
              ) : filteredStores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No medical stores match your search.
                  </td>
                </tr>
              ) : (
                filteredStores.map((store) => {
                  const isActive = store.status === 'ACTIVE';
                  const inProgress = actionInProgress === store.id;

                  return (
                    <tr key={store.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">
                          {store.name}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {store.id}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                        {store.licenseNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div className="truncate max-w-[200px]">{store.address}</div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {store.city} {store.coordinates && `(${store.coordinates.lat}, ${store.coordinates.lng})`}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div>{store.phone}</div>
                        <div className="text-[11px] text-slate-400">{store.email}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            <span>ACTIVE</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                            <span>SUSPENDED</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          disabled={inProgress}
                          onClick={() => handleToggleStatus(store)}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition active:scale-[0.98] disabled:opacity-50',
                            isActive
                              ? 'border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700'
                              : 'border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                          )}
                        >
                          <Power className="h-3.5 w-3.5" />
                          <span>
                            {inProgress
                              ? 'Updating...'
                              : isActive
                              ? 'Suspend Store'
                              : 'Activate Store'}
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onboard New Medical Store Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  + Onboard New Medical Store
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

            <form onSubmit={handleOnboardSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Store Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. CareMax Chemist - Whitefield"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    License Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    placeholder="KA-BLR-2024-099"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Bangalore"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Main Rd, Whitefield"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Store Contact Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91-9876543299"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Login Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="caremax.whitefield@medigrid.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Latitude *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lat}
                    onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                    placeholder="12.9698"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Longitude *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lng}
                    onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                    placeholder="77.7499"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'SUSPENDED' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
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
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition disabled:opacity-60"
                >
                  {submitting ? 'Onboarding...' : 'Authorize & Onboard Store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
