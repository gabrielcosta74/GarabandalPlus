import Link from 'next/link';
import Image from 'next/image';
import type { HomeArticle } from '../../lib/cms/home';
import { Section, SectionHeader } from './ui';

/** Latest news: a compact list, one hairline per item. */
export default function LatestNews({
  items,
  locale,
  allHref,
}: {
  items: HomeArticle[];
  locale: 'pt' | 'en';
  allHref: string;
}) {
  if (!items.length) return null;

  return (
    <Section tone="white" labelledBy="home-news-heading">
      <SectionHeader
        id="home-news-heading"
        eyebrow={locale === 'pt' ? 'Atualidade' : 'Current'}
        title={locale === 'pt' ? 'Últimas notícias' : 'Latest news'}
        action={{ href: allHref, label: locale === 'pt' ? 'Ver todas' : 'See all' }}
      />

      <ul className="divide-y divide-line border-y border-line">
        {items.map((a) => (
          <li key={a.href}>
            <Link
              href={a.href}
              className="group flex items-center gap-5 py-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:gap-8 sm:py-6"
            >
              {a.image && (
                <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-line sm:h-20 sm:w-32">
                  <Image
                    src={a.image}
                    alt=""
                    fill
                    sizes="128px"
                    className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.04]"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 text-base font-semibold leading-snug tracking-[-0.01em] text-ink underline-offset-4 decoration-1 group-hover:underline sm:text-lg">
                  {a.title}
                </h3>
                {a.excerpt && (
                  <p className="mt-1 line-clamp-1 text-sm text-muted">{a.excerpt}</p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
