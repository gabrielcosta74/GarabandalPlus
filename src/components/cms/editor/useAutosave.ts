"use client";

import { useEffect, useRef, useState } from 'react';

export type AutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

type Options = {
  /** Debounce in ms before triggering save after the last change. */
  delayMs?: number;
  /** Disable autosave entirely (e.g. while user is interacting with critical fields). */
  enabled?: boolean;
};

/**
 * Tracks edit-state and fires `save()` after the user stops typing for `delayMs`.
 * Returns the visible status + a manual `flush` to force save now (e.g. on unmount).
 *
 * The save callback should be stable (wrapped in useCallback) since we keep a ref
 * to it and avoid re-running the effect on every render.
 */
export function useAutosave(
  /** A serializable signature of the current draft. Whenever it changes, the timer restarts. */
  signature: string,
  save: () => Promise<{ ok: boolean }>,
  { delayMs = 2500, enabled = true }: Options = {},
) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const saveRef = useRef(save);
  const sigRef = useRef(signature);
  const initialSig = useRef(signature);

  saveRef.current = save;

  useEffect(() => {
    if (!enabled) return;
    if (signature === sigRef.current) return;
    sigRef.current = signature;
    if (signature === initialSig.current) {
      // Editor reset to original; nothing to do.
      setStatus('idle');
      return;
    }
    setStatus('dirty');
    const t = window.setTimeout(async () => {
      setStatus('saving');
      try {
        const r = await saveRef.current();
        if (r.ok) {
          setStatus('saved');
          setLastSavedAt(new Date());
          initialSig.current = signature;
        } else {
          setStatus('error');
        }
      } catch {
        setStatus('error');
      }
    }, delayMs);
    return () => window.clearTimeout(t);
  }, [signature, enabled, delayMs]);

  const flush = async () => {
    setStatus('saving');
    try {
      const r = await saveRef.current();
      if (r.ok) {
        setStatus('saved');
        setLastSavedAt(new Date());
        return true;
      }
      setStatus('error');
    } catch {
      setStatus('error');
    }
    return false;
  };

  return { status, lastSavedAt, flush };
}
