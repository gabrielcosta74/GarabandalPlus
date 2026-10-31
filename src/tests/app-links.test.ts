import { describe, expect, it } from 'vitest';
import { buildAppLinks } from '../lib/app-links';

describe('buildAppLinks', () => {
    it('keeps the plain App Store link without a provider token', () => {
        const { appStore } = buildAppLinks({ country: 'PT', locale: 'pt', source: 'gospel_image', providerToken: null });
        expect(appStore).toBe('https://apps.apple.com/pt/app/garabandal/id6806348119');
    });

    it('tags the App Store link with the share source as the campaign', () => {
        const { appStore } = buildAppLinks({ country: 'BR', locale: 'pt', source: 'gospel_image', providerToken: '123456' });
        expect(appStore).toBe('https://apps.apple.com/br/app/garabandal/id6806348119?pt=123456&ct=gospel_image&mt=8');
    });

    it('ignores a token that is not a number', () => {
        const { appStore } = buildAppLinks({ country: null, locale: 'en', source: 'app_link', providerToken: 'abc' });
        expect(appStore).toBe('https://apps.apple.com/app/garabandal/id6806348119');
    });

    it('keeps the source in the Play referrer', () => {
        const { googlePlay } = buildAppLinks({ country: 'PT', locale: 'pt', source: 'saint_image', providerToken: null });
        expect(decodeURIComponent(googlePlay)).toContain('utm_medium=saint_image');
    });
});
