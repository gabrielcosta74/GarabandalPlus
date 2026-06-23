import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Clock } from 'lucide-react';
import { ArticleHero } from '../../../../components/content/ArticleHero';
import { ArticleBody } from '../../../../components/content/ArticleBody';
import { ShareBar } from '../../../../components/content/ShareBar';
import { ShareCTA } from '../../../../components/content/ShareCTA';
import { LocaleSwitcher } from '../../../../components/content/LocaleSwitcher';
import { BlogCard } from '../../../../components/content/BlogCard';
import { getPostBySlug, getTranslationPeers, listAllSlugs, listPosts } from '../../../../lib/content/queries';
import { getPublicStatuses } from '../../../../lib/content/preview';
import { breadcrumbJsonLd, buildHreflang, jsonLdScript } from '../../../../lib/content/content-seo';
import { APP_URL } from '../../../../lib/config';

export const revalidate = 600;

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const rows = await listAllSlugs('posts', 'it');
  return rows.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const statuses = await getPublicStatuses();
  const post = await getPostBySlug(slug, 'it', statuses);
  if (!post) return { title: 'Articolo non trovato' };
  const isPreview = post.status !== 'published';

  const peers = await getTranslationPeers('post', post.id);
  const languages = buildHreflang('post', 'it', slug, peers);

  return {
    title: post.meta_title ?? post.title,
    description: post.meta_description ?? undefined,
    robots: isPreview ? { index: false, follow: false } : undefined,
    alternates: {
      canonical: `${APP_URL}/it/l/${slug}`,
      languages,
    },
    openGraph: {
      type: 'article',
      title: post.meta_title ?? post.title,
      description: post.meta_description ?? undefined,
      url: `${APP_URL}/it/l/${slug}`,
      images: (post.cover_image_url ?? post.og_image_url) ? [{ url: (post.cover_image_url ?? post.og_image_url)! }] : undefined,
      locale: 'it_IT',
      siteName: 'Apostolado de Garabandal',
      publishedTime: post.published_at ?? undefined,
    },
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return ''; }
}

function readingMinutes(html: string | null): number {
  if (!html) return 1;
  const w = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(w / 220));
}

export default async function ItPostPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const statuses = await getPublicStatuses();
  const post = await getPostBySlug(slug, 'it', statuses);
  if (!post) notFound();

  const peers = await getTranslationPeers('post', post.id);
  const moreRaw = await listPosts('it', { limit: 7 });
  const more = moreRaw.filter((p) => p.id !== post.id).slice(0, 3);

  const date = formatDate(post.published_at ?? post.created_at);
  const minutes = readingMinutes(post.content_html);
  const cover = post.cover_image_url ?? post.og_image_url;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.meta_description ?? undefined,
    image: cover ? [cover] : undefined,
    datePublished: post.published_at ?? post.created_at,
    dateModified: post.updated_at,
    author: { '@type': 'Organization', name: 'Apostolado de Garabandal' },
    publisher: {
      '@type': 'Organization',
      name: 'Apostolado de Garabandal',
      logo: { '@type': 'ImageObject', url: `${APP_URL}/opengraph-image` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${APP_URL}/it/l/${slug}` },
    inLanguage: 'it',
  };

  const breadcrumb = breadcrumbJsonLd([
    { name: 'Home', path: '/it' },
    { name: 'Articoli', path: '/it/l' },
    { name: post.title },
  ]);

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(ld, breadcrumb) }}
      />
      <ArticleHero
        variant="post"
        title={post.title}
        subtitle={post.meta_description}
        coverImage={cover}
        breadcrumbs={[
          { href: '/it', label: 'Home' },
          { href: '/it/l', label: 'Articoli' },
          { label: post.title },
        ]}
        meta={
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                fontSize: '0.85rem',
                color: cover ? 'rgba(255,255,255,0.9)' : 'var(--muted)',
              }}
            >
              {date && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={14} aria-hidden /> {date}
                </span>
              )}
              {minutes > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={14} aria-hidden /> {minutes} min
                </span>
              )}
            </div>
            {peers.length > 1 ? <LocaleSwitcher current="it" peers={peers} basePath="post" /> : null}
          </div>
        }
      />
      <ArticleBody html={post.content_html} />
      <ShareBar url={`${APP_URL}/it/l/${slug}`} title={post.title} locale="it" />
      <ShareCTA url={`${APP_URL}/it/l/${slug}`} title={post.title} locale="it" />

      {more.length > 0 && (
        <section
          style={{
            background: 'rgba(15,23,42,0.03)',
            borderTop: '1px solid rgba(15,23,42,0.06)',
            padding: '3rem 1.5rem',
          }}
        >
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2
                style={{
                  fontFamily: 'var(--font-serif), Georgia, serif',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--color-garabandal-dark, #0f172a)',
                }}
              >
                Altri articoli
              </h2>
              <Link href="/it/l" style={{ fontSize: '0.9rem', color: 'var(--primary, #1d4ed8)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                Vedi tutti
              </Link>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {more.map((p) => (
                <BlogCard key={p.id} post={p} locale="it" />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
