"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Cookie, Settings2, ShieldCheck, X } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import {
  COOKIE_CONSENT_OPEN_EVENT,
  createCookieConsentPreferences,
  readCookieConsent,
  saveCookieConsent,
  syncAnalyticsConsentCookie,
} from '../../lib/cookie-consent';

type Copy = {
  title: string;
  intro: string;
  necessary: string;
  analytics: string;
  marketing: string;
  necessaryDescription: string;
  analyticsDescription: string;
  marketingDescription: string;
  acceptAll: string;
  rejectOptional: string;
  customize: string;
  save: string;
  policy: string;
  alwaysActive: string;
  cookiesHref: string;
};

const copyByLocale: Record<'pt' | 'en', Copy> = {
  pt: {
    title: 'Cookies',
    intro:
      'Usamos cookies necessários para segurança e pagamentos. Analíticos e marketing só com o seu consentimento.',
    necessary: 'Necessários',
    analytics: 'Analíticos',
    marketing: 'Marketing',
    necessaryDescription: 'Mantêm a sessão, protegem a plataforma e permitem compras, doações e inscrições.',
    analyticsDescription: 'Ajudam-nos a compreender visitas e melhorar páginas públicas, sem ativação antes do consentimento.',
    marketingDescription: 'Podem ser usados para campanhas, medição de conversões ou comunicações personalizadas.',
    acceptAll: 'Aceitar todos',
    rejectOptional: 'Rejeitar opcionais',
    customize: 'Configurar',
    save: 'Guardar preferências',
    policy: 'Política de Cookies',
    alwaysActive: 'Sempre ativo',
    cookiesHref: '/cookies',
  },
  en: {
    title: 'Cookies',
    intro:
      'We use necessary cookies for security and payments. Analytics and marketing only run with your consent.',
    necessary: 'Necessary',
    analytics: 'Analytics',
    marketing: 'Marketing',
    necessaryDescription: 'Keep sessions active, protect the platform and enable purchases, donations and registrations.',
    analyticsDescription: 'Help us understand visits and improve public pages, without activation before consent.',
    marketingDescription: 'May be used for campaigns, conversion measurement or personalised communications.',
    acceptAll: 'Accept all',
    rejectOptional: 'Reject optional',
    customize: 'Configure',
    save: 'Save preferences',
    policy: 'Cookie Policy',
    alwaysActive: 'Always active',
    cookiesHref: '/en/cookies',
  },
};

