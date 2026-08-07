'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { useAuth } from './AuthContext';
import { useLocale } from './LocaleContext';
import type { PaymentAlert, PaymentAlertsResponse } from '../lib/pilgrimage-payment-alerts';

type PaymentAlertsContextValue = {
  alerts: PaymentAlert[];
  primaryAlert: PaymentAlert | null;
  isLoading: boolean;
  userId: string | null;
  refresh: () => Promise<PaymentAlertsResponse | undefined>;
};

const PaymentAlertsContext = createContext<PaymentAlertsContextValue | undefined>(undefined);
const EMPTY_ALERTS: PaymentAlert[] = [];

type FetchError = Error & { status?: number };

const fetchPaymentAlerts = async (url: string): Promise<PaymentAlertsResponse> => {
  const response = await fetch(url, {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      payload?.error || 'Não foi possível carregar os avisos de pagamento.',
    ) as FetchError;
    error.status = response.status;
    throw error;
  }

  return {
    alerts: Array.isArray(payload?.alerts) ? payload.alerts : [],
    generatedAt: String(payload?.generatedAt || new Date().toISOString()),
  };
};

export function PilgrimagePaymentAlertsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const { locale } = useLocale();
  const key = user && !authLoading
    ? `/api/booking/payment-alerts?locale=${locale}`
    : null;
  const { data, isLoading, mutate } = useSWR<PaymentAlertsResponse>(
    key,
    fetchPaymentAlerts,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 5 * 60 * 1000,
      refreshWhenHidden: false,
      shouldRetryOnError: true,
      onErrorRetry: (error: FetchError, _key, _config, revalidate, context) => {
        if (error.status === 401 || context.retryCount >= 2) return;
        setTimeout(() => revalidate({ retryCount: context.retryCount }), 5000);
      },
    },
  );

  useEffect(() => {
    if (key) void mutate();
  }, [key, pathname, mutate]);

  const alerts = user ? (data?.alerts || EMPTY_ALERTS) : EMPTY_ALERTS;
  const value = useMemo<PaymentAlertsContextValue>(() => ({
    alerts,
    primaryAlert: alerts[0] || null,
    isLoading: authLoading || Boolean(user && isLoading),
    userId: user?.id || null,
    refresh: async () => mutate(),
  }), [alerts, authLoading, isLoading, mutate, user]);

  return (
    <PaymentAlertsContext.Provider value={value}>
      {children}
    </PaymentAlertsContext.Provider>
  );
}

export function usePilgrimagePaymentAlerts() {
  const context = useContext(PaymentAlertsContext);
  if (!context) {
    throw new Error('usePilgrimagePaymentAlerts must be used within PilgrimagePaymentAlertsProvider');
  }
  return context;
}
