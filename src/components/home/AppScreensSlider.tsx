'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export type AppScreen = { src: string; alt: string };

/**
 * Horizontal, scroll-snapping gallery of the app's marketing screens. Native
 * scrolling does the work (swipe on phones, trackpad/drag on desktop); the
 * arrows and dots are an enhancement on top of it.
 */
export default function AppScreensSlider({
  screens,
  labels,
}: {
  screens: AppScreen[];
  labels: { previous: string; next: string; goTo: string };
}) {
  const scroller = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [edges, setEdges] = useState({ start: true, end: false });

  // Where a card rests when snapped: centred on phones, at the left edge otherwise.
  const restOffset = (el: HTMLElement, item: HTMLElement) =>
    window.innerWidth >= 640 ? 0 : (el.clientWidth - item.offsetWidth) / 2;

  const sync = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const items = Array.from(el.children) as HTMLElement[];
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    let nearest = 0;
    let best = Infinity;
    items.forEach((item, i) => {
      const d = Math.abs(item.offsetLeft - restOffset(el, item) - el.scrollLeft);
      if (d < best) { best = d; nearest = i; }
    });
    setActive(atEnd ? items.length - 1 : nearest);
    setEdges({ start: el.scrollLeft <= 4, end: atEnd });
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [sync]);

  const scrollByCard = (dir: 1 | -1) => {
    const el = scroller.current;
    const first = el?.firstElementChild as HTMLElement | undefined;
    if (!el || !first) return;
    el.scrollBy({ left: dir * (first.offsetWidth + 20) * 2, behavior: 'smooth' });
  };

  const goTo = (i: number) => {
    const el = scroller.current;
    const item = el?.children[i] as HTMLElement | undefined;
    if (!el || !item) return;
    el.scrollTo({ left: item.offsetLeft - restOffset(el, item), behavior: 'smooth' });
  };

  const arrow =
    'flex h-12 w-12 items-center justify-center rounded-full border border-white/25 text-white transition-all duration-300 hover:bg-white hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-30';

  return (
    <div>
      <ul
        ref={scroller}
        onScroll={sync}
        className="-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-5 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {screens.map((s, i) => (
          <li
            key={s.src}
            className="w-[72vw] max-w-[320px] shrink-0 snap-center sm:w-[300px] sm:snap-start lg:w-[310px]"
          >
            <div className="overflow-hidden rounded-[1.75rem] ring-1 ring-white/15">
              <Image
                src={s.src}
                alt={s.alt}
                width={853}
                height={1844}
                sizes="(max-width: 640px) 72vw, 310px"
                className="h-auto w-full"
                loading={i < 3 ? 'eager' : 'lazy'}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex items-center justify-between gap-6">
        <div className="flex items-center gap-2" role="group" aria-label="Slides">
          {screens.map((s, i) => (
            <button
              key={s.src}
              type="button"
              onClick={() => goTo(i)}
              aria-label={labels.goTo.replace('{n}', String(i + 1))}
              aria-current={i === active}
              className="group flex h-6 items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span className={`block h-1.5 rounded-full transition-all duration-300 ${i === active ? 'w-8 bg-white' : 'w-1.5 bg-white/35 group-hover:bg-white/60'}`} />
            </button>
          ))}
        </div>
        <div className="hidden gap-3 sm:flex">
          <button type="button" onClick={() => scrollByCard(-1)} disabled={edges.start} aria-label={labels.previous} className={arrow}>
            <ArrowLeft size={20} aria-hidden />
          </button>
          <button type="button" onClick={() => scrollByCard(1)} disabled={edges.end} aria-label={labels.next} className={arrow}>
            <ArrowRight size={20} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
