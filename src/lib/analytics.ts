"use client";

import posthog, { type CaptureResult } from 'posthog-js';
import { hasAnalyticsConsent } from './cookie-consent';

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

export type AnalyticsRequestContext = {
  consent: true;
  distinctId: string;
  sessionId?: string;
};

const POSTHOG_PROXY_PATH = '/maria-sinais';
const POSTHOG_UI_HOST = 'https://us.posthog.com';

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

const EXCLUDED_PAGEVIEW_PREFIXES = [
  ...EXCLUDED_PUBLIC_ANALYTICS_PREFIXES,
  '/auth-callback',
  '/en/auth-callback',
];

const SENSITIVE_INTERACTION_PREFIXES = [
  ...EXCLUDED_PUBLIC_ANALYTICS_PREFIXES,
  '/auth-callback',
  '/en/auth-callback',
  '/thank-you',
  '/en/thank-you',
  '/loja-online/checkout',
  '/en/store/checkout',
];

const SAFE_QUERY_PARAMETERS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'ref',
  'source',
  'type',
  'provider',
  'status',
  'canceled',
]);

const SENSITIVE_PROPERTY_KEYS = new Set([
  'access_token',
  'address',
  'buyer_email',
  'email',
  'order_ref',
  'phone',
  'session_id',
  'token',
]);

let initialized = false;
let lastPageview: { key: string; capturedAt: number } | null = null;

const getPostHogToken = () =>
  process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.NEXT_PUBLIC_POSTHOG_TOKEN || '';

const getPostHogHost = () =>
  process.env.NEXT_PUBLIC_POSTHOG_PROXY_HOST || POSTHOG_PROXY_PATH;

const isAllowedAnalyticsHost = () => {
  if (typeof window === 'undefined') return false;
  if (process.env.NEXT_PUBLIC_POSTHOG_CAPTURE_NON_PRODUCTION === 'true') return true;
  return window.location.hostname === 'apostoladodegarabandal.com';
};

const hasDoNotTrack = () => {
  if (typeof window === 'undefined') return true;
  const nav = window.navigator as Navigator & { msDoNotTrack?: string };
  return nav.doNotTrack === '1' || nav.msDoNotTrack === '1';
};

const matchesPrefix = (pathname: string, prefixes: string[]) =>
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const getPathnameFromProperties = (properties: Record<string, unknown> = {}) => {
  const directPath = properties.$pathname || properties.path || properties.analytics_path;
  if (typeof directPath === 'string' && directPath.startsWith('/')) return directPath;

  const currentUrl = properties.$current_url;
  if (typeof currentUrl === 'string') {
    try {
      return new URL(currentUrl, window.location.origin).pathname;
    } catch {
      return window.location.pathname;
    }
  }

  return typeof window !== 'undefined' ? window.location.pathname : '/';
};

export const sanitizeAnalyticsUrl = (rawUrl: string) => {
  if (typeof window === 'undefined') return rawUrl.split('?')[0].split('#')[0];

  try {
    const url = new URL(rawUrl, window.location.origin);
    const safeSearch = new URLSearchParams();
    url.searchParams.forEach((value, key) => {
      if (SAFE_QUERY_PARAMETERS.has(key.toLowerCase())) {
        safeSearch.set(key, value.slice(0, 120));
      }
    });
    url.search = safeSearch.toString();
    url.hash = '';
    return url.toString();
  } catch {
    return rawUrl.split('?')[0].split('#')[0];
  }
};

const sanitizeProperties = (properties: AnalyticsProperties = {}) =>
  Object.fromEntries(
    Object.entries(properties)
      .filter(([key, value]) => value !== undefined && !SENSITIVE_PROPERTY_KEYS.has(key.toLowerCase()))
      .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 300) : value]),
  );

export const isPublicAnalyticsPath = (pathname?: string | null) => {
  const path = pathname || '/';
  return !matchesPrefix(path, EXCLUDED_PUBLIC_ANALYTICS_PREFIXES);
};

const isPageviewPath = (pathname?: string | null) => {
  const path = pathname || '/';
  return !matchesPrefix(path, EXCLUDED_PAGEVIEW_PREFIXES);
};

