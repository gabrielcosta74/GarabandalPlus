'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import { readCookieConsent } from '../../lib/cookie-consent';
import { captureAnalyticsEvent } from '../../lib/analytics';
import {
  appShortLink,
  buildAppLinks,
  detectPlatform,
  regionFromLanguages,
  type AppLinks,
  type AppPlatform,
} from '../../lib/app-links';
import StoreBadge from './StoreBadge';

/**
 * Garabandal+ promo.
 *
 * Re-show rules (state written when it opens, so a reload never repeats it):
 * a visitor who taps a store is never asked again; one who dismisses it is
 * asked again after 30 days, at most twice in total. It waits for the cookie
 * banner to be resolved and
 * for any other modal to be gone, then opens after a short delay or once the
 * visitor has scrolled a bit, whichever comes first. Append `?app-promo=1` to a
 * URL to force it for QA.
 */

const STORAGE_KEY = 'garabandal_app_promo_v1';
const SHOW_AFTER_MS = 9000;
const SHOW_AFTER_SCROLL = 0.3;

// Transactional, account and legal pages are never interrupted. Matched on the
// first path segment, after removing a locale prefix.
const BLOCKED_SEGMENTS = new Set([
  'admin', 'embed', 'api', 'auth', 'auth-callback', 'login', 'register', 'reset-password',
  'checkout', 'payments', 'payment', 'loja-online', 'thank-you', 'tornar-membro', 'become-member',
  'membership', 'donations', 'member', 'account', 'encomendas', 'eliminar-conta',
  'cancelar-subscricao', 'acesso-antecipado', 'dados-check-in', 'convite', 'preview',
  'privacidade', 'termos', 'cookies',
]);
const LOCALE_PREFIX = /^\/(en|es|fr|it)(?=\/|$)/;

function isBlockedPath(pathname: string | null) {
  if (!pathname) return true;
  if (/^\/(?:peregrinacoes\/(?:inscricao\/|[^/]+\/inscrever)|en\/pilgrimages\/(?:registration\/|[^/]+\/register))/.test(pathname)) return true;
  const segment = pathname.replace(LOCALE_PREFIX, '').split('/')[1] ?? '';
  return BLOCKED_SEGMENTS.has(segment);
}

type PromoState = { shown: number; last: number; clicked: boolean };

const RESHOW_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_SHOWS = 2;

function readState(): PromoState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // First release stored a bare timestamp: that counts as one earlier showing.
    if (/^\d+$/.test(raw)) return { shown: 1, last: Number(raw), clicked: false };
    const parsed = JSON.parse(raw) as Partial<PromoState>;
    return { shown: Number(parsed.shown) || 0, last: Number(parsed.last) || 0, clicked: parsed.clicked === true };
  } catch {
    return null;
  }
}
const writeState = (state: PromoState) => {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private mode */ }
};
const canShow = () => {
  const state = readState();
  if (!state) return true;
  return !state.clicked && state.shown < MAX_SHOWS && Date.now() - state.last >= RESHOW_AFTER_MS;
};
const recordShown = () => {
  const state = readState() ?? { shown: 0, last: 0, clicked: false };
  writeState({ ...state, shown: state.shown + 1, last: Date.now() });
};
const recordClick = () => {
  const state = readState() ?? { shown: 1, last: Date.now(), clicked: false };
  writeState({ ...state, clicked: true });
};

/** Another overlay is up (cookie banner, newsletter popup, open dialog). */
function isPageBusy() {
  if (document.getElementById('cookie-consent')) return true;
  if (!readCookieConsent()) return true;
  return Boolean(
    document.querySelector(
      '.sender-form-modal, .sender-modal-background, [class*="sender-subs-popup-form-"], [role="dialog"][aria-modal="true"]',
    ),
  );
}

