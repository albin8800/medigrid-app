'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function AdminRootPage() {
  const router = useRouter();
  const { adminSession, isInitialized } = useAuth();

  useEffect(() => {
    if (!isInitialized) return;
    if (adminSession) {
      router.replace('/admin/dashboard');
    } else {
      router.replace('/admin/login');
    }
  }, [adminSession, isInitialized, router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-pulse text-sm text-slate-500">Redirecting to super admin portal...</div>
    </div>
  );
}
