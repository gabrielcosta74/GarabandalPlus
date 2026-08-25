'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link2, Check } from 'lucide-react';
import type { ContentLocale } from '../../lib/content/queries';
import { WhatsAppIcon, FacebookIcon, TelegramIcon, XIcon, InstagramIcon } from './ShareBar';

type Copy = {
  heading: string;
  sub: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  telegram: string;
  twitter: string;
  copy: string;
  copied: string;
  igHint: string;
};

const COPY: Record<ContentLocale, Copy> = {
  pt: {
    heading: 'Partilhe este artigo',
    sub: 'Se este conteúdo lhe foi útil, envie-o a alguém que também possa gostar de o ler.',
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    facebook: 'Facebook',
    telegram: 'Telegram',
    twitter: 'X',
    copy: 'Copiar ligação',
    copied: 'Ligação copiada!',
    igHint: 'Ligação copiada — cole no seu story ou bio do Instagram',
  },
  en: {
    heading: 'Share this article',
    sub: 'If this article was helpful, send it to someone who may also appreciate reading it.',
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    facebook: 'Facebook',
    telegram: 'Telegram',
    twitter: 'X',
    copy: 'Copy link',
    copied: 'Link copied!',
    igHint: 'Link copied — paste it in your Instagram story or bio',
  },
  es: {
    heading: 'Comparte este artículo',
    sub: 'Si este artículo te ha resultado útil, envíalo a alguien a quien también le pueda interesar.',
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    facebook: 'Facebook',
    telegram: 'Telegram',
    twitter: 'X',
    copy: 'Copiar enlace',
    copied: '¡Enlace copiado!',
    igHint: 'Enlace copiado — pégalo en tu historia o bio de Instagram',
  },
  fr: {
    heading: 'Partagez cet article',
    sub: "Si cet article vous a été utile, envoyez-le à une personne qui pourrait aussi souhaiter le lire.",
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    facebook: 'Facebook',
    telegram: 'Telegram',
    twitter: 'X',
    copy: 'Copier le lien',
    copied: 'Lien copié !',
    igHint: 'Lien copié — collez-le dans votre story ou bio Instagram',
  },
  it: {
    heading: 'Condividi questo articolo',
    sub: 'Se questo articolo ti è stato utile, invialo a qualcuno che potrebbe apprezzarne la lettura.',
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    facebook: 'Facebook',
    telegram: 'Telegram',
    twitter: 'X',
    copy: 'Copia link',
    copied: 'Link copiato!',
    igHint: 'Link copiato — incollalo nella tua storia o bio di Instagram',
  },
};

