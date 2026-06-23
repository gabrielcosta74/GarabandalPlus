import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleHero } from '../../../components/content/ArticleHero';
import { ArticleBody } from '../../../components/content/ArticleBody';
import { ShareBar } from '../../../components/content/ShareBar';
import { ShareCTA } from '../../../components/content/ShareCTA';
import { LocaleSwitcher } from '../../../components/content/LocaleSwitcher';
import { getPageBySlug, getTranslationPeers, listAllSlugs } from '../../../lib/content/queries';
import { getPublicStatuses } from '../../../lib/content/preview';
import { articleJsonLd, breadcrumbJsonLd, buildHreflang, jsonLdScript } from '../../../lib/content/content-seo';
import { APP_URL } from '../../../lib/config';

export const revalidate = 600;

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const rows = await listAllSlugs('wp_pages', 'en');
  return rows.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const statuses = await getPublicStatuses();
  const page = await getPageBySlug(slug, 'en', statuses);
  if (!page) return { title: 'Page not found' };
  const isPreview = page.status !== 'published';

  const peers = await getTranslationPeers('page', page.id);
  const languages = buildHreflang('page', 'en', slug, peers);

  return {
    title: page.meta_title ?? page.title,
    description: page.meta_description ?? undefined,
    robots: isPreview ? { index: false, follow: false } : undefined,
    alternates: {
      canonical: `${APP_URL}/en/${slug}`,
      languages,
    },
    openGraph: {
      type: 'article',
      title: page.meta_title ?? page.title,
      description: page.meta_description ?? undefined,
      url: `${APP_URL}/en/${slug}`,
      images: page.og_image_url ? [{ url: page.og_image_url }] : undefined,
      locale: 'en_US',
      siteName: 'Apostolado de Garabandal',
    },
  };
}

export default async function EnMigratedPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const statuses = await getPublicStatuses();
  const page = await getPageBySlug(slug, 'en', statuses);
  if (!page) notFound();

  const peers = await getTranslationPeers('page', page.id);

  const ld = [
    articleJsonLd({
      kind: 'page',
      locale: 'en',
      slug,
      title: page.title,
      description: page.meta_description,
      image: page.og_image_url,
      datePublished: page.published_at ?? page.created_at,
      dateModified: page.updated_at,
    }),
    breadcrumbJsonLd([
      { name: 'Home', path: '/en' },
      { name: page.title },
    ]),
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
          { href: '/en', label: 'Home' },
          { label: page.title },
        ]}
        meta={
          peers.length > 1 ? <LocaleSwitcher current="en" peers={peers} basePath="page" /> : null
        }
      />
      <ArticleBody html={page.content_html} />
      <ShareBar url={`${APP_URL}/en/${slug}`} title={page.title} locale="en" />
      <ShareCTA url={`${APP_URL}/en/${slug}`} title={page.title} locale="en" />
    </main>
  );
}
