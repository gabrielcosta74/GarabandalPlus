import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/cookie-consent', () => ({ hasAnalyticsConsent: () => false }));

describe('first-party tracking locale', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it.each([
    ['/fr/garabandal', 'fr'],
    ['/it/garabandal', 'it'],
    ['/es', 'es'],
    ['/en/garabandal', 'en'],
    ['/esperanca', 'pt'],
    ['/frutos', 'pt'],
  ])('sends the correct locale for %s', async (path, expected) => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
      removeItem: (key: string) => { data.delete(key); },
    };
    const sendBeacon = vi.fn((_url: string, _body: Blob) => true);
    const navigator = { doNotTrack: '0', sendBeacon };
    vi.stubGlobal('navigator', navigator);
    vi.stubGlobal('window', {
      location: { pathname: path, hostname: 'apostoladodegarabandal.com', search: '' },
      navigator,
      localStorage: storage,
      sessionStorage: storage,
      innerWidth: 1200,
      addEventListener: vi.fn(),
    });
    vi.stubGlobal('document', { referrer: '', addEventListener: vi.fn() });

    const { trackSiteEvent } = await import('../lib/site-tracker');
    trackSiteEvent('test_event', {}, { immediate: true });

    expect(sendBeacon).toHaveBeenCalledOnce();
    const payload = JSON.parse(await (sendBeacon.mock.calls[0][1] as Blob).text());
    expect(payload.session.locale).toBe(expected);
    expect(payload.events[0].path).toBe(path);
  });
});
