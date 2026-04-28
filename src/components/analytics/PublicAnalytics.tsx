"use client";

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { capturePublicPageView } from '../../lib/analytics';
import { COOKIE_CONSENT_CHANGED_EVENT } from '../../lib/cookie-consent';

function PublicAnalyticsPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    capturePublicPageView(pathname || '/', searchParams?.toString() || '');
  }, [pathname, searchParams]);

  useEffect(() => {
    const captureAfterConsent = () => {
      capturePublicPageView(pathname || '/', searchParams?.toString() || '');
    };

    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, captureAfterConsent);
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, captureAfterConsent);
  }, [pathname, searchParams]);

  return null;
}

export default function PublicAnalytics() {
  return (
    <Suspense fallback={null}>
      <PublicAnalyticsPageView />
    </Suspense>
  );
}
