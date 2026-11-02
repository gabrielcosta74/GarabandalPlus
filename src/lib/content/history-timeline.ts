import * as cheerio from 'cheerio';

const moments = [
  {
    date: '18 June 1961',
    iso: '1961-06-18',
    title: 'The first apparition of Saint Michael',
    description: 'The four girls encounter Saint Michael the Archangel for the first time.',
    href: '/en/a-aparicao-do-anjo-s-miguel',
    link: 'Read about the apparition of the angel',
  },
  {
    date: '2 July 1961',
    iso: '1961-07-02',
    title: 'Our Lady appears',
    description: 'Our Lady of Mount Carmel appears to the girls in Garabandal.',
    href: '/en/aparicao-de-n-senhora',
    link: 'Read about the first apparition of Our Lady',
  },
  {
    date: '18 October 1961',
    iso: '1961-10-18',
    title: 'The first message',
    description: 'The first public message calls us to sacrifice, penance and a life turned towards God.',
    href: '/en/a-primeira-mensagem',
    link: 'Read the first message',
  },
  {
    date: '18 July 1962',
    iso: '1962-07-18',
    title: 'The visible Communion',
    description: 'Conchita receives the visible Communion, an event remembered in the testimony and images preserved by the Apostolate.',
    href: '/en/o-milagre-da-hostia',
    link: 'Read about the visible Communion',
  },
  {
    date: '18 June 1965',
    iso: '1965-06-18',
    title: 'The second message',
    description: 'Saint Michael gives the second public message, calling us again to take Our Lady’s words to heart.',
    href: '/en/the-messages',
    link: 'Read the messages of Garabandal',
  },
  {
    date: '13 November 1965',
    iso: '1965-11-13',
    title: 'The last apparition at the Pines',
    description: 'Our Lady appears to Conchita for the last time at the Pines.',
    href: '/en/a-ultima-aparicao',
    link: 'Read about the last apparition',
  },
] as const;

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const timeline = `<section class="history-timeline" aria-label="Key dates in the history of Garabandal">
  <div class="history-timeline__intro">
    <div><p>Follow the first apparition of the angel, Our Lady’s visits and the messages she entrusted to the girls. Open any date to continue reading in the Apostolate’s archive.</p></div>
    <figure><img src="https://pntzzuxzjnzksubbjfvj.supabase.co/storage/v1/object/public/posts-media/21097bb6dfba6194.jpg" alt="Mari Cruz, Jacinta, Conchita and Mari Loli in a photograph from the Apostolate’s archive" width="1024" height="576" loading="lazy" decoding="async"><figcaption>The four seers of Garabandal · Apostolate archive</figcaption></figure>
  </div>
  <ol class="history-timeline__list">
    ${moments.map((moment, index) => `<li class="history-timeline__item">
      <details${index === 0 ? ' open' : ''}>
        <summary>
          <time datetime="${moment.iso}">${escapeHtml(moment.date)}</time>
          <span class="history-timeline__title">${escapeHtml(moment.title)}</span>
          <span class="history-timeline__toggle" aria-hidden="true"></span>
        </summary>
        <div class="history-timeline__detail">
          <p>${escapeHtml(moment.description)}</p>
          <a href="${moment.href}">${escapeHtml(moment.link)} <span aria-hidden="true">→</span></a>
        </div>
      </details>
    </li>`).join('')}
  </ol>
</section>`;

/** Replaces only the six-date table in the published English history page. */
export function withHistoryTimeline(html: string | null | undefined): string | null | undefined {
  if (!html) return html;
  const heading = 'The main dates of the apparitions';
  const headingIndex = html.indexOf(heading);
  if (headingIndex < 0) return html;
  const tableStart = html.indexOf('<table', headingIndex);
  const tableEnd = html.indexOf('</table>', tableStart);
  if (tableStart < 0 || tableEnd < 0 || tableStart - headingIndex > 250) return html;

  const oldTable = html.slice(tableStart, tableEnd + '</table>'.length);
  const $ = cheerio.load(oldTable, null, false);
  const tableText = $('table').text();
  if (!moments.every(({ date }) => tableText.includes(date))) return html;

  return html.slice(0, tableStart) + timeline + html.slice(tableEnd + '</table>'.length);
}
