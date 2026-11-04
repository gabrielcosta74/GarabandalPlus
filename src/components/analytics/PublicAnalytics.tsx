"use client";

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { capturePostHogEvent, capturePublicPageView, pilgrimageAnalyticsProperties, syncAnalyticsScope } from '../../lib/analytics';
import { COOKIE_CONSENT_CHANGED_EVENT } from '../../lib/cookie-consent';
import { trackSitePageView } from '../../lib/site-tracker';

function PublicAnalyticsPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() || '';

  useEffect(() => {
    syncAnalyticsScope(pathname || '/');
    capturePublicPageView(pathname || '/');
  }, [pathname, search]);

  // O tracking próprio conta todas as visitas, com ou sem consentimento.
  useEffect(() => {
    trackSitePageView(pathname || '/');
  }, [pathname]);

  useEffect(() => {
    const captureAfterConsent = () => {
      syncAnalyticsScope(pathname || '/');
      capturePublicPageView(pathname || '/');
    };

    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, captureAfterConsent);
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, captureAfterConsent);
  }, [pathname, search]);

  useEffect(() => {
    const capturePilgrimageClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-track]') : null;
      if (!target) return;
      const name = target.dataset.track;
      if (name !== 'pilgrimage_cta_clicked' && name !== 'pilgrimage_waitlist_clicked') return;
      const page = pilgrimageAnalyticsProperties(window.location.pathname);
      if (!('pilgrimage_page' in page) || page.pilgrimage_page !== 'detail') return;
      capturePostHogEvent(name, { placement: target.dataset.trackPlacement || 'unknown' });
    };
    document.addEventListener('click', capturePilgrimageClick, { capture: true });
    return () => document.removeEventListener('click', capturePilgrimageClick, { capture: true });
  }, []);

  return null;
}

export default function PublicAnalytics() {
  return (
    <Suspense fallback={null}>
      <PublicAnalyticsPageView />
    </Suspense>
  );
}