async function fetchCountry(): Promise<string | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch('/api/region', { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { country?: string | null };
    return data.country ?? null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

const COPY = {
  pt: {
    eyebrow: 'Nova app',
    title: 'Leve o Garabandal',
    body: 'Orações, novenas, a liturgia do dia e uma comunidade de oração, sempre por perto.',
    also: 'Também disponível no',
    scanTitle: 'Abra no telemóvel',
    scanBody: 'Aponte a câmara para descarregar.',
    scanAlt: 'QR code para descarregar a app Garabandal+',
    orStore: 'Ou abra a',
    orPlay: 'ou o',
    dismiss: 'Agora não',
    close: 'Fechar',
    icon: 'Ícone da app Garabandal+',
  },
  en: {
    eyebrow: 'New app',
    title: 'Take Garabandal',
    body: 'Prayers, novenas, the daily liturgy and a community of prayer, always close to you.',
    also: 'Also on',
    scanTitle: 'Open on your phone',
    scanBody: 'Point your camera to download.',
    scanAlt: 'QR code to download the Garabandal+ app',
    orStore: 'Or open the',
    orPlay: 'or',
    dismiss: 'Not now',
    close: 'Close',
    icon: 'Garabandal+ app icon',
  },
} as const;

export default function AppPromoPopup() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const reduceMotion = useReducedMotion();
  const copy = COPY[locale];

  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<AppPlatform>('desktop');
  const [links, setLinks] = useState<AppLinks | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [isPhone, setIsPhone] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Decide when to open.
  useEffect(() => {
    if (isBlockedPath(pathname)) return;
    const forced = new URLSearchParams(window.location.search).get('app-promo') === '1';
    if (!forced && !canShow()) return;

    let cancelled = false;
    let opening = false;
    const startedAt = Date.now();

    const reveal = async () => {
      if (opening || cancelled) return;
      opening = true;
      const detected = detectPlatform();
      const detectedCountry = (await fetchCountry()) ?? regionFromLanguages(navigator.languages ?? [navigator.language]);
      if (cancelled) return;
      setPlatform(detected);
      setCountry(detectedCountry);
      setLinks(buildAppLinks({ country: detectedCountry, locale, source: 'home_popup' }));
      setIsPhone(window.matchMedia('(max-width: 639px)').matches);
      setOpen(true);
      if (!forced) recordShown();
      captureAnalyticsEvent('app_promo_shown', { platform: detected, country: detectedCountry ?? 'unknown' });
    };

    const scrolledEnough = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return max > 0 && window.scrollY / max >= SHOW_AFTER_SCROLL;
    };

    const tick = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const ready = forced || Date.now() - startedAt >= SHOW_AFTER_MS || scrolledEnough();
      if (!ready || isPageBusy()) return;
      window.clearInterval(tick);
      void reveal();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(tick);
    };
  }, [pathname, locale]);

  const close = useCallback((reason: 'dismiss' | 'store') => {
    setOpen(false);
    if (reason === 'dismiss') captureAnalyticsEvent('app_promo_dismiss', { platform });
  }, [platform]);

  // Desktop visitors cannot install from here, so they get a QR code that
  // carries the /app short link to their phone. Loaded only when needed.
  useEffect(() => {
    if (!open || platform !== 'desktop') return;
    let cancelled = false;
    import('qrcode')
      .then((QR) => QR.toDataURL(appShortLink(locale, 'popup_qr'), {
        margin: 1,
        width: 288,
        color: { dark: '#0F1B33', light: '#FFFFFF' },
      }))
      .then((url) => { if (!cancelled) setQr(url); })
      .catch(() => { /* the store links below still work */ });
    return () => { cancelled = true; };
  }, [open, platform, locale]);

  // Scroll lock, Escape, and a minimal focus trap while open.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { close('dismiss'); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  const trackStore = (store: 'app-store' | 'google-play') => {
    captureAnalyticsEvent('app_promo_click', { store, platform });
    recordClick();
    close('store');
  };

  const ptBr = locale === 'pt' && country === 'BR';
  const showAppStore = platform !== 'android';
  const showPlay = platform !== 'ios';

  return (
    <AnimatePresence>
      {open && links && (
        <div className="fixed inset-0 z-[210] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-ink/70 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => close('dismiss')}
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-promo-title"
            className="relative w-full overflow-hidden rounded-t-[1.75rem] bg-ink text-white shadow-2xl shadow-black/50 sm:max-w-[860px] sm:rounded-[1.75rem] sm:grid sm:grid-cols-[1fr_0.92fr]"
            initial={reduceMotion ? { opacity: 0 } : { y: isPhone ? '100%' : 32, opacity: 0, scale: isPhone ? 1 : 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { y: isPhone ? '100%' : 24, opacity: 0, scale: isPhone ? 1 : 0.98 }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            drag={isPhone && !reduceMotion ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 600) close('dismiss'); }}
          >
            {/* Art: the phones peek out from the bottom of the blue backdrop. */}
            <div className="relative order-1 h-[250px] overflow-hidden bg-[#0b4fd8] sm:order-2 sm:h-auto sm:min-h-[540px]">
              <Image
                src="/images/app/screen-complete.webp"
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 400px"
                className="object-cover object-[50%_46%] sm:object-[50%_100%]"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent sm:bg-gradient-to-r sm:from-ink sm:via-transparent sm:to-transparent" />
              <span aria-hidden className="absolute left-1/2 top-3 h-1 w-10 -translate-x-1/2 rounded-full bg-white/40 sm:hidden" />
            </div>

            <div className="relative order-2 px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-2 sm:order-1 sm:flex sm:flex-col sm:justify-center sm:p-12">
              <div className="flex items-center gap-3">
                <Image
                  src="/images/app-icon-512.png"
                  alt={copy.icon}
                  width={44}
                  height={44}
                  className="h-11 w-11 rounded-[0.8rem] ring-1 ring-white/15"
                />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/65">{copy.eyebrow}</p>
              </div>

              <h2 id="app-promo-title" className="mt-5 text-[clamp(1.875rem,1.4rem+2vw,2.5rem)] font-semibold leading-[1.05] tracking-[-0.035em]">
                {copy.title}<span className="text-[#7DA8FF]">+</span>
                <span className="block text-white/70">{locale === 'pt' ? (ptBr ? 'no seu celular.' : 'no seu telemóvel.') : 'with you.'}</span>
              </h2>
              <p className="mt-4 max-w-sm text-base leading-relaxed text-white/75">{copy.body}</p>

              {platform === 'desktop' ? (
                <div className="mt-7">
                  <div className="flex items-center gap-5 rounded-3xl border border-white/10 bg-white/[0.05] p-4">
                    <div className="h-[7.5rem] w-[7.5rem] shrink-0 overflow-hidden rounded-2xl bg-white">
                      {qr && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={qr} alt={copy.scanAlt} width={120} height={120} className="h-full w-full" />
                      )}
                    </div>
                    <div>
                      <p className="text-lg font-semibold tracking-[-0.02em]">{copy.scanTitle}</p>
                      <p className="mt-1 text-sm leading-relaxed text-white/65">{copy.scanBody}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-white/55">
                    {copy.orStore}{' '}
                    <a
                      href={links.appStore}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackStore('app-store')}
                      className="font-semibold text-white underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      App Store
                    </a>{' '}
                    {copy.orPlay}{' '}
                    <a
                      href={links.googlePlay}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackStore('google-play')}
                      className="font-semibold text-white underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      Google Play
                    </a>
                  </p>
                </div>
              ) : (
                <div className="mt-7 flex flex-col gap-3">
                  {showAppStore && (
                    <StoreBadge
                      store="app-store"
                      href={links.appStore}
                      locale={locale}
                      ptBr={ptBr}
                      variant="solid"
                      className="w-full"
                      onClick={() => trackStore('app-store')}
                    />
                  )}
                  {showPlay && (
                    <StoreBadge
                      store="google-play"
                      href={links.googlePlay}
                      locale={locale}
                      ptBr={ptBr}
                      variant="solid"
                      className="w-full"
                      onClick={() => trackStore('google-play')}
                    />
                  )}
                </div>
              )}

              {platform !== 'desktop' && (
                <p className="mt-4 text-center text-sm text-white/55 sm:text-left">
                  {copy.also}{' '}
                  <a
                    href={platform === 'ios' ? links.googlePlay : links.appStore}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackStore(platform === 'ios' ? 'google-play' : 'app-store')}
                    className="font-semibold text-white underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    {platform === 'ios' ? 'Google Play' : 'App Store'}
                  </a>
                </p>
              )}

              <button
                type="button"
                onClick={() => close('dismiss')}
                className="mt-5 w-full rounded-full py-3 text-sm font-semibold text-white/65 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto sm:self-start sm:px-0 sm:text-left"
              >
                {copy.dismiss}
              </button>
            </div>

            <button
              ref={closeRef}
              type="button"
              onClick={() => close('dismiss')}
              aria-label={copy.close}
              className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-ink/55 text-white backdrop-blur-md transition-colors hover:bg-ink/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-4 sm:top-4"
            >
              <X size={20} aria-hidden />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
