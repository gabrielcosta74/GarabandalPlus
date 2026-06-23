import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleHero } from '../../components/content/ArticleHero';
import { ArticleBody } from '../../components/content/ArticleBody';
import { ShareBar } from '../../components/content/ShareBar';
import { ShareCTA } from '../../components/content/ShareCTA';
import { LocaleSwitcher } from '../../components/content/LocaleSwitcher';
import { getPageBySlug, getTranslationPeers, listAllSlugs } from '../../lib/content/queries';
import { getPublicStatuses } from '../../lib/content/preview';
import { articleJsonLd, breadcrumbJsonLd, buildHreflang, jsonLdScript } from '../../lib/content/content-seo';
import { APP_URL } from '../../lib/config';

export const revalidate = 600;

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const rows = await listAllSlugs('wp_pages', 'pt');
  return rows.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const statuses = await getPublicStatuses();
  const page = await getPageBySlug(slug, 'pt', statuses);
  if (!page) return { title: 'Página não encontrada' };
  const isPreview = page.status !== 'published';

  const peers = await getTranslationPeers('page', page.id);
  const languages = buildHreflang('page', 'pt', slug, peers);

  return {
    title: page.meta_title ?? page.title,
    description: page.meta_description ?? undefined,
    robots: isPreview ? { index: false, follow: false } : undefined,
    alternates: {
      canonical: `${APP_URL}/${slug}`,
      languages,
    },
    openGraph: {
      type: 'article',
      title: page.meta_title ?? page.title,
      description: page.meta_description ?? undefined,
      url: `${APP_URL}/${slug}`,
      images: page.og_image_url ? [{ url: page.og_image_url }] : undefined,
      locale: 'pt_BR',
      siteName: 'Apostolado de Garabandal',
    },
  };
}

export default async function MigratedPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const statuses = await getPublicStatuses();
  const page = await getPageBySlug(slug, 'pt', statuses);
  if (!page) notFound();

  const peers = await getTranslationPeers('page', page.id);

  const ld = [
    articleJsonLd({
      kind: 'page',
      locale: 'pt',
      slug,
      title: page.title,
      description: page.meta_description,
      image: page.og_image_url,
      datePublished: page.published_at ?? page.created_at,
      dateModified: page.updated_at,
    }),
    breadcrumbJsonLd([
      { name: 'Início', path: '/' },
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
          { href: '/', label: 'Início' },
          { label: page.title },
        ]}
        meta={
          peers.length > 1 ? <LocaleSwitcher current="pt" peers={peers} basePath="page" /> : null
        }
      />
      <ArticleBody html={page.content_html} />
      <ShareBar url={`${APP_URL}/${slug}`} title={page.title} locale="pt" />
      <ShareCTA url={`${APP_URL}/${slug}`} title={page.title} locale="pt" />
    </main>
  );
}
