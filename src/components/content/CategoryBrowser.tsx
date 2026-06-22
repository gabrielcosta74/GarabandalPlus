'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Search, X, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';

/** Plain, serializable shape passed from the server page. */
export type BrowseItem = {
  id: string;
  title: string;
  href: string;
  cover: string | null;
  excerpt: string | null;
  date: string; // ISO — used for sorting
  tags: string[];
};

type SortKey = 'recent' | 'old' | 'az';

const STR = {
  pt: {
    search: 'Pesquisar nesta secção…',
    all: 'Todos',
    sortRecent: 'Mais recentes',
    sortOld: 'Mais antigos',
    sortAz: 'A–Z',
    none: 'Nenhum resultado encontrado.',
    noneHint: 'Tente outra pesquisa ou limpe os filtros.',
    clear: 'Limpar filtros',
    read: 'Ler',
    result: 'resultado',
    results: 'resultados',
    prev: 'Página anterior',
    next: 'Página seguinte',
    page: 'Página',
    of: 'de',
  },
  en: {
    search: 'Search this section…',
    all: 'All',
    sortRecent: 'Newest',
    sortOld: 'Oldest',
    sortAz: 'A–Z',
    none: 'No results found.',
    noneHint: 'Try another search or clear the filters.',
    clear: 'Clear filters',
    read: 'Read',
    result: 'result',
    results: 'results',
    prev: 'Previous page',
    next: 'Next page',
    page: 'Page',
    of: 'of',
  },
};

/** Build a compact page list with ellipses, e.g. [1, '…', 4, 5, 6, '…', 20]. */
function pageList(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | '…'> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push('…');
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push('…');
  out.push(total);
  return out;
}

export function CategoryBrowser({
  items,
  tags,
  locale,
  pageSize = 9,
}: {
  items: BrowseItem[];
  tags: string[];
  locale: 'pt' | 'en';
  pageSize?: number;
}) {
  const s = STR[locale];
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('recent');
  const [page, setPage] = useState(1);
  const topRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((i) => {
      const matchesQuery =
        !q ||
        i.title.toLowerCase().includes(q) ||
        (i.excerpt ?? '').toLowerCase().includes(q);
      const matchesTag = !activeTag || i.tags.includes(activeTag);
      return matchesQuery && matchesTag;
    });
    return list.sort((a, b) => {
      if (sort === 'az') return a.title.localeCompare(b.title);
      if (sort === 'old') return a.date.localeCompare(b.date);
      return b.date.localeCompare(a.date);
    });
  }, [items, query, activeTag, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  // Keep the current page valid when filters shrink the result set.
  useEffect(() => {
    setPage(1);
  }, [query, activeTag, sort]);

  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice((current - 1) * pageSize, current * pageSize);
  const hasFilters = query.trim() !== '' || activeTag !== null;

  function goTo(p: number) {
    const next = Math.min(Math.max(1, p), totalPages);
    setPage(next);
    // Scroll back to the top of the list so the new page starts in view.
    if (topRef.current) {
      const y = topRef.current.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  return (
    <div ref={topRef} className="scroll-mt-24">
      {/* FILTER BAR */}
      <div className="mb-8 flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={s.search}
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-10 text-sm text-garabandal-dark shadow-sm outline-none transition focus:border-garabandal-gold focus:ring-2 focus:ring-garabandal-gold/30"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={s.clear}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-garabandal-dark"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="relative shrink-0">
            <SlidersHorizontal size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-9 text-sm font-medium text-garabandal-dark shadow-sm outline-none transition focus:border-garabandal-gold focus:ring-2 focus:ring-garabandal-gold/30 sm:w-auto"
            >
              <option value="recent">{s.sortRecent}</option>
              <option value="old">{s.sortOld}</option>
              <option value="az">{s.sortAz}</option>
            </select>
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
          </div>
        </div>

        {/* Tag chips */}
        {tags.length > 0 && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Chip active={activeTag === null} onClick={() => setActiveTag(null)}>
              {s.all}
            </Chip>
            {tags.map((tag) => (
              <Chip key={tag} active={activeTag === tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)}>
                {tag}
              </Chip>
            ))}
          </div>
        )}

        {/* Result count */}
        <p className="text-sm text-slate-400">
          {filtered.length} {filtered.length === 1 ? s.result : s.results}
        </p>
      </div>

      {/* RESULTS */}
      {pageItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
          <p className="font-serif text-xl text-garabandal-dark">{s.none}</p>
          <p className="mt-2 text-sm text-slate-500">{s.noneHint}</p>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setActiveTag(null);
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-garabandal-gold/20 px-5 py-2.5 text-sm font-bold text-garabandal-dark transition hover:bg-garabandal-gold"
            >
              {s.clear}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((item) => (
              <ContentCard key={item.id} item={item} read={s.read} />
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination
              current={current}
              total={totalPages}
              onChange={goTo}
              labels={{ prev: s.prev, next: s.next, page: s.page, of: s.of }}
            />
          )}
        </>
      )}
    </div>
  );
}

function Pagination({
  current,
  total,
  onChange,
  labels,
}: {
  current: number;
  total: number;
  onChange: (p: number) => void;
  labels: { prev: string; next: string; page: string; of: string };
}) {
  const pages = pageList(current, total);

  return (
    <nav aria-label="Pagination" className="mt-12 flex flex-col items-center gap-4">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(current - 1)}
          disabled={current === 1}
          aria-label={labels.prev}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-garabandal-dark transition hover:border-garabandal-gold/50 hover:bg-garabandal-gold/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white"
        >
          <ChevronLeft size={18} />
        </button>

        {pages.map((p, idx) =>
          p === '…' ? (
            <span key={`gap-${idx}`} className="px-2 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === current ? 'page' : undefined}
              className={`flex h-10 min-w-10 items-center justify-center rounded-xl border px-3 text-sm font-bold transition ${
                p === current
                  ? 'border-transparent bg-garabandal-dark text-white shadow-sm'
                  : 'border-slate-200 bg-white text-garabandal-dark hover:border-garabandal-gold/50 hover:bg-garabandal-gold/10'
              }`}
            >
              {p}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onChange(current + 1)}
          disabled={current === total}
          aria-label={labels.next}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-garabandal-dark transition hover:border-garabandal-gold/50 hover:bg-garabandal-gold/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <p className="text-xs uppercase tracking-widest text-slate-400">
        {labels.page} {current} {labels.of} {total}
      </p>
    </nav>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium capitalize transition ${
        active
          ? 'border-transparent bg-garabandal-dark text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-600 hover:border-garabandal-gold/50 hover:text-garabandal-dark'
      }`}
    >
      {children}
    </button>
  );
}

export function ContentCard({ item, read }: { item: BrowseItem; read: string }) {
  return (
    <Link
      href={item.href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
        {item.cover && (
          <Image
            src={item.cover}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-serif text-xl font-bold leading-snug text-garabandal-dark">{item.title}</h3>
        {item.excerpt && (
          <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600">{item.excerpt}</p>
        )}
        <span className="mt-5 inline-flex w-fit items-center gap-2 rounded-xl bg-garabandal-gold/20 px-5 py-2.5 text-sm font-bold text-garabandal-dark shadow-sm transition-colors group-hover:bg-garabandal-gold">
          {read}
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
