"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, useDeferredValue, useEffect, useRef } from 'react';
import { Search, ChevronLeft, ChevronRight, ExternalLink, Star, Trash2, CheckCircle2, Archive, X, Tag } from 'lucide-react';
import type { CmsListItem, CmsContentType, CmsLocale, CmsStatus } from '../../lib/cms/queries';
import { setPostFeaturedAction, bulkApplyAction } from '../../app/admin/cms/actions';

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  draft: { bg: 'rgba(180,83,9,0.1)', color: '#b45309', label: 'rascunho' },
  published: { bg: 'rgba(21,128,61,0.1)', color: '#15803d', label: 'publicado' },
  scheduled: { bg: 'rgba(29,78,216,0.1)', color: '#1d4ed8', label: 'agendado' },
  archived: { bg: 'rgba(15,23,42,0.06)', color: '#475569', label: 'arquivado' },
};

const LOCALE_BADGE: Record<string, string> = { pt: '#2d8b2d', en: '#2563eb', es: '#dc2626' };

type Props = {
  type: CmsContentType;
  items: CmsListItem[];
  total: number;
  page: number;
  pageSize: number;
  filters: {
    search: string;
    locale: string;
    status: string;
    category: string;
  };
  categories?: string[];
};

export function CmsListView({ type, items, total, page, pageSize, filters, categories = [] }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [search, setSearch] = useState(filters.search);
  const deferred = useDeferredValue(search);
  const [, startTransition] = useTransition();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startBulkTransition] = useTransition();
  const [bulkMessage, setBulkMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const someSelected = selected.size > 0 && !allSelected;

  // Live featured optimistic state
  const [featuredOverride, setFeaturedOverride] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (deferred === filters.search) return;
    const params = new URLSearchParams(sp.toString());
    if (deferred) params.set('q', deferred); else params.delete('q');
    params.set('page', '1');
    startTransition(() => router.replace(`?${params.toString()}`, { scroll: false }));
  }, [deferred, filters.search, router, sp]);

  const onFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(sp.toString());
    if (value && value !== 'all') params.set(key, value); else params.delete(key);
    params.set('page', '1');
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const goPage = (next: number) => {
    const params = new URLSearchParams(sp.toString());
    params.set('page', String(next));
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const onFeaturedToggle = (id: string, currentFeatured: boolean) => {
    setFeaturedOverride((prev) => ({ ...prev, [id]: !currentFeatured }));
    startBulkTransition(async () => {
      const r = await setPostFeaturedAction(id, !currentFeatured);
      if (!r.ok) {
        setFeaturedOverride((prev) => ({ ...prev, [id]: currentFeatured }));
        setBulkMessage({ kind: 'err', text: r.message ?? 'Erro' });
      }
    });
  };

  const runBulk = (action: Parameters<typeof bulkApplyAction>[2], label: string) => {
    if (selected.size === 0) return;
    if (action.kind === 'delete') {
      if (!window.confirm(`Apagar ${selected.size} item(s) permanentemente? Esta acção não pode ser desfeita.`)) return;
    }
    startBulkTransition(async () => {
      setBulkMessage(null);
      const r = await bulkApplyAction(type, [...selected], action);
      if (r.ok) {
        setBulkMessage({ kind: 'ok', text: `${label} aplicada a ${r.affected} item(s).` });
        setSelected(new Set());
        router.refresh();
      } else {
        setBulkMessage({ kind: 'err', text: r.message ?? 'Erro' });
      }
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const baseEditPath = type === 'page' ? '/admin/cms/pages' : '/admin/cms/posts';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Filters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 1fr) repeat(auto-fit, minmax(150px, max-content))',
          gap: '0.75rem',
          alignItems: 'center',
          background: '#fff',
          borderRadius: 14,
          padding: '0.85rem 1rem',
          border: '1px solid rgba(15,23,42,0.06)',
          boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.65rem', color: 'var(--muted)' }} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Pesquisar ${type === 'page' ? 'páginas' : 'artigos'} (título, slug, descrição)`}
            style={{
              width: '100%',
              padding: '0.55rem 0.85rem 0.55rem 2.1rem',
              border: '1px solid rgba(15,23,42,0.1)',
              borderRadius: 8,
              fontSize: '0.92rem',
              background: '#f8fafc',
            }}
          />
        </label>

        <select value={filters.locale} onChange={(e) => onFilterChange('locale', e.target.value)} style={selectStyle}>
          <option value="all">Todos idiomas</option>
          <option value="pt">PT</option>
          <option value="en">EN</option>
          <option value="es">ES</option>
        </select>

        <select value={filters.status} onChange={(e) => onFilterChange('status', e.target.value)} style={selectStyle}>
          <option value="all">Todos estados</option>
          <option value="draft">Rascunho</option>
          <option value="published">Publicado</option>
          <option value="scheduled">Agendado</option>
          <option value="archived">Arquivado</option>
        </select>

        {type === 'page' && categories.length > 0 && (
          <select value={filters.category} onChange={(e) => onFilterChange('category', e.target.value)} style={selectStyle}>
            <option value="">Todas categorias</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            background: '#0f172a',
            color: '#fff',
            borderRadius: 12,
            padding: '0.6rem 1rem',
            boxShadow: '0 6px 20px rgba(15,23,42,0.15)',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontWeight: 600 }}>{selected.size} seleccionado{selected.size === 1 ? '' : 's'}</span>
          <button type="button" disabled={pending} className="cms-btn cms-btn-secondary" onClick={() => runBulk({ kind: 'set_status', status: 'draft' }, 'Mudar para rascunho')}>
            Mudar para draft
          </button>
          <button type="button" disabled={pending} className="cms-btn cms-btn-secondary" onClick={() => runBulk({ kind: 'set_status', status: 'archived' }, 'Arquivar')}>
            <Archive size={13} /> Arquivar
          </button>
          {type === 'post' && (
            <>
              <button type="button" disabled={pending} className="cms-btn cms-btn-secondary" onClick={() => runBulk({ kind: 'set_featured', featured: true }, 'Destacar')}>
                <Star size={13} /> Destacar
              </button>
              <button type="button" disabled={pending} className="cms-btn cms-btn-secondary" onClick={() => runBulk({ kind: 'set_featured', featured: false }, 'Remover destaque')}>
                Remover destaque
              </button>
            </>
          )}
          {type === 'page' && (
            <BulkCategoryPicker
              disabled={pending}
              suggestions={categories}
              onSet={(cat) => runBulk({ kind: 'set_category', category: cat }, cat ? `Categoria "${cat}"` : 'Categoria limpa')}
            />
          )}
          <button type="button" disabled={pending} className="cms-btn cms-btn-warning" onClick={() => runBulk({ kind: 'delete' }, 'Apagados')} style={{ marginLeft: 'auto' }}>
            <Trash2 size={13} /> Apagar
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="cms-btn cms-btn-ghost" style={{ color: '#fff' }}>
            <X size={13} /> Limpar
          </button>
        </div>
      )}

      {bulkMessage && (
        <div
          style={{
            padding: '0.55rem 0.85rem',
            borderRadius: 8,
            fontSize: '0.85rem',
            background: bulkMessage.kind === 'ok' ? 'rgba(21,128,61,0.08)' : 'rgba(220,38,38,0.08)',
            color: bulkMessage.kind === 'ok' ? '#15803d' : '#b91c1c',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {bulkMessage.kind === 'ok' ? <CheckCircle2 size={14} /> : null}
          {bulkMessage.text}
        </div>
      )}

      {/* Table */}
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          border: '1px solid rgba(15,23,42,0.06)',
          boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem', minWidth: 720 }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                <th style={{ ...thStyle, width: 40 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    aria-label="Seleccionar todos"
                  />
                </th>
                <th style={thStyle}>Título / slug</th>
                <th style={{ ...thStyle, width: 70 }}>Loc</th>
                <th style={{ ...thStyle, width: 120 }}>Estado</th>
                {type === 'post' && <th style={{ ...thStyle, width: 100 }}>Destaque</th>}
                <th style={{ ...thStyle, width: 160 }}>Atualizado</th>
                <th style={{ ...thStyle, width: 60 }} aria-label="actions" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={type === 'post' ? 7 : 6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                    Nada encontrado com estes filtros.
                  </td>
                </tr>
              ) : items.map((item) => {
                const status = STATUS_BADGE[item.status] ?? STATUS_BADGE.draft;
                const localeColor = LOCALE_BADGE[item.locale] ?? '#475569';
                const isSel = selected.has(item.id);
                const isFeatured = featuredOverride[item.id] ?? !!item.featured;
                return (
                  <tr
                    key={item.id}
                    style={{ borderTop: '1px solid rgba(15,23,42,0.05)', background: isSel ? 'rgba(29,78,216,0.04)' : undefined }}
                  >
                    <td style={tdStyle}>
                      <input type="checkbox" checked={isSel} onChange={() => toggleOne(item.id)} aria-label={`Seleccionar ${item.title}`} />
                    </td>
                    <td style={tdStyle}>
                      <Link href={`${baseEditPath}/${item.id}`} style={{ color: '#0f172a', textDecoration: 'none', fontWeight: 600 }}>
                        {item.title}
                      </Link>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                        /{item.slug}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: 4,
                          background: localeColor,
                          color: '#fff',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {item.locale}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: 4,
                          background: status.bg,
                          color: status.color,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {status.label}
                      </span>
                    </td>
                    {type === 'post' && (
                      <td style={tdStyle}>
                        <button
                          type="button"
                          onClick={() => onFeaturedToggle(item.id, isFeatured)}
                          disabled={pending}
                          title={isFeatured ? 'Remover destaque' : 'Destacar'}
                          style={{
                            background: 'transparent',
                            border: 0,
                            cursor: 'pointer',
                            padding: '0.3rem',
                            color: isFeatured ? '#d4af37' : 'rgba(15,23,42,0.25)',
                            transition: 'transform .15s ease',
                          }}
                        >
                          <Star size={16} fill={isFeatured ? 'currentColor' : 'none'} />
                        </button>
                      </td>
                    )}
                    <td style={tdStyle}>
                      <span style={{ color: 'var(--muted)' }}>
                        {new Date(item.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {item.status === 'published' && (
                        <Link
                          href={publicHref(type, item.locale, item.slug)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir página pública"
                          style={{ color: 'var(--muted)', display: 'inline-flex' }}
                        >
                          <ExternalLink size={15} />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.85rem',
          color: 'var(--muted)',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <span>
          Página {page} de {totalPages} · {total} resultado{total === 1 ? '' : 's'}
        </span>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button disabled={page <= 1} onClick={() => goPage(page - 1)} style={pagerBtn(page <= 1)}>
            <ChevronLeft size={16} /> Anterior
          </button>
          <button disabled={page >= totalPages} onClick={() => goPage(page + 1)} style={pagerBtn(page >= totalPages)}>
            Seguinte <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkCategoryPicker({
  disabled,
  suggestions,
  onSet,
}: {
  disabled: boolean;
  suggestions: string[];
  onSet: (category: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filtered = value
    ? suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()))
    : suggestions;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="cms-btn cms-btn-secondary"
      >
        <Tag size={13} /> Categoria
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 30,
            width: 240,
            background: '#fff',
            border: '1px solid rgba(15,23,42,0.12)',
            borderRadius: 10,
            boxShadow: '0 12px 30px rgba(15,23,42,0.18)',
            padding: '0.4rem',
          }}
        >
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Nome da categoria"
            className="cms-input"
            style={{ marginBottom: 6 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) {
                onSet(value.trim());
                setOpen(false);
                setValue('');
              }
            }}
          />
          <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filtered.slice(0, 12).map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onSet(s); setOpen(false); setValue(''); }}
                style={{ textAlign: 'left', padding: '0.4rem 0.55rem', borderRadius: 6, border: 0, background: 'transparent', cursor: 'pointer', fontSize: '0.85rem', color: '#0f172a' }}
                className="hover:bg-slate-100"
              >
                <Tag size={11} style={{ color: '#d4af37', marginRight: 5, verticalAlign: 'middle' }} />
                {s}
              </button>
            ))}
            {value.trim() && !suggestions.includes(value.trim()) && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onSet(value.trim()); setOpen(false); setValue(''); }}
                style={{ textAlign: 'left', padding: '0.4rem 0.55rem', borderRadius: 6, border: 0, background: 'rgba(29,78,216,0.08)', cursor: 'pointer', fontSize: '0.85rem', color: '#1d4ed8', fontWeight: 600 }}
              >
                + Criar “{value.trim()}”
              </button>
            )}
          </div>
          <div style={{ borderTop: '1px solid rgba(15,23,42,0.08)', marginTop: 6, paddingTop: 6 }}>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onSet(null); setOpen(false); }}
              style={{ width: '100%', textAlign: 'left', padding: '0.4rem 0.55rem', borderRadius: 6, border: 0, background: 'transparent', cursor: 'pointer', fontSize: '0.82rem', color: '#b91c1c' }}
              className="hover:bg-red-50"
            >
              Limpar categoria
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function publicHref(type: CmsContentType, locale: string, slug: string): string {
  const prefix = locale === 'pt' ? '' : `/${locale}`;
  return type === 'post' ? `${prefix}/l/${slug}` : `${prefix}/${slug}`;
}

const selectStyle: React.CSSProperties = {
  padding: '0.55rem 0.7rem',
  border: '1px solid rgba(15,23,42,0.1)',
  borderRadius: 8,
  fontSize: '0.9rem',
  background: '#f8fafc',
  cursor: 'pointer',
};

const thStyle: React.CSSProperties = {
  padding: '0.7rem 1rem',
  fontSize: '0.75rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--muted)',
};

const tdStyle: React.CSSProperties = {
  padding: '0.85rem 1rem',
  verticalAlign: 'middle',
};

function pagerBtn(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.45rem 0.85rem',
    borderRadius: 8,
    border: '1px solid rgba(15,23,42,0.1)',
    background: '#fff',
    color: disabled ? 'rgba(15,23,42,0.3)' : '#0f172a',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  };
}
