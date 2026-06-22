"use client";

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Tag, Edit2, Trash2, Loader2, Check, X, ExternalLink } from 'lucide-react';
import { renameCategoryAction, deleteCategoryAction } from '../../app/admin/cms/actions';
import type { CategoryStat } from '../../lib/cms/queries';

const NO_CAT = '(sem categoria)';

export function CategoriesManager({ stats }: { stats: CategoryStat[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const startEdit = (current: string) => {
    setEditing(current);
    setDraftName(current);
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraftName('');
  };

  const onRename = () => {
    if (!editing || !draftName.trim() || draftName === editing) return cancelEdit();
    startTransition(async () => {
      setMessage(null);
      const r = await renameCategoryAction(editing, draftName.trim());
      if (r.ok) {
        setMessage({ kind: 'ok', text: `Renomeada para "${draftName.trim()}" — ${r.affected} página(s) actualizada(s).` });
        cancelEdit();
        router.refresh();
      } else {
        setMessage({ kind: 'err', text: r.message ?? 'Erro' });
      }
    });
  };

  const onDelete = (name: string) => {
    if (!window.confirm(`Limpar a categoria "${name}" de todas as páginas? As páginas continuam existir, só perdem a categoria.`)) return;
    startTransition(async () => {
      const r = await deleteCategoryAction(name);
      if (r.ok) {
        setMessage({ kind: 'ok', text: `Categoria removida de ${r.affected} página(s).` });
        router.refresh();
      } else {
        setMessage({ kind: 'err', text: 'Erro a limpar.' });
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {message && (
        <div
          style={{
            padding: '0.65rem 0.85rem',
            borderRadius: 8,
            fontSize: '0.85rem',
            background: message.kind === 'ok' ? 'rgba(21,128,61,0.08)' : 'rgba(220,38,38,0.08)',
            color: message.kind === 'ok' ? '#15803d' : '#b91c1c',
          }}
        >
          {message.text}
        </div>
      )}

      <div className="cms-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
              <th style={th}>Categoria</th>
              <th style={{ ...th, width: 110 }}>Total</th>
              <th style={{ ...th, width: 130 }}>Estados</th>
              <th style={{ ...th, width: 220 }} aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {stats.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                  Sem páginas ainda.
                </td>
              </tr>
            ) : stats.map((s) => {
              const isEditing = editing === s.category;
              const isReal = s.category !== NO_CAT;
              return (
                <tr key={s.category} style={{ borderTop: '1px solid rgba(15,23,42,0.05)' }}>
                  <td style={td}>
                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          autoFocus
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          className="cms-input"
                          style={{ maxWidth: 280 }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') onRename();
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                        <button type="button" onClick={onRename} disabled={pending} className="cms-btn cms-btn-primary" title="Guardar">
                          {pending ? <Loader2 size={14} className="cms-spin" /> : <Check size={14} />}
                        </button>
                        <button type="button" onClick={cancelEdit} className="cms-btn cms-btn-ghost" title="Cancelar">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#0f172a' }}>
                        <Tag size={14} style={{ color: isReal ? '#d4af37' : 'rgba(15,23,42,0.3)' }} />
                        {s.category}
                      </span>
                    )}
                  </td>
                  <td style={td}>
                    <span style={{ fontWeight: 700 }}>{s.total}</span>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.78rem' }}>
                      <span style={{ padding: '0.15rem 0.4rem', borderRadius: 4, background: 'rgba(180,83,9,0.1)', color: '#b45309', fontWeight: 600 }}>
                        {s.draft} draft
                      </span>
                      {s.published > 0 && (
                        <span style={{ padding: '0.15rem 0.4rem', borderRadius: 4, background: 'rgba(21,128,61,0.1)', color: '#15803d', fontWeight: 600 }}>
                          {s.published} pub
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={td}>
                    {!isEditing && (
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <Link
                          href={isReal ? `/admin/cms/pages?category=${encodeURIComponent(s.category)}` : '/admin/cms/pages'}
                          className="cms-btn cms-btn-ghost"
                          style={{ padding: '0.35rem 0.65rem' }}
                          title="Ver páginas"
                        >
                          <ExternalLink size={13} /> Ver
                        </Link>
                        {isReal && (
                          <>
                            <button type="button" onClick={() => startEdit(s.category)} className="cms-btn cms-btn-ghost" style={{ padding: '0.35rem 0.65rem' }}>
                              <Edit2 size={13} /> Renomear
                            </button>
                            <button type="button" onClick={() => onDelete(s.category)} disabled={pending} className="cms-btn cms-btn-warning" style={{ padding: '0.35rem 0.65rem' }}>
                              <Trash2 size={13} /> Limpar
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0 }}>
        Categorias são livres — escreve qualquer nome no campo "Categoria" do editor de páginas. Aqui podes renomear ou limpar em massa.
      </p>
    </div>
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
