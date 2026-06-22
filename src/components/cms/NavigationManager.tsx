"use client";

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Star, StarOff, ArrowUp, ArrowDown, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  setNavFeaturedAction,
  reorderNavFeaturedAction,
} from '../../app/admin/cms/actions';
import type { CategoryKey } from '../../lib/cms/categories';
import type { NavItem } from '../../lib/cms/queries';

type Props = {
  category: CategoryKey;
  label: string;
  items: NavItem[];
};

export function NavigationManager({ category, label, items }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Group by locale, then by featured-status. Featured items are sorted by
  // nav_sort_order; unfeatured by title for findability.
  const byLocale: Record<'pt' | 'en' | 'es', { featured: NavItem[]; rest: NavItem[] }> = {
    pt: { featured: [], rest: [] },
    en: { featured: [], rest: [] },
    es: { featured: [], rest: [] },
  };
  for (const it of items) {
    const bucket = byLocale[it.locale as 'pt' | 'en' | 'es'];
    if (!bucket) continue;
    if (it.featured_in_nav) bucket.featured.push(it);
    else bucket.rest.push(it);
  }
  for (const loc of Object.keys(byLocale) as Array<'pt' | 'en' | 'es'>) {
    byLocale[loc].featured.sort((a, b) => a.nav_sort_order - b.nav_sort_order);
    byLocale[loc].rest.sort((a, b) => a.title.localeCompare(b.title));
  }

  const toggleFeatured = (item: NavItem) => {
    startTransition(async () => {
      setMessage(null);
      const r = await setNavFeaturedAction(item.type, item.id, !item.featured_in_nav);
      if (r.ok) {
        setMessage({
          kind: 'ok',
          text: `${item.featured_in_nav ? 'Removido do destaque' : 'Adicionado ao destaque'}: ${item.title}`,
        });
        router.refresh();
      } else {
        setMessage({ kind: 'err', text: r.message ?? 'Erro' });
      }
    });
  };

  const move = (locale: 'pt' | 'en' | 'es', from: number, to: number) => {
    const list = byLocale[locale].featured;
    if (to < 0 || to >= list.length) return;
    const reordered = [...list];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    // Split by type — sort_order lives per table, not globally.
    const pages = reordered.filter((r) => r.type === 'page').map((r) => r.id);
    const posts = reordered.filter((r) => r.type === 'post').map((r) => r.id);
    startTransition(async () => {
      setMessage(null);
      const results = await Promise.all([
        pages.length ? reorderNavFeaturedAction('page', pages) : Promise.resolve({ ok: true } as { ok: true }),
        posts.length ? reorderNavFeaturedAction('post', posts) : Promise.resolve({ ok: true } as { ok: true }),
      ]);
      if (results.every((r) => r.ok)) {
        router.refresh();
      } else {
        setMessage({ kind: 'err', text: 'Erro ao reordenar' });
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {message && (
        <div className={`cms-editor-message cms-editor-message-${message.kind}`}>
          {message.kind === 'ok' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '1rem' }} className="cms-nav-grid">
        <style>{`
          @media (max-width: 1080px) { .cms-nav-grid { grid-template-columns: 1fr !important; } }
        `}</style>

        {(['pt', 'en'] as const).map((loc) => {
          const bucket = byLocale[loc];
          return (
            <section key={loc} className="cms-card" style={{ padding: 0, overflow: 'hidden' }}>
              <header style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid rgba(15,23,42,0.08)',
                background: '#f8fafc',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>{loc === 'pt' ? '🇵🇹' : '🇬🇧'}</span>
                  <strong style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem' }}>
                    {loc === 'pt' ? 'Português' : 'English'}
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    · {bucket.featured.length} destacado(s) · {bucket.rest.length + bucket.featured.length} total
                  </span>
                </div>
              </header>

              <div style={{ padding: '0.75rem 1rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', margin: '0 0 0.5rem' }}>
                  Destacados na nav · arrasta para reordenar
                </h3>
                {bucket.featured.length === 0 && (
                  <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '0 0 1rem', fontStyle: 'italic' }}>
                    Nenhum em destaque. Selecciona da lista abaixo.
                  </p>
                )}
                {bucket.featured.map((it, i) => (
                  <FeaturedRow
                    key={it.id}
                    item={it}
                    canUp={i > 0}
                    canDown={i < bucket.featured.length - 1}
                    onUp={() => move(loc, i, i - 1)}
                    onDown={() => move(loc, i, i + 1)}
                    onToggle={() => toggleFeatured(it)}
                    pending={pending}
                  />
                ))}

                <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', margin: '1.25rem 0 0.5rem' }}>
                  Disponíveis · {bucket.rest.length}
                </h3>
                <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                  {bucket.rest.length === 0 && (
                    <p style={{ padding: '0.75rem', color: 'var(--muted)', fontSize: '0.85rem', margin: 0 }}>
                      Não há páginas na categoria <code>{category}</code> em {loc.toUpperCase()}.
                    </p>
                  )}
                  {bucket.rest.map((it) => (
                    <RestRow key={it.id} item={it} onToggle={() => toggleFeatured(it)} pending={pending} />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0 }}>
        Categoria: <code>{category}</code> · {label}.
        Os artigos destacados aparecem no mega-menu da nav e na grelha de destaques da página <code>/{label.toLowerCase()}</code>.
      </p>
    </div>
  );
}

function FeaturedRow({
  item, canUp, canDown, onUp, onDown, onToggle, pending,
}: {
  item: NavItem;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onToggle: () => void;
  pending: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.5rem', border: '1px solid #fde68a', background: '#fffbeb',
      borderRadius: 8, marginBottom: '0.4rem',
    }}>
      <Star size={14} fill="#ca8a04" stroke="#ca8a04" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'ui-monospace, monospace' }}>
          /{item.slug} · {item.status} · {item.type}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.2rem' }}>
        <button type="button" disabled={!canUp || pending} onClick={onUp} className="cms-btn cms-btn-secondary" style={{ padding: '0.3rem' }} title="Subir">
          <ArrowUp size={12} />
        </button>
        <button type="button" disabled={!canDown || pending} onClick={onDown} className="cms-btn cms-btn-secondary" style={{ padding: '0.3rem' }} title="Descer">
          <ArrowDown size={12} />
        </button>
        <Link href={`/admin/cms/${item.type === 'page' ? 'pages' : 'posts'}/${item.id}`} className="cms-btn cms-btn-secondary" style={{ padding: '0.3rem' }} title="Editar">
          <ExternalLink size={12} />
        </Link>
        <button type="button" disabled={pending} onClick={onToggle} className="cms-btn cms-btn-secondary" style={{ padding: '0.3rem' }} title="Remover do destaque">
          {pending ? <Loader2 size={12} className="cms-spin" /> : <StarOff size={12} />}
        </button>
      </div>
    </div>
  );
}

function RestRow({
  item, onToggle, pending,
}: {
  item: NavItem;
  onToggle: () => void;
  pending: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.4rem 0.6rem', borderBottom: '1px solid #f1f5f9',
    }}>
      <button
        type="button" onClick={onToggle} disabled={pending}
        className="cms-btn cms-btn-secondary"
        style={{ padding: '0.25rem' }}
        title="Adicionar ao destaque"
      >
        {pending ? <Loader2 size={12} className="cms-spin" /> : <Star size={12} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.85rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'ui-monospace, monospace' }}>
          /{item.slug} · <StatusBadge status={item.status} /> · {item.type}
        </div>
      </div>
      <Link href={`/admin/cms/${item.type === 'page' ? 'pages' : 'posts'}/${item.id}`} className="cms-btn cms-btn-secondary" style={{ padding: '0.25rem' }} title="Editar">
        <ExternalLink size={12} />
      </Link>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c = status === 'published' ? '#15803d' : status === 'draft' ? '#b45309' : '#475569';
  return <span style={{ color: c, fontWeight: 600 }}>{status}</span>;
}
