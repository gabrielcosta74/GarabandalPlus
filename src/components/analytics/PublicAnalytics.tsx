"use client";

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { capturePublicPageView } from '../../lib/analytics';

function PublicAnalyticsPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    capturePublicPageView(pathname || '/', searchParams?.toString() || '');
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
