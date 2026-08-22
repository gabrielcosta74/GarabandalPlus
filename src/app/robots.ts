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
      // ── AI crawlers ────────────────────────────────────────────────
      // Cloudflare's "Managed robots.txt" (AI Crawl Control) used to inject
      // these directives and blocked everything, Google-Extended included,
      // which kept the site out of AI Overviews. It was turned off on
      // 2026-08-22 so the policy lives here, in version control, instead.
      //
      // Allowed: crawlers that feed AI *search* surfaces, where being cited
      // sends real readers back. Google-Extended is the one that gates
      // AI Overviews and Gemini grounding.
      //
      // Note these are advisory. User-triggered fetchers (ChatGPT-User,
      // Google-Agent, Google-NotebookLM) ignore robots.txt by design.
      ...['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot',
        'Google-Extended', 'Applebot-Extended', 'meta-externalagent'].map((userAgent) => ({
        userAgent,
        allow: ['/'],
      })),
      // Blocked: bulk scrapers that only harvest training data and never
      // send a reader back.
      ...['CCBot', 'Bytespider', 'cohere-ai', 'Diffbot', 'Omgilibot',
        'ImagesiftBot', 'Timpibot'].map((userAgent) => ({
        userAgent,
        disallow: ['/'],
      })),
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
