import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Newspaper } from 'lucide-react';
import type { HomeArticle } from '../../lib/cms/home';

/** Branded fallback when an article has no cover/og image. */
const FALLBACK_IMAGE = '/images/nossasenhoragarabandal.jpg';

function formatDate(iso: string | null, locale: 'pt' | 'en'): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Homepage "Artigos" band — the CMS `posts` content type (labelled "Artigos" in
 * the admin, served publicly at /l/<slug>), newest first. Light theme to match
 * the mist background; mobile-first grid.
 */
export default function LatestArticles({
  articles,
  locale,
}: {
  articles: HomeArticle[];
  locale: 'pt' | 'en';
}) {
  if (!articles.length) return null;
  const heading = locale === 'pt' ? 'Artigos' : 'Articles';
  const sub = locale === 'pt'
    ? 'Os artigos mais recentes do Apostolado de Garabandal.'
    : 'The latest articles from the Garabandal Apostolate.';

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="mb-8 text-center sm:mb-12">
        <span className="inline-flex items-center gap-2 rounded-full bg-garabandal-gold/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-garabandal-dark">
          <Newspaper size={14} className="text-garabandal-gold" />
          {heading}
        </span>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-600 sm:text-base">{sub}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => {
          const date = formatDate(a.date, locale);
          return (
            <Link
              key={a.href}
              href={a.href}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                <Image
                  src={a.image || FALLBACK_IMAGE}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                {date && (
                  <span className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-garabandal-gold">
                    {date}
                  </span>
                )}
                <h3 className="line-clamp-2 font-serif text-lg font-bold leading-snug text-garabandal-dark">{a.title}</h3>
                {a.excerpt && (
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">{a.excerpt}</p>
                )}
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-garabandal-dark">
                  {locale === 'pt' ? 'Ler mais' : 'Read more'}
                  <ArrowRight size={15} className="text-garabandal-gold transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
