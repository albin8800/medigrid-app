'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function StoreRootPage() {
  const router = useRouter();
  const { storeSession, isInitialized } = useAuth();

  useEffect(() => {
    if (!isInitialized) return;
    if (storeSession) {
      router.replace('/store/dashboard');
    } else {
      router.replace('/store/login');
    }
  }, [storeSession, isInitialized, router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-pulse text-sm text-slate-500">Redirecting to store portal...</div>
    </div>
  );
}
