'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Share2, Link2, Check, Mail, X } from 'lucide-react';
import type { ContentLocale } from '../../lib/content/queries';

type Copy = {
  fab: string;
  title: string;
  copy: string;
  copied: string;
  email: string;
  whatsapp: string;
  facebook: string;
  telegram: string;
  twitter: string;
  close: string;
  emailSubject: (title: string) => string;
};

const COPY: Record<ContentLocale, Copy> = {
  pt: { fab: 'Partilhar', title: 'Partilhar este artigo', copy: 'Copiar ligação', copied: 'Ligação copiada!', email: 'Email', whatsapp: 'WhatsApp', facebook: 'Facebook', telegram: 'Telegram', twitter: 'X', close: 'Fechar', emailSubject: (t) => `Veja: ${t}` },
  en: { fab: 'Share', title: 'Share this article', copy: 'Copy link', copied: 'Link copied!', email: 'Email', whatsapp: 'WhatsApp', facebook: 'Facebook', telegram: 'Telegram', twitter: 'X', close: 'Close', emailSubject: (t) => `Read: ${t}` },
  es: { fab: 'Compartir', title: 'Compartir este artículo', copy: 'Copiar enlace', copied: '¡Enlace copiado!', email: 'Email', whatsapp: 'WhatsApp', facebook: 'Facebook', telegram: 'Telegram', twitter: 'X', close: 'Cerrar', emailSubject: (t) => `Mira: ${t}` },
  fr: { fab: 'Partager', title: 'Partager cet article', copy: 'Copier le lien', copied: 'Lien copié !', email: 'Email', whatsapp: 'WhatsApp', facebook: 'Facebook', telegram: 'Telegram', twitter: 'X', close: 'Fermer', emailSubject: (t) => `À lire : ${t}` },
  it: { fab: 'Condividi', title: 'Condividi questo articolo', copy: 'Copia link', copied: 'Link copiato!', email: 'Email', whatsapp: 'WhatsApp', facebook: 'Facebook', telegram: 'Telegram', twitter: 'X', close: 'Chiudi', emailSubject: (t) => `Leggi: ${t}` },
};

const BRAND: Record<string, string> = {
  whatsapp: '#25D366',
  facebook: '#1877F2',
  telegram: '#229ED9',
  twitter: '#0f172a',
  email: '#64748b',
};

export function WhatsAppIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.59 5.317l-.999 3.648 3.908-1.024zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}
export function FacebookIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}
export function TelegramIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}
export function XIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
export function InstagramIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

