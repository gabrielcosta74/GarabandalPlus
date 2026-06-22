"use client";

import { useEffect, useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { checkSlugAction } from '../../../app/admin/cms/actions';
import type { CmsContentType, CmsLocale } from '../../../lib/cms/queries';

type Props = {
  value: string;
  onChange: (next: string) => void;
  type: CmsContentType;
  locale: CmsLocale;
  /** Current row id — excluded from the uniqueness check. */
  excludeId: string;
};

const SLUGIFY = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);

export function SlugInput({ value, onChange, type, locale, excludeId }: Props) {
  const [available, setAvailable] = useState<boolean | null>(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!value) {
      setAvailable(null);
      return;
    }
    setChecking(true);
    const t = window.setTimeout(async () => {
      const r = await checkSlugAction(type, value, locale, excludeId);
      setAvailable(r.available);
      setChecking(false);
    }, 350);
    return () => {
      window.clearTimeout(t);
      setChecking(false);
    };
  }, [value, locale, type, excludeId]);

  const status = checking ? 'checking' : available === true ? 'ok' : available === false ? 'taken' : 'idle';

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={(e) => onChange(SLUGIFY(e.target.value))}
        className="cms-input"
        style={{ paddingRight: 36 }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {status === 'checking' && <Loader2 size={14} className="cms-spin" style={{ color: 'var(--muted)' }} />}
        {status === 'ok' && <Check size={14} style={{ color: '#15803d' }} />}
        {status === 'taken' && <X size={14} style={{ color: '#b91c1c' }} />}
      </span>
      {status === 'taken' && (
        <span style={{ fontSize: '0.72rem', color: '#b91c1c', display: 'block', marginTop: '0.2rem' }}>
          Slug já em uso neste idioma
        </span>
      )}
    </div>
  );
}
