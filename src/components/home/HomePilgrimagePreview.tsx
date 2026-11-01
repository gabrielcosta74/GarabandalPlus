import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from '../../i18n';
import { richTextToPlain } from '../../lib/rich-text';
import { parseCivilDate } from '../../lib/utils';
import { Section, SectionHeader } from './ui';

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
    <Section tone="white" labelledBy="home-pilgrimages-heading">
      <SectionHeader
        id="home-pilgrimages-heading"
        eyebrow={isEn ? 'Spiritual journeys' : 'Viagens espirituais'}
        title={isEn ? 'Upcoming pilgrimages' : 'Próximas peregrinações'}
        action={{ href: t.urls.pilgrimages, label: isEn ? 'View all' : 'Ver todas' }}
      />

      <div className="grid gap-x-8 gap-y-14 md:grid-cols-2">
        {pilgrimages.slice(0, 2).map((pilgrimage) => {
          const start = parseCivilDate(pilgrimage.start_date);
          const badge = availabilityLabel(pilgrimage, isEn);
          const cover = (isEn && pilgrimage.cover_image_en)
            || pilgrimage.cover_image
            || '/images/pilgrimage-placeholder.jpg';
          const dateLabel = start.toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' });

          return (
            <Link
              key={pilgrimage.id}
              href={`${t.urls.pilgrimages}#${pilgrimage.slug}`}
              className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {/* Covers are posters with their own lettering, so nothing is laid
                  over the picture except a small status tag. */}
              <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-line">
                <Image
                  src={cover}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 580px"
                  className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]"
                />
                {badge && (
                  <span className="absolute left-4 top-4 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-sm">
                    {badge}
                  </span>
                )}
              </div>

              <div className="mt-6">
                <p className="text-sm font-semibold text-brand">{dateLabel}</p>
                <h3 className="mt-2 text-2xl font-semibold leading-tight tracking-[-0.02em] text-ink underline-offset-4 decoration-1 group-hover:underline">
                  {pilgrimage.title}
                </h3>
                {pilgrimage.itinerary_summary && (
                  <p className="mt-2 line-clamp-1 text-sm text-muted">{pilgrimage.itinerary_summary}</p>
                )}
                <p className="mt-3 line-clamp-2 text-[15px] leading-relaxed text-muted">
                  {richTextToPlain(pilgrimage.description)}
                </p>
                <p className="mt-5 border-t border-line pt-5 text-sm text-muted">
                  {isEn ? 'From' : 'A partir de'}{' '}
                  <strong className="text-lg font-semibold text-ink">{priceFormatter.format(pilgrimage.base_price)}</strong>
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </Section>
  );
}
