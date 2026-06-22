"use client";

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X, Search, Upload, Loader2, Check } from 'lucide-react';
import { supabaseBrowser } from '../../lib/supabase-browser';

type MediaItem = {
  id: string;
  filename: string;
  public_url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
};

type Props = {
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  /** Triggered button label */
  label?: string;
  /** Aspect ratio hint shown in the picker preview */
  aspect?: 'square' | 'cover' | 'wide';
};

/**
 * Reusable image picker. Replaces a free-text "Image URL" input with a
 * dialog that browses the existing media library, supports search/filter,
 * and lets the user upload a new file inline.
 *
 * The picker never invents a new URL — it only sets a Supabase Storage
 * public URL or clears the field.
 */
export function MediaPicker({ value, onChange, label, aspect = 'cover' }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {value ? (
          <div
            style={{
              display: 'flex',
              gap: '0.6rem',
              padding: '0.45rem',
              border: '1px solid rgba(15,23,42,0.1)',
              borderRadius: 10,
              background: '#fff',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: 56,
                height: 56,
                borderRadius: 6,
                overflow: 'hidden',
                background: '#f1f5f9',
                flexShrink: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0, fontSize: '0.78rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'ui-monospace, monospace' }}>
              {value.replace(/^https?:\/\/[^/]+\//, '/')}
            </div>
            <button type="button" onClick={() => setOpen(true)} className="cms-btn cms-btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem' }}>
              Trocar
            </button>
            <button type="button" onClick={() => onChange(null)} className="cms-btn cms-btn-ghost" style={{ padding: '0.4rem 0.5rem' }} title="Remover">
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="cms-btn cms-btn-secondary"
            style={{ justifyContent: 'flex-start', padding: '0.6rem 0.8rem', fontWeight: 600 }}
          >
            <ImagePlus size={15} /> {label ?? 'Escolher imagem'}
          </button>
        )}
      </div>

      {open && (
        <MediaPickerDialog
          aspect={aspect}
          onClose={() => setOpen(false)}
          onPick={(url) => {
            onChange(url);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

/**
 * The media library dialog on its own (search, filter, upload, pick). Exported
 * so other surfaces — e.g. the on-canvas hero cover editor — can open the same
 * picker without the inline trigger button that {@link MediaPicker} renders.
 */
export function MediaPickerDialog({
  onClose,
  onPick,
  aspect,
}: {
  onClose: () => void;
  onPick: (url: string) => void;
  aspect: 'square' | 'cover' | 'wide';
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'no-alt' | 'with-alt'>('all');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchItems = async (reset: boolean) => {
    if (!supabaseBrowser) return;
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    if (!session?.access_token) {
      setError('Sessão expirada');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/admin/cms/media', window.location.origin);
      if (q) url.searchParams.set('q', q);
      if (filter !== 'all') url.searchParams.set('filter', filter);
      if (!reset && cursor) url.searchParams.set('cursor', cursor);
      url.searchParams.set('limit', '36');

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { items: MediaItem[]; nextCursor: string | null };
      setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchItems(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filter]);

  const onFile = async (file: File) => {
    if (!supabaseBrowser) return;
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    if (!session?.access_token) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/cms/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Upload falhou');
      }
      const { url } = await res.json();
      onPick(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(6px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          width: 'min(940px, 100%)',
          maxHeight: 'min(720px, calc(100vh - 32px))',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 30px 80px rgba(15,23,42,0.3)',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: '0.85rem 1.1rem',
            borderBottom: '1px solid rgba(15,23,42,0.08)',
          }}
        >
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
            Escolher imagem
          </h2>
          <button type="button" onClick={onClose} className="cms-btn cms-btn-ghost" aria-label="Fechar">
            <X size={16} />
          </button>
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 1fr) auto auto',
            gap: '0.5rem',
            alignItems: 'center',
            padding: '0.75rem 1.1rem',
            borderBottom: '1px solid rgba(15,23,42,0.05)',
          }}
        >
          <label style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Pesquisar por filename ou alt"
              className="cms-input"
              style={{ paddingLeft: 32 }}
            />
          </label>
          <select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | 'no-alt' | 'with-alt')} className="cms-input" style={{ width: 'auto' }}>
            <option value="all">Todas</option>
            <option value="no-alt">Sem alt</option>
            <option value="with-alt">Com alt</option>
          </select>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="cms-btn cms-btn-primary"
          >
            {uploading ? <Loader2 size={14} className="cms-spin" /> : <Upload size={14} />} Upload
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void onFile(f);
            }}
          />
        </div>

        {error && (
          <div style={{ margin: '0.5rem 1.1rem', padding: '0.5rem 0.75rem', background: 'rgba(220,38,38,0.08)', color: '#b91c1c', fontSize: '0.85rem', borderRadius: 8 }}>
            {error}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.85rem 1.1rem' }}>
          {items.length === 0 && !loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
              Nenhuma imagem com estes filtros. Faz upload acima.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '0.55rem',
              }}
            >
              {items.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onPick(m.public_url)}
                  title={m.alt ?? m.filename}
                  style={{
                    position: 'relative',
                    aspectRatio: aspect === 'square' ? '1 / 1' : aspect === 'wide' ? '16 / 9' : '4 / 3',
                    background: '#f1f5f9',
                    borderRadius: 8,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: '1px solid rgba(15,23,42,0.06)',
                    padding: 0,
                  }}
                  className="hover:ring-2 hover:ring-blue-500"
                >
                  <Image
                    src={m.public_url}
                    alt={m.alt ?? ''}
                    fill
                    sizes="140px"
                    style={{ objectFit: 'cover' }}
                    unoptimized
                  />
                  {m.alt && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        padding: '0.1rem 0.35rem',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        background: 'rgba(21,128,61,0.92)',
                        color: '#fff',
                        borderRadius: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <Check size={10} /> alt
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--muted)' }}>
              <Loader2 size={16} className="cms-spin" /> A carregar…
            </div>
          )}

          {hasMore && !loading && (
            <div style={{ textAlign: 'center', marginTop: '0.85rem' }}>
              <button type="button" onClick={() => fetchItems(false)} className="cms-btn cms-btn-ghost">
                Carregar mais
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
