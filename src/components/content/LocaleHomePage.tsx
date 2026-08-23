import Link from 'next/link';
import {
  ArrowUpRight,
  Scroll,
  BookOpen,
  MessageCircleHeart,
  Users,
  Sparkles,
  Info,
  Compass,
  Church,
} from 'lucide-react';
import {
  CATEGORIES,
  PUBLIC_NAV_ORDER,
  categoryHref,
  localePrefix,
  type CategoryKey,
  type PublicLocale,
} from '../../lib/cms/categories';
import { cmsListCategoryHighlights, type NavItem } from '../../lib/cms/queries';
import { PUBLISHED_ONLY } from '../../lib/content/preview';
import { APP_URL } from '../../lib/config';

/**
 * Locale landing page for /es, /fr and /it.
 *
 * These three locales had category hubs but no root: /es, /fr and /it all
 * returned 404 while every hub's breadcrumb linked to them, and the hreflang
 * mesh had nowhere to point. This is that missing root.
 *
 * It is deliberately not a translation of the PT/EN homepage. That homepage
 * and its dozen child components carry hardcoded pt|en copy; cloning it would
 * mean widening all of them and risking the two locales that actually work.
 * This page is built from the pieces that are already locale-aware (CATEGORIES
 * and the CMS queries), so it stays self-contained.
 *
 * The "what is Garabandal" block is the point of the page. It is a
 * self-contained ~150-word answer placed at the top, which is the shape and
 * position AI answer engines actually quote — and it targets the one query
 * ("what is garabandal") where the site ranks around position 59.
 */

type LocaleKey = Extract<PublicLocale, 'es' | 'fr' | 'it'>;

const ICONS: Record<CategoryKey, typeof Scroll> = {
  historia: Scroll,
  ensinamentos: BookOpen,
  mensagens: MessageCircleHeart,
  testemunhos: Users,
  profecias: Sparkles,
  noticias: Info,
};

type LocaleCopy = {
  /** BCP 47 tag used for <div lang> and schema inLanguage. */
  lang: string;
  badge: string;
  h1: string;
  lead: string;
  /** Heading of the citable definition block. Phrased as the query itself. */
  whatIsHeading: string;
  /** One self-contained paragraph. Keep it 134–167 words: that is the length
   *  AI answer engines cite most, and it has to stand alone out of context. */
  whatIs: string;
  exploreHeading: string;
  exploreSub: string;
  seeAll: string;
  elsewhereNote: string;
  pilgrimages: string;
  store: string;
};