const isSensitiveInteractionPath = (pathname?: string | null) =>
  matchesPrefix(pathname || '/', SENSITIVE_INTERACTION_PREFIXES);

const sanitizeBeforeSend = (event: CaptureResult | null): CaptureResult | null => {
  if (!event || !hasAnalyticsConsent()) return null;

  const properties = event.properties || {};
  const pathname = getPathnameFromProperties(properties);
  if (!isPublicAnalyticsPath(pathname)) return null;

  if (event.event === '$pageview' && !isPageviewPath(pathname)) return null;
  if (isSensitiveInteractionPath(pathname) && (event.event === '$autocapture' || event.event === '$snapshot')) {
    return null;
  }

  if (typeof properties.$current_url === 'string') {
    properties.$current_url = sanitizeAnalyticsUrl(properties.$current_url);
  }
  if (typeof properties.$referrer === 'string') {
    properties.$referrer = sanitizeAnalyticsUrl(properties.$referrer);
  }
  delete properties.search;
  for (const key of SENSITIVE_PROPERTY_KEYS) delete properties[key];

  event.properties = properties;
  return event;
};

export const initAnalytics = () => {
  if (typeof window === 'undefined') return false;
  if (!isAllowedAnalyticsHost() || hasDoNotTrack() || !hasAnalyticsConsent()) {
    if (initialized) {
      posthog.stopSessionRecording();
      posthog.opt_out_capturing();
    }
    return false;
  }

  if (initialized) {
    posthog.opt_in_capturing({ captureEventName: false });
    if (!isSensitiveInteractionPath(window.location.pathname)) posthog.startSessionRecording();
    return true;
  }

  const token = getPostHogToken();
  if (!token) return false;

  posthog.init(token, {
    api_host: getPostHogHost(),
    ui_host: POSTHOG_UI_HOST,
    defaults: '2026-01-30',
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: {
      dom_event_allowlist: ['click', 'change', 'submit'],
      element_allowlist: ['a', 'button', 'form', 'input', 'select', 'textarea', 'label'],
    },
    capture_dead_clicks: true,
    capture_exceptions: true,
    enable_heatmaps: true,
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '.ph-sensitive, [data-ph-sensitive], [data-private]',
      blockSelector: '.ph-no-capture, [data-ph-no-capture]',
    },
    mask_all_text: true,
    person_profiles: 'identified_only',
    before_send: sanitizeBeforeSend,
  });

  initialized = true;
  if (isSensitiveInteractionPath(window.location.pathname)) posthog.stopSessionRecording();
  return true;
};

export const syncAnalyticsScope = (pathname?: string | null) => {
  if (typeof window === 'undefined') return;
  if (!hasAnalyticsConsent() || hasDoNotTrack()) {
    if (initialized) {
      posthog.stopSessionRecording();
      posthog.opt_out_capturing();
    }
    return;
  }

  if (!initAnalytics()) return;
  if (isSensitiveInteractionPath(pathname || window.location.pathname)) posthog.stopSessionRecording();
  else posthog.startSessionRecording();
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
  if (!isPageviewPath(pathname)) return;
  if (!initAnalytics()) return;

  const safeUrl = sanitizeAnalyticsUrl(window.location.href);
  const key = `${pathname}?${search || ''}`;
  const now = Date.now();
  if (lastPageview?.key === key && now - lastPageview.capturedAt < 1500) return;
  lastPageview = { key, capturedAt: now };

  posthog.capture('$pageview', {
    $current_url: safeUrl,
    $pathname: pathname,
    path: pathname,
    locale: pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'pt',
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
};

export const resetAnalyticsUser = () => {
  if (typeof window === 'undefined' || !initialized) return;
  posthog.reset();
};

export const getAnalyticsRequestContext = (): AnalyticsRequestContext | null => {
  if (typeof window === 'undefined' || !initAnalytics()) return null;
  const distinctId = posthog.get_distinct_id();
  if (!distinctId) return null;
  const sessionId = posthog.get_session_id();
  return {
    consent: true,
    distinctId,
    ...(sessionId ? { sessionId } : {}),
  };
};
