'use client';

import type { PublicLocale } from '../../lib/cms/categories';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

/** Plain, serializable shape passed from the server page. */
export type BrowseItem = {
  id: string;
  title: string;
  href: string;
  cover: string | null;
  excerpt: string | null;
  date: string; // ISO — used for sorting
  /** Formatted on the server so SSR and hydration render the same string. */
  dateLabel: string;
  tags: string[];
};

type SortKey = 'recent' | 'old' | 'az';

const STR = {
  pt: {
    search: 'Pesquisar nesta secção…',
    all: 'Todos',
    sortLabel: 'Ordenar',
    sortRecent: 'Mais recentes',
    sortOld: 'Mais antigos',
    sortAz: 'A–Z',
    none: 'Nenhum resultado encontrado.',
    noneHint: 'Tente outra pesquisa ou limpe os filtros.',
    clear: 'Limpar filtros',
    result: 'artigo',
    results: 'artigos',
    prev: 'Página anterior',
    next: 'Página seguinte',
    prevShort: 'Anterior',
    nextShort: 'Seguinte',
  },
  en: {
    search: 'Search this section…',
    all: 'All',
    sortLabel: 'Sort',
    sortRecent: 'Newest',
    sortOld: 'Oldest',
    sortAz: 'A–Z',
    none: 'No results found.',
    noneHint: 'Try another search or clear the filters.',
    clear: 'Clear filters',
    result: 'article',
    results: 'articles',
    prev: 'Previous page',
    next: 'Next page',
    prevShort: 'Previous',
    nextShort: 'Next',
  },
  es: {
    search: 'Buscar en esta sección…',
    all: 'Todos',
    sortLabel: 'Ordenar',
    sortRecent: 'Más recientes',
    sortOld: 'Más antiguos',
    sortAz: 'A–Z',
    none: 'No se han encontrado resultados.',
    noneHint: 'Pruebe otra búsqueda o borre los filtros.',
    clear: 'Borrar filtros',
    result: 'artículo',
    results: 'artículos',
    prev: 'Página anterior',
    next: 'Página siguiente',
    prevShort: 'Anterior',
    nextShort: 'Siguiente',
  },
  fr: {
    search: 'Rechercher dans cette section…',
    all: 'Tous',
    sortLabel: 'Trier',
    sortRecent: 'Plus récents',
    sortOld: 'Plus anciens',
    sortAz: 'A–Z',
    none: 'Aucun résultat trouvé.',
    noneHint: 'Essayez une autre recherche ou effacez les filtres.',
    clear: 'Effacer les filtres',
    result: 'article',
    results: 'articles',
    prev: 'Page précédente',
    next: 'Page suivante',
    prevShort: 'Précédent',
    nextShort: 'Suivant',
  },
  it: {
    search: 'Cerca in questa sezione…',
    all: 'Tutti',
    sortLabel: 'Ordina',
    sortRecent: 'Più recenti',
    sortOld: 'Meno recenti',
    sortAz: 'A–Z',
    none: 'Nessun risultato trovato.',
    noneHint: 'Provi un\'altra ricerca o cancelli i filtri.',
    clear: 'Cancella filtri',
    result: 'articolo',
    results: 'articoli',
    prev: 'Pagina precedente',
    next: 'Pagina successiva',
    prevShort: 'Precedente',
    nextShort: 'Successiva',
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
  pageSize = 10,
}: {
  items: BrowseItem[];
  tags: string[];
  locale: PublicLocale;
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
      {/* FILTER BAR — search + sort on one line, topics as text tabs below */}
      <div className="flex items-center gap-4 border-b border-line">
        <label className="relative flex min-w-0 flex-1 items-center">
          <Search size={17} className="pointer-events-none absolute left-0 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={s.search}
            aria-label={s.search}
            className="w-full bg-transparent py-3.5 pl-7 pr-8 text-[15px] text-ink outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={s.clear}
              className="absolute right-0 rounded p-1 text-muted hover:text-ink"
            >
              <X size={16} />
            </button>
          )}
        </label>

        <label className="relative flex shrink-0 items-center">
          <span className="sr-only">{s.sortLabel}</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="cursor-pointer appearance-none bg-transparent py-3.5 pr-5 text-sm font-medium text-ink outline-none"
          >
            <option value="recent">{s.sortRecent}</option>
            <option value="old">{s.sortOld}</option>
            <option value="az">{s.sortAz}</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-0 text-muted" />
        </label>
      </div>

      {tags.length > 0 && (
        <div className="-mx-4 flex gap-6 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <TopicTab active={activeTag === null} onClick={() => setActiveTag(null)}>
            {s.all}
          </TopicTab>
          {tags.map((tag) => (
            <TopicTab key={tag} active={activeTag === tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)}>
              {tag}
            </TopicTab>
          ))}
        </div>
      )}

      <p className="mt-6 text-sm text-muted">
        {filtered.length} {filtered.length === 1 ? s.result : s.results}
      </p>

      {/* RESULTS */}
      {pageItems.length === 0 ? (
        <div className="py-16">
          <p className="text-lg font-semibold text-ink">{s.none}</p>
          <p className="mt-1.5 text-[15px] text-muted">{s.noneHint}</p>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setActiveTag(null);
              }}
              className="mt-4 text-sm font-medium text-brand underline-offset-4 hover:underline"
            >
              {s.clear}
            </button>
          )}
        </div>
      ) : (
        <>
          <div>
            {pageItems.map((item) => (
              <ArticleRow key={item.id} item={item} />
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination
              current={current}
              total={totalPages}
              onChange={goTo}
              labels={{ prev: s.prev, next: s.next, prevShort: s.prevShort, nextShort: s.nextShort }}
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
  labels: { prev: string; next: string; prevShort: string; nextShort: string };
}) {
  const pages = pageList(current, total);
  const stepClass =
    'inline-flex items-center gap-1 text-sm font-medium text-ink transition-colors hover:text-brand disabled:invisible';

  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-4">
      <button type="button" onClick={() => onChange(current - 1)} disabled={current === 1} aria-label={labels.prev} className={stepClass}>
        <ChevronLeft size={16} />
        <span className="hidden sm:inline">{labels.prevShort}</span>
      </button>

      <div className="flex items-center gap-1">
        {pages.map((p, idx) =>
          p === '…' ? (
            <span key={`gap-${idx}`} className="px-1.5 text-sm text-muted">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === current ? 'page' : undefined}
              className={`flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm tabular-nums transition-colors ${
                p === current ? 'bg-paper font-semibold text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {p}
            </button>
          ),
        )}
      </div>

      <button type="button" onClick={() => onChange(current + 1)} disabled={current === total} aria-label={labels.next} className={stepClass}>
        <span className="hidden sm:inline">{labels.nextShort}</span>
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

function TopicTab({
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
      aria-pressed={active}
      className={`-mb-px shrink-0 border-b-2 py-3 text-sm capitalize transition-colors ${
        active ? 'border-ink font-medium text-ink' : 'border-transparent text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

/** One article in the list: date, title and excerpt, thumbnail on the right.
 *  The title link is stretched over the whole row so the row is the target. */
export function ArticleRow({ item }: { item: BrowseItem }) {
  return (
    <article className="group relative flex gap-5 border-b border-line py-7 sm:gap-8">
      <div className="min-w-0 flex-1">
        <time dateTime={item.date} className="text-[13px] text-muted">
          {item.dateLabel}
        </time>
        <h3 className="mt-1.5 text-lg font-semibold leading-snug tracking-[-0.01em] text-ink transition-colors group-hover:text-brand sm:text-xl">
          <Link href={item.href} className="after:absolute after:inset-0">
            {item.title}
          </Link>
        </h3>
        {item.excerpt && (
          <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-muted">{item.excerpt}</p>
        )}
      </div>
      {item.cover && (
        <div className="relative aspect-[4/3] w-24 shrink-0 self-start overflow-hidden rounded-md bg-paper sm:w-44">
          <Image src={item.cover} alt="" fill sizes="(max-width: 640px) 96px, 176px" className="object-cover" />
        </div>
      )}
    </article>
  );
}

/** Image-led card for the "recommended" block: a large lead and smaller companions. */
export function FeatureCard({ item, lead = false }: { item: BrowseItem; lead?: boolean }) {
  return (
    <article className="group relative">
      <div className={`relative w-full overflow-hidden rounded-lg bg-paper ${lead ? 'aspect-[16/10]' : 'aspect-[16/9]'}`}>
        {item.cover && (
          <Image
            src={item.cover}
            alt=""
            fill
            sizes={lead ? '(max-width: 1024px) 100vw, 600px' : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px'}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        )}
      </div>
      <time dateTime={item.date} className="mt-4 block text-[13px] text-muted">
        {item.dateLabel}
      </time>
      <h3
        className={`mt-1.5 font-semibold text-ink transition-colors group-hover:text-brand ${
          lead ? 'text-2xl leading-tight tracking-[-0.02em] sm:text-[1.75rem]' : 'text-lg leading-snug tracking-[-0.01em]'
        }`}
      >
        <Link href={item.href} className="after:absolute after:inset-0">
          {item.title}
        </Link>
      </h3>
      {lead && item.excerpt && (
        <p className="mt-3 line-clamp-3 text-base leading-relaxed text-muted">{item.excerpt}</p>
      )}
    </article>
  );
}
