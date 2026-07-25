'use client';

import { useEffect } from 'react';

/**
 * Development-only noise filter.
 *
 * React Strict Mode double-invokes effects in dev, which makes the Supabase
 * client (and other fetches) abort their first in-flight request. Those aborts
 * surface as `unhandledRejection: AbortError` spam in the terminal/console even
 * though nothing is actually wrong. We swallow ONLY AbortErrors, ONLY in dev, so
 * every other rejection still shows up normally. Strict Mode is off in
 * production, so this is a no-op there.
 */
export default function AbortErrorSilencer() {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'development') return;

        const isAbort = (reason: unknown) => {
            const name = (reason as { name?: string })?.name;
            const message = (reason as { message?: string })?.message;
            return name === 'AbortError' || (typeof message === 'string' && message.includes('aborted'));
        };

        const onRejection = (event: PromiseRejectionEvent) => {
            if (isAbort(event.reason)) event.preventDefault();
        };

        window.addEventListener('unhandledrejection', onRejection);
        return () => window.removeEventListener('unhandledrejection', onRejection);
    }, []);

    return null;
}
