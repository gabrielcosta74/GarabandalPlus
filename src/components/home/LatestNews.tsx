import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Newspaper } from 'lucide-react';
import type { HomeArticle } from '../../lib/cms/home';

/**
 * Latest news strip for the homepage (compact list). Light theme, mobile-first.
 */
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
  const heading = locale === 'pt' ? 'Últimas notícias' : 'Latest news';

  return (
    <section className="relative mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="inline-flex items-center gap-2.5 font-serif text-2xl font-bold text-garabandal-dark sm:text-3xl">
          <Newspaper size={22} className="text-garabandal-gold" /> {heading}
        </h2>
        <Link
          href={allHref}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-garabandal-dark/70 transition-colors hover:text-garabandal-dark"
        >
          {locale === 'pt' ? 'Ver todas' : 'See all'}
          <ArrowRight size={15} />
        </Link>
      </div>

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {items.map((a) => (
          <li key={a.href}>
            <Link
              href={a.href}
              className="group flex items-center gap-4 p-3 transition-colors hover:bg-garabandal-mist sm:p-4"
            >
              {a.image ? (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-[68px] sm:w-28">
                  <Image
                    src={a.image}
                    alt=""
                    fill
                    sizes="112px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-garabandal-gold/10 sm:h-[68px] sm:w-28">
                  <Newspaper size={20} className="text-garabandal-gold" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 font-serif text-base font-bold leading-snug text-garabandal-dark sm:text-lg">
                  {a.title}
                </h3>
                {a.excerpt && (
                  <p className="mt-1 line-clamp-1 text-sm text-slate-500">{a.excerpt}</p>
                )}
              </div>

              <ArrowRight
                size={18}
                className="shrink-0 text-garabandal-gold transition-transform group-hover:translate-x-1"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
