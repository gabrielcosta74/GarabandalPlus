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
import { CATEGORIES, PUBLIC_NAV_ORDER, localePrefix, type CategoryKey, type PublicLocale } from '../../lib/cms/categories';
import {
  cmsListPublishedByCategory,
  type NavItem,
} from '../../lib/cms/queries';
import { PUBLISHED_ONLY } from '../../lib/content/preview';
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
  locale: PublicLocale;
};

const ICONS: Record<CategoryKey, typeof Scroll> = {
  historia: Scroll,
  ensinamentos: BookOpen,
  mensagens: MessageCircleHeart,
  testemunhos: Users,
  profecias: Sparkles,
  noticias: Info,
};

// Unique, factual descriptive prose per category. Gives the landing pages real
// editorial depth (vs. a thin list of links) and topical relevance for queries
// like "história de garabandal" / "mensagens de garabandal". Kept conservative
// and consistent with the category intros above.
// PT and EN carry hand-written editorial prose. The other locales fall back to
// the category `intro` from categories.ts rather than shipping a machine
// translation of these paragraphs — see `overviewFor` below.
const OVERVIEW: Record<CategoryKey, Partial<Record<PublicLocale, string[]>>> = {
  historia: {
    pt: [
      'As aparições de Garabandal decorreram entre 1961 e 1965, na pequena aldeia de San Sebastián de Garabandal, no norte de Espanha. Quatro meninas — Conchita González, Jacinta González, Mari Loli Mazón e Mari Cruz González — afirmaram ver primeiro o Arcanjo São Miguel e, depois, Nossa Senhora do Carmo, em mais de duas mil aparições.',
      'Nesta secção reúne-se a cronologia dos acontecimentos, o relato dos êxtases e das marchas extáticas, o testemunho das videntes e dos sacerdotes que os acompanharam, e a posição da Igreja sobre Garabandal ao longo das décadas.',
    ],
    en: [
      'The Garabandal apparitions took place between 1961 and 1965 in the small village of San Sebastián de Garabandal, in northern Spain. Four girls — Conchita González, Jacinta González, Mari Loli Mazón and Mari Cruz González — reported seeing first Saint Michael the Archangel and then Our Lady of Mount Carmel, in more than two thousand apparitions.',
      'This section gathers the chronology of events, the accounts of the ecstasies and ecstatic marches, the testimony of the seers and the priests who accompanied them, and the position of the Church on Garabandal across the decades.',
    ],
  },
  ensinamentos: {
    pt: [
      'A mensagem de Garabandal não acrescenta nada à fé católica: chama-nos de volta ao essencial — a oração, os sacramentos, a devoção a Nossa Senhora e o seguimento sincero do Evangelho.',
      'Nesta secção reúnem-se reflexões e meditações que partem da experiência de Garabandal para iluminar a vida cristã de hoje, à luz daquilo que Nossa Senhora pediu nas suas mensagens.',
    ],
    en: [
      'The message of Garabandal adds nothing to the Catholic faith: it calls us back to the essentials — prayer, the sacraments, devotion to Our Lady, and the sincere following of the Gospel.',
      'This section gathers reflections and meditations that draw on the Garabandal experience to illuminate Christian life today, in the light of what Our Lady asked in her messages.',
    ],
  },
  mensagens: {
    pt: [
      'Em Garabandal, Nossa Senhora deixou duas mensagens públicas. A primeira, a 18 de Outubro de 1961, apela ao sacrifício, à penitência, à visita ao Santíssimo Sacramento e à vida segundo os mandamentos. A segunda, a 18 de Junho de 1965, transmitida pelo Arcanjo São Miguel, adverte para o afastamento crescente dos sacramentos e renova o chamamento à conversão.',
      'Aqui pode ler o texto das mensagens, o seu contexto e as meditações que delas brotam — um apelo à oração, à reparação e à proximidade com a Eucaristia.',
    ],
    en: [
      'At Garabandal, Our Lady gave two public messages. The first, on 18 October 1961, calls for sacrifice, penance, visits to the Blessed Sacrament and a life according to the commandments. The second, on 18 June 1965, delivered through Saint Michael the Archangel, warns of a growing estrangement from the sacraments and renews the call to conversion.',
      'Here you can read the text of the messages, their context, and the meditations that flow from them — a call to prayer, reparation and closeness to the Eucharist.',
    ],
  },
  testemunhos: {
    pt: [
      'Ao longo de mais de seis décadas, sacerdotes, religiosos, peregrinos e testemunhas oculares partilharam o impacto de Garabandal nas suas vidas.',
      'Aqui reúnem-se entrevistas com as videntes, memórias de quem conheceu de perto os acontecimentos, e relatos de conversão e de fé nascidos do encontro com a Mensagem.',
    ],
    en: [
      'Across more than six decades, priests, religious, pilgrims and eyewitnesses have shared the impact of Garabandal on their lives.',
      'Here you will find interviews with the seers, memoirs of those who knew the events at first hand, and accounts of conversion and faith born from the encounter with the Message.',
    ],
  },
  profecias: {
    pt: [
      'Garabandal anuncia quatro acontecimentos futuros: o Aviso, um esclarecimento universal das consciências sentido por todos; o Grande Milagre, prometido em San Sebastián de Garabandal e a anunciar com antecedência por Conchita; o Castigo, condicional e dependente da resposta da humanidade; e um sinal permanente que ficará no local do Milagre.',
      'Estas páginas reúnem o que as videntes relataram sobre cada um destes acontecimentos, sempre na fidelidade ao discernimento da Igreja.',
    ],
    en: [
      'Garabandal announces four future events: the Warning, a universal illumination of consciences felt by all; the Great Miracle, promised at San Sebastián de Garabandal and to be announced in advance by Conchita; the Chastisement, conditional and dependent on humanity\'s response; and a permanent sign that will remain at the site of the Miracle.',
      'These pages gather what the seers related about each of these events, always in fidelity to the discernment of the Church.',
    ],
  },
  noticias: {
    pt: [
      'Atualidade do Apostolado de Garabandal: eventos, peregrinações, lançamentos e comunicados.',
      'Acompanhe aqui as novidades da missão e consulte o arquivo de notícias publicadas ao longo dos anos.',
    ],
    en: [
      'News from the Apostolate of Garabandal: events, pilgrimages, releases and announcements.',
      'Follow the latest from the mission here and browse the archive of stories published over the years.',
    ],
  },
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
    section: 'A Mensagem',
    heading: (l: string) => `${l} de Garabandal`,
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
    section: 'The Message',
    heading: (l: string) => `Garabandal ${l}`,
  },
  es: {
    featured: 'Lecturas recomendadas',
    featuredSub: 'El contenido esencial para empezar.',
    all: 'Todos los contenidos',
    emptyTitle: 'Contenido próximamente',
    emptyDesc: 'Estamos preparando los artículos de esta sección. Mientras tanto, explore las demás áreas del Mensaje.',
    readMore: 'Leer',
    home: 'Inicio',
    exploreHeading: 'Explorar el Mensaje',
    exploreSub: 'Continúe su lectura por otras áreas de Garabandal.',
    section: 'El Mensaje',
    heading: (l: string) => `${l} de Garabandal`,
  },
  fr: {
    featured: 'Lectures recommandées',
    featuredSub: 'L\'essentiel pour commencer.',
    all: 'Tous les contenus',
    emptyTitle: 'Contenu à venir',
    emptyDesc: 'Nous préparons les articles de cette section. En attendant, explorez les autres domaines du Message.',
    readMore: 'Lire',
    home: 'Accueil',
    exploreHeading: 'Explorer le Message',
    exploreSub: 'Poursuivez votre lecture dans les autres domaines de Garabandal.',
    section: 'Le Message',
    heading: (l: string) => `${l} de Garabandal`,
  },
  it: {
    featured: 'Letture consigliate',
    featuredSub: 'I contenuti essenziali per iniziare.',
    all: 'Tutti i contenuti',
    emptyTitle: 'Contenuti in arrivo',
    emptyDesc: 'Stiamo preparando gli articoli di questa sezione. Nel frattempo, esplori le altre aree del Messaggio.',
    readMore: 'Leggi',
    home: 'Home',
    exploreHeading: 'Esplorare il Messaggio',
    exploreSub: 'Prosegua la lettura nelle altre aree di Garabandal.',
    section: 'Il Messaggio',
    heading: (l: string) => `${l} di Garabandal`,
  },
};