const COPY: Record<LocaleKey, LocaleCopy> = {
  es: {
    lang: 'es',
    badge: 'Apostolado',
    h1: 'Apostolado de Garabandal',
    lead: 'Las apariciones de Nuestra Señora en San Sebastián de Garabandal: historia, mensajes, testimonios y documentación.',
    whatIsHeading: '¿Qué es Garabandal?',
    whatIs:
      'Garabandal es una aldea de montaña de Cantabria, en el norte de España, donde entre 1961 y 1965 cuatro niñas —Conchita González, Mari Loli Mazón, Jacinta González y Mari Cruz González— afirmaron ver al arcángel San Miguel y, después, a la Virgen María bajo el título de Nuestra Señora del Monte Carmelo. Las apariciones se prolongaron durante cuatro años e incluyeron más de dos mil episodios de éxtasis presenciados por miles de personas. De ellas surgieron dos mensajes públicos, fechados en 1961 y en 1965, que llaman a la conversión, a la penitencia y a la Eucaristía, junto al anuncio de tres acontecimientos futuros: el Aviso, el Milagro y el Castigo. La Iglesia no ha reconocido oficialmente las apariciones. El Apostolado de Garabandal difunde su mensaje, organiza peregrinaciones y publica documentación histórica sobre lo ocurrido en la aldea.',
    exploreHeading: 'Explora el mensaje',
    exploreSub: 'Seis secciones que reúnen todo el contenido publicado en español.',
    seeAll: 'Ver todo',
    elsewhereNote: 'Las peregrinaciones y la tienda están disponibles en inglés y portugués.',
    pilgrimages: 'Peregrinaciones',
    store: 'Tienda',
  },
  fr: {
    lang: 'fr',
    badge: 'Apostolat',
    h1: 'Apostolat de Garabandal',
    lead: 'Les apparitions de Notre-Dame à San Sebastián de Garabandal : histoire, messages, témoignages et documentation.',
    whatIsHeading: 'Qu’est-ce que Garabandal ?',
    whatIs:
      'Garabandal est un village de montagne de Cantabrie, dans le nord de l’Espagne, où, entre 1961 et 1965, quatre fillettes — Conchita González, Mari Loli Mazón, Jacinta González et Mari Cruz González — ont déclaré voir l’archange saint Michel, puis la Vierge Marie sous le titre de Notre-Dame du Mont-Carmel. Les apparitions se sont poursuivies pendant quatre ans et ont compté plus de deux mille extases observées par des milliers de témoins. Il en est ressorti deux messages publics, datés de 1961 et de 1965, qui appellent à la conversion, à la pénitence et à l’Eucharistie, ainsi que l’annonce de trois événements à venir : l’Avertissement, le Miracle et le Châtiment. L’Église n’a pas reconnu officiellement ces apparitions. L’Apostolat de Garabandal diffuse leur message, organise des pèlerinages et publie une documentation historique sur les faits survenus au village.',
    exploreHeading: 'Explorer le message',
    exploreSub: 'Six sections regroupant tout le contenu publié en français.',
    seeAll: 'Tout voir',
    elsewhereNote: 'Les pèlerinages et la boutique sont disponibles en anglais et en portugais.',
    pilgrimages: 'Pèlerinages',
    store: 'Boutique',
  },
  it: {
    lang: 'it',
    badge: 'Apostolato',
    h1: 'Apostolato di Garabandal',
    lead: 'Le apparizioni della Madonna a San Sebastián de Garabandal: storia, messaggi, testimonianze e documentazione.',
    whatIsHeading: 'Che cos’è Garabandal?',
    whatIs:
      'Garabandal è un villaggio di montagna della Cantabria, nel nord della Spagna, dove tra il 1961 e il 1965 quattro bambine — Conchita González, Mari Loli Mazón, Jacinta González e Mari Cruz González — dissero di vedere l’arcangelo san Michele e, in seguito, la Vergine Maria con il titolo di Nostra Signora del Monte Carmelo. Le apparizioni proseguirono per quattro anni e compresero più di duemila estasi osservate da migliaia di persone. Ne derivarono due messaggi pubblici, datati 1961 e 1965, che invitano alla conversione, alla penitenza e all’Eucaristia, insieme all’annuncio di tre eventi futuri: l’Avviso, il Miracolo e il Castigo. La Chiesa non ha riconosciuto ufficialmente le apparizioni. L’Apostolato di Garabandal ne diffonde il messaggio, organizza pellegrinaggi e pubblica documentazione storica sui fatti avvenuti nel villaggio.',
    exploreHeading: 'Esplora il messaggio',
    exploreSub: 'Sei sezioni con tutti i contenuti pubblicati in italiano.',
    seeAll: 'Vedi tutto',
    elsewhereNote: 'I pellegrinaggi e il negozio sono disponibili in inglese e in portoghese.',
    pilgrimages: 'Pellegrinaggi',
    store: 'Negozio',
  },
};

/** Every category, in reading order. PUBLIC_NAV_ORDER omits `noticias`
 *  because the header dropdown does; a landing page should still list it. */
const ALL_CATEGORIES: CategoryKey[] = [...PUBLIC_NAV_ORDER, 'noticias'];

function articleHref(item: NavItem, locale: PublicLocale) {
  const prefix = localePrefix(locale);
  return item.type === 'page' ? `${prefix}/${item.slug}` : `${prefix}/l/${item.slug}`;
}

