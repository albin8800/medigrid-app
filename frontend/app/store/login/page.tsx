'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, Lock, Mail, ArrowRight, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function StoreLoginPage() {
  const router = useRouter();
  const { loginStore } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      await loginStore(email, password);
      router.push('/store/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto pt-10 pb-16 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-md shadow-teal-600/20">
          <Store className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Partner Pharmacy Login
        </h1>
        <p className="text-sm text-slate-600">
          Sign in to access your pharmacy inventory and counter POS billing.
        </p>
      </div>

      {/* Login Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-5">
        {errorMessage && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm">
            <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Registered Store Email
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pharmacy@medigrid.com"
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition shadow-sm shadow-teal-600/20 active:scale-[0.99] disabled:opacity-60"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In to Store Portal'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Demo Quick-Fill Buttons */}
        <div className="border-t border-slate-100 pt-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Demo Test Credentials:</span>
            <span>Single-Click Login</span>
          </div>

          <button
            type="button"
            onClick={async () => {
              setEmail('apollo.indiranagar@medigrid.com');
              setPassword('store123');
              setErrorMessage(null);
              setLoading(true);
              try {
                await loginStore('apollo.indiranagar@medigrid.com', 'store123');
                router.push('/store/dashboard');
              } catch (err: any) {
                setErrorMessage(err.message || 'Login failed.');
              } finally {
                setLoading(false);
              }
            }}
            className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-200 text-xs text-slate-700 transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="font-semibold text-slate-900 group-hover:text-teal-900">
                Apollo Pharmacy
              </span>
              <span className="font-mono text-slate-500">(store-001)</span>
            </div>
            <span className="text-[11px] font-mono text-teal-600 group-hover:underline">Login &rarr;</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              setEmail('medplus.koramangala@medigrid.com');
              setPassword('store123');
              setErrorMessage(null);
              setLoading(true);
              try {
                await loginStore('medplus.koramangala@medigrid.com', 'store123');
                router.push('/store/dashboard');
              } catch (err: any) {
                setErrorMessage(err.message || 'Login failed.');
              } finally {
                setLoading(false);
              }
            }}
            className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-200 text-xs text-slate-700 transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="font-semibold text-slate-900 group-hover:text-teal-900">
                MedPlus Chemist
              </span>
              <span className="font-mono text-slate-500">(store-002)</span>
            </div>
            <span className="text-[11px] font-mono text-teal-600 group-hover:underline">Login &rarr;</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              setEmail('lifecare.hsr@medigrid.com');
              setPassword('store123');
              setErrorMessage(null);
              setLoading(true);
              try {
                await loginStore('lifecare.hsr@medigrid.com', 'store123');
                router.push('/store/dashboard');
              } catch (err: any) {
                setErrorMessage(err.message || 'This medical store is suspended by admin');
              } finally {
                setLoading(false);
              }
            }}
            className="w-full text-left px-3 py-2 rounded-lg border border-rose-200 bg-rose-50/60 hover:bg-rose-100/60 text-xs text-rose-900 transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-rose-500"></span>
              <span className="font-semibold text-rose-950">
                Lifecare Pharmacy
              </span>
              <span className="font-mono text-rose-700">(store-003 &bull; Suspended)</span>
            </div>
            <span className="text-[11px] font-mono text-rose-600 group-hover:underline">Try Login &rarr;</span>
          </button>
        </div>
      </div>
    </div>
  );
}
