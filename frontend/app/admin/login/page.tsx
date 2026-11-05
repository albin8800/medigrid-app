'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, Mail, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function AdminLoginPage() {
  const router = useRouter();
  const { loginAdmin } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      await loginAdmin(email, password);
      router.push('/admin/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Super Admin authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = async () => {
    setEmail('admin@medigrid.com');
    setPassword('admin123');
    setErrorMessage(null);
    setLoading(true);

    try {
      await loginAdmin('admin@medigrid.com', 'admin123');
      router.push('/admin/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto pt-6 pb-16 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/20">
          <Shield className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Super Admin Governance
        </h1>
        <p className="text-sm text-slate-600">
          Platform-wide fleet oversight, store onboarding, and status authorization.
        </p>
      </div>

      {/* Login Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-5">
        {errorMessage && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Super Admin Email
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
                placeholder="admin@medigrid.com"
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Master Password
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
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition shadow-sm shadow-blue-600/20 active:scale-[0.99] disabled:opacity-60"
          >
            <span>{loading ? 'Verifying master token...' : 'Sign In as Super Admin'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Quick-fill Button */}
        <div className="border-t border-slate-100 pt-5 space-y-2">
          <div className="text-xs font-medium text-slate-400">
            Developer / Evaluation Quick-Fill:
          </div>

          <button
            type="button"
            onClick={handleQuickFill}
            className="w-full text-left px-3.5 py-2.5 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100/70 text-xs text-blue-900 transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-slate-900">
                [ Login as Super Admin ]
              </span>
              <span className="font-mono text-slate-500 text-[11px]">(admin@medigrid.com)</span>
            </div>
            <span className="text-xs font-mono font-medium text-blue-600 group-hover:underline">
              Enter &rarr;
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
