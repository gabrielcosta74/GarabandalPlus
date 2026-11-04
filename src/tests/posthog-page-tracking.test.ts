import { describe, expect, it } from 'vitest';
import {
  analyticsLocale,
  isPublicAnalyticsPath,
  pilgrimageAnalyticsProperties,
} from '../lib/analytics';

describe('PostHog public page classification', () => {
  it('groups public pilgrimage details and registration steps by slug', () => {
    expect(pilgrimageAnalyticsProperties('/peregrinacoes/peregrinacao-mariana-2027')).toEqual({
      site_area: 'pilgrimage',
      pilgrimage_slug: 'peregrinacao-mariana-2027',
      pilgrimage_page: 'detail',
    });
    expect(pilgrimageAnalyticsProperties('/en/pilgrimages/peregrinacao-mariana-2027/register')).toEqual({
      site_area: 'pilgrimage',
      pilgrimage_slug: 'peregrinacao-mariana-2027',
      pilgrimage_page: 'registration',
    });
  });

  it('excludes private booking and check-in URLs and admin previews', () => {
    for (const path of [
      '/peregrinacoes/inscricao/59fef36b-b86d-4396-b29f-ef886891abba',
      '/en/pilgrimages/registration/59fef36b-b86d-4396-b29f-ef886891abba',
      '/dados-check-in/example',
      '/checkin/example',
      '/peregrinacoes/preview-admin',
    ]) {
      expect(isPublicAnalyticsPath(path)).toBe(false);
      expect(pilgrimageAnalyticsProperties(path)).toEqual({});
    }
    expect(isPublicAnalyticsPath('/peregrinacoes/peregrinacao-mariana-2027')).toBe(true);
  });

  it('labels each translated page with its actual locale', () => {
    expect(analyticsLocale('/peregrinacoes')).toBe('pt');
    for (const locale of ['en', 'es', 'fr', 'it']) {
      expect(analyticsLocale(`/${locale}/some-page`)).toBe(locale);
    }
  });
});
