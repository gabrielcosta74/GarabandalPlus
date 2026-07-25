"use client";

export type CookieConsentPreferences = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
  version: 1;
};

export const COOKIE_CONSENT_STORAGE_KEY = 'garabandal_cookie_consent_v1';
export const ANALYTICS_CONSENT_COOKIE = 'garabandal_analytics_consent';
export const COOKIE_CONSENT_CHANGED_EVENT = 'garabandal-cookie-consent-changed';
export const COOKIE_CONSENT_OPEN_EVENT = 'garabandal-cookie-consent-open';

export const createCookieConsentPreferences = (
  preferences: Pick<CookieConsentPreferences, 'analytics' | 'marketing'>,
): CookieConsentPreferences => ({
  necessary: true,
  analytics: preferences.analytics,
  marketing: preferences.marketing,
  updatedAt: new Date().toISOString(),
  version: 1,
});

export const readCookieConsent = (): CookieConsentPreferences | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CookieConsentPreferences>;
    if (parsed.version !== 1 || parsed.necessary !== true) return null;

    return {
      necessary: true,
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      version: 1,
    };
  } catch {
    return null;
  }
};

export const saveCookieConsent = (preferences: CookieConsentPreferences) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(preferences));
  syncAnalyticsConsentCookie(preferences);
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT, { detail: preferences }));
};

export const syncAnalyticsConsentCookie = (preferences: CookieConsentPreferences) => {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ANALYTICS_CONSENT_COOKIE}=${preferences.analytics ? 'granted' : 'denied'}; Path=/; Max-Age=15552000; SameSite=Lax${secure}`;
};

export const openCookiePreferences = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(COOKIE_CONSENT_OPEN_EVENT));
};

export const hasAnalyticsConsent = () => readCookieConsent()?.analytics === true;
