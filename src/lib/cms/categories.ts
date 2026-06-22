/**
 * Single source of truth for the public IA categories that drive the new
 * primary navigation, the category landing pages, the mega-menu groupings,
 * sitemap entries, breadcrumbs, and hreflang pairs.
 *
 * Adding a category? Update CATEGORIES below — every consumer (nav, landing
 * routes, sitemap, sitemap-image generators) reads from here.
 *
 * NOTE about `sobre`: not in this list. Per IA decision, "Sobre o Apostolado"
 * is a single hand-built page at /sobre-o-apostolado, not a category that
 * aggregates articles. It appears as the first item in the primary nav as a
 * direct link, not a dropdown. See PUBLIC_NAV_ORDER below.
 */

export type CategoryKey =
  | 'historia'
  | 'ensinamentos'
  | 'mensagens'
  | 'testemunhos'
  | 'profecias'
  | 'noticias';

export type CategoryLocaleConfig = {
  /** URL slug used in /<slug> (PT) and /en/<slug> (EN). */
  slug: string;
  /** Human label shown in nav + breadcrumb. */
  label: string;
  /** One-line tagline for SEO meta description / nav subtitle. ≤160 chars. */
  tagline: string;
  /** Hero blurb for the category landing page. Phase C replaces with full intro. */
  intro: string;
};

export type CategoryConfig = {
  key: CategoryKey;
  /** Whether this category appears in the primary nav dropdown. `noticias`
   *  is intentionally excluded — it lives in the footer. */
  inPrimaryNav: boolean;
  /** Default header style for the category landing page. */
  headerStyle: 'dark-hero' | 'light';
  pt: CategoryLocaleConfig;
  en: CategoryLocaleConfig;
};

