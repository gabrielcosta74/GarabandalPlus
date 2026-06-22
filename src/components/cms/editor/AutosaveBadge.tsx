"use client";

import { CheckCircle2, Loader2, AlertTriangle, Edit3 } from 'lucide-react';
import type { AutosaveStatus } from './useAutosave';

const LABEL: Record<AutosaveStatus, string> = {
  idle: 'Sem alterações',
  dirty: 'A escrever…',
  saving: 'A guardar…',
  saved: 'Guardado',
  error: 'Erro a guardar',
};

const COLOR: Record<AutosaveStatus, string> = {
  idle: 'rgba(15,23,42,0.45)',
  dirty: '#1d4ed8',
  saving: '#1d4ed8',
  saved: '#15803d',
  error: '#b91c1c',
};

export function AutosaveBadge({ status, lastSavedAt }: { status: AutosaveStatus; lastSavedAt: Date | null }) {
  const Icon = ICONS[status];
  const time = lastSavedAt
    ? lastSavedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : null;
  return (
    <span
      role="status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontSize: '0.78rem',
        fontWeight: 600,
        color: COLOR[status],
      }}
    >
      <Icon size={14} className={status === 'saving' ? 'cms-spin' : undefined} />
      <span>{LABEL[status]}{status === 'saved' && time ? ` · ${time}` : ''}</span>
    </span>
  );
}

const ICONS: Record<AutosaveStatus, typeof Loader2> = {
  idle: Edit3,
  dirty: Edit3,
  saving: Loader2,
  saved: CheckCircle2,
  error: AlertTriangle,
};
