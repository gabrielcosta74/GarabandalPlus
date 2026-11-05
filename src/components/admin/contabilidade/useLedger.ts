"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { supabaseBrowser } from '../../../lib/supabase-browser';
import { demoMovements } from './demo-data';
import type { LedgerMovement } from './types';

export const PREVIEW_STORAGE_KEY = 'ledger:preview:v1';

export type StoredPreview = {
  fileName: string;
  createdAt: string;
  balanceOk: boolean | null;
  movements: LedgerMovement[];
};

/** live = database · preview = an uploaded statement, not saved · demo = invented example data */
export type LedgerMode = 'live' | 'preview' | 'demo' | 'bank';

export type BankInfo = {
  fetchedAt: string | null;
  nextRefreshAt: string | null;
  rateLimited: boolean;
  balanceLimited: boolean;
  validUntil: string | null;
  balance: number | null;
  balanceCheckedAt?: string | null;
  lastErrorCode?: string | null;
  lastAttemptAt?: string | null;
  manualBlockedUntil?: string | null;
  /** When set, donations from this date can have their FR issued by the app. */
  donationIssueFrom?: string | null;
};

export async function adminFetch(input: string, init: RequestInit = {}) {
  if (!supabaseBrowser) throw new Error('A ligação à área administrativa não está disponível.');
  const { data: { session } } = await supabaseBrowser.auth.getSession();
  if (!session) {
    clearStoredPreview();
    throw new Error('A sessão de administrador expirou. Entre novamente.');
  }
  const response = await fetch(input, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null);
  if (response.status === 401 || response.status === 403) clearStoredPreview();
  if (!response.ok) throw Object.assign(new Error(body?.error || 'Ocorreu um erro. Tente novamente.'), { body });
  return body;
}

export function readStoredPreview(): StoredPreview | null {
  try {
    const raw = window.sessionStorage.getItem(PREVIEW_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredPreview) : null;
  } catch {
    return null;
  }
}

export function storePreview(preview: StoredPreview) {
  try {
    window.sessionStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(preview));
  } catch {
    // Storage full or blocked: the preview only lives in memory.
  }
}

