"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Legacy Page Redirector
 * 
 * This page exists because some old emails or Supabase configurations 
 * might still point to /reset-password.
 * 
 * improved logic: Forward everything to /auth-callback which handles 
 * the session validation and redirects to the correct Premium UI pages.
 */
export default function ResetPasswordRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Preserve hash (#access_token=...) and search (?query=...)
    // and forward to the central handler.
    const isEn = window.location.pathname.startsWith('/en');
    const search = new URLSearchParams(window.location.search);
    if (isEn && !search.has('locale')) search.set('locale', 'en');
    const qs = search.toString();
    const target = '/auth-callback' + (qs ? `?${qs}` : '') + window.location.hash;

    console.log("Forcing redirect from legacy page to:", target);
    window.location.replace(target);
  }, [router]);

  const isEn = typeof window !== 'undefined' && window.location.pathname.startsWith('/en');

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-garabandal-gold animate-spin" />
        <p className="text-gray-500 font-medium">{isEn ? 'Redirecting...' : 'A redirecionar...'}</p>
      </div>
    </div>
  );
}
