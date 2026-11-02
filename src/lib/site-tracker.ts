"use client";

import { hasAnalyticsConsent } from './cookie-consent';

/**
 * Tracking próprio (first-party) do site. Envia lotes para /api/m, que grava
 * em site_visitors / site_sessions / site_events no Supabase.
 *
 * - Com consentimento analítico: visitante persistente (localStorage).
 * - Sem consentimento ou com Do Not Track: o visitante é só a sessão do
 *   separador (sessionStorage), sem identificador que sobreviva à visita.
 * - Nunca envia IP, valores de formulários nem query strings além de UTM.
 * - Admins (quem já abriu /admin neste browser) não são contados.
 * - Depuração: localStorage.gp_debug = '1' escreve cada lote na consola.
 */

type TrackValue = string | number | boolean | null | undefined;
export type TrackProperties = Record<string, TrackValue>;

type QueuedEvent = {
  name: string;
  path: string;
  ts: string;
  pilgrimage_id?: string;
  props: Record<string, string | number | boolean | null>;
};

const ENDPOINT = '/api/m';
const VISITOR_KEY = 'gp_vid';
const SESSION_KEY = 'gp_sid';
const SESSION_TOUCH_KEY = 'gp_sid_at';
const SESSION_SOURCE_KEY = 'gp_src';
const INTERNAL_KEY = 'gp_internal';
const SESSION_IDLE_MS = 30 * 60 * 1000;
const FLUSH_DELAY_MS = 1500;
const MAX_BATCH = 30;

const EXCLUDED_PREFIXES = ['/admin', '/account', '/member', '/en/member', '/auth-callback', '/en/auth-callback'];
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
const SENSITIVE_KEYS = new Set(['email', 'phone', 'name', 'token', 'access_token', 'address', 'password', 'nif', 'cpf_nif']);

const queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;

// Estado da página atual (tempo ativo, scroll, secções vistas).
let pageState: { path: string; startedAt: number; activeMs: number; lastActiveAt: number; maxScroll: number; pilgrimageId?: string } | null = null;
const seenSections = new Set<string>();
// Contexto e observer ficam presos ao caminho onde foram criados: os efeitos
// da página podem correr antes ou depois do page_view do layout.
let sectionObserver: { path: string; observer: IntersectionObserver } | null = null;
let pilgrimageContext: { path: string; id: string } | null = null;

const currentPilgrimageId = () =>
  pilgrimageContext && pilgrimageContext.path === window.location.pathname ? pilgrimageContext.id : undefined;

const isBrowser = () => typeof window !== 'undefined';

const safeStorage = (kind: 'local' | 'session') => {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
};

const randomId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
};

const hasDoNotTrack = () => {
  const nav = window.navigator as Navigator & { msDoNotTrack?: string };
  return nav.doNotTrack === '1' || nav.msDoNotTrack === '1';
};

const isExcludedPath = (path: string) =>
  EXCLUDED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const isInternal = () => {
  if (window.location.pathname.startsWith('/admin')) {
    safeStorage('local')?.setItem(INTERNAL_KEY, '1');
    return true;
  }
  return safeStorage('local')?.getItem(INTERNAL_KEY) === '1';
};

const canPersist = () => hasAnalyticsConsent() && !hasDoNotTrack();

const getSessionId = () => {
  const store = safeStorage('session');
  const now = Date.now();
  const existing = store?.getItem(SESSION_KEY);
  const touchedAt = Number(store?.getItem(SESSION_TOUCH_KEY) || 0);
  if (existing && now - touchedAt < SESSION_IDLE_MS) {
    store?.setItem(SESSION_TOUCH_KEY, String(now));
    return existing;
  }
  const id = randomId();
  store?.setItem(SESSION_KEY, id);
  store?.setItem(SESSION_TOUCH_KEY, String(now));
  store?.removeItem(SESSION_SOURCE_KEY);
  return id;
};

const getVisitor = () => {
  if (canPersist()) {
    const store = safeStorage('local');
    let id = store?.getItem(VISITOR_KEY);
    if (!id) {
      id = randomId();
      store?.setItem(VISITOR_KEY, id);
    }
    return { id, persistent: true };
  }
  // Sem consentimento: visitante = sessão (nada persiste entre visitas).
  return { id: `s:${getSessionId()}`, persistent: false };
};

