import Link from 'next/link';
import Image from 'next/image';
import type { HomeArticle } from '../../lib/cms/home';
import { FALLBACK_IMAGE, MediaCard, Section, SectionHeader } from './ui';

/**
 * Cross-category featured articles. The first entry leads (large, left); the
 * rest follow as a compact list, so the band has a clear entry point instead of
 * three equal cards.
 */
export default function FeaturedArticles({
  articles,
  locale,
}: {
  articles: HomeArticle[];
  locale: 'pt' | 'en';
}) {
  if (!articles.length) return null;
  const [lead, ...rest] = articles;

  return (
    <Section tone="paper" labelledBy="home-featured-heading">
      <SectionHeader
        id="home-featured-heading"
        eyebrow={locale === 'pt' ? 'Leitura' : 'Reading'}
        title={locale === 'pt' ? 'Em destaque' : 'Featured'}
        description={locale === 'pt'
          ? 'Testemunhos, mensagens e reflexões em destaque sobre as Aparições de Garabandal.'
          : 'Featured testimonies, messages and reflections on the Garabandal Apparitions.'}
      />

      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className={rest.length ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <MediaCard
            href={lead.href}
            image={lead.image}
            title={lead.title}
            excerpt={lead.excerpt}
            serifTitle
            titleClass="text-2xl md:text-[1.75rem]"
            aspect="aspect-[16/10]"
            excerptLines="line-clamp-3"
            sizes="(max-width: 1024px) 100vw, 680px"
          />
        </div>

        {rest.length > 0 && (
          <ul className="flex flex-col divide-y divide-line lg:col-span-5">
            {rest.map((a) => (
              <li key={a.href} className="py-6 first:pt-0 last:pb-0">
                <Link
                  href={a.href}
                  className="group grid grid-cols-[7.5rem_1fr] items-start gap-5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:grid-cols-[10rem_1fr]"
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-line">
                    <Image
                      src={a.image || FALLBACK_IMAGE}
                      alt=""
                      fill
                      sizes="160px"
                      className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.04]"
                    />
                  </div>
                  <div>
                    <h3 className="line-clamp-3 font-serif text-lg font-medium leading-snug text-ink underline-offset-4 decoration-1 group-hover:underline">
                      {a.title}
                    </h3>
                    {a.excerpt && (
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{a.excerpt}</p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
