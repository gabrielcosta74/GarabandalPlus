import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CATEGORIES, PUBLIC_NAV_ORDER, localePrefix, type CategoryKey, type PublicLocale } from '../../lib/cms/categories';
import {
  cmsListPublishedByCategory,
  type NavItem,
} from '../../lib/cms/queries';
import { PUBLISHED_ONLY } from '../../lib/content/preview';
import { CategoryBrowser, FeatureCard, type BrowseItem } from './CategoryBrowser';

/**
 * Shared category landing page used by /historia, /ensinamentos, /mensagens,
 * /testemunhos, /profecias, /noticias and their EN counterparts.
 *
 * Editorial, white, mobile-first, Inter throughout. One left-aligned column
 * edge for everything. Structure:
 *   1. Header: breadcrumb + title + intro and overview prose in one text column
 *   2. Recommended reads: one lead story and two companions
 *   3. All articles: searchable, filterable (tags), sortable, paginated list
 *   4. Empty state when nothing is published yet
 *   5. Cross-category navigation ("Explorar a Mensagem")
 */
type Props = {
  category: CategoryKey;
  locale: PublicLocale;
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
    all: 'Todos os artigos',
    emptyTitle: 'Conteúdo a chegar em breve',
    emptyDesc: 'Estamos a preparar os artigos desta secção. Entretanto, explore as outras áreas da Mensagem.',
    home: 'Início',
    exploreHeading: 'Explorar a Mensagem',
    heading: (l: string) => `${l} de Garabandal`,
  },
  en: {
    featured: 'Recommended reads',
    all: 'All articles',
    emptyTitle: 'Content coming soon',
    emptyDesc: 'We are preparing the articles for this section. In the meantime, explore the other areas of the Message.',
    home: 'Home',
    exploreHeading: 'Explore the Message',
    heading: (l: string) => `Garabandal ${l}`,
  },
  es: {
    featured: 'Lecturas recomendadas',
    all: 'Todos los artículos',
    emptyTitle: 'Contenido próximamente',
    emptyDesc: 'Estamos preparando los artículos de esta sección. Mientras tanto, explore las demás áreas del Mensaje.',
    home: 'Inicio',
    exploreHeading: 'Explorar el Mensaje',
    heading: (l: string) => `${l} de Garabandal`,
  },
  fr: {
    featured: 'Lectures recommandées',
    all: 'Tous les articles',
    emptyTitle: 'Contenu à venir',
    emptyDesc: 'Nous préparons les articles de cette section. En attendant, explorez les autres domaines du Message.',
    home: 'Accueil',
    exploreHeading: 'Explorer le Message',
    heading: (l: string) => `${l} de Garabandal`,
  },
  it: {
    featured: 'Letture consigliate',
    all: 'Tutti gli articoli',
    emptyTitle: 'Contenuti in arrivo',
    emptyDesc: 'Stiamo preparando gli articoli di questa sezione. Nel frattempo, esplori le altre aree del Messaggio.',
    home: 'Home',
    exploreHeading: 'Esplorare il Messaggio',
    heading: (l: string) => `${l} di Garabandal`,
  },
};

function categoryLandingHref(key: CategoryKey, locale: PublicLocale) {
  return `${localePrefix(locale)}/${CATEGORIES[key][locale].slug}`;
}

/** Editorial prose for the category. Locales without hand-written paragraphs
 *  show only the category intro, which the header already renders. */
function overviewFor(category: CategoryKey, locale: PublicLocale): string[] {
  return OVERVIEW[category][locale] ?? [];
}

const DATE_LOCALE: Record<PublicLocale, string> = {
  pt: 'pt-PT',
  en: 'en-GB',
  es: 'es-ES',
  fr: 'fr-FR',
  it: 'it-IT',
};

function formatDate(iso: string, locale: PublicLocale) {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

function articleHref(item: NavItem, locale: PublicLocale) {
  const prefix = localePrefix(locale);
  return item.type === 'page' ? `${prefix}/${item.slug}` : `${prefix}/l/${item.slug}`;
}

function toBrowseItem(item: NavItem, locale: PublicLocale): BrowseItem {
  const withTags = item as NavItem & { tags?: string[] };
  const date = item.published_at ?? item.updated_at;
  return {
    id: item.id,
    title: item.title,
    href: articleHref(item, locale),
    cover: item.cover_image_url ?? item.og_image_url ?? null,
    excerpt: item.meta_description ?? item.excerpt ?? null,
    date,
    dateLabel: formatDate(date, locale),
    tags: Array.isArray(withTags.tags) ? withTags.tags : [],
  };
}

export async function CategoryIndexPage({ category, locale }: Props) {
  const cfg = CATEGORIES[category];
  const meta = cfg[locale];
  const t = T[locale];

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

  const [lead, ...companions] = recommendedItems;

  return (
    <main className="min-h-screen bg-white font-sans text-ink">
      {/* HEADER */}
      <header className="mx-auto w-full max-w-5xl px-4 pb-14 pt-28 sm:px-6 sm:pb-20 sm:pt-36">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted">
          <Link href={localePrefix(locale) || '/'} className="transition-colors hover:text-ink">
            {t.home}
          </Link>
          <span aria-hidden className="text-slate-300">/</span>
          <span className="text-ink">{meta.label}</span>
        </nav>

        <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-[-0.025em] sm:text-5xl lg:text-[3.5rem]">
          {t.heading(meta.label)}
        </h1>

        <div className="mt-6 max-w-[42rem]">
          <p className="text-lg leading-relaxed text-ink-soft sm:text-xl sm:leading-relaxed">{meta.intro}</p>
          {overviewFor(category, locale).map((para, i) => (
            <p key={i} className="mt-4 text-base leading-[1.75] text-muted">
              {para}
            </p>
          ))}
        </div>
      </header>

      {/* RECOMMENDED READS */}
      {lead && (
        <section className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <SectionHeading>{t.featured}</SectionHeading>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-12">
            <FeatureCard item={lead} lead />
            {companions.length > 0 && (
              <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-1 lg:content-start">
                {companions.map((item) => (
                  <FeatureCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ALL ARTICLES — search + filter + sort + paginate */}
      {browseItems.length > 0 && (
        <section className="mx-auto w-full max-w-5xl px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20">
          <SectionHeading>{t.all}</SectionHeading>
          <div className="max-w-3xl">
            <CategoryBrowser items={browseItems} tags={availableTags} locale={locale} />
          </div>
        </section>
      )}

      {/* EMPTY STATE */}
      {isEmpty && (
        <section className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-6">
          <div className="max-w-xl border-t border-line pt-8">
            <h2 className="text-xl font-semibold">{t.emptyTitle}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{t.emptyDesc}</p>
          </div>
        </section>
      )}

      {/* CROSS-CATEGORY NAVIGATION */}
      <nav aria-label={t.exploreHeading} className="border-t border-line bg-paper">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 className="text-xl font-semibold tracking-[-0.01em]">{t.exploreHeading}</h2>
          <ul className="mt-6 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((key) => {
              const oc = CATEGORIES[key][locale];
              return (
                <li key={key} className="border-t border-line">
                  <Link href={categoryLandingHref(key, locale)} className="group block py-5">
                    <span className="flex items-center justify-between gap-3 text-base font-semibold text-ink transition-colors group-hover:text-brand">
                      {oc.label}
                      <ArrowRight size={16} className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
                    </span>
                    <span className="mt-1 line-clamp-2 block text-sm leading-relaxed text-muted">{oc.tagline}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </main>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-8 border-t border-ink pt-4 text-xl font-semibold tracking-[-0.01em] sm:text-2xl">{children}</h2>
  );
}
