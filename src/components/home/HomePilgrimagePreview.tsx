import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import { getTranslations } from '../../i18n';
import { richTextToPlain } from '../../lib/rich-text';
import { parseCivilDate } from '../../lib/utils';

interface Pilgrimage {
  id: string;
  title: string;
  slug: string;
  cover_image: string;
  cover_image_en?: string | null;
  start_date: string;
  description: string;
  base_price: number;
  itinerary_summary?: string;
  status: 'draft' | 'open' | 'closed' | 'completed' | 'waitlist' | 'full';
  total_vacancies: number;
  confirmed_pax: number;
  effective_vacancies?: number | null;
}
interface HomePilgrimagePreviewProps {
  pilgrimages: Pilgrimage[];
  locale?: 'pt' | 'en';
}

function availabilityLabel(pilgrimage: Pilgrimage, isEn: boolean) {
  const vacancies = pilgrimage.effective_vacancies
    ?? (pilgrimage.total_vacancies - pilgrimage.confirmed_pax);

  if (pilgrimage.status === 'full' || pilgrimage.status === 'closed' || vacancies <= 0) {
    return isEn ? 'Sold out' : 'Esgotado';
  }
  if (pilgrimage.status === 'waitlist') return isEn ? 'Waitlist' : 'Lista de espera';
  if (vacancies <= 5) return isEn ? `Last ${vacancies} places` : `Últimas ${vacancies} vagas`;
  return null;
}

export default function HomePilgrimagePreview({
  pilgrimages,
  locale = 'pt',
}: HomePilgrimagePreviewProps) {
  if (!pilgrimages.length) return null;

  const isEn = locale === 'en';
  const t = getTranslations(locale);
  const dateLocale = isEn ? 'en-GB' : 'pt-PT';
  const priceFormatter = new Intl.NumberFormat(dateLocale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });

  return (
    <section className="relative overflow-hidden bg-slate-900 py-20 text-white md:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.12),transparent_38%)]" />
      <div className="container relative z-10 mx-auto max-w-7xl px-6">
        <div className="mb-10 flex flex-col gap-6 md:mb-14 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-garabandal-gold">
              {isEn ? 'Spiritual journeys' : 'Viagens espirituais'}
            </p>
            <h2 className="font-serif text-4xl leading-[1.1] tracking-tight md:text-5xl">
              {isEn ? 'Upcoming pilgrimages' : 'Próximas peregrinações'}
            </h2>
          </div>
          <Link
            href={t.urls.pilgrimages}
            className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white/75 transition-colors hover:text-garabandal-gold"
          >
            {isEn ? 'View all' : 'Ver todas'}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {pilgrimages.slice(0, 2).map((pilgrimage) => {
            const start = parseCivilDate(pilgrimage.start_date);
            const badge = availabilityLabel(pilgrimage, isEn);
            const cover = (isEn && pilgrimage.cover_image_en)
              || pilgrimage.cover_image
              || '/images/pilgrimage-placeholder.jpg';

            return (
              <Link
                key={pilgrimage.id}
                href={`${t.urls.pilgrimages}#${pilgrimage.slug}`}
                className="group relative min-h-[430px] overflow-hidden rounded-3xl border border-white/10 bg-slate-800 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-garabandal-gold/40"
              >
                <Image
                  src={cover}
                  alt={pilgrimage.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/65 to-black/15" />

                <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-6">
                  {badge ? (
                    <span className="rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">
                      {badge}
                    </span>
                  ) : <span />}
                  <div className="rounded-2xl border border-white/20 bg-black/45 px-3 py-2 text-center backdrop-blur-md">
                    <span className="block font-serif text-xl font-bold leading-none">{start.getDate()}</span>
                    <span className="mt-1 block text-[10px] font-bold uppercase text-garabandal-gold">
                      {start.toLocaleDateString(dateLocale, { month: 'short' })}
                    </span>
                  </div>
                </div>

                <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                  {pilgrimage.itinerary_summary && (
                    <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-garabandal-gold">
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="line-clamp-1">{pilgrimage.itinerary_summary}</span>
                    </p>
                  )}
                  <h3 className="font-serif text-2xl font-bold leading-tight md:text-3xl">
                    {pilgrimage.title}
                  </h3>
                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-300">
                    {richTextToPlain(pilgrimage.description)}
                  </p>
                  <p className="mt-5 text-sm text-white/65">
                    {isEn ? 'From' : 'A partir de'}{' '}
                    <strong className="text-lg text-white">{priceFormatter.format(pilgrimage.base_price)}</strong>
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
