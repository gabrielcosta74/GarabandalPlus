'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Play, Youtube, Bell } from 'lucide-react';
import type { YouTubeVideo } from '../../lib/youtube';
import { YOUTUBE_CHANNEL_URL } from '../../lib/youtube';

/**
 * "Lives do Apostolado" — video-forward, mobile-first.
 *
 * A large featured player (plays inline on tap) with a horizontal playlist of
 * the other recent videos below; tapping a playlist item loads it into the big
 * player. Light theme to match the homepage.
 */
export default function YouTubeLives({
  videos,
  locale,
}: {
  videos: YouTubeVideo[];
  locale: 'pt' | 'en';
}) {
  const [activeId, setActiveId] = useState<string | null>(videos[0]?.id ?? null);
  const [playing, setPlaying] = useState(false);

  if (!videos.length) return null;

  const active = videos.find((v) => v.id === activeId) ?? videos[0];
  const heading = locale === 'pt' ? 'Lives do Apostolado' : 'Apostolate Lives';
  const sub = locale === 'pt'
    ? 'Conferências, testemunhos e transmissões sobre Garabandal no nosso canal.'
    : 'Conferences, testimonies and broadcasts about Garabandal on our channel.';

  const fmt = (iso: string) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
    } catch { return ''; }
  };

  const select = (id: string) => {
    setActiveId(id);
    setPlaying(true);
  };

  return (
    <section className="relative mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
      {/* Header */}
      <div className="mb-8 flex flex-col items-center text-center sm:mb-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-garabandal-gold px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-garabandal-dark shadow-sm">
          <Youtube size={16} />
          {heading}
        </span>
        <p className="mx-auto mt-4 max-w-xl text-base text-slate-600">{sub}</p>
      </div>

      {/* Upcoming live announcement */}
      <div className="mb-8 flex flex-col items-center sm:mb-10">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          {locale === 'pt' ? 'Próxima live · 27/06 · 14h' : 'Next live · 27/06 · 2pm'}
        </span>
        <div className="overflow-hidden rounded-3xl shadow-2xl ring-1 ring-black/5">
          {/* next/image, not a raw <img>: the source is 900x1600 but it renders
              at most 400px wide, so Lighthouse measured ~78 KiB of wasted
              transfer. Explicit dimensions also reserve the space and keep this
              out of the CLS budget. */}
          <Image
            src="https://pntzzuxzjnzksubbjfvj.supabase.co/storage/v1/object/public/site-content/lives/livegarabandal27.jpeg"
            alt={locale === 'pt'
              ? 'São Padre Pio e as aparições de Garabandal — live dia 27 de junho às 14h'
              : 'Saint Padre Pio and the Garabandal apparitions — live on June 27 at 2pm'}
            width={900}
            height={1600}
            sizes="(max-width: 640px) 100vw, 400px"
            className="block h-auto w-full max-w-[400px]"
          />
        </div>
      </div>

      {/* Featured player */}
      <div className="overflow-hidden rounded-3xl bg-garabandal-dark shadow-2xl ring-1 ring-black/5">
        <div className="relative aspect-video w-full">
          {playing ? (
            <iframe
              key={active.id}
              src={`https://www.youtube.com/embed/${active.id}?autoplay=1&rel=0&modestbranding=1`}
              title={active.title}
              className="absolute inset-0 h-full w-full"
              allow="accelerated-encoder; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="group absolute inset-0 h-full w-full"
              aria-label={locale === 'pt' ? 'Reproduzir vídeo' : 'Play video'}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={active.thumbnail}
                alt=""
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
              {/* Big play button */}
              <span className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-garabandal-gold text-garabandal-dark shadow-xl transition-transform duration-300 group-hover:scale-110 sm:h-24 sm:w-24">
                <Play size={36} className="ml-1.5" fill="currentColor" />
              </span>
              {/* Title on the gradient */}
              <span className="absolute inset-x-0 bottom-0 p-5 text-left sm:p-7">
                <span className="block font-serif text-xl font-bold leading-tight text-white drop-shadow sm:text-2xl">
                  {active.title}
                </span>
                {active.published && (
                  <span className="mt-1.5 block text-xs font-medium uppercase tracking-wide text-white/70">
                    {fmt(active.published)}
                  </span>
                )}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Playlist — horizontal carousel (scroll-snap), larger cards */}
      {videos.length > 1 && (
        <div className="-mx-4 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0 [-ms-overflow-style:none] [scrollbar-width:thin]">
          {videos.filter((v) => v.id !== active.id).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => select(v.id)}
              className="group w-[80vw] max-w-[360px] shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:w-[340px]"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-garabandal-dark">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={v.thumbnail}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-garabandal-gold text-garabandal-dark shadow-lg">
                    <Play size={22} className="ml-0.5" fill="currentColor" />
                  </span>
                </span>
              </div>
              <div className="p-4">
                <h3 className="line-clamp-2 font-serif text-base font-bold leading-snug text-garabandal-dark">
                  {v.title}
                </h3>
                {v.published && (
                  <span className="mt-1.5 block text-xs text-slate-400">{fmt(v.published)}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Channel CTAs — subscribe (primary) + view channel (secondary) */}
      <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:mt-12 sm:flex-row sm:items-center">
        <a
          href={`${YOUTUBE_CHANNEL_URL}?sub_confirmation=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center justify-center gap-2.5 rounded-2xl bg-garabandal-gold px-8 py-4 text-base font-bold text-garabandal-dark shadow-[0_8px_24px_rgba(212,175,55,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(212,175,55,0.45)]"
        >
          <Bell size={20} className="transition-transform group-hover:rotate-12" fill="currentColor" />
          {locale === 'pt' ? 'Subscrever o canal' : 'Subscribe to the channel'}
        </a>
        <a
          href={YOUTUBE_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2.5 rounded-2xl border-2 border-garabandal-dark/15 bg-white px-8 py-4 text-base font-bold text-garabandal-dark transition-all hover:-translate-y-0.5 hover:border-garabandal-dark/30 hover:bg-garabandal-mist"
        >
          <Youtube size={20} />
          {locale === 'pt' ? 'Ver o canal' : 'View channel'}
        </a>
      </div>
    </section>
  );
}
