import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import type { HomeCategory } from '../../lib/cms/home';

/**
 * Devotional entry grid for the homepage — the main content gateways
 * (História, Mensagens, Profecias, Testemunhos, ...). Mobile-first: single
 * column on phones, expanding to a multi-column grid on larger screens.
 */
export default function DevotionalGrid({
  categories,
  locale,
}: {
  categories: HomeCategory[];
  locale: 'pt' | 'en';
}) {
  if (!categories.length) return null;
  const heading = locale === 'pt' ? 'Conhecer Garabandal' : 'Discover Garabandal';
  const sub = locale === 'pt'
    ? 'A história, as mensagens e as profecias de Nossa Senhora do Carmo em Garabandal.'
    : 'The history, messages and prophecies of Our Lady of Mount Carmel at Garabandal.';

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="mb-8 text-center sm:mb-12">
        <h2 className="font-serif text-3xl font-bold text-garabandal-dark sm:text-4xl">{heading}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">{sub}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <Link
            key={cat.key}
            href={cat.href}
            className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-xl"
          >
            {cat.cover && (
              <div className="relative w-full aspect-[16/9] overflow-hidden bg-slate-100">
                <Image
                  src={cat.cover}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
            )}
            <div className="flex flex-col flex-grow p-6">
              <h3 className="font-serif text-2xl font-bold text-garabandal-dark mb-3">{cat.label}</h3>
              <p className="line-clamp-3 text-sm text-slate-600 font-medium leading-relaxed flex-grow">{cat.intro}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-garabandal-dark bg-garabandal-gold/20 group-hover:bg-garabandal-gold px-5 py-2.5 rounded-xl transition-colors w-fit shadow-sm">
                {locale === 'pt' ? 'Explorar' : 'Explore'}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
