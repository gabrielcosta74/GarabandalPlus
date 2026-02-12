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
          '/tornar-membro',
          '/intencoes',
          '/transparencia'
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
          '/loja-online',
          '/loja-online/checkout',
          '/loja-online/claim',
          '/thank-you'
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
