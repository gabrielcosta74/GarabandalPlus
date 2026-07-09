import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseServer } from '../../../../lib/supabase';
import { normalizeEmail } from '../../../../lib/marketing-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Resend entrega webhooks no formato Svix: a assinatura cobre "{id}.{timestamp}.{payload}"
// com HMAC-SHA256 e o segredo base64 (depois do prefixo whsec_).
export const verifySvixSignature = (secret: string, id: string, timestamp: string, payload: string, signatureHeader: string) => {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', secretBytes).update(`${id}.${timestamp}.${payload}`).digest('base64');
  return signatureHeader.split(' ').some((part) => {
    const candidate = part.includes(',') ? part.split(',')[1] : part;
    if (!candidate || candidate.length !== expected.length) return false;
    try {
      return timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
    } catch {
      return false;
    }
  });
};

// Tolerância anti-replay (Svix recomenda 5 minutos).
const isFreshTimestamp = (timestamp: string, toleranceSeconds = 300) => {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(Date.now() / 1000 - ts) <= toleranceSeconds;
};

type ResendEventType =
  | 'email.delivered'
  | 'email.opened'
  | 'email.clicked'
  | 'email.bounced'
  | 'email.complained';

const EVENT_MAP: Record<string, { logField: string; eventType: string; title: string }> = {
  'email.delivered': { logField: 'delivered_at', eventType: 'email_delivered', title: 'Email entregue' },
  'email.opened': { logField: 'opened_at', eventType: 'email_opened', title: 'Email aberto' },
  'email.clicked': { logField: 'clicked_at', eventType: 'email_clicked', title: 'Clique no email' },
  'email.bounced': { logField: 'bounced_at', eventType: 'email_bounced', title: 'Email devolvido (bounce)' },
  'email.complained': { logField: 'complained_at', eventType: 'email_complained', title: 'Marcado como spam' },
};

const COUNTER_FIELD: Partial<Record<ResendEventType, string>> = {
  'email.opened': 'open_count',
  'email.clicked': 'click_count',
};

// Bounces e queixas de spam suprimem o contacto de todo o marketing futuro.
const SUPPRESSING_EVENTS = new Set<ResendEventType>(['email.bounced', 'email.complained']);

export async function POST(request: Request) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Server Configuration Error' }, { status: 500 });
  }

  const secret = process.env.RESEND_WEBHOOK_SECRET || '';
  if (!secret) {
    return NextResponse.json({ error: 'RESEND_WEBHOOK_SECRET não configurado.' }, { status: 500 });
  }

  const payload = await request.text();
  const svixId = request.headers.get('svix-id') || '';
  const svixTimestamp = request.headers.get('svix-timestamp') || '';
  const svixSignature = request.headers.get('svix-signature') || '';

  if (
    !svixId ||
    !svixTimestamp ||
    !svixSignature ||
    !isFreshTimestamp(svixTimestamp) ||
    !verifySvixSignature(secret, svixId, svixTimestamp, payload, svixSignature)
  ) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: { type?: string; created_at?: string; data?: any };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const type = String(event.type || '') as ResendEventType;
  const mapping = EVENT_MAP[type];
  if (!mapping) {
    // Evento que não seguimos (ex. email.sent) — confirmar receção para o Resend não re-tentar.
    return NextResponse.json({ received: true, ignored: type || 'unknown' });
  }

  const data = event.data || {};
  const providerMessageId = String(data.email_id || '');
  const occurredAt = event.created_at || new Date().toISOString();
  const toEmails: string[] = (Array.isArray(data.to) ? data.to : [data.to])
    .map((value: unknown) => normalizeEmail(value))
    .filter(Boolean) as string[];

  try {
    // 1. Ligar o evento ao envio de marketing (transacionais não estão nos logs — ignoram-se).
    const { data: log } = providerMessageId
      ? await supabaseServer
          .from('marketing_message_logs')
          .select('id,contact_id,template_key,metadata')
          .eq('provider_message_id', providerMessageId)
          .maybeSingle()
      : { data: null };

    if (log?.id) {
      const metadata = { ...(log.metadata || {}) } as Record<string, unknown>;
      if (!metadata[mapping.logField]) metadata[mapping.logField] = occurredAt;
      const counterField = COUNTER_FIELD[type];
      if (counterField) metadata[counterField] = Number(metadata[counterField] || 0) + 1;
      if (type === 'email.clicked' && data.click?.link) metadata.last_click_url = String(data.click.link);
      if (type === 'email.bounced' && data.bounce?.type) metadata.bounce_type = String(data.bounce.type);

      await supabaseServer
        .from('marketing_message_logs')
        .update({ metadata })
        .eq('id', log.id);

      if (log.contact_id) {
        // Upsert dedupla por (contact_id, event_type, source_table, source_id):
        // 1 evento por tipo por email — os contadores vivem no log.
        await supabaseServer.from('marketing_events').upsert(
          {
            contact_id: log.contact_id,
            event_type: mapping.eventType,
            source_table: 'marketing_message_logs',
            source_id: log.id,
            title: `${mapping.title}${log.template_key ? `: ${log.template_key}` : ''}`,
            occurred_at: occurredAt,
            metadata: { template_key: log.template_key, provider_message_id: providerMessageId },
          },
          { onConflict: 'contact_id,event_type,source_table,source_id' },
        );
      }
    }

    // 2. Bounce/queixa suprime o endereço — mesmo que o envio não seja de marketing,
    //    um endereço inválido ou que marcou spam nunca mais deve receber marketing.
    if (SUPPRESSING_EVENTS.has(type) && toEmails.length) {
      for (const email of toEmails) {
        const { data: existing } = await supabaseServer
          .from('marketing_suppression_list')
          .select('id')
          .eq('normalized_email', email)
          .maybeSingle();
        if (!existing?.id) {
          await supabaseServer.from('marketing_suppression_list').insert({
            normalized_email: email,
            reason: type === 'email.bounced' ? 'bounce' : 'spam_complaint',
            source: 'resend_webhook',
          });
        }
        await supabaseServer
          .from('marketing_contacts')
          .update({ consent_state: 'suppressed', lifecycle_stage: 'suppressed', updated_at: new Date().toISOString() })
          .eq('normalized_email', email);
      }
    }

    return NextResponse.json({ received: true, type, matchedLog: Boolean(log?.id) });
  } catch (error: any) {
    console.error('[Resend Webhook] Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
