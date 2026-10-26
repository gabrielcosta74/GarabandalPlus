import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { supabaseServer } from '../../../lib/supabase';
import RezarInvite, { type InvitePreview } from './RezarInvite';

// Convite para "Rezar juntos" da app Garabandal+. O link vai por WhatsApp ou
// mensagem: quem tem a app abre-a já no grupo; quem não tem vê onde a instalar
// e o código. Privado: não entra nos motores de busca.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Convite para rezar juntos · Garabandal+',
  description: 'Abra o convite na app Garabandal+ para rezar em grupo.',
  robots: { index: false, follow: false },
};

const CODE = /^[A-Z0-9]{6,12}$/;

function parsePreview(data: unknown): InvitePreview | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  const title = typeof row.title === 'string' ? row.title : null;
  const startsAt = typeof row.starts_at === 'string' ? row.starts_at : null;
  const kind = row.kind === 'challenge' || row.kind === 'session' ? row.kind : null;
  if (!title || !startsAt || !kind) return null;
  const creator = (row.creator && typeof row.creator === 'object' ? row.creator : {}) as Record<string, unknown>;
  return {
    creatorName: typeof creator.name === 'string' && creator.name.trim() ? creator.name.trim() : null,
    days: typeof row.days === 'number' ? row.days : null,
    goingCount: typeof row.going_count === 'number' ? row.going_count : Number(row.going_count) || 0,
    kind,
    startsAt,
    title,
  };
}

export default async function Page({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  let code: string | null = null;
  try {
    const value = decodeURIComponent(codigo).trim().toUpperCase();
    code = CODE.test(value) ? value : null;
  } catch {
    code = null;
  }
  const english = ((await headers()).get('accept-language') ?? '').toLowerCase().startsWith('en');

  // 'unknown' = não foi possível confirmar (sem servidor ou erro): mostra-se o
  // convite sem detalhes em vez de o dar como terminado.
  let preview: InvitePreview | null | 'unknown' = 'unknown';
  if (code && supabaseServer) {
    const { data, error } = await supabaseServer.rpc('gathering_preview', { p_code: code });
    preview = error ? 'unknown' : parsePreview(data);
  }

  return <RezarInvite code={code} english={english} preview={code ? preview : null} />;
}
