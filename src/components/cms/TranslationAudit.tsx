"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, X, Sparkles, Globe2 } from 'lucide-react';
import type { TranslationCoverageRow, CmsContentType } from '../../lib/cms/queries';
import { MtReviewBadge } from './MtReviewBadge';

type Props = {
  type: CmsContentType;
  rows: TranslationCoverageRow[];
  filter: string;
  totals: { all: number; missingEn: number; missingEs: number; missingFr: number; missingIt: number; missingPt: number; complete: number };
};

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  draft: { bg: 'rgba(180,83,9,0.1)', color: '#b45309' },
  published: { bg: 'rgba(21,128,61,0.1)', color: '#15803d' },
};

export function TranslationAudit({ type, rows, filter, totals }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const setFilter = (f: string) => {
    const p = new URLSearchParams(sp.toString());
    if (f === 'all') p.delete('filter');
    else p.set('filter', f);
    router.replace(`?${p.toString()}`, { scroll: false });
  };

  const setType = (next: CmsContentType) => {
    const p = new URLSearchParams(sp.toString());
    p.set('type', next);
    router.replace(`?${p.toString()}`, { scroll: false });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="cms-card" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 0.85rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <Pill active={type === 'page'} onClick={() => setType('page')}>Páginas</Pill>
          <Pill active={type === 'post'} onClick={() => setType('post')}>Artigos</Pill>
        </div>
        <span style={{ width: 1, height: 22, background: 'rgba(15,23,42,0.1)' }} aria-hidden />
        <Pill active={filter === 'all'} onClick={() => setFilter('all')}>
          Todos <Count n={totals.all} />
        </Pill>
        <Pill active={filter === 'missing-en'} onClick={() => setFilter('missing-en')} accent="#15803d">
          Sem EN <Count n={totals.missingEn} />
        </Pill>
        <Pill active={filter === 'missing-es'} onClick={() => setFilter('missing-es')} accent="#7c3aed">
          Sem ES <Count n={totals.missingEs} />
        </Pill>
        <Pill active={filter === 'missing-fr'} onClick={() => setFilter('missing-fr')} accent="#db2777">
          Sem FR <Count n={totals.missingFr} />
        </Pill>
        <Pill active={filter === 'missing-it'} onClick={() => setFilter('missing-it')} accent="#0d9488">
          Sem IT <Count n={totals.missingIt} />
        </Pill>
        <Pill active={filter === 'missing-pt'} onClick={() => setFilter('missing-pt')} accent="#b45309">
          Sem PT <Count n={totals.missingPt} />
        </Pill>
        <Pill active={filter === 'complete'} onClick={() => setFilter('complete')} accent="#15803d">
          Completas <Count n={totals.complete} />
        </Pill>
      </div>

      {rows.length === 0 ? (
        <div className="cms-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
          <Globe2 size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
          <div>Nada para mostrar com este filtro.</div>
        </div>
      ) : (
        <div className="cms-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                <th style={th}>Português</th>
                <th style={th}>English</th>
                <th style={th}>Español</th>
                <th style={th}>Français</th>
                <th style={th}>Italiano</th>
                <th style={{ ...th, width: 60 }} aria-label="action" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.group_id} style={{ borderTop: '1px solid rgba(15,23,42,0.05)' }}>
                  <td style={td}>
                    <PeerCell peer={r.pt} />
                  </td>
                  <td style={td}>
                    <PeerCell peer={r.en} />
                  </td>
                  <td style={td}>
                    <PeerCell peer={r.es} />
                  </td>
                  <td style={td}>
                    <PeerCell peer={r.fr} />
                  </td>
                  <td style={td}>
                    <PeerCell peer={r.it} />
                  </td>
                  <td style={td}>
                    <Link
                      href={`/admin/cms/translations/${type}/${r.group_id}`}
                      className="cms-btn cms-btn-secondary"
                      style={{ padding: '0.4rem 0.6rem' }}
                      title="Editor lado-a-lado"
                    >
                      <Sparkles size={13} /> Editar <ArrowRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PeerCell({ peer }: { peer: TranslationCoverageRow['pt'] }) {
  if (!peer) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#b45309', fontSize: '0.85rem', fontWeight: 600 }}>
        <X size={14} /> em falta
      </span>
    );
  }
  const status = STATUS_BADGE[peer.status] ?? STATUS_BADGE.draft;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
      <span style={{ fontWeight: 600, color: '#0f172a' }}>{peer.title}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', color: 'var(--muted)', flexWrap: 'wrap' }}>
        <span style={{ padding: '0.1rem 0.35rem', borderRadius: 4, background: status.bg, color: status.color, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {peer.status}
        </span>
        <span style={{ fontFamily: 'ui-monospace, monospace' }}>/{peer.slug}</span>
        {peer.mt_unreviewed && <MtReviewBadge compact />}
      </span>
    </div>
  );
}

function Pill({ active, accent, onClick, children }: { active: boolean; accent?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0.4rem 0.8rem',
        borderRadius: 999,
        border: '1px solid ' + (active ? (accent ?? '#1d4ed8') : 'rgba(15,23,42,0.1)'),
        background: active ? (accent ?? '#1d4ed8') : '#fff',
        color: active ? '#fff' : '#0f172a',
        fontSize: '0.82rem',
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
      }}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '0.1rem 0.35rem', borderRadius: 4, background: 'rgba(15,23,42,0.06)', color: '#0f172a' }}>
      {n}
    </span>
  );
}

const th: React.CSSProperties = {
  padding: '0.7rem 1rem',
  fontSize: '0.72rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--muted)',
};
const td: React.CSSProperties = {
  padding: '0.85rem 1rem',
  verticalAlign: 'middle',
};
