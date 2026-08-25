import Link from 'next/link';
import { Globe } from 'lucide-react';
import type { ContentLocale, TranslationPeer } from '../../lib/content/queries';

const LABEL: Record<ContentLocale, string> = { pt: 'Português', en: 'English', es: 'Español', fr: 'Français', it: 'Italiano' };
// Compact labels used on narrow viewports so the switcher never overflows.
const SHORT: Record<ContentLocale, string> = { pt: 'PT', en: 'EN', es: 'ES', fr: 'FR', it: 'IT' };

/**
 * Inline language switcher rendered next to the article meta.
 * Only shows locales we actually have content for (peers from
 * content_translations, plus the current page itself).
 *
 * Responsive: full language names on wider screens, two-letter codes on
 * phones, and it wraps gracefully when many languages are present.
 * Theme-aware via `tone`: 'dark' on a photo/dark hero, 'light' on a pale hero.
 */
export function LocaleSwitcher({
  current,
  peers,
  basePath,
  tone = 'dark',
}: {
  current: ContentLocale;
  peers: TranslationPeer[];
  /** 'page' for /<slug>, 'post' for /l/<slug> */
  basePath: 'page' | 'post';
  tone?: 'light' | 'dark';
}) {
  // Build entries from peers; ensure current locale is present even if it has no peer row.
  const all = new Map<ContentLocale, { slug: string; title: string }>();
  for (const p of peers) {
    all.set(p.locale, { slug: p.slug, title: p.title });
  }

  if (all.size <= 1) return null;

  const hrefFor = (loc: ContentLocale, slug: string) => {
    const prefix = loc === 'pt' ? '' : `/${loc}`;
    return basePath === 'post' ? `${prefix}/l/${slug}` : `${prefix}/${slug}`;
  };

  return (
    <div className={`locsw locsw--${tone}`}>
      <Globe size={14} aria-hidden className="locsw__icon" />
      <ul className="locsw__list">
        {[...all.entries()].map(([loc, { slug }]) => {
          const isCurrent = loc === current;
          return (
            <li key={loc}>
              {isCurrent ? (
                <span className="locsw__item locsw__item--current" aria-current="true">
                  <span className="locsw__full">{LABEL[loc]}</span>
                  <span className="locsw__short">{SHORT[loc]}</span>
                </span>
              ) : (
                <Link href={hrefFor(loc, slug)} className="locsw__item" hrefLang={loc} title={LABEL[loc]}>
                  <span className="locsw__full">{LABEL[loc]}</span>
                  <span className="locsw__short">{SHORT[loc]}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <style>{`
        .locsw {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          max-width: 100%;
          padding: 0.35rem 0.5rem;
          border-radius: 999px;
        }
        .locsw__icon { flex: 0 0 auto; opacity: 0.7; }
        .locsw__list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
        }
        .locsw__item {
          display: inline-flex;
          align-items: center;
          padding: 0.32rem 0.7rem;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 600;
          line-height: 1;
          letter-spacing: 0.01em;
          text-decoration: none;
          white-space: nowrap;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .locsw__item--current {
          background: var(--color-garabandal-gold, #d4af37);
          color: #fff;
          font-weight: 700;
          box-shadow: 0 2px 8px rgba(212, 175, 55, 0.4);
        }
        .locsw__short { display: none; }

        /* Dark hero (photo / navy background) */
        .locsw--dark {
          background: rgba(15, 23, 42, 0.72);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: #fff;
          backdrop-filter: blur(12px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
        }
        .locsw--dark .locsw__item { color: rgba(255, 255, 255, 0.96); }
        .locsw--dark .locsw__item:hover { background: rgba(255, 255, 255, 0.18); color: #fff; }
        .locsw--dark .locsw__item--current { color: #172033; }

        /* Light hero (pale gradient background) */
        .locsw--light {
          background: rgba(15, 23, 42, 0.05);
          border: 1px solid rgba(15, 23, 42, 0.08);
          color: var(--color-garabandal-dark, #0f172a);
        }
        .locsw--light .locsw__item { color: #475569; }
        .locsw--light .locsw__item:hover { background: rgba(15, 23, 42, 0.08); color: #0f172a; }
        .locsw--light .locsw__item--current { color: #fff; }

        /* ArticleHero owns the actual background. The switcher can be nested
           inside a meta wrapper, so this selector keeps its contrast correct
           even when the tone prop cannot be passed directly to the child. */
        [data-article-hero-tone="dark"] .locsw {
          background: rgba(15, 23, 42, 0.72);
          border-color: rgba(255, 255, 255, 0.3);
          color: #fff;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
        }
        [data-article-hero-tone="dark"] .locsw .locsw__item { color: rgba(255, 255, 255, 0.96); }
        [data-article-hero-tone="dark"] .locsw .locsw__item:hover { background: rgba(255, 255, 255, 0.18); color: #fff; }
        [data-article-hero-tone="dark"] .locsw .locsw__item--current { color: #172033; }

        [data-article-hero-tone="light"] .locsw {
          background: rgba(255, 255, 255, 0.92);
          border-color: rgba(15, 23, 42, 0.16);
          color: #172033;
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.1);
        }
        [data-article-hero-tone="light"] .locsw .locsw__item { color: #334155; }
        [data-article-hero-tone="light"] .locsw .locsw__item:hover { background: rgba(15, 23, 42, 0.08); color: #0f172a; }
        [data-article-hero-tone="light"] .locsw .locsw__item--current { color: #172033; }

        /* Phones: switch to two-letter codes and tighten spacing. */
        @media (max-width: 520px) {
          .locsw__full { display: none; }
          .locsw__short { display: inline; }
          .locsw__item { padding: 0.3rem 0.55rem; font-size: 0.74rem; }
          .locsw__list { gap: 0.2rem; }
        }
      `}</style>
    </div>
  );
}
