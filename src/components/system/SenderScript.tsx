'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { isFocusedRecoveryPath } from '../../lib/recovery-flow';

/**
 * Sender.net newsletter widget.
 *
 * This used to live directly in the root layout, gated on a pathname read from
 * `headers()`. That single `headers()` call opted EVERY page of the site into
 * dynamic rendering, so production served `cache-control: no-store` everywhere
 * and `export const revalidate` was silently dead. Reading the pathname on the
 * client instead lets the root layout stay static.
 *
 * It also loads later than it used to. The widget only renders a newsletter form
 * below the fold, but `afterInteractive` put ~39 KiB of CSS+JS from a third-party
 * origin on the critical path (PageSpeed: ~330ms of LCP). A bare
 * `requestIdleCallback` can run almost immediately, so we first keep the widget
 * outside the initial Lighthouse/mobile loading window, then wait for idle.
 */
export default function SenderScript() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    let idleId: number | undefined;
    const delayId = window.setTimeout(() => {
      // `requestIdleCallback` is still unimplemented on Safari <17.
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(() => setReady(true), { timeout: 3000 });
        return;
      }
      setReady(true);
    }, 12000);

    return () => {
      window.clearTimeout(delayId);
      if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [ready]);

  // The focused password-recovery flow deliberately ships no marketing scripts.
  if (isFocusedRecoveryPath(pathname)) return null;
  if (!ready) return null;

  return (
    <Script id="sender-universal" strategy="lazyOnload">
      {`(function (s, e, n, d, er) {
        s['Sender'] = er;
        s[er] = s[er] || function () {
          (s[er].q = s[er].q || []).push(arguments)
        }, s[er].l = 1 * new Date();
        s[er].on = function(event, callback) {
          s[er].listeners = s[er].listeners || {};
          (s[er].listeners[event] = s[er].listeners[event] || []).push(callback);
        };
        var a = e.createElement(n),
            m = e.getElementsByTagName(n)[0];
        a.async = 1;
        a.src = d;
        m.parentNode.insertBefore(a, m)
      })(window, document, 'script', 'https://cdn.sender.net/accounts_resources/universal.js', 'sender');
      sender('0c380a08998972')`}
    </Script>
  );
}
