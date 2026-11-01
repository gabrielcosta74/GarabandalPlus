'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { ArticleHero } from '../../../components/content/ArticleHero';
import './typography-preview.css';

const options = [
  {"id": "current", "name": "Anterior", "heading": "var(--font-playfair), Georgia, serif", "body": "var(--font-inter), sans-serif", "pair": "Playfair Display + Inter", "character": "Referência do site", "note": "A combinação anterior, antes da escolha de Inter para os artigos."},
  {"id": "onest", "name": "Onest", "heading": "var(--type-onest), sans-serif", "body": "var(--type-onest), sans-serif", "pair": "Onest", "character": "Discreta · polida", "note": "A minha primeira candidata: um aspeto limpo e cuidado, sem chamar demasiado a atenção para a fonte."},
  {"id": "hanken", "name": "Hanken Grotesk", "heading": "var(--type-hanken), sans-serif", "body": "var(--type-hanken), sans-serif", "pair": "Hanken Grotesk", "character": "Sóbria · equilibrada", "note": "Uma alternativa sóbria, com títulos firmes e parágrafos visualmente equilibrados."},
  {"id": "albert", "name": "Albert Sans", "heading": "var(--type-albert), sans-serif", "body": "var(--type-albert), sans-serif", "pair": "Albert Sans", "character": "Leve · geométrica", "note": "Linhas simples e um ritmo mais geométrico, para um artigo com bastante espaço para respirar."},
  {"id": "figtree", "name": "Figtree", "heading": "var(--type-figtree), sans-serif", "body": "var(--type-figtree), sans-serif", "pair": "Figtree", "character": "Suave · natural", "note": "Uma opção suave e pouco formal, que mantém o texto acessível e a página cuidada."},
  {"id": "schibsted", "name": "Schibsted Grotesk", "heading": "var(--type-schibsted), sans-serif", "body": "var(--type-schibsted), sans-serif", "pair": "Schibsted Grotesk", "character": "Precisa · editorial", "note": "Uma candidata a experimentar se procuras um aspeto editorial contemporâneo e discreto."},
  {"id": "franklin", "name": "Libre Franklin", "heading": "var(--type-franklin), sans-serif", "body": "var(--type-franklin), sans-serif", "pair": "Libre Franklin", "character": "Clássica · profissional", "note": "Uma sans com um toque mais clássico, para artigos sóbrios e páginas institucionais."},
  {"id": "commissioner", "name": "Commissioner", "heading": "var(--type-commissioner), sans-serif", "body": "var(--type-commissioner), sans-serif", "pair": "Commissioner", "character": "Distinta · contida", "note": "Tem alguma personalidade nos detalhes, mantendo uma aparência contida no corpo do artigo."},
  {"id": "archivo", "name": "Archivo", "heading": "var(--type-archivo), sans-serif", "body": "var(--type-archivo), sans-serif", "pair": "Archivo", "character": "Firme · compacta", "note": "Uma opção com mais presença, para comparar com as alternativas mais leves."},
  {"id": "chivo", "name": "Chivo", "heading": "var(--type-chivo), sans-serif", "body": "var(--type-chivo), sans-serif", "pair": "Chivo", "character": "Sólida · gráfica", "note": "Uma textura mais firme nos parágrafos e títulos com presença."},
  {"id": "asap", "name": "Asap", "heading": "var(--type-asap), sans-serif", "body": "var(--type-asap), sans-serif", "pair": "Asap", "character": "Aberta · prática", "note": "Uma alternativa simples e informal, para avaliar sobretudo nos parágrafos longos."},
  {"id": "assistant", "name": "Assistant", "heading": "var(--type-assistant), sans-serif", "body": "var(--type-assistant), sans-serif", "pair": "Assistant", "character": "Arejada · discreta", "note": "Um desenho mais estreito e leve, com menos peso visual na página."},
  {"id": "instrument", "name": "Instrument Sans", "heading": "var(--type-instrument), sans-serif", "body": "var(--type-instrument), sans-serif", "pair": "Instrument Sans", "character": "Refinada · moderna", "note": "Uma opção com detalhes mais distintos, sem perder uma aparência sóbria."},
  {"id": "public", "name": "Public Sans", "heading": "var(--type-public), sans-serif", "body": "var(--type-public), sans-serif", "pair": "Public Sans", "character": "Neutra · institucional", "note": "Uma aparência neutra e profissional, útil para comparar artigos e páginas informativas."},
  {"id": "plex", "name": "IBM Plex Sans", "heading": "var(--type-plex), sans-serif", "body": "var(--type-plex), sans-serif", "pair": "IBM Plex Sans", "character": "Precisa · humana", "note": "Detalhes reconhecíveis e um tom mais técnico. Vale a pena comparar no texto corrido."},
  {"id": "source-sans", "name": "Source Sans 3", "heading": "var(--type-source-sans), sans-serif", "body": "var(--type-source-sans), sans-serif", "pair": "Source Sans 3", "character": "Fluida · editorial", "note": "Uma alternativa de aspeto leve, especialmente interessante para comparar no corpo do artigo."},
  {"id": "dm-sans", "name": "DM Sans", "heading": "var(--type-dm-sans), sans-serif", "body": "var(--type-dm-sans), sans-serif", "pair": "DM Sans", "character": "Versátil · limpa", "note": "Uma referência moderna e equilibrada, para comparar com as opções menos habituais."},
  {"id": "inter", "name": "Inter", "heading": "var(--font-inter), sans-serif", "body": "var(--font-inter), sans-serif", "pair": "Inter", "character": "Familiar · minimal", "note": "Uma referência discreta: também permite ver o efeito de usar a fonte atual do corpo nos títulos."},
] as const;

