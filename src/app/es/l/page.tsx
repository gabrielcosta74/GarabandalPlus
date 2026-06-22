import type { Metadata } from 'next';
import { ArticleHero } from '../../../components/content/ArticleHero';
import { BlogCard } from '../../../components/content/BlogCard';
import { listPosts } from '../../../lib/content/queries';
import { APP_URL } from '../../../lib/config';

export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Artículos · Apostolado de Garabandal',
  description: 'Artículos, noticias y meditaciones del Apostolado de Garabandal sobre las apariciones de Nuestra Señora, enseñanzas y peregrinaciones.',
  alternates: {
    canonical: `${APP_URL}/es/l`,
    languages: {
      'pt-BR': `${APP_URL}/l`,
      en: `${APP_URL}/en/l`,
      es: `${APP_URL}/es/l`,
    },
  },
  openGraph: {
    type: 'website',
    title: 'Artículos · Apostolado de Garabandal',
    description: 'Artículos, noticias y meditaciones del Apostolado de Garabandal.',
    url: `${APP_URL}/es/l`,
    locale: 'es_ES',
    siteName: 'Apostolado de Garabandal',
  },
};

export default async function EsBlogIndexPage() {
  const posts = await listPosts('es', { limit: 100 });

  return (
    <main>
      <ArticleHero
        variant="page"
        title="Artículos del Apostolado"
        subtitle="Meditaciones, noticias, testimonios y reflexiones sobre Garabandal y la vida de fe."
        breadcrumbs={[{ href: '/es', label: 'Inicio' }, { label: 'Artículos' }]}
      />

      <section style={{ padding: '2.5rem 1.5rem 4rem', maxWidth: 1200, margin: '0 auto' }}>
        {posts.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--muted)' }}>
            Aún no hay artículos publicados.
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
              <BlogCard key={p.id} post={p} locale="es" />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
