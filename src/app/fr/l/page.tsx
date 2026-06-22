import type { Metadata } from 'next';
import { ArticleHero } from '../../../components/content/ArticleHero';
import { BlogCard } from '../../../components/content/BlogCard';
import { listPosts } from '../../../lib/content/queries';
import { APP_URL } from '../../../lib/config';

export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Articles · Apostolat de Garabandal',
  description: "Articles, actualités et méditations de l'Apostolat de Garabandal sur les apparitions de Notre-Dame, les enseignements catholiques et les pèlerinages.",
  alternates: {
    canonical: `${APP_URL}/fr/l`,
    languages: {
      'pt-BR': `${APP_URL}/l`,
      en: `${APP_URL}/en/l`,
      es: `${APP_URL}/es/l`,
      fr: `${APP_URL}/fr/l`,
    },
  },
  openGraph: {
    type: 'website',
    title: 'Articles · Apostolat de Garabandal',
    description: "Articles, actualités et méditations de l'Apostolat de Garabandal.",
    url: `${APP_URL}/fr/l`,
    locale: 'fr_FR',
    siteName: 'Apostolado de Garabandal',
  },
};

export default async function FrBlogIndexPage() {
  const posts = await listPosts('fr', { limit: 100 });

  return (
    <main>
      <ArticleHero
        variant="page"
        title="Articles de l'Apostolat"
        subtitle="Méditations, actualités, témoignages et réflexions sur Garabandal et la vie de foi."
        breadcrumbs={[{ href: '/fr', label: 'Accueil' }, { label: 'Articles' }]}
      />

      <section style={{ padding: '2.5rem 1.5rem 4rem', maxWidth: 1200, margin: '0 auto' }}>
        {posts.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--muted)' }}>
            Aucun article publié pour le moment.
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
              <BlogCard key={p.id} post={p} locale="fr" />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
