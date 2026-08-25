import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import type { HomeCategory } from '../../lib/cms/home';

/**
 * Devotional entry grid for the homepage — the main content gateways
 * (História, Mensagens, Profecias, Testemunhos, ...). Mobile-first: single
 * column on phones, expanding to a sleek asymmetric Bento grid on larger screens.
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
  const churchPositionCard = locale === 'pt'
    ? {
        key: 'church-position',
        label: 'A posição da Igreja',
        intro: 'Garabandal nunca foi condenado pela Igreja. Conheça a situação do processo e a documentação disponível.',
        href: '/a-posicao-da-igreja',
        cover: '/images/igrejagarabandal.webp',
      }
    : {
        key: 'church-position',
        label: "The Church's position",
        intro: 'Garabandal has never been condemned by the Church. Learn about the status of the process and the available documentation.',
        href: '/en/a-posicao-da-igreja',
        cover: '/images/igrejagarabandal.webp',
      };
  const cards = [...categories, churchPositionCard];

  return (
    <section className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mb-12 max-w-2xl sm:mb-16">
        <h2 className="font-serif text-4xl font-bold text-slate-900 sm:text-5xl tracking-tight mb-4">{heading}</h2>
        <p className="text-base text-slate-500 sm:text-lg leading-relaxed">{sub}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-6">
        {cards.map((cat, index) => {
          // Bento layout logic: the Church position card sits below Prophecies.
          let spanClasses = "";
          let heightClasses = "";

          if (index === 0) {
            spanClasses = "md:col-span-2 lg:col-span-4 lg:row-span-2";
            heightClasses = "min-h-[400px] sm:min-h-[450px] lg:min-h-[580px]";
          } else if (index === 1 || index === 2) {
            spanClasses = "md:col-span-1 lg:col-span-2 lg:row-span-1";
            heightClasses = "min-h-[300px] sm:min-h-[320px] lg:min-h-[280px]";
          } else if (index === 3 || index === 4) {
            spanClasses = "md:col-span-1 lg:col-span-3 lg:row-span-1";
            heightClasses = "min-h-[300px] sm:min-h-[320px] lg:min-h-[280px]";
          } else if (index === 5) {
            spanClasses = "md:col-span-1 lg:col-span-3 lg:col-start-4 lg:row-span-1";
            heightClasses = "min-h-[300px] sm:min-h-[320px] lg:min-h-[280px]";
          }

          return (
            <div key={cat.key} className={`${spanClasses} h-full`}>
              <Link
                href={cat.href}
                className={`group relative flex overflow-hidden rounded-[2rem] bg-slate-900 w-full h-full ${heightClasses} shadow-sm hover:shadow-2xl transition-shadow duration-500`}
              >
                {cat.cover && (
                  <>
                    <Image
                      src={cat.cover}
                      alt={cat.label}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 50vw"
                      className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/40 to-slate-900/10" />
                  </>
                )}

                <div className="relative z-10 flex flex-col justify-end p-6 sm:p-8 w-full h-full">
                  <div className="flex items-end justify-between gap-4">
                    <div className="max-w-[85%] sm:max-w-[90%]">
                      <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white mb-2 sm:mb-3 tracking-tight group-hover:text-yellow-200 transition-colors duration-300">
                        {cat.label}
                      </h3>
                      <p className={`text-slate-200 font-medium leading-relaxed ${index === 0 ? 'text-sm sm:text-base line-clamp-3' : 'text-sm line-clamp-2 sm:line-clamp-3'}`}>
                        {cat.intro}
                      </p>
                    </div>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 transition-all duration-500 ease-out group-hover:bg-white group-hover:text-slate-950 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:border-white group-hover:shadow-[0_0_20px_rgba(255,255,255,0.4)]">
                      <ArrowRight size={20} strokeWidth={2.5} className="transition-transform duration-500 group-hover:scale-110" />
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      <section
        className="mt-6 overflow-hidden rounded-[2rem] border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-slate-50 px-6 py-12 sm:mt-8 sm:px-10 sm:py-16 lg:px-16"
        aria-labelledby="walk-with-us-heading"
      >
        <div className="max-w-3xl">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-amber-700">
            {locale === 'pt' ? 'Caminhe connosco' : 'Walk with us'}
          </p>
          <h2 id="walk-with-us-heading" className="font-serif text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl">
            {locale === 'pt' ? 'Um lugar para a oração e para pertencer.' : 'A place for prayer and belonging.'}
          </h2>
        </div>
      </section>
    </section>
  );
}