const referrerHost = () => {
  if (!document.referrer) return null;
  try {
    const host = new URL(document.referrer).hostname.replace(/^www\./, '');
    return host === window.location.hostname.replace(/^www\./, '') ? null : host;
  } catch {
    return null;
  }
};

/** Origem da sessão (first touch): fica fixa até a sessão expirar. */
const getSessionSource = () => {
  const store = safeStorage('session');
  const cached = store?.getItem(SESSION_SOURCE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached) as Record<string, string | null>;
    } catch {
      // segue para recalcular
    }
  }
  const params = new URLSearchParams(window.location.search);
  const source: Record<string, string | null> = {
    landing_path: window.location.pathname,
    referrer_host: referrerHost(),
  };
  for (const key of UTM_KEYS) source[key] = params.get(key)?.slice(0, 120) || null;
  if (!source.utm_source && params.get('ref')) source.utm_source = params.get('ref')!.slice(0, 120);
  store?.setItem(SESSION_SOURCE_KEY, JSON.stringify(source));
  return source;
};

const deviceType = () => {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1100) return 'tablet';
  return 'desktop';
};

const localeFromPath = (path: string) => (path === '/en' || path.startsWith('/en/') ? 'en' : path.startsWith('/es') ? 'es' : 'pt');

const cleanProps = (props: TrackProperties = {}) =>
  Object.fromEntries(
    Object.entries(props)
      .filter(([key, value]) => value !== undefined && !SENSITIVE_KEYS.has(key.toLowerCase()))
      .slice(0, 25)
      .map(([key, value]) => [key.slice(0, 60), typeof value === 'string' ? value.slice(0, 200) : value]),
  ) as Record<string, string | number | boolean | null>;

const shouldTrack = () => isBrowser() && !isInternal() && !isExcludedPath(window.location.pathname);

const flush = (useBeacon = false) => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!queue.length || !isBrowser()) return;

  const events = queue.splice(0, MAX_BATCH);
  const path = window.location.pathname;
  const payload = JSON.stringify({
    visitor: getVisitor(),
    session: {
      id: getSessionId(),
      ...getSessionSource(),
      device: deviceType(),
      locale: localeFromPath(path),
    },
    events,
  });

  if (safeStorage('local')?.getItem('gp_debug') === '1') console.debug('[site-track]', payload);

  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'text/plain' }));
    } else {
      void fetch(ENDPOINT, { method: 'POST', body: payload, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
    }
  } catch {
    // tracking nunca pode partir a página
  }

  if (queue.length) flush(useBeacon);
};

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(() => flush(false), FLUSH_DELAY_MS);
};

const enqueue = (name: string, props: TrackProperties = {}, options: { pilgrimageId?: string; immediate?: boolean; path?: string } = {}) => {
  if (!shouldTrack()) return;
  bindLifecycleListeners();
  const pilgrimageId = options.pilgrimageId ?? (typeof props.pilgrimage_id === 'string' ? props.pilgrimage_id : currentPilgrimageId());
  queue.push({
    name: name.slice(0, 80),
    path: options.path || window.location.pathname,
    ts: new Date().toISOString(),
    ...(pilgrimageId ? { pilgrimage_id: pilgrimageId } : {}),
    props: cleanProps(props),
  });
  if (options.immediate || queue.length >= MAX_BATCH) flush(true);
  else scheduleFlush();
};

/* -------------------------- página: tempo e scroll -------------------------- */

const markActive = () => {
  if (!pageState || document.visibilityState !== 'visible') return;
  const now = Date.now();
  // Só conta como ativo até 30s depois da última interação.
  pageState.activeMs += Math.min(now - pageState.lastActiveAt, 30_000);
  pageState.lastActiveAt = now;
};

const trackScroll = () => {
  if (!pageState) return;
  const doc = document.documentElement;
  const scrollable = doc.scrollHeight - window.innerHeight;
  const pct = scrollable > 0 ? Math.round((window.scrollY / scrollable) * 100) : 100;
  pageState.maxScroll = Math.max(pageState.maxScroll, Math.min(100, pct));
  markActive();
};

