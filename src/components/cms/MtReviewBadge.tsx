import { Sparkles } from 'lucide-react';

/**
 * Amber "machine-translated, needs review" chip. Shown on rows whose
 * mt_unreviewed flag is set (filled by the batch AI translator, cleared on the
 * next manual save). Two sizes: inline (tables/headers) and a slightly larger
 * pill for editor topbars.
 */
export function MtReviewBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      title="Tradução automática (IA) ainda por rever. Abre, revê e guarda para marcar como revista."
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: compact ? '0.05rem 0.3rem' : '0.15rem 0.45rem',
        borderRadius: 999,
        background: 'rgba(180,83,9,0.12)',
        color: '#b45309',
        fontSize: compact ? '0.6rem' : '0.7rem',
        fontWeight: 700,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      <Sparkles size={compact ? 10 : 12} /> IA · por rever
    </span>
  );
}