export function ShareCTA({ url, title, locale = 'pt' }: { url: string; title: string; locale?: ContentLocale }) {
  const c = COPY[locale] ?? COPY.pt;
  const [copied, setCopied] = useState(false);
  const [igCopied, setIgCopied] = useState(false);

  // Reset toast after a moment
  useEffect(() => {
    if (!copied && !igCopied) return;
    const t = setTimeout(() => {
      setCopied(false);
      setIgCopied(false);
    }, 2400);
    return () => clearTimeout(t);
  }, [copied, igCopied]);

  const eUrl = encodeURIComponent(url);
  const eTitle = encodeURIComponent(title);

  const copyLink = useCallback(async (kind: 'copy' | 'ig') => {
    try {
      await navigator.clipboard.writeText(url);
      if (kind === 'ig') setIgCopied(true);
      else setCopied(true);
    } catch {
      /* clipboard unavailable */
    }
  }, [url]);

  const networks = [
    { key: 'whatsapp', label: c.whatsapp, color: '#25D366', href: `https://wa.me/?text=${eTitle}%20${eUrl}`, Icon: WhatsAppIcon },
    { key: 'facebook', label: c.facebook, color: '#1877F2', href: `https://www.facebook.com/sharer/sharer.php?u=${eUrl}`, Icon: FacebookIcon },
    { key: 'telegram', label: c.telegram, color: '#229ED9', href: `https://t.me/share/url?url=${eUrl}&text=${eTitle}`, Icon: TelegramIcon },
    { key: 'twitter', label: c.twitter, color: '#0f172a', href: `https://twitter.com/intent/tweet?url=${eUrl}&text=${eTitle}`, Icon: XIcon },
  ];

  return (
    <section className="sharecta" aria-label={c.heading}>
      <div className="sharecta__inner">
        <h2 className="sharecta__heading">{c.heading}</h2>
        <p className="sharecta__sub">{c.sub}</p>

        <div className="sharecta__grid">
          {networks.map(({ key, label, color, href, Icon }) => (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="sharecta__btn"
              style={{ ['--brand' as string]: color }}
            >
              <Icon size={22} />
              <span>{label}</span>
            </a>
          ))}

          {/* Instagram has no web share URL → copy link for story/bio */}
          <button
            type="button"
            className={`sharecta__btn sharecta__btn--ig${igCopied ? ' is-done' : ''}`}
            onClick={() => copyLink('ig')}
            style={{ ['--brand' as string]: '#e1306c' }}
          >
            {igCopied ? <Check size={22} /> : <InstagramIcon size={22} />}
            <span>{igCopied ? c.copied : c.instagram}</span>
          </button>

          <button
            type="button"
            className={`sharecta__btn sharecta__btn--copy${copied ? ' is-done' : ''}`}
            onClick={() => copyLink('copy')}
          >
            {copied ? <Check size={22} /> : <Link2 size={22} />}
            <span>{copied ? c.copied : c.copy}</span>
          </button>
        </div>

        <p className={`sharecta__toast${igCopied ? ' is-visible' : ''}`} role="status" aria-live="polite">
          {c.igHint}
        </p>
      </div>

      <style>{`
        .sharecta {
          background: #fff;
          border-top: 1px solid rgba(15,23,42,0.1);
          padding: 3.5rem 1.25rem 4rem;
        }
        .sharecta__inner {
          max-width: 680px;
          margin: 0 auto;
          text-align: center;
        }
        .sharecta__heading {
          font-family: var(--font-serif), Georgia, serif;
          font-size: clamp(1.5rem, 5vw, 1.9rem);
          font-weight: 700;
          line-height: 1.2;
          margin: 0 0 0.75rem;
          color: var(--color-garabandal-dark, #0f172a);
        }
        .sharecta__sub {
          font-size: 1rem;
          line-height: 1.6;
          color: #475569;
          margin: 0 auto 1.75rem;
          max-width: 540px;
        }
        .sharecta__grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.7rem;
        }
        @media (min-width: 560px) {
          .sharecta__grid { grid-template-columns: repeat(3, 1fr); }
        }
        .sharecta__btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          padding: 0.95rem 1rem;
          min-height: 54px;
          border-radius: 12px;
          border: 1px solid rgba(15,23,42,0.12);
          background: #fff;
          color: #1e293b;
          font-size: 0.95rem;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(15,23,42,0.05);
          transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .sharecta__btn svg { color: var(--brand, #475569); }
        .sharecta__btn:hover { transform: translateY(-2px); background: #f8fafc; box-shadow: 0 8px 18px rgba(15,23,42,0.1); }
        .sharecta__btn:active { transform: translateY(0); }
        .sharecta__btn:focus-visible { outline: 3px solid rgba(212,175,55,0.5); outline-offset: 2px; }
        .sharecta__btn--ig {
          background: #fff;
        }
        .sharecta__btn--copy {
          color: var(--color-garabandal-dark, #0f172a);
          --brand: #334155;
        }
        .sharecta__btn--copy:hover { background: #f8fafc; }
        .sharecta__btn.is-done {
          background: #16a34a !important;
          color: #fff !important;
          border-color: #16a34a;
        }
        .sharecta__btn.is-done svg { color: #fff; }
        .sharecta__toast {
          margin: 1rem 0 0;
          font-size: 0.85rem;
          font-weight: 600;
          color: #15803d;
          opacity: 0;
          transform: translateY(-4px);
          transition: opacity 0.2s ease, transform 0.2s ease;
          pointer-events: none;
        }
        .sharecta__toast.is-visible { opacity: 1; transform: translateY(0); }
      `}</style>
    </section>
  );
}
