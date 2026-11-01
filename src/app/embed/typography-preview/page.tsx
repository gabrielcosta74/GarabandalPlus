import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Onest, Hanken_Grotesk, Albert_Sans, Figtree, Schibsted_Grotesk, Libre_Franklin, Commissioner, Archivo, Chivo, Asap, Assistant, Instrument_Sans, Public_Sans, IBM_Plex_Sans, Source_Sans_3, DM_Sans } from 'next/font/google';
import { ArticleBody } from '../../../components/content/ArticleBody';
import TypographyPreview from './TypographyPreview';

const onest = Onest({ subsets: ['latin'], variable: '--type-onest', display: 'swap', preload: false });
const hanken = Hanken_Grotesk({ subsets: ['latin'], variable: '--type-hanken', display: 'swap', preload: false });
const albert = Albert_Sans({ subsets: ['latin'], variable: '--type-albert', display: 'swap', preload: false });
const figtree = Figtree({ subsets: ['latin'], variable: '--type-figtree', display: 'swap', preload: false });
const schibsted = Schibsted_Grotesk({ subsets: ['latin'], variable: '--type-schibsted', display: 'swap', preload: false });
const franklin = Libre_Franklin({ subsets: ['latin'], variable: '--type-franklin', display: 'swap', preload: false });
const commissioner = Commissioner({ subsets: ['latin'], variable: '--type-commissioner', display: 'swap', preload: false });
const archivo = Archivo({ subsets: ['latin'], variable: '--type-archivo', display: 'swap', preload: false });
const chivo = Chivo({ subsets: ['latin'], variable: '--type-chivo', display: 'swap', preload: false });
const asap = Asap({ subsets: ['latin'], variable: '--type-asap', display: 'swap', preload: false });
const assistant = Assistant({ subsets: ['latin'], variable: '--type-assistant', display: 'swap', preload: false });
const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--type-instrument', display: 'swap', preload: false });
const publicSans = Public_Sans({ subsets: ['latin'], variable: '--type-public', display: 'swap', preload: false });
const plex = IBM_Plex_Sans({ subsets: ['latin'], variable: '--type-plex', display: 'swap', preload: false });
const sourceSans = Source_Sans_3({ subsets: ['latin'], variable: '--type-source-sans', display: 'swap', preload: false });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--type-dm-sans', display: 'swap', preload: false });

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: { absolute: 'Comparar tipografia — Apostolado de Garabandal' },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default async function TypographyPreviewPage() {
  // This review tool must never expose local fixtures on a production site.
  if (process.env.NODE_ENV !== 'development') notFound();

  const directory = path.join(process.cwd(), 'docs/seo/2026-10-27/lote-1');
  const [introduction, snapshotText] = await Promise.all([
    readFile(path.join(directory, 'filme-introducao.html'), 'utf8'),
    readFile(path.join(directory, 'cms-snapshot.json'), 'utf8'),
  ]);
  const snapshot = JSON.parse(snapshotText) as {
    pages: Array<{ slug: string; locale: string; og_image_url: string | null }>;
  };
  const film = snapshot.pages.find((entry) => entry.slug === 'filme-no-cinema' && entry.locale === 'pt');
  const html = introduction.replace(/<h2>Arquivo da tradução e divulgação<\/h2>[\s\S]*$/, '') + `
    <h2>Uma história que convida a aprofundar</h2>
    <p>O filme pode despertar o interesse por Garabandal. Para conhecer uma citação ou avaliar um relato em detalhe, consulte os textos e as fontes identificadas nas páginas do Apostolado.</p>
    <blockquote><p>«Mãe, concede a este filme, a tua bênção.»</p></blockquote>
    <p>Esta oração acompanhava o início de cada dia de trabalho da equipa, segundo o relato preservado no arquivo do Apostolado.</p>
    <h3>Duas formas de acompanhar o filme</h3>
    <ul><li><strong>Português de Portugal:</strong> versão com legendas.</li><li><strong>Português do Brasil:</strong> versão com áudio em português.</li></ul>
    <p>Oração, fé, Eucaristia e conversão: palavras com acentos e ritmos diferentes, para comparar a leitura de cada família tipográfica.</p>`;

  return (
    <div className={[onest.variable, hanken.variable, albert.variable, figtree.variable, schibsted.variable, franklin.variable, commissioner.variable, archivo.variable, chivo.variable, asap.variable, assistant.variable, instrument.variable, publicSans.variable, plex.variable, sourceSans.variable, dmSans.variable].join(' ')}>
      <TypographyPreview
        cover={film?.og_image_url ?? null}
        articleBody={<ArticleBody html={html} />}
      />
    </div>
  );
}
