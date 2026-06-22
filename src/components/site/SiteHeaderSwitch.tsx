"use client";

import { useEffect, useState } from 'react';
import SiteHeader from './SiteHeader';
import SiteHeaderV2 from './SiteHeaderV2';

/**
 * Picks V1 or V2 of the site header at runtime.
 *
 * V2 is shown when EITHER:
 *   - navV2Enabled is true (build-time flip at cutover)
 *   - the `cms-preview` cookie is set to '1' (admins previewing pre-cutover)
 *
 * Otherwise we render the legacy SiteHeader so public users see the
 * transactional-only site until Sprint 7. The cookie read happens client-side
 * (we can't read cookies from a "use client" component during hydration
 * without a flash), so we render V1 on the first paint and swap to V2 on
 * mount when the cookie is present. The flash is acceptable for the small
 * admin-preview audience.
 */
export default function SiteHeaderSwitch({ navV2Enabled = false }: { navV2Enabled?: boolean }) {
  const [showV2, setShowV2] = useState(navV2Enabled);

  useEffect(() => {
    if (navV2Enabled) {
      setShowV2(true);
      return;
    }
    try {
      const m = document.cookie.match(/(?:^|;\s*)cms-preview=([^;]+)/);
      if (m && m[1] === '1') setShowV2(true);
    } catch { /* noop */ }
  }, [navV2Enabled]);

  return showV2 ? <SiteHeaderV2 /> : <SiteHeader />;
}
