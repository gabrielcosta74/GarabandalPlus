import { describe, expect, it } from 'vitest';
import { entityJsonLd } from '../lib/content/entity-schema';

const enFaq = `
<h2>Is Conchita of Garabandal still alive?</h2><p>Yes. According to the records of the Garabandal Apostolate, Conchita González lives in Long Island, New York, where she moved in 1972. She has been a widow since 2013 and has four children.</p>
<h2>Where does Conchita live today?</h2><p>In Long Island, New York. She settled there after leaving Spain in 1972, and it is where she married on 26 May 1973. She also keeps a house in Fátima, Portugal, where she stays for parts of the year.</p>
<h2>Why does Conchita not speak about Garabandal?</h2><p>Because she considers that everything has been said. The four seers, now adults, do not wish to be approached about the events: it is documented in books, and their decision deserves respect. Conchita lives quietly and keeps no contact with groups who want to discuss the subject.</p>
<h2>When did Conchita last speak about Garabandal?</h2><p>In 2011, for the 50th anniversary of the apparitions, at the request of the parish priest of Garabandal, Fr. Rolando. She wrote him a letter dated 17 May 2011 in which she simply repeats Our Lady's message.</p>`;

const types = (html?: string | null) => entityJsonLd('page', 'en', 'conchita-gonzalez', html)
  .map((item) => (item as { '@type': string })['@type']);

describe('entity FAQ structured data', () => {
  it('includes FAQ markup when the visible CMS content matches, allowing typographic apostrophes', () => {
    expect(types(enFaq)).toEqual(['Person', 'FAQPage']);
  });

  it('omits stale or unavailable FAQ content while keeping person markup', () => {
    expect(types(enFaq.replace('She has been a widow since 2013', 'Her family lives nearby'))).toEqual(['Person']);
    expect(types(null)).toEqual(['Person']);
  });

  it('does not apply entity markup to posts or unrelated pages', () => {
    expect(entityJsonLd('post', 'en', 'conchita-gonzalez', enFaq)).toEqual([]);
    expect(entityJsonLd('page', 'en', 'other', enFaq)).toEqual([]);
  });
});
