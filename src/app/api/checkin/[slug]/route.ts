import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { checkinSubmissionSchema } from '../../../../lib/pilgrimage-checkin';
import { checkRateLimit } from '../../../../lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
  }

  const rateLimit = checkRateLimit(request, {
    keyPrefix: 'pilgrimage-checkin',
    windowMs: 60 * 60 * 1000,
    max: 20,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Foram enviados demasiados formulários. Tente novamente mais tarde.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  const { slug } = await params;
  const body = await request.json().catch(() => null);
  const parsed = checkinSubmissionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Confirme os campos assinalados.', fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { data: pilgrimage, error: pilgrimageError } = await supabaseServer
    .from('pilgrimages')
    .select('id, checkin_form_enabled')
    .eq('slug', slug)
    .eq('checkin_form_enabled', true)
    .maybeSingle();

  if (pilgrimageError) {
    console.error('Erro ao validar formulário de check-in:', pilgrimageError.message);
    return NextResponse.json({ error: 'Não foi possível validar este formulário.' }, { status: 500 });
  }

  if (!pilgrimage) {
    return NextResponse.json({ error: 'Este formulário não está disponível.' }, { status: 404 });
  }

  const { privacy_consent: _consent, website: _website, ...submission } = parsed.data;
  const { error } = await supabaseServer
    .from('pilgrimage_checkin_submissions')
    .insert({
      ...submission,
      pilgrimage_id: pilgrimage.id,
      email: submission.email.toLowerCase(),
    });

  if (error) {
    console.error('Erro ao guardar dados de check-in:', error.message);
    return NextResponse.json({ error: 'Não foi possível guardar os dados. Tente novamente.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
