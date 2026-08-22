import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArticleHero } from '../../../components/content/ArticleHero';
import { ArticleBody } from '../../../components/content/ArticleBody';
import { getPageBySlug, getPostBySlug, type ContentLocale } from '../../../lib/content/queries';
import { isPreviewSession, PREVIEW_STATUSES } from '../../../lib/content/preview';

/**
 * Draft preview for the CMS.
 *
 * Previewing used to happen on the public URL itself: every content route
 * called `getPublicStatuses()`, which reads `cookies()`. That is a dynamic API,
 * so all ~1500 public URLs were rendered per request and served
 * `cache-control: no-store` — the sitewide TTFB and crawl-budget problem.
 *
 * Preview now lives here instead. This route is the only one that reads the
 * session, so it can be dynamic on its own while every public page stays on
 * ISR.
 *
 *   /preview/pt/page/as-mensagens      → the PT page  /as-mensagens
 *   /preview/en/post/some-article      → the EN post  /en/l/some-article
 *
 * Access still requires an admin session, exactly as before — the preview
 * cookie alone was never enough.
 */
export const dynamic = 'force-dynamic';

// Drafts must never reach the index, whatever happens.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const LOCALES = new Set<ContentLocale>(['pt', 'en', 'es', 'fr', 'it'] as ContentLocale[]);

export default async function PreviewPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const [locale, kind, ...rest] = path ?? [];
  const slug = rest.join('/');

  if (!locale || !kind || !slug) notFound();
  if (!LOCALES.has(locale as ContentLocale)) notFound();
  if (kind !== 'page' && kind !== 'post') notFound();

  // Gate on the real admin session, not just the cookie.
  if (!(await isPreviewSession())) notFound();

  const doc = kind === 'page'
    ? await getPageBySlug(slug, locale as ContentLocale, PREVIEW_STATUSES)
    : await getPostBySlug(slug, locale as ContentLocale, PREVIEW_STATUSES);

  if (!doc) notFound();

  const publicHref = kind === 'page'
    ? `${locale === 'pt' ? '' : `/${locale}`}/${slug}`
    : `${locale === 'pt' ? '' : `/${locale}`}/l/${slug}`;

  return (
    <main>
      <div
        style={{
          background: '#78350f', color: '#fff', padding: '10px 16px',
          font: '600 13px/1.4 system-ui, sans-serif', textAlign: 'center',
        }}
      >
        Pré-visualização — estado: {doc.status}. Não indexável.{' '}
        {doc.status === 'published' && (
          <a href={publicHref} style={{ color: '#fde68a', textDecoration: 'underline' }}>
            Ver a página pública
          </a>
        )}
      </div>
      <ArticleHero
        variant={kind}
        title={doc.title}
        subtitle={doc.meta_description}
        coverImage={doc.og_image_url}
        breadcrumbs={[{ label: doc.title }]}
      />
      <ArticleBody html={doc.content_html} />
    </main>
  );
}
