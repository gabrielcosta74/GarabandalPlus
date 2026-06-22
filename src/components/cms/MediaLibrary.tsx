"use client";

import Image from 'next/image';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Check, Loader2, AlertCircle, ImageIcon } from 'lucide-react';
import { setMediaAltAction } from '../../app/admin/cms/actions';
import type { CmsMediaItem } from '../../lib/cms/queries';

type Props = {
  items: CmsMediaItem[];
  total: number;
  filter: 'all' | 'no-alt' | 'with-alt';
  search: string;
  hasMore: boolean;
};

export function MediaLibrary({ items, total, filter, search, hasMore }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(search);

  // Debounce search → URL
  useEffect(() => {
    if (q === search) return;
    const t = window.setTimeout(() => {
      const params = new URLSearchParams(sp.toString());
      if (q) params.set('q', q); else params.delete('q');
      router.replace(`?${params.toString()}`, { scroll: false });
    }, 350);
    return () => window.clearTimeout(t);
  }, [q, search, router, sp]);

  const setFilter = (next: 'all' | 'no-alt' | 'with-alt') => {
    const params = new URLSearchParams(sp.toString());
    if (next === 'all') params.delete('filter');
    else params.set('filter', next);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const totalLabel =
    filter === 'no-alt'
      ? `${total} sem alt text`
      : filter === 'with-alt'
        ? `${total} com alt text`
        : `${total} ficheiros`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="cms-card" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) auto', gap: '0.75rem', alignItems: 'center', padding: '0.75rem 1rem' }}>
        <label style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar por filename ou alt text"
            className="cms-input"
            style={{ paddingLeft: '2rem' }}
          />
        </label>
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <FilterPill label="Todas" active={filter === 'all'} onClick={() => setFilter('all')} />
          <FilterPill label="Sem alt" active={filter === 'no-alt'} onClick={() => setFilter('no-alt')} accent="#b45309" />
          <FilterPill label="Com alt" active={filter === 'with-alt'} onClick={() => setFilter('with-alt')} accent="#15803d" />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--muted)' }}>
        <span>{totalLabel}</span>
        {filter === 'no-alt' && total > 0 && (
          <span style={{ color: '#b45309' }}>
            <AlertCircle size={13} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
            Imagens sem alt prejudicam SEO e acessibilidade
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="cms-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
          <ImageIcon size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
          <div>Nenhuma imagem com estes filtros.</div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem',
          }}
        >
          {items.map((m) => <MediaTile key={m.id} item={m} />)}
        </div>
      )}

      {hasMore && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
          Carregar mais — usa pesquisa para refinar.
        </div>
      )}
    </div>
  );
}

function FilterPill({ label, active, onClick, accent }: { label: string; active: boolean; onClick: () => void; accent?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0.45rem 0.85rem',
        borderRadius: 999,
        border: '1px solid ' + (active ? (accent ?? '#1d4ed8') : 'rgba(15,23,42,0.1)'),
        background: active ? (accent ?? '#1d4ed8') : '#fff',
        color: active ? '#fff' : '#0f172a',
        fontSize: '0.82rem',
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );
}

function MediaTile({ item }: { item: CmsMediaItem }) {
  const [alt, setAlt] = useState(item.alt ?? '');
  const initialAltRef = useRef(item.alt ?? '');
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Debounced save on change
  useEffect(() => {
    if (alt === initialAltRef.current) return;
    const t = window.setTimeout(() => {
      setStatus('saving');
      startTransition(async () => {
        const r = await setMediaAltAction(item.id, alt);
        if (r.ok) {
          initialAltRef.current = alt;
          setStatus('saved');
          window.setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1500);
        } else {
          setStatus('error');
        }
      });
    }, 800);
    return () => window.clearTimeout(t);
  }, [alt, item.id]);

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid rgba(15,23,42,0.08)',
        boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '4 / 3', background: '#f1f5f9' }}>
        <Image
          src={item.public_url}
          alt={item.alt ?? ''}
          fill
          sizes="(max-width: 640px) 50vw, 280px"
          style={{ objectFit: 'cover' }}
          unoptimized
        />
      </div>
      <div style={{ padding: '0.75rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'ui-monospace, monospace' }}>
          <span title={item.filename} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.filename}
          </span>
          <span>{item.width && item.height ? `${item.width}×${item.height}` : ''}</span>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Alt text para acessibilidade e SEO…"
            className="cms-input"
            style={{ paddingRight: 30, fontSize: '0.85rem' }}
          />
          <span aria-hidden style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>
            {status === 'saving' && <Loader2 size={14} className="cms-spin" style={{ color: 'var(--muted)' }} />}
            {status === 'saved' && <Check size={14} style={{ color: '#15803d' }} />}
            {status === 'error' && <AlertCircle size={14} style={{ color: '#b91c1c' }} />}
          </span>
        </div>
      </div>
    </div>
  );
}
