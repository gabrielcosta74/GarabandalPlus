"use client";

import { useCallback, useEffect, useState } from 'react';

import type { Analysis } from '../../../lib/ledger/analysis';
import { adminFetch } from '../contabilidade/useLedger';
import { demoAnalysis } from './demo-data';
import FinanceDashboard from './FinanceDashboard';
import styles from './financas.module.css';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: Analysis; demo: boolean };

export default function FinancasView() {
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      // Demo data still requires a valid admin session.
      const data = (await adminFetch('/api/admin/financas/analise')) as Analysis;
      const demo = new URLSearchParams(window.location.search).get('demo') === '1';
      setState({ status: 'ready', data: demo ? demoAnalysis() : data, demo });
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Não foi possível carregar a análise.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === 'ready') return <FinanceDashboard data={state.data} demo={state.demo} />;

  return (
    <div className={styles.page}>
      <div className={styles.center}>
        {state.status === 'loading' ? <div className={styles.spinner} role="status" aria-label="A carregar" /> : (
          <>
            <p style={{ margin: 0 }}>{state.message}</p>
            <button type="button" className={`${styles.glass} ${styles.retry}`} onClick={() => void load()}>Tentar novamente</button>
          </>
        )}
      </div>
    </div>
  );
}
