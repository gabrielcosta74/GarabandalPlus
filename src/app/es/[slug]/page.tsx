import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleHero } from '../../../components/content/ArticleHero';
import { ArticleBody } from '../../../components/content/ArticleBody';
import { ShareBar } from '../../../components/content/ShareBar';
import { ShareCTA } from '../../../components/content/ShareCTA';
import { LocaleSwitcher } from '../../../components/content/LocaleSwitcher';
import { getPageBySlug, getTranslationPeers, listAllSlugs } from '../../../lib/content/queries';
import { PUBLISHED_ONLY } from '../../../lib/content/preview';
import { articleJsonLd, breadcrumbJsonLd, buildHreflang, jsonLdScript } from '../../../lib/content/content-seo';
import { entityJsonLd } from '../../../lib/content/entity-schema';
import { APP_URL } from '../../../lib/config';

export const revalidate = 600;

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const rows = await listAllSlugs('wp_pages', 'es');
  return rows.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageBySlug(slug, 'es', PUBLISHED_ONLY);
  if (!page) return { title: 'Página no encontrada' };
  const isPreview = page.status !== 'published';

  const peers = await getTranslationPeers('page', page.id);
  const languages = buildHreflang('page', 'es', slug, peers);

  return {
    title: page.meta_title ?? page.title,
    description: page.meta_description ?? undefined,
    robots: isPreview ? { index: false, follow: false } : undefined,
    alternates: {
      canonical: `${APP_URL}/es/${slug}`,
      languages,
    },
    openGraph: {
      type: 'article',
      title: page.meta_title ?? page.title,
      description: page.meta_description ?? undefined,
      url: `${APP_URL}/es/${slug}`,
      images: page.og_image_url ? [{ url: page.og_image_url }] : undefined,
      locale: 'es_ES',
      siteName: 'Apostolado de Garabandal',
    },
  };
}

export default async function EsMigratedPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const page = await getPageBySlug(slug, 'es', PUBLISHED_ONLY);
  if (!page) notFound();

  const peers = await getTranslationPeers('page', page.id);

  const ld = [
    articleJsonLd({
      kind: 'page',
      locale: 'es',
      slug,
      title: page.title,
      description: page.meta_description,
      image: page.og_image_url,
      datePublished: page.published_at ?? page.created_at,
      dateModified: page.updated_at,
    }),
    breadcrumbJsonLd([
      { name: 'Inicio', path: '/es' },
      { name: page.title },
    ]),
    // Person + FAQPage for the handful of pages that are entity hubs;
    // an empty array for every other slug.
    ...entityJsonLd('page', 'es', slug),
  ];

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(...ld) }} />
      <ArticleHero
        variant="page"
        title={page.title}
        subtitle={page.meta_description}
        coverImage={page.og_image_url}
        breadcrumbs={[
          { href: '/es', label: 'Inicio' },
          { label: page.title },
        ]}
        meta={
          peers.length > 1 ? <LocaleSwitcher current="es" peers={peers} basePath="page" /> : null
        }
      />
      <ArticleBody html={page.content_html} />
      <ShareBar url={`${APP_URL}/es/${slug}`} title={page.title} locale="es" />
      <ShareCTA url={`${APP_URL}/es/${slug}`} title={page.title} locale="es" />
    </main>
  );
}
