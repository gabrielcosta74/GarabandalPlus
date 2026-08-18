import { checkRateLimit } from '../../../../../../lib/rate-limit';
import { supabaseServer } from '../../../../../../lib/supabase';
import { isMobilePublicPilgrimage } from '../../../_lib/pilgrimages';
import {
  authenticateOptionalMobileUser,
  isSafeSlug,
  mobileError,
  mobileSuccess,
  privateCacheHeaders,
} from '../../../_lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const normalizeText = (value: unknown, maxLength: number) => (
  typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const rateLimit = checkRateLimit(request, {
    keyPrefix: 'mobile-pilgrimage-waitlist',
    windowMs: 60_000,
    max: 8,
  });
  if (!rateLimit.allowed) {
    return mobileError(429, 'rate_limited', 'Demasiadas tentativas. Tenta novamente dentro de instantes.');
  }

  const auth = await authenticateOptionalMobileUser(request);
  if (auth.error) return auth.error;
  if (!supabaseServer) {
    return mobileError(503, 'not_configured', 'Serviço temporariamente indisponível.');
  }

  const { slug } = await params;
  if (!isSafeSlug(slug)) {
    return mobileError(400, 'invalid_request', 'Identificador de peregrinação inválido.');
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return mobileError(400, 'invalid_request', 'Pedido JSON inválido.');

  const email = auth.identity?.email || normalizeText(body.email, 200).toLowerCase();
  let fullName = normalizeText(body.fullName ?? body.full_name, 120);
  if (auth.identity && !fullName) {
    const { data: member } = await supabaseServer
      .from('membros')
      .select('nome')
      .eq('id', auth.identity.userId)
      .maybeSingle();
    const metadata = auth.identity.user.user_metadata ?? {};
    fullName = normalizeText(
      member?.nome
      || metadata.full_name
      || metadata.name
      || email.split('@')[0],
      120,
    );
  }
  const phone = normalizeText(body.phone, 40) || null;
  const notes = normalizeText(body.notes, 1000) || null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !fullName) {
    return mobileError(400, 'invalid_request', 'Nome e email válidos são obrigatórios.');
  }

  const { data: pilgrimage, error: pilgrimageError } = await supabaseServer
    .rpc('get_pilgrimage_list', { p_slug: slug })
    .maybeSingle();
  const pilgrimageRow = pilgrimage as Record<string, unknown> | null;
  if (pilgrimageError) {
    console.error('[mobile/pilgrimages/:slug/waitlist] Pilgrimage lookup failed:', pilgrimageError);
    return mobileError(502, 'upstream_error', 'Não foi possível carregar a peregrinação.');
  }
  if (!pilgrimageRow || !isMobilePublicPilgrimage(pilgrimageRow)) {
    return mobileError(404, 'not_found', 'Peregrinação não encontrada.');
  }

  const pilgrimageId = String(pilgrimageRow.id || '');
  const { data: existing, error: existingError } = await supabaseServer
    .from('pilgrimage_waitlists')
    .select('id,status,created_at')
    .eq('pilgrimage_id', pilgrimageId)
    .ilike('email', email)
    .in('status', ['pending', 'active', 'waiting', 'notified'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) {
    console.error('[mobile/pilgrimages/:slug/waitlist] Duplicate lookup failed:', existingError);
    return mobileError(502, 'upstream_error', 'Não foi possível validar a lista de espera.');
  }
  if (existing) {
    return mobileSuccess(
      {
        waitlist: {
          id: existing.id,
          status: existing.status,
          createdAt: existing.created_at,
          duplicate: true,
        },
      },
      { headers: privateCacheHeaders },
    );
  }

  const { data: inserted, error: insertError } = await supabaseServer
    .from('pilgrimage_waitlists')
    .insert({
      pilgrimage_id: pilgrimageId,
      user_id: auth.identity?.userId ?? null,
      email,
      full_name: fullName,
      phone,
      notes,
      status: 'pending',
    })
    .select('id,status,created_at')
    .single();
  if (insertError) {
    console.error('[mobile/pilgrimages/:slug/waitlist] Insert failed:', insertError);
    return mobileError(502, 'upstream_error', 'Não foi possível entrar na lista de espera.');
  }

  return mobileSuccess(
    {
      waitlist: {
        id: inserted.id,
        status: inserted.status,
        createdAt: inserted.created_at,
        duplicate: false,
      },
    },
    { status: 201, headers: privateCacheHeaders },
  );
}