export function clearStoredPreview() {
  try {
    window.sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function demoRequested(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('demo') === '1';
  } catch {
    return false;
  }
}

type LedgerState = {
  loading: boolean;
  error: string | null;
  mode: LedgerMode;
  previewFileName: string | null;
  /** All months, for preview and demo (kept in memory so local actions stick). */
  localMovements: LedgerMovement[];
  periods: string[];
  period: string | null;
  movements: LedgerMovement[];
  closed: { closed_by: string; closed_at: string } | null;
  bank: BankInfo | null;
};

function periodsOf(movements: LedgerMovement[]): string[] {
  return [...new Set(movements.map(m => m.period))].sort().reverse();
}

function localState(mode: 'preview' | 'demo' | 'bank', all: LedgerMovement[], wanted: string | null, fileName: string | null, bank: BankInfo | null = null): LedgerState {
  const periods = periodsOf(all);
  const period = wanted && periods.includes(wanted) ? wanted : periods[0] || null;
  return {
    loading: false,
    error: null,
    mode,
    previewFileName: fileName,
    localMovements: all,
    periods,
    period,
    movements: all.filter(m => m.period === period),
    closed: null,
    bank,
  };
}

/**
 * Movements for one month. Reads the database when the ledger is live;
 * otherwise shows an uploaded statement (preview) or example data (demo).
 * In preview/demo, actions change the page in memory only.
 */
export function useLedger() {
  const [period, setPeriod] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<LedgerState>({
    loading: true, error: null, mode: 'live', previewFileName: null, localMovements: [],
    periods: [], period: null, movements: [], closed: null, bank: null,
  });

  const modeRef = useRef<LedgerMode>('live');
  const refreshRef = useRef(false);
  modeRef.current = state.mode;

  useEffect(() => {
    let cancelled = false;

    // Preview/demo keep every month in memory: switching month only re-slices.
    if (modeRef.current !== 'live' && !refreshRef.current) {
      setState(prev => localState(prev.mode as 'preview' | 'demo' | 'bank', prev.localMovements, period, prev.previewFileName, prev.bank));
      return;
    }
    const refresh = refreshRef.current;
    refreshRef.current = false;
    if (demoRequested()) {
      setState(prev => ({ ...prev, loading: true, error: null }));
      adminFetch('/api/admin/auth')
        .then(() => { if (!cancelled) setState(localState('demo', demoMovements(), period, null)); })
        .catch(error => { if (!cancelled) setState(prev => ({ ...prev, loading: false, error: error instanceof Error ? error.message : 'Sem acesso.' })); });
      return () => { cancelled = true; };
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    const query = new URLSearchParams();
    if (period) query.set('period', period);
    if (refresh) query.set('refresh', '1');
    adminFetch(`/api/admin/contabilidade/movimentos${query.size ? `?${query}` : ''}`)
      .then(body => {
        if (cancelled) return;
        if (body.dbReady === false && body.source === 'bank') {
          if (body.bankError) {
            setState(prev => ({ ...prev, loading: false, error: `Não foi possível ler o Montepio: ${body.bankError}` }));
            return;
          }
          setState(localState('bank', body.movements || [], period, null, body.bank || null));
          return;
        }
        if (body.dbReady === false) {
          const preview = readStoredPreview();
          setState(preview
            ? localState('preview', preview.movements, period, preview.fileName)
            : localState('demo', demoMovements(), period, null));
          return;
        }
        setState({
          loading: false,
          error: null,
          mode: 'live',
          previewFileName: null,
          localMovements: [],
          periods: body.periods || [],
          period: body.period || null,
          movements: body.movements || [],
          closed: body.closed || null,
          bank: body.bank || null,
        });
      })
      .catch(error => {
        if (cancelled) return;
        setState(prev => ({ ...prev, loading: false, error: error instanceof Error ? error.message : 'Erro ao carregar.' }));
      });
    return () => { cancelled = true; };
  }, [period, reloadKey]);

  const reload = useCallback(() => {
    if (modeRef.current === 'live') setReloadKey(key => key + 1);
  }, []);

  /** Bank mode: fetch the latest movements from Montepio again. */
  const refreshFromBank = useCallback(() => {
    refreshRef.current = true;
    setReloadKey(key => key + 1);
  }, []);

  useEffect(() => {
    if (state.mode !== 'bank' || !state.bank?.nextRefreshAt) return;
    const due = Date.parse(state.bank.nextRefreshAt);
    if (!Number.isFinite(due)) return;
    const timer = window.setTimeout(refreshFromBank, Math.max(1000, due - Date.now()));
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() >= due) refreshFromBank();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [state.mode, state.bank?.nextRefreshAt, refreshFromBank]);

  // The cron reads the bank independently. Refresh the displayed database state
  // while the admin is present, without making another request to the bank.
  useEffect(() => {
    if (state.mode !== 'live') return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') setReloadKey(key => key + 1);
    }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [state.mode]);

  /** Preview/demo only: apply an action in memory. */
  const updateLocal = useCallback((id: string, patch: Partial<LedgerMovement>) => {
    setState(prev => {
      const all = prev.localMovements.map(m => (m.id === id ? { ...m, ...patch } : m));
      return { ...prev, localMovements: all, movements: all.filter(m => m.period === prev.period) };
    });
  }, []);

  const showStoredPreview = useCallback(() => {
    const preview = readStoredPreview();
    if (preview) setState(localState('preview', preview.movements, null, preview.fileName));
  }, []);

  const readOnlyReason = state.closed ? 'Este mês está fechado.' : null;

  /** Movements of the month before, when known (local modes keep every month). */
  const previous = useMemo(() => {
    if (state.mode === 'live' || !state.period) return null;
    const [year, month] = state.period.split('-').map(Number);
    const prev = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
    const rows = state.localMovements.filter(m => m.period === prev);
    return rows.length ? rows : null;
  }, [state.mode, state.period, state.localMovements]);

  return useMemo(
    () => ({ ...state, previous, isLocal: state.mode !== 'live', readOnlyReason, setPeriod, reload, refreshFromBank, updateLocal, showStoredPreview }),
    [state, previous, readOnlyReason, reload, refreshFromBank, updateLocal, showStoredPreview],
  );
}
