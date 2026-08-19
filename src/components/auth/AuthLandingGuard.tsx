"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { hasAuthCallbackPayload } from '../../lib/auth-redirects';

const AUTH_HANDLER_PREFIXES = [
  '/auth-callback',
  '/auth/confirm',
  '/auth/update-password',
  '/en/auth-callback',
  '/en/auth/confirm',
  '/en/auth/update-password',
];

export default function AuthLandingGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pathname) return;
    if (AUTH_HANDLER_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;

    const currentUrl = window.location.href;
    if (!hasAuthCallbackPayload(currentUrl)) return;

    const url = new URL(currentUrl);
    const callbackUrl = new URL('/auth-callback', url.origin);
    callbackUrl.search = url.search;
    callbackUrl.hash = url.hash;
    window.location.replace(callbackUrl.toString());
  }, [pathname]);

  return null;
}
