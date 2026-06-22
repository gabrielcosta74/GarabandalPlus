import { FileText, Newspaper } from 'lucide-react';
import type { CmsContentType, LocaleTriple, TranslationOverview as Overview } from '../../lib/cms/queries';

// Per-language palette, reused across the cards, bars and category table so the
// same colour always means the same language at a glance.
const LOCALE = {
  pt: { label: 'PT', name: 'Português', color: '#1d4ed8', soft: 'rgba(29,78,216,0.12)' },
  en: { label: 'EN', name: 'English', color: '#15803d', soft: 'rgba(21,128,61,0.12)' },
  es: { label: 'ES', name: 'Español', color: '#7c3aed', soft: 'rgba(124,58,237,0.12)' },
  fr: { label: 'FR', name: 'Français', color: '#db2777', soft: 'rgba(219,39,119,0.12)' },
  it: { label: 'IT', name: 'Italiano', color: '#0d9488', soft: 'rgba(13,148,136,0.12)' },
} as const;

const LOCALES = ['pt', 'en', 'es', 'fr', 'it'] as const;

type Props = {
  type: CmsContentType;
  overview: Overview;
};

export function TranslationOverview({ type, overview }: Props) {
  const typeLabel = type === 'page' ? 'páginas' : 'artigos';
  const { coverage, byCategory } = overview;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Per-type language totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        <TypeCard
          icon={<FileText size={16} />}
          title="Páginas"
          triple={overview.pages}
          active={type === 'page'}
        />
        <TypeCard
          icon={<Newspaper size={16} />}
          title="Artigos"
          triple={overview.posts}
          active={type === 'post'}
        />
      </div>

      {/* Coverage for the active type */}
      <div className="cms-card" style={{ padding: '1rem 1.15rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
            Cobertura de tradução · {typeLabel}
          </strong>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            base: {coverage.ptGroups} {typeLabel} em PT
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.85rem' }}>
          <CoverageStat
            label="Completas (PT+EN+ES)"
            value={coverage.complete}
            total={coverage.ptGroups}
            color="#15803d"
          />
          <CoverageStat
            label="Com EN"
            value={coverage.en}
            total={coverage.ptGroups}
            color={LOCALE.en.color}
            missing={coverage.missingEn}
          />
          <CoverageStat
            label="Com ES"
            value={coverage.es}
            total={coverage.ptGroups}
            color={LOCALE.es.color}
            missing={coverage.missingEs}
          />
          <CoverageStat
            label="Com FR"
            value={coverage.fr}
            total={coverage.ptGroups}
            color={LOCALE.fr.color}
            missing={coverage.missingFr}
          />
          <CoverageStat
            label="Com IT"
            value={coverage.it}
            total={coverage.ptGroups}
            color={LOCALE.it.color}
            missing={coverage.missingIt}
          />
        </div>
      </div>

      {/* Per category / tag */}
      {byCategory.length > 0 && (
        <div className="cms-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.85rem 1.15rem', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
            <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
              {type === 'page' ? 'Por categoria' : 'Por etiqueta'}
            </strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', marginLeft: '0.5rem' }}>
              quantidade por língua
            </span>
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                  <th style={catTh}>{type === 'page' ? 'Categoria' : 'Etiqueta'}</th>
                  <th style={{ ...catTh, textAlign: 'right', width: 70 }}>
                    <Dot color={LOCALE.pt.color} /> PT
                  </th>
                  <th style={{ ...catTh, textAlign: 'right', width: 70 }}>
                    <Dot color={LOCALE.en.color} /> EN
                  </th>
                  <th style={{ ...catTh, textAlign: 'right', width: 70 }}>
                    <Dot color={LOCALE.es.color} /> ES
                  </th>
                  <th style={{ ...catTh, textAlign: 'right', width: 70 }}>
                    <Dot color={LOCALE.fr.color} /> FR
                  </th>
                  <th style={{ ...catTh, textAlign: 'right', width: 70 }}>
                    <Dot color={LOCALE.it.color} /> IT
                  </th>
                  <th style={{ ...catTh, width: 160 }} aria-label="cobertura" />
                </tr>
              </thead>
              <tbody>
                {byCategory.map((c) => (
                  <tr key={c.label} style={{ borderTop: '1px solid rgba(15,23,42,0.05)' }}>
                    <td style={{ ...catTd, fontWeight: 600, color: '#0f172a' }}>{c.label}</td>
                    <td style={{ ...catTd, textAlign: 'right' }}><LocaleNum n={c.pt} base={c.pt} loc="pt" /></td>
                    <td style={{ ...catTd, textAlign: 'right' }}><LocaleNum n={c.en} base={c.pt} loc="en" /></td>
                    <td style={{ ...catTd, textAlign: 'right' }}><LocaleNum n={c.es} base={c.pt} loc="es" /></td>
                    <td style={{ ...catTd, textAlign: 'right' }}><LocaleNum n={c.fr} base={c.pt} loc="fr" /></td>
                    <td style={{ ...catTd, textAlign: 'right' }}><LocaleNum n={c.it} base={c.pt} loc="it" /></td>
                    <td style={catTd}>
                      <MiniBars pt={c.pt} en={c.en} es={c.es} fr={c.fr} it={c.it} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function TypeCard({ icon, title, triple, active }: { icon: React.ReactNode; title: string; triple: LocaleTriple; active: boolean }) {
  const max = Math.max(triple.pt.total, triple.en.total, triple.es.total, triple.fr.total, triple.it.total, 1);
  return (
    <div
      className="cms-card"
      style={{
        padding: '1rem 1.15rem',
        border: active ? '1.5px solid #1d4ed8' : undefined,
        boxShadow: active ? '0 0 0 3px rgba(29,78,216,0.08)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem', color: '#0f172a' }}>
        <span style={{ display: 'inline-flex', color: '#1d4ed8' }}>{icon}</span>
        <strong style={{ fontSize: '0.98rem' }}>{title}</strong>
        {active && (
          <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1d4ed8', background: 'rgba(29,78,216,0.1)', padding: '0.12rem 0.4rem', borderRadius: 4 }}>
            a ver
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {LOCALES.map((loc) => (
          <LocaleRow key={loc} loc={loc} stat={triple[loc]} max={max} ptTotal={triple.pt.total} />
        ))}
      </div>
    </div>
  );
}

function LocaleRow({ loc, stat, max, ptTotal }: { loc: keyof typeof LOCALE; stat: LocaleTriple['pt']; max: number; ptTotal: number }) {
  const meta = LOCALE[loc];
  const widthPct = Math.round((stat.total / max) * 100);
  const cov = loc === 'pt' ? null : ptTotal ? Math.round((stat.total / ptTotal) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <span style={{ width: 26, fontSize: '0.72rem', fontWeight: 800, color: meta.color }}>{meta.label}</span>
      <div style={{ flex: 1, height: 18, background: 'rgba(15,23,42,0.04)', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
        <div style={{ width: `${widthPct}%`, height: '100%', background: meta.soft, borderRight: `2px solid ${meta.color}` }} />
      </div>
      <span style={{ width: 34, textAlign: 'right', fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>{stat.total}</span>
      <span style={{ width: 48, textAlign: 'right', fontSize: '0.72rem', color: 'var(--muted)' }}>
        {cov === null ? `${stat.published}/${stat.draft}` : `${cov}%`}
      </span>
    </div>
  );
}

function CoverageStat({ label, value, total, color, missing }: { label: string; value: number; total: number; color: string; missing?: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <span style={{ fontSize: '0.74rem', color: 'var(--muted)', fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>/ {total}</span>
        {missing != null && missing > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 700, color: '#b45309' }}>
            faltam {missing}
          </span>
        )}
      </div>
      <div style={{ height: 6, background: 'rgba(15,23,42,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}

function MiniBars({ pt, en, es, fr, it }: { pt: number; en: number; es: number; fr: number; it: number }) {
  const max = Math.max(pt, en, es, fr, it, 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {([['pt', pt], ['en', en], ['es', es], ['fr', fr], ['it', it]] as const).map(([loc, n]) => (
        <div key={loc} style={{ height: 5, background: 'rgba(15,23,42,0.05)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${Math.round((n / max) * 100)}%`, height: '100%', background: LOCALE[loc].color }} />
        </div>
      ))}
    </div>
  );
}

function LocaleNum({ n, base, loc }: { n: number; base: number; loc: keyof typeof LOCALE }) {
  // Amber when a translation is missing relative to PT; muted when none expected.
  const missing = loc !== 'pt' && n < base;
  return (
    <span style={{ fontWeight: 700, color: n === 0 ? '#cbd5e1' : missing ? '#b45309' : '#0f172a' }}>
      {n}
    </span>
  );
}

function Dot({ color }: { color: string }) {
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: color, marginRight: 4 }} />;
}

const catTh: React.CSSProperties = {
  padding: '0.6rem 1.15rem',
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--muted)',
  position: 'sticky',
  top: 0,
  background: '#f8fafc',
};
const catTd: React.CSSProperties = {
  padding: '0.6rem 1.15rem',
  verticalAlign: 'middle',
};
