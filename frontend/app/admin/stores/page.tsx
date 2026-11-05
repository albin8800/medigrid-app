'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminStoresRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect directly to admin dashboard fleet view
    router.replace('/admin/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-pulse text-sm text-slate-500">Loading store fleet...</div>
    </div>
  );
}
