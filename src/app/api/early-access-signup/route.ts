import { NextResponse } from 'next/server';
import { checkRateLimit } from '../../../lib/rate-limit';
import { supabaseServer } from '../../../lib/supabase';

const CAMPAIGN_SLUG = 'caminho-mariano-2027';
const CAMPAIGN_TITLE = 'Caminho Mariano 2027 — acesso antecipado';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
}

function getWhatsAppGroupUrl() {
  const raw = process.env.EARLY_ACCESS_WHATSAPP_GROUP_URL?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname === 'chat.whatsapp.com' ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 10_000) {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 413 });
  }

  const rateLimit = checkRateLimit(request, {
    keyPrefix: 'early-access-signup',
    windowMs: 60_000,
    max: 6,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Foram feitas demasiadas tentativas. Aguarde um minuto e tente novamente.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  if (!supabaseServer) {
    return NextResponse.json({ error: 'O registo está temporariamente indisponível.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const name = cleanText(body?.name, 80);
    const email = cleanText(body?.email, 254).toLowerCase();
    const website = cleanText(body?.website, 200);
    const consent = body?.consent === true;

    // Honeypot: respond as if successful, but do not persist automated submissions.
    if (website) {
      return NextResponse.json({ success: true, whatsappUrl: null });
    }

    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json({ error: 'Indique um email válido.' }, { status: 400 });
    }
    if (!consent) {
      return NextResponse.json({ error: 'É necessário aceitar a comunicação sobre o acesso antecipado.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const leadData = {
      source: 'early_access_page',
      campaign_slug: CAMPAIGN_SLUG,
      campaign_title: CAMPAIGN_TITLE,
      pilgrimage_title: CAMPAIGN_TITLE,
      locale: body?.locale === 'en' ? 'en' : 'pt',
      consent_state: 'explicit',
      consented_at: now,
      early_access_opens_on: '2026-10-13',
      public_registration_opens_on: '2026-10-15',
      whatsapp_group_offered: true,
    };

    const { data: existing, error: lookupError } = await supabaseServer
      .from('booking_leads')
      .select('id')
      .eq('status', 'interested')
      .eq('email', email)
      .filter('data->>campaign_slug', 'eq', CAMPAIGN_SLUG)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (existing?.id) {
      const { error: updateError } = await supabaseServer
        .from('booking_leads')
        .update({ ...(name ? { name } : {}), email, data: leadData, updated_at: now })
        .eq('id', existing.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabaseServer.from('booking_leads').insert({
        name: name || null,
        email,
        phone: null,
        pilgrimage_id: null,
        status: 'interested',
        step_reached: 0,
        data: leadData,
      });
      if (insertError) throw insertError;
    }

    return NextResponse.json(
      {
        success: true,
        alreadyRegistered: Boolean(existing?.id),
        whatsappUrl: getWhatsAppGroupUrl(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[EarlyAccessSignup] Failed to register contact:', error);
    return NextResponse.json({ error: 'Não foi possível concluir o registo. Tente novamente.' }, { status: 500 });
  }
}
