import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Star } from 'lucide-react';
import type { HomeArticle } from '../../lib/cms/home';

/** Branded fallback when an article has no cover/og image. */
const FALLBACK_IMAGE = '/images/nossasenhoragarabandal.jpg';

/**
 * Cross-category featured articles band for the homepage. Light theme to match
 * the rest of the page (mist background). Mobile-first grid.
 */
export default function FeaturedArticles({
  articles,
  locale,
}: {
  articles: HomeArticle[];
  locale: 'pt' | 'en';
}) {
  if (!articles.length) return null;
  const heading = locale === 'pt' ? 'Em destaque' : 'Featured';
  const sub = locale === 'pt'
    ? 'Testemunhos, mensagens e reflexões em destaque sobre as Aparições de Garabandal.'
    : 'Featured testimonies, messages and reflections on the Garabandal Apparitions.';

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="mb-8 text-center sm:mb-12">
        <span className="inline-flex items-center gap-2 rounded-full bg-garabandal-gold/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-garabandal-dark">
          <Star size={14} className="text-garabandal-gold" />
          {heading}
        </span>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-600 sm:text-base">{sub}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
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
              <h3 className="font-serif text-lg font-bold leading-snug text-garabandal-dark">{a.title}</h3>
              {a.excerpt && (
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">{a.excerpt}</p>
              )}
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-garabandal-dark">
                {locale === 'pt' ? 'Ler mais' : 'Read more'}
                <ArrowRight size={15} className="text-garabandal-gold transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
