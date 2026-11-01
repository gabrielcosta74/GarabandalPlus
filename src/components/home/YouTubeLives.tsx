'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';
import { Eyebrow, H2_CLASS, Section, buttonClass } from './ui';
import type { YouTubeVideo } from '../../lib/youtube';
import { YOUTUBE_CHANNEL_URL } from '../../lib/youtube';

/**
 * "Lives do Apostolado" — video-forward, mobile-first.
 *
 * A large featured player (plays inline on tap) with a horizontal playlist of
 * the other recent videos below; tapping a playlist item loads it into the big
 * player.
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
    <Section tone="white" labelledBy="home-lives-heading">
      <div className="mb-10 flex flex-col gap-6 md:mb-14 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <Eyebrow>YouTube</Eyebrow>
          <h2 id="home-lives-heading" className={H2_CLASS}>{heading}</h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">{sub}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={`${YOUTUBE_CHANNEL_URL}?sub_confirmation=1`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass('primary')}
          >
            {locale === 'pt' ? 'Subscrever o canal' : 'Subscribe to the channel'}
          </a>
          <a
            href={YOUTUBE_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass('secondary')}
          >
            {locale === 'pt' ? 'Ver o canal' : 'View channel'}
          </a>
        </div>
      </div>

      {/* Featured player */}
      <div className="overflow-hidden rounded-xl bg-ink">
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
              className="group absolute inset-0 h-full w-full focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
              aria-label={locale === 'pt' ? 'Reproduzir vídeo' : 'Play video'}
            >
              <Image
                src={active.thumbnail}
                alt=""
                fill
                sizes="(max-width: 1200px) 100vw, 1200px"
                className="object-cover transition-transform duration-700 motion-safe:group-hover:scale-[1.02]"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
              <span className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink transition-transform duration-300 motion-safe:group-hover:scale-105">
                <Play size={28} className="ml-1" fill="currentColor" aria-hidden />
              </span>
              <span className="absolute inset-x-0 bottom-0 p-6 text-left sm:p-8">
                <span className="block max-w-3xl text-xl font-semibold leading-tight tracking-[-0.02em] text-white sm:text-2xl">
                  {active.title}
                </span>
                {active.published && (
                  <span className="mt-2 block text-sm text-white/70">{fmt(active.published)}</span>
                )}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Playlist */}
      {videos.length > 1 && (
        <div className="-mx-5 mt-8 flex snap-x snap-mandatory gap-6 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
          {videos.filter((v) => v.id !== active.id).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => select(v.id)}
              className="group w-[75vw] max-w-[340px] shrink-0 snap-start rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:w-auto sm:max-w-none"
            >
              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-ink">
                <Image
                  src={v.thumbnail}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 75vw, 380px"
                  className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
                />
                <span className="absolute bottom-3 left-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink">
                  <Play size={16} className="ml-0.5" fill="currentColor" aria-hidden />
                </span>
              </div>
              <h3 className="mt-4 line-clamp-2 text-base font-semibold leading-snug tracking-[-0.01em] text-ink underline-offset-4 decoration-1 group-hover:underline">
                {v.title}
              </h3>
              {v.published && (
                <span className="mt-1.5 block text-sm text-muted">{fmt(v.published)}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}
