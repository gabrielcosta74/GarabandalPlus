import Link from 'next/link';
import { Globe } from 'lucide-react';
import type { ContentLocale, TranslationPeer } from '../../lib/content/queries';

const LABEL: Record<ContentLocale, string> = { pt: 'Português', en: 'English', es: 'Español', fr: 'Français', it: 'Italiano' };

/**
 * Small inline switcher rendered next to the article meta.
 * Only shows locales we actually have content for (peers from
 * content_translations, plus the current page itself).
 */
export function LocaleSwitcher({
  current,
  peers,
  basePath,
}: {
  current: ContentLocale;
  peers: TranslationPeer[];
  /** 'page' for /<slug>, 'post' for /l/<slug> */
  basePath: 'page' | 'post';
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
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.35rem',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ paddingLeft: '0.5rem', display: 'flex', color: 'inherit', opacity: 0.7 }}>
        <Globe size={14} />
      </div>
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        {[...all.entries()].map(([loc, { slug }]) => {
          const isCurrent = loc === current;
          return isCurrent ? (
            <span
              key={loc}
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: 999,
                background: 'var(--color-garabandal-gold, #d4af37)',
                color: '#fff',
                fontSize: '0.78rem',
                fontWeight: 700,
                letterSpacing: '0.02em',
                boxShadow: '0 2px 8px rgba(212,175,55,0.4)',
              }}
            >
              {LABEL[loc]}
            </span>
          ) : (
            <Link
              key={loc}
              href={hrefFor(loc, slug)}
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: 999,
                color: 'inherit',
                fontSize: '0.78rem',
                fontWeight: 600,
                letterSpacing: '0.02em',
                textDecoration: 'none',
                transition: 'background 0.2s ease',
              }}
              className="hover:bg-white/20"
            >
              {LABEL[loc]}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
