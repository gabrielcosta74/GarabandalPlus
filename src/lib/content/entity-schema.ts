import type { ContentLocale } from './queries';

/**
 * Extra structured data for entity hub pages.
 *
 * Most content pages need nothing beyond Article + BreadcrumbList, which the
 * route already emits. A handful of pages are *about a thing* — a seer, a
 * place, an event — and those earn Person/Place plus an FAQPage built from the
 * questions the page actually answers.
 *
 * Keyed by slug because the slug is shared across locales in this CMS.
 *
 * Google requires FAQ structured data to mirror Q&A that is visible on the
 * page. Every question and answer below is written verbatim from the rendered
 * copy — if you edit one, edit the other.
 */

type FaqItem = { q: string; a: string };

type EntityDefinition = {
  person?: {
    name: string;
    alternateName?: string[];
    birthDate?: string;
    birthPlace?: string;
    /** One-line description per locale. */
    description: Partial<Record<ContentLocale, string>>;
  };
  faq?: Partial<Record<ContentLocale, FaqItem[]>>;
};

const ENTITIES: Record<string, EntityDefinition> = {
  'conchita-gonzalez': {
    person: {
      name: 'Conchita González',
      alternateName: ['María Concepción González González', 'Conchita of Garabandal'],
      birthDate: '1949-02-07',
      birthPlace: 'San Sebastián de Garabandal, Cantabria, Spain',
      description: {
        pt: 'Uma das quatro videntes das aparições de Garabandal (1961-1965). Vive em Long Island, Nova Iorque.',
        en: 'One of the four seers of the Garabandal apparitions (1961-1965). She lives in Long Island, New York.',
      },
    },
    faq: {
      pt: [
        {
          q: 'A Conchita de Garabandal ainda é viva?',
          a: 'Sim. Segundo os registos do Apostolado de Garabandal, Conchita González vive em Long Island, no estado de Nova Iorque, para onde se mudou em 1972. É viúva desde 2013 e tem quatro filhos.',
        },
        {
          q: 'Onde vive a Conchita hoje?',
          a: 'Em Long Island, Nova Iorque. Instalou-se ali depois de deixar Espanha em 1972 e foi lá que casou, a 26 de Maio de 1973. Tem também casa em Fátima, em Portugal, onde permanece durante algumas temporadas.',
        },
        {
          q: 'Porque é que a Conchita não fala sobre Garabandal?',
          a: 'Porque entende que já disse tudo. As quatro videntes, hoje adultas, não querem ser abordadas sobre os acontecimentos: está documentado em livros, e a decisão delas merece respeito. Conchita vive de forma discreta e não mantém contacto com grupos para falar do assunto.',
        },
        {
          q: 'Quando foi a última vez que a Conchita falou sobre Garabandal?',
          a: 'Em 2011, nos 50 anos das aparições, a pedido do pároco de Garabandal, o Padre Rolando. Escreveu-lhe uma carta datada de 17 de Maio de 2011, na qual se limita a repetir a mensagem de Nossa Senhora.',
        },
      ],
      en: [
        {
          q: 'Is Conchita of Garabandal still alive?',
          a: 'Yes. According to the records of the Garabandal Apostolate, Conchita González lives in Long Island, New York, where she moved in 1972. She has been a widow since 2013 and has four children.',
        },
        {
          q: 'Where does Conchita live today?',
          a: 'In Long Island, New York. She settled there after leaving Spain in 1972, and it is where she married on 26 May 1973. She also keeps a house in Fátima, Portugal, where she stays for parts of the year.',
        },
        {
          q: 'Why does Conchita not speak about Garabandal?',
          a: 'Because she considers that everything has been said. The four seers, now adults, do not wish to be approached about the events: it is documented in books, and their decision deserves respect. Conchita lives quietly and keeps no contact with groups who want to discuss the subject.',
        },
        {
          q: 'When did Conchita last speak about Garabandal?',
          a: 'In 2011, for the 50th anniversary of the apparitions, at the request of the parish priest of Garabandal, Fr. Rolando. She wrote him a letter dated 17 May 2011 in which she simply repeats Our Lady’s message.',
        },
      ],
    },
  },
};

/**
 * Structured-data blocks to append to a content page's JSON-LD, or an empty
 * array when the slug is not an entity hub.
 */
export function entityJsonLd(
  kind: 'page' | 'post',
  locale: ContentLocale,
  slug: string,
): object[] {
  if (kind !== 'page') return [];
  const entity = ENTITIES[slug];
  if (!entity) return [];

  const blocks: object[] = [];

  if (entity.person?.description[locale]) {
    const p = entity.person;
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: p.name,
      alternateName: p.alternateName,
      birthDate: p.birthDate,
      birthPlace: p.birthPlace ? { '@type': 'Place', name: p.birthPlace } : undefined,
      description: p.description[locale],
    });
  }

  const faq = entity.faq?.[locale];
  if (faq?.length) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    });
  }

  return blocks;
}
