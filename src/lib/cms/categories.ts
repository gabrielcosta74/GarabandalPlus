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

/** Locales that get a public, navigable site section. PT is the unprefixed
 *  root; every other locale lives under /<locale>/. */
export type PublicLocale = 'pt' | 'en' | 'es' | 'fr' | 'it';

/** URL prefix for a locale. PT is served from the root, so it has none. */
export function localePrefix(locale: PublicLocale): string {
  return locale === 'pt' ? '' : `/${locale}`;
}

export type CategoryLocaleConfig = {
  /** URL slug used in /<slug> (PT) and /<locale>/<slug> everywhere else. */
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
  es: CategoryLocaleConfig;
  fr: CategoryLocaleConfig;
  it: CategoryLocaleConfig;
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
    es: {
      slug: 'historia',
      label: 'Historia',
      tagline: 'Las apariciones de Nuestra Señora en Garabandal — videntes, éxtasis, cronología y la posición de la Iglesia.',
      intro: 'La historia de las apariciones de Nuestra Señora del Carmen en San Sebastián de Garabandal — desde la primera aparición del Arcángel San Miguel en 1961 hasta hoy.',
    },
    fr: {
      slug: 'histoire',
      label: 'Histoire',
      tagline: 'Les apparitions de Notre-Dame à Garabandal — voyantes, extases, chronologie et la position de l\'Église.',
      intro: 'L\'histoire des apparitions de Notre-Dame du Mont-Carmel à San Sebastián de Garabandal — de la première apparition de l\'Archange saint Michel en 1961 à aujourd\'hui.',
    },
    it: {
      slug: 'storia',
      label: 'Storia',
      tagline: 'Le apparizioni della Madonna a Garabandal — veggenti, estasi, cronologia e la posizione della Chiesa.',
      intro: 'La storia delle apparizioni della Madonna del Carmine a San Sebastián de Garabandal — dalla prima apparizione dell\'Arcangelo San Michele nel 1961 a oggi.',
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
    es: {
      slug: 'ensenanzas',
      label: 'Enseñanzas',
      tagline: 'Reflexiones doctrinales a la luz de Garabandal — sacramentos, oración, vida cristiana, temas de los que habló Nuestra Señora.',
      intro: 'Las enseñanzas espirituales que brotan de la experiencia de Garabandal — meditaciones sobre la fe, los sacramentos y la vida cristiana a la luz de los mensajes de Nuestra Señora.',
    },
    fr: {
      slug: 'enseignements',
      label: 'Enseignements',
      tagline: 'Réflexions doctrinales à la lumière de Garabandal — sacrements, prière, vie chrétienne, thèmes évoqués par Notre-Dame.',
      intro: 'Les enseignements spirituels qui découlent de l\'expérience de Garabandal — méditations sur la foi, les sacrements et la vie chrétienne à la lumière des messages de Notre-Dame.',
    },
    it: {
      slug: 'insegnamenti',
      label: 'Insegnamenti',
      tagline: 'Riflessioni dottrinali alla luce di Garabandal — sacramenti, preghiera, vita cristiana, temi toccati dalla Madonna.',
      intro: 'Gli insegnamenti spirituali che nascono dall\'esperienza di Garabandal — meditazioni sulla fede, i sacramenti e la vita cristiana alla luce dei messaggi della Madonna.',
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
    es: {
      slug: 'mensajes',
      label: 'Mensajes',
      tagline: 'Los dos mensajes de Nuestra Señora en Garabandal — 18 de octubre de 1961 y 18 de junio de 1965.',
      intro: 'Los dos mensajes dados por Nuestra Señora en Garabandal: el primero el 18 de octubre de 1961 y el segundo el 18 de junio de 1965 — llamadas urgentes a la conversión, la oración y la reparación.',
    },
    fr: {
      slug: 'messages',
      label: 'Messages',
      tagline: 'Les deux messages de Notre-Dame à Garabandal — 18 octobre 1961 et 18 juin 1965.',
      intro: 'Les deux messages donnés par Notre-Dame à Garabandal : le premier le 18 octobre 1961 et le second le 18 juin 1965 — appels urgents à la conversion, à la prière et à la réparation.',
    },
    it: {
      slug: 'messaggi',
      label: 'Messaggi',
      tagline: 'I due messaggi della Madonna a Garabandal — 18 ottobre 1961 e 18 giugno 1965.',
      intro: 'I due messaggi dati dalla Madonna a Garabandal: il primo il 18 ottobre 1961 e il secondo il 18 giugno 1965 — appelli urgenti alla conversione, alla preghiera e alla riparazione.',
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
    es: {
      slug: 'testimonios',
      label: 'Testimonios',
      tagline: 'Entrevistas, memorias y vivencias de quienes conocieron, vivieron o fueron transformados por Garabandal.',
      intro: 'Entrevistas con las videntes, memorias de testigos oculares y el impacto de Garabandal en sacerdotes, religiosos y peregrinos a lo largo de seis décadas.',
    },
    fr: {
      slug: 'temoignages',
      label: 'Témoignages',
      tagline: 'Entretiens, mémoires et expériences vécues de ceux qui ont connu Garabandal ou en ont été transformés.',
      intro: 'Entretiens avec les voyantes, mémoires de témoins oculaires et l\'impact de Garabandal sur les prêtres, les religieux et les pèlerins au fil de six décennies.',
    },
    it: {
      slug: 'testimonianze',
      label: 'Testimonianze',
      tagline: 'Interviste, memorie ed esperienze vissute da chi ha conosciuto Garabandal o ne è stato trasformato.',
      intro: 'Interviste con le veggenti, memorie di testimoni oculari e l\'impatto di Garabandal su sacerdoti, religiosi e pellegrini nell\'arco di sei decenni.',
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
    es: {
      slug: 'profecias',
      label: 'Profecías',
      tagline: 'El Aviso, el Milagro, el Castigo y la señal permanente — las profecías anunciadas en Garabandal.',
      intro: 'El Aviso universal, el Gran Milagro, el Castigo condicional y la señal permanente — las profecías dadas en Garabandal sobre nuestro tiempo y lo que está por venir.',
    },
    fr: {
      slug: 'propheties',
      label: 'Prophéties',
      tagline: 'L\'Avertissement, le Miracle, le Châtiment et le signe permanent — les prophéties annoncées à Garabandal.',
      intro: 'L\'Avertissement universel, le Grand Miracle, le Châtiment conditionnel et le signe permanent — les prophéties données à Garabandal sur notre temps et sur ce qui doit venir.',
    },
    it: {
      slug: 'profezie',
      label: 'Profezie',
      tagline: 'L\'Avviso, il Miracolo, il Castigo e il segno permanente — le profezie annunciate a Garabandal.',
      intro: 'L\'Avviso universale, il Grande Miracolo, il Castigo condizionale e il segno permanente — le profezie date a Garabandal sul nostro tempo e su ciò che deve venire.',
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
    es: {
      slug: 'noticias',
      label: 'Noticias',
      tagline: 'Actualidad del Apostolado, eventos, comunicados y archivo de noticias.',
      intro: 'Actualidad del Apostolado de Garabandal — eventos, peregrinaciones, comunicados y el archivo de noticias publicadas a lo largo de los años.',
    },
    fr: {
      slug: 'actualites',
      label: 'Actualités',
      tagline: 'Actualité de l\'Apostolat, événements, communiqués et archives.',
      intro: 'L\'actualité de l\'Apostolat de Garabandal — événements, pèlerinages, communiqués et les archives des nouvelles publiées au fil des ans.',
    },
    it: {
      slug: 'notizie',
      label: 'Notizie',
      tagline: 'Attualità dell\'Apostolato, eventi, comunicati e archivio delle notizie.',
      intro: 'L\'attualità dell\'Apostolato di Garabandal — eventi, pellegrinaggi, comunicati e l\'archivio delle notizie pubblicate negli anni.',
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

export const PUBLIC_LOCALES: PublicLocale[] = ['pt', 'en', 'es', 'fr', 'it'];

/** Resolve a localised slug → category key. Used by the [category] dynamic
 *  route to look up which bucket the URL is asking for. */
export function categoryFromSlug(slug: string, locale: PublicLocale): CategoryKey | null {
  for (const cat of Object.values(CATEGORIES)) {
    if (cat[locale].slug === slug) return cat.key;
  }
  return null;
}

/** All public-facing slugs across every locale. Used for sitemap + middleware
 *  short-circuits. */
export function allCategorySlugs(): Array<{ locale: PublicLocale; slug: string; key: CategoryKey }> {
  const out: Array<{ locale: PublicLocale; slug: string; key: CategoryKey }> = [];
  for (const cat of Object.values(CATEGORIES)) {
    for (const locale of PUBLIC_LOCALES) {
      out.push({ locale, slug: cat[locale].slug, key: cat.key });
    }
  }
  return out;
}

/** Absolute path to a category landing page in a given locale. */
export function categoryHref(key: CategoryKey, locale: PublicLocale): string {
  return `${localePrefix(locale)}/${CATEGORIES[key][locale].slug}`;
}
