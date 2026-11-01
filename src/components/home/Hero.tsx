import Image from 'next/image';
import Link from 'next/link';
import { HERO_CONTENT, HERO_IMAGE_URL } from './constants';
import { getTranslations } from '../../i18n';
import HeroMemberAction from './HeroMemberAction';
import { CONTAINER, buttonClass } from './ui';

export default function Hero({ locale }: { locale: 'pt' | 'en' }) {
  const isEn = locale === 'en';
  const t = getTranslations(locale);

  return (
    <section className="relative isolate flex min-h-svh w-full overflow-hidden bg-ink">
      {/* A responsive Next image avoids sending the original desktop asset to
          small screens. It is the only preloaded image on the homepage. */}
      <div className="absolute inset-0 z-0">
        <Image
          src={HERO_IMAGE_URL}
          alt=""
          fill
          sizes="100vw"
          preload
          className="object-cover object-center lg:object-[center_top]"
        />
        {/* Darkened in layers: an even tint, a left-to-right fade behind the copy,
            and a floor so the hero melts into the page below. */}
        <div className="absolute inset-0 bg-ink/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/75 to-ink/20 lg:hidden" />
        <div className="absolute inset-0 hidden bg-gradient-to-r from-ink via-ink/80 via-40% to-ink/5 lg:block" />
        <div className="absolute inset-0 hidden bg-gradient-to-t from-ink/70 via-transparent to-ink/40 lg:block" />
      </div>

      <div className={`${CONTAINER} relative z-10 flex flex-col justify-end pb-16 pt-40 lg:justify-center lg:pb-24`}>
        <div className="max-w-2xl">
          {/* All LCP candidates are visible in the first HTML response. Entrance
              animations here previously held the subtitle at opacity:0 until
              React and Framer Motion had hydrated on the phone. */}
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
            {isEn ? 'Non-profit association' : 'Associação sem fins lucrativos'}
          </p>
          <h1 className="text-[clamp(2.75rem,1.8rem+4.6vw,5.5rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-white text-balance">
            {isEn ? 'Garabandal Apostolate' : HERO_CONTENT.title}
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/80 sm:text-xl">
            {isEn
              ? 'The official space of the Garabandal Apostolate. A place of faith, prayer and sharing the Message.'
              : 'O espaço oficial do Apostolado de Garabandal. Um lugar de fé, oração e divulgação da Mensagem.'}
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <HeroMemberAction
              locale={locale}
              memberHref={t.urls.member}
              becomeMemberHref={t.urls.becomeMember}
            />
            <div className="flex gap-3">
              <Link href={t.urls.donations} className={buttonClass('ghost', 'flex-1 sm:flex-none')}>
                {isEn ? 'Donate' : 'Doar'}
              </Link>
              <Link href={t.urls.intentions} className={buttonClass('ghost', 'flex-1 sm:flex-none')}>
                <span className="sm:hidden">{isEn ? 'Prayers' : 'Intenções'}</span>
                <span className="hidden sm:inline">{isEn ? 'Prayer requests' : 'Pedidos de oração'}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
