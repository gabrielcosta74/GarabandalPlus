import type { HomeArticle } from '../../lib/cms/home';
import { MediaCard, Section, SectionHeader, formatDate } from './ui';

/**
 * Homepage "Artigos" band: the CMS `posts` content type (labelled "Artigos" in
 * the admin, served publicly at /l/<slug>), newest first.
 */
export default function LatestArticles({
  articles,
  locale,
}: {
  articles: HomeArticle[];
  locale: 'pt' | 'en';
}) {
  if (!articles.length) return null;

  return (
    <Section tone="white" labelledBy="home-articles-heading">
      <SectionHeader
        id="home-articles-heading"
        eyebrow={locale === 'pt' ? 'Mais recentes' : 'Latest'}
        title={locale === 'pt' ? 'Artigos' : 'Articles'}
        action={{ href: locale === 'pt' ? '/l' : '/en/l', label: locale === 'pt' ? 'Ver todos' : 'View all' }}
      />

      <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <MediaCard
            key={a.href}
            href={a.href}
            image={a.image}
            title={a.title}
            excerpt={a.excerpt}
            meta={formatDate(a.date, locale)}
            serifTitle
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
          />
        ))}
      </div>
    </Section>
  );
}
