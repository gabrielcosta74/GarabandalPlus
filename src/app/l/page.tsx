import type { Metadata } from 'next';
import { ArticleHero } from '../../components/content/ArticleHero';
import { BlogCard } from '../../components/content/BlogCard';
import { listPosts } from '../../lib/content/queries';
import { APP_URL } from '../../lib/config';

export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Artigos · Apostolado de Garabandal',
  description: 'Artigos, notícias e meditações do Apostolado de Garabandal sobre as aparições de Nossa Senhora, ensinamentos e peregrinações.',
  alternates: {
    canonical: `${APP_URL}/l`,
    languages: {
      'pt-BR': `${APP_URL}/l`,
      en: `${APP_URL}/en/l`,
    },
  },
  openGraph: {
    type: 'website',
    title: 'Artigos · Apostolado de Garabandal',
    description: 'Artigos, notícias e meditações do Apostolado de Garabandal.',
    url: `${APP_URL}/l`,
    locale: 'pt_BR',
    siteName: 'Apostolado de Garabandal',
  },
};

export default async function BlogIndexPage() {
  const posts = await listPosts('pt', { limit: 100 });

  return (
    <main>
      <ArticleHero
        variant="page"
        title="Artigos do Apostolado"
        subtitle="Meditações, notícias, testemunhos e reflexões sobre Garabandal e a vida de fé."
        breadcrumbs={[{ href: '/', label: 'Início' }, { label: 'Artigos' }]}
      />

      <section style={{ padding: '2.5rem 1.5rem 4rem', maxWidth: 1200, margin: '0 auto' }}>
        {posts.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--muted)' }}>
            Nenhum artigo publicado de momento.
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
              <BlogCard key={p.id} post={p} locale="pt" />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