export const CATEGORIES: Record<CategoryKey, CategoryConfig> = {
  historia: {
    key: 'historia',
    inPrimaryNav: true,
    headerStyle: 'dark-hero',
    pt: {
      slug: 'historia',
      label: 'História',
      tagline: 'As aparições de Nossa Senhora em Garabandal — videntes, êxtases, cronologia e o reconhecimento eclesial.',
      intro: 'A história das aparições de Nossa Senhora do Carmo em San Sebastián de Garabandal — desde a primeira aparição do Arcanjo São Miguel em 1961 até hoje.',
    },
    en: {
      slug: 'history',
      label: 'History',
      tagline: 'The apparitions of Our Lady in Garabandal — seers, ecstasies, chronology, and the Church\'s position.',
      intro: 'The history of the apparitions of Our Lady of Mount Carmel in San Sebastián de Garabandal — from the first apparition of Saint Michael the Archangel in 1961 to today.',
    },
  },
  ensinamentos: {
    key: 'ensinamentos',
    inPrimaryNav: true,
    headerStyle: 'dark-hero',
    pt: {
      slug: 'ensinamentos',
      label: 'Ensinamentos',
      tagline: 'Reflexões doutrinais à luz de Garabandal — sacramentos, oração, vida cristã, temas tocados por Nossa Senhora.',
      intro: 'Os ensinamentos espirituais que florescem da experiência de Garabandal — meditações sobre a fé, os sacramentos e a vida cristã iluminadas pelas mensagens de Nossa Senhora.',
    },
    en: {
      slug: 'teachings',
      label: 'Teachings',
      tagline: 'Doctrinal reflections in the light of Garabandal — sacraments, prayer, Christian life, themes Our Lady spoke of.',
      intro: 'The spiritual teachings that flow from the Garabandal experience — meditations on faith, the sacraments, and Christian life in light of Our Lady\'s messages.',
    },
  },
  mensagens: {
    key: 'mensagens',
    inPrimaryNav: true,
    headerStyle: 'dark-hero',
    pt: {
      slug: 'mensagens',
      label: 'Mensagens',
      tagline: 'As duas mensagens de Nossa Senhora em Garabandal — 18 de Outubro de 1961 e 18 de Junho de 1965.',
      intro: 'As duas mensagens dadas por Nossa Senhora em Garabandal: a primeira a 18 de Outubro de 1961 e a segunda a 18 de Junho de 1965 — apelos urgentes à conversão, à oração e à reparação.',
    },
    en: {
      slug: 'messages',
      label: 'Messages',
      tagline: 'The two messages of Our Lady at Garabandal — October 18, 1961 and June 18, 1965.',
      intro: 'The two messages given by Our Lady at Garabandal: the first on October 18, 1961 and the second on June 18, 1965 — urgent appeals to conversion, prayer, and reparation.',
    },
  },
  testemunhos: {
    key: 'testemunhos',
    inPrimaryNav: true,
    headerStyle: 'dark-hero',
    pt: {
      slug: 'testemunhos',
      label: 'Testemunhos',
      tagline: 'Entrevistas, memórias e vivências de quem viveu, conheceu ou foi transformado por Garabandal.',
      intro: 'Entrevistas com os videntes, memórias de testemunhas oculares, e o impacto de Garabandal em sacerdotes, religiosos e peregrinos ao longo de seis décadas.',
    },
    en: {
      slug: 'testimonies',
      label: 'Testimonies',
      tagline: 'Interviews, memoirs, and lived experiences from those who knew, met, or were transformed by Garabandal.',
      intro: 'Interviews with the seers, memoirs from eyewitnesses, and the impact of Garabandal on priests, religious, and pilgrims across six decades.',
    },
  },
  profecias: {
    key: 'profecias',
    inPrimaryNav: true,
    headerStyle: 'dark-hero',
    pt: {
      slug: 'profecias',
      label: 'Profecias',
      tagline: 'O Aviso, o Milagre, o Castigo e o sinal permanente — as profecias anunciadas em Garabandal.',
      intro: 'O Aviso universal, o Grande Milagre, o Castigo condicional e o sinal permanente — as profecias dadas em Garabandal sobre o tempo presente e o que está para vir.',
    },
    en: {
      slug: 'prophecies',
      label: 'Prophecies',
      tagline: 'The Warning, the Miracle, the Chastisement, and the permanent sign — the prophecies announced at Garabandal.',
      intro: 'The universal Warning, the Great Miracle, the conditional Chastisement, and the permanent sign — the prophecies given at Garabandal about our time and what is to come.',
    },
  },
  noticias: {
    key: 'noticias',
    inPrimaryNav: false,
    headerStyle: 'light',
    pt: {
      slug: 'noticias',
      label: 'Notícias',
      tagline: 'Atualidade do Apostolado, eventos, comunicados e arquivo de notícias.',
      intro: 'Atualidade do Apostolado de Garabandal — eventos, peregrinações, comunicados e arquivo de notícias publicadas ao longo dos anos.',
    },
    en: {
      slug: 'news',
      label: 'News',
      tagline: 'Apostolate updates, events, announcements, and news archive.',
      intro: 'News and updates from the Apostolate of Garabandal — events, pilgrimages, announcements, and the archive of past stories.',
    },
  },
};

/** Order in which categories appear in the primary navigation. The
 *  institutional `sobre-o-apostolado` link is prepended at render time. */
export const PUBLIC_NAV_ORDER: CategoryKey[] = [
  'historia',
  'ensinamentos',
  'mensagens',
  'testemunhos',
  'profecias',
];

export function getCategory(key: CategoryKey): CategoryConfig {
  return CATEGORIES[key];
}

/** Resolve PT-or-EN slug → category key. Used by the [category] dynamic route
 *  to look up which bucket the URL is asking for. */
export function categoryFromSlug(slug: string, locale: 'pt' | 'en'): CategoryKey | null {
  for (const cat of Object.values(CATEGORIES)) {
    if (cat[locale].slug === slug) return cat.key;
  }
  return null;
}

/** All public-facing slugs across PT + EN. Used for sitemap + middleware
 *  short-circuits. */
export function allCategorySlugs(): Array<{ locale: 'pt' | 'en'; slug: string; key: CategoryKey }> {
  const out: Array<{ locale: 'pt' | 'en'; slug: string; key: CategoryKey }> = [];
  for (const cat of Object.values(CATEGORIES)) {
    out.push({ locale: 'pt', slug: cat.pt.slug, key: cat.key });
    out.push({ locale: 'en', slug: cat.en.slug, key: cat.key });
  }
  return out;
}
