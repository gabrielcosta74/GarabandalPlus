"use client";

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Loader2, AlertTriangle } from 'lucide-react';
import { createPageAction, createPostAction, checkSlugAction } from '../../app/admin/cms/actions';
import type { CmsContentType, CmsLocale } from '../../lib/cms/queries';

type Props = {
  type: CmsContentType;
};

const SLUGIFY = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

export function CreateContentDialog({ type }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [locale, setLocale] = useState<CmsLocale>('pt');
  const [touched, setTouched] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const titleRef = useRef<HTMLInputElement>(null);

  // Auto-generate slug from title until user edits the slug field
  useEffect(() => {
    if (!touched) setSlug(SLUGIFY(title));
  }, [title, touched]);

  // Live availability check (debounced)
  useEffect(() => {
    if (!open || !slug) {
      setAvailable(null);
      return;
    }
    const t = window.setTimeout(async () => {
      const { available } = await checkSlugAction(type, slug, locale);
      setAvailable(available);
    }, 300);
    return () => window.clearTimeout(t);
  }, [slug, locale, open, type]);

  useEffect(() => {
    if (open) setTimeout(() => titleRef.current?.focus(), 50);
  }, [open]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim() || available === false) return;
    setError(null);
    startTransition(async () => {
      const action = type === 'page' ? createPageAction : createPostAction;
      const r = await action({ title: title.trim(), slug, locale });
      if (r.ok) {
        const route = type === 'page' ? 'pages' : 'posts';
        router.push(`/admin/cms/${route}/${r.id}`);
      } else {
        setError(r.message);
      }
    });
  };

  const onClose = () => {
    if (pending) return;
    setOpen(false);
    setTitle('');
    setSlug('');
    setLocale('pt');
    setTouched(false);
    setAvailable(null);
    setError(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cms-btn cms-btn-primary"
        style={{ padding: '0.55rem 0.95rem' }}
      >
        <Plus size={15} /> {type === 'page' ? 'Nova página' : 'Novo artigo'}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && onClose()}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <form
            onSubmit={onSubmit}
            style={{
              background: '#fff',
              borderRadius: 16,
              maxWidth: 480,
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 50px rgba(15, 23, 42, 0.25)',
              animation: 'cms-dialog-in 0.15s ease-out',
            }}
          >
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                {type === 'page' ? 'Nova página' : 'Novo artigo'}
              </h2>
              <button type="button" onClick={onClose} className="cms-btn cms-btn-ghost" aria-label="Fechar">
                <X size={16} />
              </button>
            </header>

            <label className="cms-field">
              <span className="cms-field-label">Título</span>
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={type === 'page' ? 'ex: Sobre as aparições' : 'ex: Reflexão sobre a quaresma'}
                className="cms-input"
                required
              />
            </label>

            <label className="cms-field">
              <span className="cms-field-label">Slug</span>
              <input
                value={slug}
                onChange={(e) => { setTouched(true); setSlug(SLUGIFY(e.target.value)); }}
                placeholder="auto-gerado a partir do título"
                className="cms-input"
                required
              />
              <span style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                {available === null && slug && <span style={{ color: 'var(--muted)' }}>A verificar…</span>}
                {available === true && <span style={{ color: '#15803d' }}>✓ Disponível · /{locale === 'pt' ? '' : locale + '/'}{type === 'post' ? 'l/' : ''}{slug}</span>}
                {available === false && <span style={{ color: '#b91c1c' }}>✗ Já existe um {type === 'page' ? 'página' : 'artigo'} com este slug+idioma</span>}
              </span>
            </label>

            <label className="cms-field">
              <span className="cms-field-label">Idioma</span>
              <select value={locale} onChange={(e) => setLocale(e.target.value as CmsLocale)} className="cms-input">
                <option value="pt">Português</option>
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="it">Italiano</option>
              </select>
            </label>

            {error && (
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem 0.7rem',
                  borderRadius: 8,
                  background: 'rgba(220,38,38,0.08)',
                  color: '#b91c1c',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertTriangle size={14} /> {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" onClick={onClose} className="cms-btn cms-btn-ghost" disabled={pending}>
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending || !title.trim() || !slug || available === false}
                className="cms-btn cms-btn-primary"
              >
                {pending ? <Loader2 size={14} className="cms-spin" /> : <Plus size={14} />}
                Criar e abrir editor
              </button>
            </div>
          </form>
          <style>{`
            @keyframes cms-dialog-in {
              from { opacity: 0; transform: translateY(8px) scale(0.98); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
