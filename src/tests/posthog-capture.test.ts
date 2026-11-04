import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  trackSiteEvent: vi.fn(),
  hasAnalyticsConsent: vi.fn(() => true),
}));

vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    capture: mocks.capture,
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    startSessionRecording: vi.fn(),
    stopSessionRecording: vi.fn(),
  },
}));
vi.mock('../lib/cookie-consent', () => ({ hasAnalyticsConsent: mocks.hasAnalyticsConsent }));
vi.mock('../lib/site-tracker', () => ({ trackSiteEvent: mocks.trackSiteEvent }));

const storage = new Map<string, string>();
const location = {
  hostname: 'apostoladodegarabandal.com',
  origin: 'https://apostoladodegarabandal.com',
  pathname: '/peregrinacoes/peregrinacao-mariana-2027',
  search: '?utm_source=newsletter&viewToken=private',
  href: 'https://apostoladodegarabandal.com/peregrinacoes/peregrinacao-mariana-2027?utm_source=newsletter&viewToken=private',
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.hasAnalyticsConsent.mockReturnValue(true);
  storage.clear();
  location.pathname = '/peregrinacoes/peregrinacao-mariana-2027';
  location.search = '?utm_source=newsletter&viewToken=private';
  location.href = `${location.origin}${location.pathname}${location.search}`;
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
  vi.stubGlobal('window', {
    location,
    navigator: { doNotTrack: '0' },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('PostHog page capture', () => {
  it('captures a tagged pilgrimage page without private query parameters', async () => {
    const { capturePublicPageView, capturePostHogEvent } = await import('../lib/analytics');

    capturePublicPageView(location.pathname);
    capturePostHogEvent('pilgrimage_viewed', { pilgrimage_id: 'trip-1' });

    expect(mocks.capture).toHaveBeenCalledWith('$pageview', expect.objectContaining({
      $pathname: location.pathname,
      $current_url: `${location.origin}${location.pathname}?utm_source=newsletter`,
      pilgrimage_slug: 'peregrinacao-mariana-2027',
      pilgrimage_page: 'detail',
    }));
    expect(mocks.capture).toHaveBeenCalledWith('pilgrimage_viewed', expect.objectContaining({
      $pathname: location.pathname,
      $current_url: `${location.origin}${location.pathname}?utm_source=newsletter`,
      pilgrimage_id: 'trip-1',
      pilgrimage_slug: 'peregrinacao-mariana-2027',
    }));
    expect(mocks.trackSiteEvent).not.toHaveBeenCalled();
  });

  it('excludes a visitor who entered the admin area from public statistics', async () => {
    const { capturePublicPageView, syncAnalyticsScope } = await import('../lib/analytics');
    location.pathname = '/admin';
    syncAnalyticsScope('/admin');
    location.pathname = '/peregrinacoes/peregrinacao-mariana-2027';
    capturePublicPageView(location.pathname);

    expect(storage.get('gp_internal')).toBe('1');
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it('does not count an admin preview as a public pilgrimage view', async () => {
    const { capturePublicPageView } = await import('../lib/analytics');
    location.search = '?previewId=trip-1';
    capturePublicPageView(location.pathname);

    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it('can capture the current milestone when consent is granted later', async () => {
    const { capturePostHogEvent } = await import('../lib/analytics');
    mocks.hasAnalyticsConsent.mockReturnValue(false);
    expect(capturePostHogEvent('pilgrimage_viewed')).toBe(false);
    expect(mocks.capture).not.toHaveBeenCalled();

    mocks.hasAnalyticsConsent.mockReturnValue(true);
    expect(capturePostHogEvent('pilgrimage_viewed')).toBe(true);
    expect(mocks.capture).toHaveBeenCalledTimes(1);
  });
});
