import type { Metadata } from 'next';
import { ArticleHero } from '../../../components/content/ArticleHero';
import { BlogCard } from '../../../components/content/BlogCard';
import { listPosts } from '../../../lib/content/queries';
import { APP_URL } from '../../../lib/config';

export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Articles · Apostolate of Garabandal',
  description: 'Articles, news and meditations from the Apostolate of Garabandal on the apparitions of Our Lady, teachings and pilgrimages.',
  alternates: {
    canonical: `${APP_URL}/en/l`,
    languages: {
      'pt-BR': `${APP_URL}/l`,
      en: `${APP_URL}/en/l`,
    },
  },
  openGraph: {
    type: 'website',
    title: 'Articles · Apostolate of Garabandal',
    description: 'Articles, news and meditations from the Apostolate of Garabandal.',
    url: `${APP_URL}/en/l`,
    locale: 'en_US',
    siteName: 'Apostolado de Garabandal',
  },
};

export default async function EnBlogIndexPage() {
  const posts = await listPosts('en', { limit: 100 });

  return (
    <main>
      <ArticleHero
        variant="page"
        title="Apostolate articles"
        subtitle="Meditations, news, testimonies and reflections on Garabandal and the life of faith."
        breadcrumbs={[{ href: '/en', label: 'Home' }, { label: 'Articles' }]}
      />

      <section style={{ padding: '2.5rem 1.5rem 4rem', maxWidth: 1200, margin: '0 auto' }}>
        {posts.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--muted)' }}>
            No articles published yet.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {posts.map((p) => (
              <BlogCard key={p.id} post={p} locale="en" />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
