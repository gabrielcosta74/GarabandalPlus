import type { MetadataRoute } from 'next';
import { APP_URL } from '../lib/config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/peregrinacoes',
          '/peregrinacoes/*',
          '/donations',
          '/loja',
          '/loja/*',
          '/loja-online',
          '/loja-online/*',
          '/tornar-membro',
          '/sobre-nos',
          '/intencoes',
          '/transparencia',
          // Migrated devotional content (history, witnesses, teachings, blog).
          // The disallow list still blocks sensitive areas explicitly.
          '/l',
          '/l/*',
          '/en',
          '/en/*',
          '/es',
          '/es/*',
          '/fr',
          '/fr/*',
        ],
        disallow: [
          '/admin',
          '/member',
          '/account',
          '/login',
          '/register',
          '/reset-password',
          '/auth',
          '/auth-callback',
          '/api',
          '/biblioteca',
          '/encomendas',
          '/peregrinacoes/*/inscrever',
          '/peregrinacoes/inscricao',
          '/loja-online/checkout',
          '/loja-online/claim',
          '/thank-you',
          '/en/login',
          '/en/register',
          '/en/reset-password',
          '/en/auth',
          '/en/account',
          '/en/member',
          '/en/library',
          '/en/orders',
          '/en/my-registrations',
          '/en/thank-you',
          '/en/invite',
          '/en/pilgrimages/*/register',
          '/en/pilgrimages/registration',
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
