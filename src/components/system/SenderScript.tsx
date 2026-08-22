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
 * origin on the critical path (PageSpeed: ~330ms of LCP). We now wait for the
 * browser to go idle before injecting it.
 */
export default function SenderScript() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    // `requestIdleCallback` is still unimplemented on Safari <17, so fall back
    // to a timeout rather than never loading the widget there.
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => setReady(true), { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => setReady(true), 2500);
    return () => window.clearTimeout(id);
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
