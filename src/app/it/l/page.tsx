import type { Metadata } from 'next';
import { ArticleHero } from '../../../components/content/ArticleHero';
import { BlogCard } from '../../../components/content/BlogCard';
import { listPosts } from '../../../lib/content/queries';
import { APP_URL } from '../../../lib/config';

export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Articoli · Apostolato di Garabandal',
  description: "Articoli, notizie e meditazioni dell'Apostolato di Garabandal sulle apparizioni di Nostra Signora, gli insegnamenti cattolici e i pellegrinaggi.",
  alternates: {
    canonical: `${APP_URL}/it/l`,
    languages: {
      'pt-BR': `${APP_URL}/l`,
      en: `${APP_URL}/en/l`,
      es: `${APP_URL}/es/l`,
      fr: `${APP_URL}/fr/l`,
      it: `${APP_URL}/it/l`,
    },
  },
  openGraph: {
    type: 'website',
    title: 'Articoli · Apostolato di Garabandal',
    description: "Articoli, notizie e meditazioni dell'Apostolato di Garabandal.",
    url: `${APP_URL}/it/l`,
    locale: 'it_IT',
    siteName: 'Apostolado de Garabandal',
  },
};

export default async function ItBlogIndexPage() {
  const posts = await listPosts('it', { limit: 100 });

  return (
    <main>
      <ArticleHero
        variant="page"
        title="Articoli dell'Apostolato"
        subtitle="Meditazioni, notizie, testimonianze e riflessioni su Garabandal e la vita di fede."
        breadcrumbs={[{ href: '/it', label: 'Home' }, { label: 'Articoli' }]}
      />

      <section style={{ padding: '2.5rem 1.5rem 4rem', maxWidth: 1200, margin: '0 auto' }}>
        {posts.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--muted)' }}>
            Nessun articolo pubblicato per ora.
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
              <BlogCard key={p.id} post={p} locale="it" />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