export async function LocaleHomePage({ locale }: { locale: LocaleKey }) {
  const t = COPY[locale];
  const prefix = localePrefix(locale);

  const highlights = await Promise.all(
    ALL_CATEGORIES.map((key) =>
      cmsListCategoryHighlights(key, locale, { limit: 3, statuses: PUBLISHED_ONLY }),
    ),
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${APP_URL}${prefix}#webpage`,
    url: `${APP_URL}${prefix}`,
    name: t.h1,
    description: t.lead,
    inLanguage: t.lang,
    isPartOf: { '@id': `${APP_URL}/#website` },
    publisher: { '@id': `${APP_URL}/#organization` },
    about: {
      '@type': 'Place',
      name: 'San Sebastián de Garabandal',
      address: {
        '@type': 'PostalAddress',
        addressRegion: 'Cantabria',
        addressCountry: 'ES',
      },
    },
  };

  return (
    <main className="min-h-screen bg-garabandal-mist text-garabandal-dark">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-slate-200/70 bg-gradient-to-b from-white to-garabandal-mist">
        <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-garabandal-gold/10 blur-3xl" />
        <div className="relative mx-auto w-full max-w-5xl px-4 pb-12 pt-28 sm:px-6 sm:pb-16 sm:pt-32">
          <span className="inline-flex items-center gap-2 rounded-full border border-garabandal-gold/30 bg-garabandal-gold/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-garabandal-dark/70">
            <Church size={14} className="text-garabandal-gold" />
            {t.badge}
          </span>

          <h1 className="mt-5 font-serif text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            {t.h1}
          </h1>
          <p className="mt-5 max-w-2xl text-lg font-light leading-relaxed text-slate-600">
            {t.lead}
          </p>
        </div>
      </section>

      {/* THE CITABLE ANSWER — kept at the top, on purpose. */}
      <section className="mx-auto w-full max-w-3xl px-4 pt-12 sm:px-6 sm:pt-14">
        <h2 className="font-serif text-2xl font-bold sm:text-3xl">{t.whatIsHeading}</h2>
        <p className="mt-4 text-base leading-relaxed text-slate-600">{t.whatIs}</p>
      </section>

      {/* CATEGORIES */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mb-8 flex items-center gap-3">
          <Compass size={22} className="text-garabandal-gold" />
          <div>
            <h2 className="font-serif text-2xl font-bold sm:text-3xl">{t.exploreHeading}</h2>
            <p className="mt-1 text-sm text-slate-500">{t.exploreSub}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ALL_CATEGORIES.map((key, i) => {
            const cfg = CATEGORIES[key][locale];
            const Icon = ICONS[key];
            const items = highlights[i];
            return (
              <div
                key={key}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-shadow duration-300 hover:shadow-lg"
              >
                <Link href={categoryHref(key, locale)} className="group flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-garabandal-gold/15 text-garabandal-dark">
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 font-serif text-lg font-bold">
                      {cfg.label}
                      <ArrowUpRight
                        size={16}
                        className="text-garabandal-gold opacity-0 transition-opacity group-hover:opacity-100"
                      />
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500">
                      {cfg.tagline}
                    </p>
                  </div>
                </Link>

                {items.length > 0 && (
                  <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                    {items.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={articleHref(item, locale)}
                          className="line-clamp-2 text-sm leading-snug text-slate-600 transition-colors hover:text-garabandal-dark"
                        >
                          {item.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                <Link
                  href={categoryHref(key, locale)}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-garabandal-dark hover:underline"
                >
                  {t.seeAll}
                  <ArrowUpRight size={14} className="text-garabandal-gold" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pilgrimages and the store only exist in PT and EN. Say so plainly
          rather than dropping the reader onto a page in another language. */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <p className="text-sm text-slate-500">{t.elsewhereNote}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href="/en/pilgrimages"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold transition-colors hover:border-garabandal-gold/40 hover:bg-garabandal-mist"
            >
              {t.pilgrimages}
            </Link>
            <Link
              href="/en/store"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold transition-colors hover:border-garabandal-gold/40 hover:bg-garabandal-mist"
            >
              {t.store}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

/** Shared by the three locale roots so the mesh is declared in one place. */
export function localeHomeAlternates(locale: LocaleKey) {
  return {
    canonical: `${APP_URL}/${locale}`,
    languages: {
      'pt-BR': APP_URL,
      'pt-PT': APP_URL,
      en: `${APP_URL}/en`,
      es: `${APP_URL}/es`,
      fr: `${APP_URL}/fr`,
      it: `${APP_URL}/it`,
      'x-default': APP_URL,
    },
  };
}

export { COPY as LOCALE_HOME_COPY };
