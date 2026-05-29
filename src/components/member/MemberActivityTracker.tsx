"use client";

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { trackPageView } from '../../lib/member-activity';

/**
 * Invisible telemetry mount for the members area. Records one page view per
 * (user, pathname) change. Inserts directly via RLS-protected browser client.
 * Renders nothing.
 */
export default function MemberActivityTracker() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !user?.id || !pathname) return;

    const key = `${user.id}::${pathname}`;
    if (lastTracked.current === key) return; // dedupe re-renders for same view
    lastTracked.current = key;

    // small delay so genuine navigations (not bounces) are recorded
    const t = setTimeout(() => {
      trackPageView(user.id, pathname);
    }, 800);

    return () => clearTimeout(t);
  }, [pathname, user?.id, loading]);

  return null;
}
