"use client";

import posthog from 'posthog-js';
import { hasAnalyticsConsent } from './cookie-consent';

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

const EXCLUDED_PUBLIC_ANALYTICS_PREFIXES = [
  '/admin',
  '/account',
  '/member',
  '/en/member',
  '/en/orders',
  '/en/my-registrations',
  '/biblioteca',
  '/en/library',
  '/encomendas',
  '/peregrinacoes/minhas-inscricoes',
];

let initialized = false;

const getPostHogToken = () =>
  process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.NEXT_PUBLIC_POSTHOG_TOKEN || '';

const getPostHogHost = () =>
  process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

const hasDoNotTrack = () => {
  if (typeof window === 'undefined') return true;
  const nav = window.navigator as Navigator & { msDoNotTrack?: string };
  return nav.doNotTrack === '1' || nav.msDoNotTrack === '1';
};

const sanitizeProperties = (properties: AnalyticsProperties = {}) =>
  Object.fromEntries(
    Object.entries(properties)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, value === undefined ? null : value]),
  );

export const isPublicAnalyticsPath = (pathname?: string | null) => {
  const path = pathname || '/';
  return !EXCLUDED_PUBLIC_ANALYTICS_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
};

export const initAnalytics = () => {
  if (typeof window === 'undefined') return false;
  if (hasDoNotTrack()) return false;
  if (!hasAnalyticsConsent()) return false;
  if (initialized) return true;

  const token = getPostHogToken();
  if (!token) return false;

  posthog.init(token, {
    api_host: getPostHogHost(),
    defaults: '2026-01-30',
    capture_pageview: false,
    autocapture: false,
    person_profiles: 'identified_only',
  });

  initialized = true;
  return true;
};

export const captureAnalyticsEvent = (event: string, properties: AnalyticsProperties = {}) => {
  if (typeof window === 'undefined') return;
  if (!isPublicAnalyticsPath(window.location.pathname)) return;
  if (!initAnalytics()) return;

  posthog.capture(event, {
    ...sanitizeProperties(properties),
    analytics_path: window.location.pathname,
  });
};

export const capturePublicPageView = (pathname: string, search?: string) => {
  if (typeof window === 'undefined') return;
  if (!isPublicAnalyticsPath(pathname)) return;
  if (!initAnalytics()) return;

  posthog.capture('$pageview', {
    $current_url: window.location.href,
    path: pathname,
    search: search || '',
  });
};

export const captureStoreEvent = (event: string, properties: AnalyticsProperties = {}) => {
  captureAnalyticsEvent(event, {
    area: 'store',
    ...properties,
  });
};

export const identifyAnalyticsUser = (userId: string, properties: AnalyticsProperties = {}) => {
  if (typeof window === 'undefined') return;
  if (!initAnalytics()) return;
  posthog.identify(userId, sanitizeProperties(properties));
  captureAnalyticsEvent('user_identified', { has_user: true });
};

export const resetAnalyticsUser = () => {
  if (typeof window === 'undefined') return;
  if (!initAnalytics()) return;
  posthog.reset();
};
