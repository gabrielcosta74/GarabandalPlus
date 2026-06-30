import Link from 'next/link';
import {
  ArrowUpRight,
  Scroll,
  BookOpen,
  MessageCircleHeart,
  Users,
  Sparkles,
  Info,
  Home,
  Compass,
} from 'lucide-react';
import { CATEGORIES, PUBLIC_NAV_ORDER, type CategoryKey } from '../../lib/cms/categories';
import {
  cmsListPublishedByCategory,
  type NavItem,
} from '../../lib/cms/queries';
import { getPublicStatuses } from '../../lib/content/preview';
import { CategoryBrowser, ContentCard, type BrowseItem } from './CategoryBrowser';

/**
 * Shared category landing page used by /historia, /ensinamentos, /mensagens,
 * /testemunhos, /profecias, /noticias and their EN counterparts.
 *
 * Light, white, mobile-first. Structure:
 *   1. Light hero: breadcrumb + category label + intro
 *   2. Recommended reads: curated highlights
 *   3. Browse all content: searchable, filterable (tags), sortable, paginated
 *   4. Empty state when nothing is published yet
 *   5. Cross-category navigation ("Explorar a Mensagem")
 */
type Props = {
  category: CategoryKey;
  locale: 'pt' | 'en';
};

const ICONS: Record<CategoryKey, typeof Scroll> = {
  historia: Scroll,
  ensinamentos: BookOpen,
  mensagens: MessageCircleHeart,
  testemunhos: Users,
  profecias: Sparkles,
  noticias: Info,
};

const CATEGORY_KEYS = new Set<string>(Object.keys(CATEGORIES));

const T = {
  pt: {
    featured: 'Recomendados para ler',
    featuredSub: 'O conteúdo essencial para começar por aqui.',
    all: 'Todos os conteúdos',
    emptyTitle: 'Conteúdo a chegar em breve',
    emptyDesc: 'Estamos a preparar os artigos desta secção. Entretanto, explore as outras áreas da Mensagem.',
    readMore: 'Ler',
    home: 'Início',
    exploreHeading: 'Explorar a Mensagem',
    exploreSub: 'Continue a sua leitura por outras áreas de Garabandal.',
  },
  en: {
    featured: 'Recommended reads',
    featuredSub: 'The essential content to begin with.',
    all: 'All content',
    emptyTitle: 'Content coming soon',
    emptyDesc: 'We are preparing the articles for this section. In the meantime, explore the other areas of the Message.',
    readMore: 'Read',
    home: 'Home',
    exploreHeading: 'Explore the Message',
    exploreSub: 'Continue your reading through other areas of Garabandal.',
  },
};

function categoryLandingHref(key: CategoryKey, locale: 'pt' | 'en') {
  const prefix = locale === 'pt' ? '' : '/en';
  return `${prefix}/${CATEGORIES[key][locale].slug}`;
}

function articleHref(item: NavItem, locale: 'pt' | 'en') {
  const prefix = locale === 'pt' ? '' : '/en';
  return item.type === 'page' ? `${prefix}/${item.slug}` : `${prefix}/l/${item.slug}`;
}

function toBrowseItem(item: NavItem, locale: 'pt' | 'en'): BrowseItem {
  const withTags = item as NavItem & { tags?: string[] };
  return {
    id: item.id,
    title: item.title,
    href: articleHref(item, locale),
    cover: item.cover_image_url ?? item.og_image_url ?? null,
    excerpt: item.meta_description ?? item.excerpt ?? null,
    date: item.published_at ?? item.updated_at,
    tags: Array.isArray(withTags.tags) ? withTags.tags : [],
  };
}