const endPage = () => {
  if (!pageState) return;
  markActive();
  enqueue('page_leave', {
    active_seconds: Math.round(pageState.activeMs / 1000),
    total_seconds: Math.round((Date.now() - pageState.startedAt) / 1000),
    max_scroll: pageState.maxScroll,
  }, { pilgrimageId: pageState.pilgrimageId, path: pageState.path });
  pageState = null;
};

function bindLifecycleListeners() {
  if (listenersBound || !isBrowser()) return;
  listenersBound = true;

  window.addEventListener('scroll', trackScroll, { passive: true });
  ['pointerdown', 'keydown', 'touchstart'].forEach((type) => window.addEventListener(type, markActive, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      markActive();
      flush(true);
    } else if (pageState) {
      pageState.lastActiveAt = Date.now();
    }
  });
  window.addEventListener('pagehide', () => {
    endPage();
    flush(true);
  });

  // Cliques declarativos: <button data-track="nome" data-track-placement="x">.
  document.addEventListener('click', (event) => {
    const target = (event.target as Element | null)?.closest?.('[data-track]') as HTMLElement | null;
    if (!target) return;
    const props: TrackProperties = {};
    for (const [key, value] of Object.entries(target.dataset)) {
      if (key.startsWith('track') && key !== 'track') {
        const prop = key.slice(5).replace(/^./, (c) => c.toLowerCase()).replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
        props[prop] = value;
      }
    }
    const href = target.getAttribute('href');
    const navigates = Boolean(href && !href.startsWith('#'));
    enqueue(target.dataset.track!, props, { immediate: navigates });
  }, { capture: true });
}

/* --------------------------------- API ---------------------------------- */

export const trackSiteEvent = (name: string, props: TrackProperties = {}, options: { pilgrimageId?: string; immediate?: boolean } = {}) => {
  enqueue(name, props, options);
};

export const trackSitePageView = (path: string) => {
  if (!isBrowser()) return;
  if (pageState?.path === path) return;
  endPage();
  if (sectionObserver && sectionObserver.path !== path) {
    sectionObserver.observer.disconnect();
    sectionObserver = null;
    seenSections.clear();
  }
  if (!shouldTrack()) return;
  pageState = { path, startedAt: Date.now(), activeMs: 0, lastActiveAt: Date.now(), maxScroll: 0, pilgrimageId: currentPilgrimageId() };
  enqueue('page_view');
};

/** Associa os eventos seguintes desta página a uma peregrinação. */
export const setSitePilgrimageContext = (pilgrimageId: string | undefined) => {
  if (!isBrowser()) return;
  pilgrimageContext = pilgrimageId ? { path: window.location.pathname, id: pilgrimageId } : null;
  if (pageState?.path === window.location.pathname) pageState.pilgrimageId = pilgrimageId;
};

/**
 * Regista `section_view` uma vez por secção quando ela atravessa a faixa do
 * meio do ecrã. Funciona com secções de qualquer altura (o roteiro tem
 * milhares de píxeis e nunca chega a uma percentagem fixa visível).
 */
export const observeSiteSections = (sections: Record<string, Element | null>) => {
  if (!isBrowser() || !('IntersectionObserver' in window) || !shouldTrack()) return () => {};
  const path = window.location.pathname;
  if (sectionObserver?.path !== path) seenSections.clear();
  sectionObserver?.observer.disconnect();
  const startedAt = pageState?.startedAt || Date.now();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const section = (entry.target as HTMLElement).dataset.trackSectionName;
      if (!section || seenSections.has(section)) continue;
      seenSections.add(section);
      enqueue('section_view', { section, seconds_since_load: Math.round((Date.now() - startedAt) / 1000) });
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
  sectionObserver = { path, observer };
  for (const [name, element] of Object.entries(sections)) {
    if (!element) continue;
    (element as HTMLElement).dataset.trackSectionName = name;
    observer.observe(element);
  }
  return () => observer.disconnect();
};

/** IDs para o servidor ligar este visitante a um lead/inscrição. */
export const getSiteTrackingIds = () => {
  if (!isBrowser() || isInternal()) return null;
  return { visitorId: getVisitor().id, sessionId: getSessionId() };
};
