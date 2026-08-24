import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, Heart, HandHeart } from 'lucide-react';
import { HERO_CONTENT, HERO_IMAGE_URL } from './constants';
import { getTranslations } from '../../i18n';
import HeroMemberAction from './HeroMemberAction';

export default function Hero({ locale }: { locale: 'pt' | 'en' }) {
  const isEn = locale === 'en';
  const t = getTranslations(locale);

  return (
    <section className="relative flex min-h-screen w-full overflow-hidden bg-slate-950">
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
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/10 lg:hidden" />
        <div className="absolute inset-0 hidden bg-gradient-to-r from-slate-950 via-slate-950/70 to-transparent lg:block" />
        <div className="absolute inset-0 hidden bg-gradient-to-t from-slate-950/40 via-transparent to-transparent lg:block" />
      </div>

      <div className="relative z-20 flex min-h-screen w-full flex-col justify-end px-6 pb-24 pt-32 sm:px-12 lg:w-[70%] lg:justify-center lg:px-20 lg:py-0 xl:w-[60%] xl:px-32">
        <div className="max-w-2xl">
          {/* All LCP candidates are visible in the first HTML response. Entrance
              animations here previously held the subtitle at opacity:0 until
              React and Framer Motion had hydrated on the phone. */}
          <h1 className="mb-6 font-serif text-[2.75rem] font-bold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-[5.5rem]">
            {isEn ? 'Garabandal Apostolate' : HERO_CONTENT.title}
          </h1>

          <p className="mb-10 max-w-xl text-lg font-light leading-relaxed text-slate-300 sm:mb-12 sm:text-xl md:text-2xl">
            {isEn
              ? 'The official space of the Garabandal Apostolate — a non-profit association. A place of faith, prayer and sharing the Message.'
              : HERO_CONTENT.subtitle}
          </p>

          <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
            <HeroMemberAction
              locale={locale}
              memberHref={t.urls.member}
              becomeMemberHref={t.urls.becomeMember}
            />

            <div className="flex gap-3 sm:gap-4">
              <Link
                href={t.urls.donations}
                className="group inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-center text-sm font-semibold tracking-wide text-white backdrop-blur-md transition-all duration-300 hover:border-white/40 hover:bg-white/20 sm:flex-none sm:px-6"
              >
                <Heart size={18} className="shrink-0 text-white/80 transition-colors group-hover:text-red-400" />
                <span>{isEn ? 'Donate' : 'Doar'}</span>
              </Link>

              <Link
                href={t.urls.intentions}
                className="group inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-center text-sm font-semibold tracking-wide text-white backdrop-blur-md transition-all duration-300 hover:border-white/40 hover:bg-white/20 sm:flex-none sm:px-6"
              >
                <HandHeart size={18} className="shrink-0 text-white/80 transition-colors group-hover:text-sky-300" />
                <span className="sm:hidden">{isEn ? 'Prayers' : 'Intenções'}</span>
                <span className="hidden sm:inline">{isEn ? 'Prayer requests' : 'Pedidos de oração'}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2 animate-bounce text-white/60 motion-reduce:animate-none">
        <ChevronDown size={32} strokeWidth={2} aria-hidden />
      </div>
    </section>
  );
}