export default function CookieConsentBanner() {
  const { locale } = useLocale();
  const copy = copyByLocale[locale];
  // Starts visible so the banner is in the SSR HTML and paints at FCP (mobile
  // LCP fix). Visitors with stored consent never see it: an inline <head>
  // script hides it pre-paint via html.cc-done, then this effect unmounts it.
  const [isVisible, setIsVisible] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const existing = readCookieConsent();
    if (existing) {
      syncAnalyticsConsentCookie(existing);
      setAnalytics(existing.analytics);
      setMarketing(existing.marketing);
      setIsVisible(false);
    }
  }, []);

  useEffect(() => {
    const openPreferences = () => {
      const existing = readCookieConsent();
      setAnalytics(existing?.analytics === true);
      setMarketing(existing?.marketing === true);
      // Undo the pre-paint hide from the inline <head> script, otherwise the
      // reopened banner would stay display:none for consented visitors.
      document.documentElement.classList.remove('cc-done');
      setShowSettings(true);
      setIsVisible(true);
    };

    window.addEventListener(COOKIE_CONSENT_OPEN_EVENT, openPreferences);
    return () => window.removeEventListener(COOKIE_CONSENT_OPEN_EVENT, openPreferences);
  }, []);

  const consentLabel = useMemo(() => {
    const enabled = [analytics && copy.analytics, marketing && copy.marketing].filter(Boolean);
    return enabled.length ? enabled.join(', ') : copy.rejectOptional;
  }, [analytics, copy, marketing]);

  const commit = (nextAnalytics: boolean, nextMarketing: boolean) => {
    saveCookieConsent(createCookieConsentPreferences({ analytics: nextAnalytics, marketing: nextMarketing }));
    setAnalytics(nextAnalytics);
    setMarketing(nextMarketing);
    setShowSettings(false);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div id="cookie-consent" className="fixed inset-x-0 bottom-0 z-[200] px-3 pb-3 sm:left-auto sm:right-6 sm:max-w-[520px] sm:px-0 sm:pb-6" role="region" aria-label={copy.title}>
      <div className="rounded-lg border border-white/10 bg-[#050911]/95 text-white shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
        <div className={`grid gap-4 p-4 sm:p-5 ${showSettings ? 'max-h-[70svh] overflow-y-auto' : 'max-sm:gap-3 max-sm:p-3'}`}>
          <div className="space-y-2.5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-garabandal-gold/15 text-garabandal-gold ring-1 ring-garabandal-gold/25 max-sm:h-8 max-sm:w-8">
                <Cookie className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                {/* Not a heading: this banner renders on every page, so an <h2>
                    put "Cookies" into the heading outline of the whole site.
                    The wrapper already carries role="region" + aria-label with the
                    same text, so nothing is lost for assistive technology. */}
                <p className="font-serif text-lg font-bold leading-6 text-white max-sm:text-base">{copy.title}</p>
                <p className={`mt-1 text-sm leading-5 text-white/65 ${showSettings ? '' : 'max-sm:line-clamp-2'}`}>{copy.intro}</p>
              </div>
            </div>

            {showSettings && (
              <div className="grid gap-2 pt-1">
                <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{copy.necessary}</p>
                      <p className="mt-1 text-xs leading-5 text-white/55">{copy.necessaryDescription}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-garabandal-gold/15 px-2.5 py-1 text-[11px] font-semibold text-garabandal-gold">
                      {copy.alwaysActive}
                    </span>
                  </div>
                </div>

                <label className="cursor-pointer rounded-md border border-white/10 bg-white/[0.04] p-3 transition-all duration-200 hover:border-garabandal-gold/45 hover:bg-white/[0.07]">
                  <span className="flex items-start justify-between gap-4">
                    <span>
                      <span className="block text-sm font-semibold text-white">{copy.analytics}</span>
                      <span className="mt-1 block text-xs leading-5 text-white/55">{copy.analyticsDescription}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={analytics}
                      onChange={(event) => setAnalytics(event.target.checked)}
                      className="mt-1 h-5 w-5 cursor-pointer rounded border-white/30 bg-white/10 text-garabandal-gold focus:ring-garabandal-gold"
                    />
                  </span>
                </label>

                <label className="cursor-pointer rounded-md border border-white/10 bg-white/[0.04] p-3 transition-all duration-200 hover:border-garabandal-gold/45 hover:bg-white/[0.07]">
                  <span className="flex items-start justify-between gap-4">
                    <span>
                      <span className="block text-sm font-semibold text-white">{copy.marketing}</span>
                      <span className="mt-1 block text-xs leading-5 text-white/55">{copy.marketingDescription}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={marketing}
                      onChange={(event) => setMarketing(event.target.checked)}
                      className="mt-1 h-5 w-5 cursor-pointer rounded border-white/30 bg-white/10 text-garabandal-gold focus:ring-garabandal-gold"
                    />
                  </span>
                </label>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-xs text-white/45">
              <ShieldCheck className="h-3.5 w-3.5 text-garabandal-gold/80" aria-hidden="true" />
              <span className="max-w-full truncate">{consentLabel}</span>
              <Link href={copy.cookiesHref} className="font-semibold text-white/65 underline underline-offset-2 transition-colors hover:text-garabandal-gold">
                {copy.policy}
              </Link>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <button
              type="button"
              onClick={() => commit(true, true)}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-garabandal-gold px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-garabandal-gold/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-yellow-300 hover:shadow-garabandal-gold/25 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-garabandal-gold/40 max-sm:py-2"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {copy.acceptAll}
            </button>
            {showSettings ? (
              <button
                type="button"
                onClick={() => commit(analytics, marketing)}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-garabandal-gold/50 hover:bg-white/15 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-garabandal-gold/30 max-sm:py-2"
              >
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                {copy.save}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-garabandal-gold/50 hover:bg-white/15 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-garabandal-gold/30 max-sm:py-2"
              >
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                {copy.customize}
              </button>
            )}
            <button
              type="button"
              onClick={() => commit(false, false)}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold text-white/55 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-garabandal-gold/25 max-sm:py-2"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              {copy.rejectOptional}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