type FontOption = typeof options[number];
type FontStyle = CSSProperties & { '--font-serif': string; '--font-sans': string; '--article-heading-font': string; '--article-font': string };

function Sample({ font, cover, articleBody, kind }: {
  font: FontOption;
  cover: string | null;
  articleBody: ReactNode;
  kind: 'post' | 'page';
}) {
  const style: FontStyle = { '--font-serif': font.heading, '--font-sans': font.body, '--article-heading-font': font.heading, '--article-font': font.body };
  return (
    <section className="type-sample" style={style} aria-label={`Pré-visualização: ${font.pair}`}>
      <div className="type-sample-caption"><strong>{font.name}</strong><span>{font.pair}</span></div>
      <ArticleHero
        variant={kind}
        title="Filme Garabandal: onde ver em português"
        subtitle="Conheça as versões oficiais em português de Portugal e do Brasil e a participação do Apostolado na tradução."
        coverImage={cover}
        breadcrumbs={[{ label: 'Início' }, { label: kind === 'post' ? 'Artigos' : 'Páginas' }]}
        meta={kind === 'post' ? <span className="type-article-meta">6 min de leitura</span> : null}
      />
      <div className="type-reading">{articleBody}</div>
    </section>
  );
}

export default function TypographyPreview({ cover, articleBody }: { cover: string | null; articleBody: ReactNode }) {
  const [selected, setSelected] = useState<FontOption['id']>('inter');
  const [compare, setCompare] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [showCover, setShowCover] = useState(false);
  const [kind, setKind] = useState<'post' | 'page'>('post');
  const [bodySize, setBodySize] = useState('original');
  const [titleWeight, setTitleWeight] = useState('600');
  const [copied, setCopied] = useState(false);
  const active = options.find((option) => option.id === selected) ?? options[0];

  function chooseFont(id: FontOption['id']) {
    setSelected(id);
    setCopied(false);
  }

  function stepFont(direction: number) {
    const index = options.findIndex((font) => font.id === selected);
    chooseFont(options[(index + direction + options.length) % options.length].id);
  }

  async function copyChoice() {
    try {
      await navigator.clipboard.writeText(`Escolho ${active.pair} para os posts e páginas do CMS. Títulos: ${titleWeight}; texto: ${bodySize === 'original' ? 'tamanho atual' : bodySize}.`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="typography-lab">
      <header className="type-lab-heading">
        <div><p className="type-eyebrow">APOSTOLADO DE GARABANDAL · ESTUDO TIPOGRÁFICO</p><h1>Uma nova forma de ler.</h1><p>18 opções discretas e profissionais no template real. Usa as setas para comparar o mesmo artigo.</p></div>
        <span className="type-preview-badge">Pré-visualização · sem publicar</span>
      </header>
      <div className="type-selector">
        <label>Fonte a experimentar<select value={selected} onChange={(event) => chooseFont(event.target.value as FontOption['id'])}>{options.map((font, index) => <option key={font.id} value={font.id}>{index + 1}. {font.name}</option>)}</select></label>
        <button type="button" onClick={() => stepFont(-1)} aria-label="Fonte anterior">←</button>
        <button type="button" onClick={() => stepFont(1)} aria-label="Próxima fonte">→</button>
        <span>{options.findIndex((font) => font.id === selected) + 1} / {options.length}</span>
      </div>
      <details className="type-catalog">
        <summary>Ver as {options.length} opções de tipografia</summary>
        <nav className="type-options" aria-label="Combinações de fontes">
          {options.map((font) => (
            <button type="button" key={font.id} aria-pressed={selected === font.id} onClick={() => chooseFont(font.id)}>
              <strong style={{ fontFamily: font.heading }}>{font.name}</strong>
              <span className="type-font-sample" style={{ fontFamily: font.body }}>Fé, história e memória.</span>
              <span>{font.character}</span>
            </button>
          ))}
        </nav>
      </details>
      <div className="type-controls">
        <div className="type-toggles">
          <label><input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} />Lado a lado</label>
          <label><input type="checkbox" checked={mobile} onChange={(event) => setMobile(event.target.checked)} />Telemóvel</label>
          <label><input type="checkbox" checked={showCover} onChange={(event) => setShowCover(event.target.checked)} />Com capa</label>
          <label>Template<select value={kind} onChange={(event) => setKind(event.target.value as 'post' | 'page')}><option value="post">Artigo</option><option value="page">Página</option></select></label>
          <label>Títulos<select value={titleWeight} onChange={(event) => setTitleWeight(event.target.value)}><option value="500">Médio · 500</option><option value="600">Semibold · 600</option><option value="700">Bold · 700</option></select></label>
          <label>Texto<select value={bodySize} onChange={(event) => setBodySize(event.target.value)}><option value="original">Tamanho atual</option><option value="18px">18 px</option><option value="19px">19 px</option><option value="20px">20 px</option></select></label>
        </div>
        <button className="type-choice" type="button" onClick={copyChoice}>{copied ? 'Escolha copiada' : 'Copiar a minha escolha'}</button>
      </div>
      <div className="type-active" aria-live="polite"><strong>{active.pair}</strong><span>{active.note}</span></div>
      <div
        className={`type-grid${compare ? ' is-comparing' : ''}${mobile ? ' is-mobile' : ''}`}
        style={{ '--type-title-weight': titleWeight, ...(bodySize === 'original' ? {} : { '--type-body-size': bodySize }) } as CSSProperties}
      >
        {compare ? <Sample font={options[0]} cover={showCover ? cover : null} articleBody={articleBody} kind={kind} /> : null}
        <Sample font={active} cover={showCover ? cover : null} articleBody={articleBody} kind={kind} />
      </div>
      <footer className="type-lab-footer">Compara também as palavras em negrito, as citações e a leitura no telemóvel. O layout e os tamanhos são iguais entre as versões.</footer>
    </main>
  );
}
