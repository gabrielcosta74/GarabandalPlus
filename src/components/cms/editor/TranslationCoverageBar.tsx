"use client";

import Link from 'next/link';
import { Languages } from 'lucide-react';
import type { CmsContentType, CmsLocale } from '../../../lib/cms/queries';

const LOCALES: { locale: CmsLocale; label: string }[] = [
  { locale: 'pt', label: 'PT' },
  { locale: 'en', label: 'EN' },
  { locale: 'es', label: 'ES' },
  { locale: 'fr', label: 'FR' },
  { locale: 'it', label: 'IT' },
];

/**
 * Compact translation-coverage strip shown in the editor topbar. Marks which
 * locales already exist for this content's group and links straight into the
 * side-by-side translator so the author can go from a finished PT draft to its
 * translations in one click.
 */
export function TranslationCoverageBar({
  type,
  groupId,
  currentLocale,
  peerLocales,
}: {
  type: CmsContentType;
  groupId: string;
  currentLocale: CmsLocale;
  peerLocales: CmsLocale[];
}) {
  const present = new Set<CmsLocale>([currentLocale, ...peerLocales]);

  return (
    <Link
      href={`/admin/cms/translations/${type}/${groupId}`}
      className="cms-btn cms-btn-ghost"
      title="Abrir tradução lado-a-lado"
      style={{ gap: '0.45rem' }}
    >
      <Languages size={15} />
      <span style={{ display: 'inline-flex', gap: '0.2rem' }}>
        {LOCALES.map((l) => {
          const on = present.has(l.locale);
          return (
            <span
              key={l.locale}
              style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                letterSpacing: '0.03em',
                padding: '0.05rem 0.28rem',
                borderRadius: 4,
                background: on ? 'rgba(21,128,61,0.12)' : 'rgba(15,23,42,0.05)',
                color: on ? '#15803d' : 'var(--muted)',
                opacity: on ? 1 : 0.6,
              }}
              title={on ? `${l.label} existe` : `${l.label} em falta`}
            >
              {l.label}
            </span>
          );
        })}
      </span>
    </Link>
  );
}
