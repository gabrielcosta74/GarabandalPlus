"use client";

import { useState, useTransition } from 'react';
import { ArrowLeft, RotateCcw, Eye, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { rollbackAction } from '../../app/admin/cms/actions';
import type { CmsRevision, CmsContentType } from '../../lib/cms/queries';

type Props = {
  type: CmsContentType;
  contentId: string;
  current: { title: string; updated_at: string; content_html: string | null };
  revisions: CmsRevision[];
};

export function RevisionHistory({ type, contentId, current, revisions }: Props) {
  const [selected, setSelected] = useState<CmsRevision | null>(revisions[0] ?? null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const router = useRouter();

  const onRollback = () => {
    if (!selected) return;
    if (!window.confirm(`Restaurar esta versão? O estado actual será guardado como nova revisão antes de aplicar.`)) return;
    startTransition(async () => {
      const r = await rollbackAction(type, selected.id);
      if (r.ok) {
        setMessage({ kind: 'ok', text: 'Restaurado. A redireccionar para o editor…' });
        setTimeout(() => router.push(`/admin/cms/${type === 'page' ? 'pages' : 'posts'}/${contentId}`), 600);
      } else {
        setMessage({ kind: 'err', text: r.message });
      }
    });
  };

  const editPath = `/admin/cms/${type === 'page' ? 'pages' : 'posts'}/${contentId}`;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: '1.5rem' }} className="cms-history-grid">
      <style>{`
        @media (max-width: 900px) {
          .cms-history-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Link href={editPath} className="cms-back-link" style={{ marginBottom: '0.5rem' }}>
          <ArrowLeft size={14} /> Voltar ao editor
        </Link>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.25rem', color: '#0f172a' }}>
          {revisions.length} revisão{revisions.length === 1 ? '' : 'ões'}
        </h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0 }}>
          Cada save cria uma versão. Selecciona para ver o conteúdo dessa altura.
        </p>

        <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {revisions.length === 0 && (
            <li style={{ padding: '1rem', borderRadius: 10, background: '#f8fafc', color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center' }}>
              Sem revisões ainda. A próxima edição cria a primeira.
            </li>
          )}
          {revisions.map((r) => {
            const isSelected = selected?.id === r.id;
            const date = new Date(r.created_at);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelected(r)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.7rem 0.85rem',
                    borderRadius: 10,
                    border: '1px solid ' + (isSelected ? '#1d4ed8' : 'rgba(15,23,42,0.08)'),
                    background: isSelected ? 'rgba(29,78,216,0.05)' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                    <Clock size={12} />
                    {date.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {r.title ?? '(sem título)'}
                  </span>
                  {r.status && (
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.4rem',
                        borderRadius: 4,
                        background: r.status === 'published' ? 'rgba(21,128,61,0.1)' : 'rgba(180,83,9,0.1)',
                        color: r.status === 'published' ? '#15803d' : '#b45309',
                        width: 'fit-content',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {r.status}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <main>
        {selected ? (
          <div className="cms-card" style={{ padding: 0, overflow: 'hidden' }}>
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                padding: '1rem 1.25rem',
                borderBottom: '1px solid rgba(15,23,42,0.06)',
                background: '#f8fafc',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  {selected.title ?? '(sem título)'}
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '0.2rem 0 0' }}>
                  {new Date(selected.created_at).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <Link href={editPath} className="cms-btn cms-btn-ghost"><Eye size={14} /> Editor actual</Link>
                <button type="button" onClick={onRollback} disabled={pending} className="cms-btn cms-btn-warning">
                  <RotateCcw size={14} /> Restaurar esta versão
                </button>
              </div>
            </header>
            {message && (
              <div
                style={{
                  margin: '1rem 1.25rem 0',
                  padding: '0.6rem 0.85rem',
                  borderRadius: 8,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: message.kind === 'ok' ? 'rgba(21,128,61,0.08)' : 'rgba(220,38,38,0.08)',
                  color: message.kind === 'ok' ? '#15803d' : '#b91c1c',
                }}
              >
                {message.kind === 'ok' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                {message.text}
              </div>
            )}
            <article
              className="article-prose"
              style={{ padding: '1.5rem 1.75rem', maxHeight: '70vh', overflowY: 'auto' }}
              dangerouslySetInnerHTML={{ __html: selected.content_html ?? '' }}
            />
          </div>
        ) : (
          <div className="cms-card" style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--muted)', margin: 0 }}>
              Conteúdo actual ({current.title}) — sem revisões anteriores.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