export async function CategoryIndexPage({ category, locale }: Props) {
  const cfg = CATEGORIES[category];
  const meta = cfg[locale];
  const t = T[locale];
  const Icon = ICONS[category];
  const statuses = await getPublicStatuses();

  const all = await cmsListPublishedByCategory(category, locale, 1, 200, statuses);
  const allItems = all.items;

  // "Recomendados para ler" = the essential, cornerstone content of the category.
  // Priority: editor-curated items (featured_in_nav, e.g. "A História de Garabandal")
  // come first, then the main institutional pages, then recent posts.
  const byRecency = (a: NavItem, b: NavItem) =>
    (b.published_at ?? b.updated_at).localeCompare(a.published_at ?? a.updated_at);
  const rank = (i: NavItem) => (i.featured_in_nav ? 0 : i.type === 'page' ? 1 : 2);
  const recommendedSource = [...allItems].sort(
    (a, b) => rank(a) - rank(b) || a.nav_sort_order - b.nav_sort_order || byRecency(a, b),
  );
  const recommendedItems = recommendedSource.slice(0, 3).map((i) => toBrowseItem(i, locale));

  const browseItems = allItems.map((i) => toBrowseItem(i, locale));
  const isEmpty = browseItems.length === 0;

  // Derive subtopic chips from post tags, excluding the primary category keys.
  const tagCounts = new Map<string, number>();
  for (const it of browseItems) {
    for (const tag of it.tags) {
      if (CATEGORY_KEYS.has(tag)) continue;
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const availableTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  // Other categories for cross-navigation (the 5 "A Mensagem" buckets).
  const others = PUBLIC_NAV_ORDER.filter((k) => k !== category);

  return (
    <main className="min-h-screen bg-garabandal-mist text-garabandal-dark">
      {/* HERO — light */}
      <section className="relative overflow-hidden border-b border-slate-200/70 bg-gradient-to-b from-white to-garabandal-mist">
        <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-garabandal-gold/10 blur-3xl" />
        <div className="relative mx-auto w-full max-w-5xl px-4 pb-12 pt-28 sm:px-6 sm:pb-16 sm:pt-32">
          <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-sm text-slate-500">
            <Link href={locale === 'pt' ? '/' : '/en'} className="inline-flex items-center gap-1.5 transition-colors hover:text-garabandal-dark">
              <Home size={14} />
              {t.home}
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-garabandal-dark">{meta.label}</span>
          </nav>

          <span className="inline-flex items-center gap-2 rounded-full border border-garabandal-gold/30 bg-garabandal-gold/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-garabandal-dark/70">
            <Icon size={14} className="text-garabandal-gold" />
            {locale === 'pt' ? 'A Mensagem' : 'The Message'}
          </span>

          <h1 className="mt-5 font-serif text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            {locale === 'pt' ? `${meta.label} de Garabandal` : `Garabandal ${meta.label}`}
          </h1>
          <p className="mt-5 max-w-2xl text-lg font-light leading-relaxed text-slate-600">
            {meta.intro}
          </p>
        </div>
      </section>

      {/* RECOMMENDED READS */}
      {recommendedItems.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="mb-8">
            <h2 className="font-serif text-2xl font-bold sm:text-3xl">{t.featured}</h2>
            <p className="mt-2 text-sm text-slate-500 sm:text-base">{t.featuredSub}</p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recommendedItems.map((item) => (
              <ContentCard key={item.id} item={item} read={t.readMore} />
            ))}
          </div>
        </section>
      )}

      {/* BROWSE ALL CONTENT — search + filter + sort + paginate */}
      {browseItems.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-2 sm:px-6 sm:pb-20">
          <h2 className="mb-6 font-serif text-2xl font-bold sm:text-3xl">{t.all}</h2>
          <CategoryBrowser items={browseItems} tags={availableTags} locale={locale} />
        </section>
      )}

      {/* EMPTY STATE */}
      {isEmpty && (
        <section className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:py-24">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Icon size={28} className="text-garabandal-gold" />
          </div>
          <h2 className="mt-6 font-serif text-2xl font-bold sm:text-3xl">{t.emptyTitle}</h2>
          <p className="mx-auto mt-3 max-w-md text-slate-500">{t.emptyDesc}</p>
        </section>
      )}

      {/* CROSS-CATEGORY NAVIGATION */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-8 flex items-center gap-3">
            <Compass size={22} className="text-garabandal-gold" />
            <div>
              <h2 className="font-serif text-2xl font-bold sm:text-3xl">{t.exploreHeading}</h2>
              <p className="mt-1 text-sm text-slate-500">{t.exploreSub}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((key) => {
              const oc = CATEGORIES[key][locale];
              const OIcon = ICONS[key];
              return (
                <Link
                  key={key}
                  href={categoryLandingHref(key, locale)}
                  className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-garabandal-mist/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-garabandal-gold/40 hover:bg-white hover:shadow-lg"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-garabandal-gold/15 text-garabandal-dark">
                    <OIcon size={20} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 font-serif text-lg font-bold">
                      {oc.label}
                      <ArrowUpRight size={16} className="text-garabandal-gold opacity-0 transition-opacity group-hover:opacity-100" />
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500">{oc.tagline}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
