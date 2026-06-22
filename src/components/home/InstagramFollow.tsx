import { Instagram } from 'lucide-react';

const IG_HANDLE = 'apostoladodegarabandaloficial';
const IG_URL = `https://www.instagram.com/${IG_HANDLE}/`;

/**
 * "Follow on Instagram" band. Light theme to match the rest of the homepage,
 * gold accents. Mobile-first. Sits right after the YouTube lives section.
 */
export default function InstagramFollow({ locale }: { locale: 'pt' | 'en' }) {
  const heading = locale === 'pt' ? 'Segue-nos no Instagram' : 'Follow us on Instagram';
  const sub = locale === 'pt'
    ? 'Imagens, mensagens diárias e os momentos do Apostolado de Garabandal — acompanha o dia a dia da nossa missão.'
    : 'Images, daily messages and moments from the Garabandal Apostolate — follow our mission day by day.';

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm sm:px-12 sm:py-16">
        {/* Soft gold glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-garabandal-gold/10 blur-3xl" />

        <div className="relative flex flex-col items-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-garabandal-gold text-garabandal-dark shadow-lg">
            <Instagram size={30} />
          </span>

          <h2 className="mt-6 font-serif text-3xl font-bold leading-tight text-garabandal-dark sm:text-4xl">
            {heading}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
            {sub}
          </p>
          <span className="mt-2 text-sm font-semibold text-garabandal-dark/70">@{IG_HANDLE}</span>

          <a
            href={IG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex items-center justify-center gap-2.5 rounded-2xl bg-garabandal-gold px-8 py-4 text-base font-bold text-garabandal-dark shadow-[0_8px_24px_rgba(212,175,55,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(212,175,55,0.45)]"
          >
            <Instagram size={20} />
            {locale === 'pt' ? 'Seguir' : 'Follow'}
          </a>
        </div>
      </div>
    </section>
  );
}