function categoryLandingHref(key: CategoryKey, locale: PublicLocale) {
  return `${localePrefix(locale)}/${CATEGORIES[key][locale].slug}`;
}

/** Editorial prose for the category, or the shorter category intro when this
 *  locale has no hand-written paragraphs yet. */
function overviewFor(category: CategoryKey, locale: PublicLocale): string[] {
  return OVERVIEW[category][locale] ?? [CATEGORIES[category][locale].intro];
}

function articleHref(item: NavItem, locale: PublicLocale) {
  const prefix = localePrefix(locale);
  return item.type === 'page' ? `${prefix}/${item.slug}` : `${prefix}/l/${item.slug}`;
}

function toBrowseItem(item: NavItem, locale: PublicLocale): BrowseItem {
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

  const all = await cmsListPublishedByCategory(category, locale, 1, 200, PUBLISHED_ONLY);
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
            <Link href={localePrefix(locale) || '/'} className="inline-flex items-center gap-1.5 transition-colors hover:text-garabandal-dark">
              <Home size={14} />
              {t.home}
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-garabandal-dark">{meta.label}</span>
          </nav>

          <span className="inline-flex items-center gap-2 rounded-full border border-garabandal-gold/30 bg-garabandal-gold/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-garabandal-dark/70">
            <Icon size={14} className="text-garabandal-gold" />
            {t.section}
          </span>

          <h1 className="mt-5 font-serif text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            {t.heading(meta.label)}
          </h1>
          <p className="mt-5 max-w-2xl text-lg font-light leading-relaxed text-slate-600">
            {meta.intro}
          </p>
        </div>
      </section>

      {/* OVERVIEW — unique descriptive prose for topical depth */}
      <section className="mx-auto w-full max-w-3xl px-4 pt-12 sm:px-6 sm:pt-14">
        <div className="space-y-4 text-base leading-relaxed text-slate-600">
          {overviewFor(category, locale).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
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
