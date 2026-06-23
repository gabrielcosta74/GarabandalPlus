'use client';

import { useCallback, useEffect, useState } from 'react';
import { Heart, Link2, Check, Sparkles } from 'lucide-react';
import type { ContentLocale } from '../../lib/content/queries';
import { WhatsAppIcon, FacebookIcon, TelegramIcon, XIcon, InstagramIcon } from './ShareBar';

type Copy = {
  eyebrow: string;
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
    eyebrow: 'Ajude a espalhar a mensagem',
    heading: 'Uma partilha pode tocar um coração',
    sub: 'Se este conteúdo o inspirou, partilhe-o com alguém. É assim que a mensagem de Garabandal continua a chegar a novos corações.',
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
    eyebrow: 'Help spread the message',
    heading: 'One share can touch a heart',
    sub: 'If this content inspired you, share it with someone. This is how the message of Garabandal keeps reaching new hearts.',
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
    eyebrow: 'Ayuda a difundir el mensaje',
    heading: 'Compartir puede tocar un corazón',
    sub: 'Si este contenido te inspiró, compártelo con alguien. Así el mensaje de Garabandal sigue llegando a nuevos corazones.',
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
    eyebrow: 'Aidez à diffuser le message',
    heading: 'Un partage peut toucher un cœur',
    sub: "Si ce contenu vous a inspiré, partagez-le avec quelqu'un. C'est ainsi que le message de Garabandal continue d'atteindre de nouveaux cœurs.",
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
    eyebrow: 'Aiuta a diffondere il messaggio',
    heading: 'Una condivisione può toccare un cuore',
    sub: 'Se questo contenuto ti ha ispirato, condividilo con qualcuno. È così che il messaggio di Garabandal continua a raggiungere nuovi cuori.',
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
        <span className="sharecta__eyebrow">
          <Sparkles size={15} aria-hidden /> {c.eyebrow}
        </span>
        <h2 className="sharecta__heading">
          <Heart size={22} aria-hidden className="sharecta__heart" /> {c.heading}
        </h2>
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
          background: linear-gradient(160deg, #fffaf0 0%, #fdf6e3 45%, #f7f3ff 100%);
          border-top: 1px solid rgba(212,175,55,0.25);
          padding: 3rem 1.25rem 3.5rem;
        }
        .sharecta__inner {
          max-width: 680px;
          margin: 0 auto;
          text-align: center;
        }
        .sharecta__eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #b8860b;
          background: rgba(212,175,55,0.14);
          padding: 0.4rem 0.85rem;
          border-radius: 999px;
          margin-bottom: 1rem;
        }
        .sharecta__heading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.55rem;
          font-family: var(--font-serif), Georgia, serif;
          font-size: clamp(1.4rem, 5vw, 1.85rem);
          font-weight: 700;
          line-height: 1.2;
          margin: 0 0 0.75rem;
          color: var(--color-garabandal-dark, #0f172a);
        }
        .sharecta__heart { color: #e11d48; flex: 0 0 auto; }
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
          border-radius: 16px;
          border: none;
          background: var(--brand, #475569);
          color: #fff;
          font-size: 0.95rem;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
          box-shadow: 0 6px 16px rgba(15,23,42,0.12);
          transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .sharecta__btn:hover { transform: translateY(-2px); filter: brightness(1.05); box-shadow: 0 10px 24px rgba(15,23,42,0.18); }
        .sharecta__btn:active { transform: translateY(0); }
        .sharecta__btn:focus-visible { outline: 3px solid rgba(212,175,55,0.5); outline-offset: 2px; }
        .sharecta__btn--ig {
          background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
        }
        .sharecta__btn--copy {
          background: #fff;
          color: var(--color-garabandal-dark, #0f172a);
          border: 1px solid rgba(15,23,42,0.12);
          box-shadow: none;
        }
        .sharecta__btn--copy:hover { background: #f8fafc; }
        .sharecta__btn.is-done {
          background: #16a34a !important;
          color: #fff !important;
          border-color: #16a34a;
        }
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