export function ShareBar({ url, title, locale = 'pt' }: { url: string; title: string; locale?: ContentLocale }) {
  const c = COPY[locale] ?? COPY.pt;
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Lock body scroll while the sheet/popover is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const eUrl = encodeURIComponent(url);
  const eTitle = encodeURIComponent(title);

  const links = [
    { key: 'whatsapp', label: c.whatsapp, href: `https://wa.me/?text=${eTitle}%20${eUrl}`, Icon: WhatsAppIcon },
    { key: 'facebook', label: c.facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${eUrl}`, Icon: FacebookIcon },
    { key: 'telegram', label: c.telegram, href: `https://t.me/share/url?url=${eUrl}&text=${eTitle}`, Icon: TelegramIcon },
    { key: 'twitter', label: c.twitter, href: `https://twitter.com/intent/tweet?url=${eUrl}&text=${eTitle}`, Icon: XIcon },
    { key: 'email', label: c.email, href: `mailto:?subject=${encodeURIComponent(c.emailSubject(title))}&body=${eUrl}`, Icon: () => <Mail size={20} aria-hidden /> },
  ] as const;

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [url]);

  const onFabClick = useCallback(async () => {
    // Prefer the OS-native share sheet on mobile — most practical, one tap.
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* cancelled or failed → fall through to in-app panel */
      }
    }
    setOpen(true);
  }, [title, url]);

  if (!mounted) return null;

  const fab = (
    <button
      type="button"
      className="sharefab"
      onClick={onFabClick}
      aria-label={c.fab}
      title={c.fab}
    >
      <Share2 size={22} aria-hidden />
      <span className="sharefab__text">{c.fab}</span>
    </button>
  );

  const panel = open ? (
    <div className="shareov" role="dialog" aria-modal="true" aria-label={c.title} onClick={() => setOpen(false)}>
      <div className="sharepanel" ref={panelRef} onClick={(e) => e.stopPropagation()}>
        <div className="sharepanel__head">
          <span className="sharepanel__title">{c.title}</span>
          <button type="button" className="sharepanel__close" onClick={() => setOpen(false)} aria-label={c.close}>
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="sharepanel__grid">
          {links.map(({ key, label, href, Icon }) => (
            <a
              key={key}
              href={href}
              target={key === 'email' ? undefined : '_blank'}
              rel="noopener noreferrer"
              className="sharepanel__item"
              onClick={() => setOpen(false)}
              style={{ ['--brand' as string]: BRAND[key] }}
            >
              <span className="sharepanel__icon"><Icon /></span>
              <span className="sharepanel__name">{label}</span>
            </a>
          ))}
        </div>

        <button type="button" className={`sharepanel__copy${copied ? ' is-copied' : ''}`} onClick={onCopy}>
          {copied ? <Check size={18} aria-hidden /> : <Link2 size={18} aria-hidden />}
          <span>{copied ? c.copied : c.copy}</span>
        </button>
      </div>
    </div>
  ) : null;

  return createPortal(
    <>
      {fab}
      {panel}
      <style>{`
        .sharefab {
          position: fixed;
          right: 1.25rem;
          /* sit above the mobile bottom nav (~64px + safe area) */
          bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px));
          z-index: 80;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          height: 52px;
          width: 52px;
          padding: 0;
          border: none;
          border-radius: 999px;
          background: var(--color-garabandal-gold, #d4af37);
          color: #fff;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(15,23,42,0.25), 0 2px 6px rgba(212,175,55,0.4);
          transition: transform 0.2s ease, box-shadow 0.2s ease, width 0.25s ease;
          -webkit-tap-highlight-color: transparent;
          overflow: hidden;
        }
        .sharefab > svg { flex: 0 0 auto; }
        .sharefab__text {
          font-size: 0.95rem;
          font-weight: 700;
          white-space: nowrap;
          max-width: 0;
          opacity: 0;
          transition: max-width 0.25s ease, opacity 0.2s ease, margin 0.25s ease;
        }
        .sharefab:active { transform: scale(0.94); }
        .sharefab:focus-visible { outline: 3px solid rgba(212,175,55,0.5); outline-offset: 2px; }
        /* Desktop: no bottom nav → drop lower, expand to a labelled pill on hover */
        @media (min-width: 1024px) {
          .sharefab { height: 56px; width: 56px; bottom: 2rem; right: 2rem; justify-content: center; }
          .sharefab:hover {
            width: auto;
            padding: 0 1.5rem 0 1.25rem;
            gap: 0.6rem;
            transform: translateY(-2px);
            box-shadow: 0 16px 40px rgba(15,23,42,0.32);
          }
          .sharefab:hover .sharefab__text { max-width: 160px; opacity: 1; }
        }

        .shareov {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(15,23,42,0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          animation: shareov-in 0.2s ease;
        }
        @keyframes shareov-in { from { opacity: 0; } to { opacity: 1; } }
        .sharepanel {
          width: 100%;
          max-width: 480px;
          background: #fff;
          border-radius: 24px 24px 0 0;
          padding: 1.25rem 1.25rem calc(1.5rem + env(safe-area-inset-bottom, 0px));
          box-shadow: 0 -20px 60px rgba(15,23,42,0.3);
          animation: sharepanel-up 0.28s cubic-bezier(0.22,1,0.36,1);
        }
        @keyframes sharepanel-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .sharepanel__head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.1rem;
        }
        .sharepanel__title {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--color-garabandal-dark, #0f172a);
        }
        .sharepanel__close {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px; height: 36px;
          border: none; border-radius: 999px;
          background: rgba(15,23,42,0.06);
          color: #475569; cursor: pointer;
          transition: background 0.15s ease;
        }
        .sharepanel__close:hover { background: rgba(15,23,42,0.12); }
        .sharepanel__grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        @media (max-width: 380px) { .sharepanel__grid { grid-template-columns: repeat(4, 1fr); } }
        .sharepanel__item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.25rem;
          border-radius: 14px;
          text-decoration: none;
          color: var(--color-garabandal-dark, #0f172a);
          transition: background 0.15s ease, transform 0.15s ease;
        }
        .sharepanel__item:hover { background: rgba(15,23,42,0.04); }
        .sharepanel__item:active { transform: scale(0.94); }
        .sharepanel__icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 54px; height: 54px;
          border-radius: 999px;
          background: var(--brand, #475569);
          color: #fff;
        }
        .sharepanel__name { font-size: 0.72rem; font-weight: 600; }
        .sharepanel__copy {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.85rem;
          border-radius: 14px;
          border: 1px solid rgba(15,23,42,0.12);
          background: #f8fafc;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--color-garabandal-dark, #0f172a);
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .sharepanel__copy:hover { background: #eef2f7; }
        .sharepanel__copy.is-copied { background: #f0fdf4; color: #15803d; border-color: #86efac; }
        @media (min-width: 640px) {
          .shareov { align-items: center; }
          .sharepanel { border-radius: 24px; margin: 0 1rem; padding-bottom: 1.5rem; animation: sharepanel-pop 0.22s cubic-bezier(0.22,1,0.36,1); }
          @keyframes sharepanel-pop { from { transform: scale(0.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        }
      `}</style>
    </>,
    document.body
  );
}
