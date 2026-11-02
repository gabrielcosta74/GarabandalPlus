import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { normalizeEmail } from '../../../../lib/marketing-core';
import { verifySvixSignature } from '../../../../lib/svix-signature';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  | 'email.complained'
  | 'email.delivery_delayed'
  | 'email.failed';

const EVENT_MAP: Record<string, { logField: string; eventType: string; title: string }> = {
  'email.delivered': { logField: 'delivered_at', eventType: 'email_delivered', title: 'Email entregue' },
  'email.opened': { logField: 'opened_at', eventType: 'email_opened', title: 'Email aberto' },
  'email.clicked': { logField: 'clicked_at', eventType: 'email_clicked', title: 'Clique no email' },
  'email.bounced': { logField: 'bounced_at', eventType: 'email_bounced', title: 'Email devolvido (bounce)' },
  'email.complained': { logField: 'complained_at', eventType: 'email_complained', title: 'Marcado como spam' },
  'email.delivery_delayed': { logField: 'delayed_at', eventType: 'email_delayed', title: 'Entrega adiada' },
  'email.failed': { logField: 'failed_at', eventType: 'email_failed', title: 'Envio falhado' },
};

// Um bounce 'Transient' (caixa cheia, servidor ocupado) não é uma morada morta:
// só suprime ao fim de vários no mesmo endereço. 'Permanent' e 'Undetermined'
// suprimem logo.
const TRANSIENT_BOUNCES_TO_SUPPRESS = 3;
const TRANSIENT_BOUNCE_WINDOW_DAYS = 30;
const MAX_TRACKED_EVENT_IDS = 20;

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
      // Os reenvios do Resend repetem o mesmo svix-id: sem isto os contadores de
      // aberturas e cliques duplicavam.
      const seenEventIds = Array.isArray(metadata.event_ids) ? (metadata.event_ids as string[]) : [];
      if (seenEventIds.includes(svixId)) {
        return NextResponse.json({ received: true, type, duplicate: true });
      }
      metadata.event_ids = [...seenEventIds, svixId].slice(-MAX_TRACKED_EVENT_IDS);

      if (!metadata[mapping.logField]) metadata[mapping.logField] = occurredAt;
      const counterField = COUNTER_FIELD[type];
      if (counterField) metadata[counterField] = Number(metadata[counterField] || 0) + 1;
      if (type === 'email.clicked' && data.click?.link) metadata.last_click_url = String(data.click.link);
      if (type === 'email.bounced' && data.bounce?.type) metadata.bounce_type = String(data.bounce.type);
      if (type === 'email.bounced' && data.bounce?.message) metadata.bounce_message = String(data.bounce.message).slice(0, 300);

      const { error: updateError } = await supabaseServer
        .from('marketing_message_logs')
        .update({ metadata })
        .eq('id', log.id);
      if (updateError) throw updateError;

      if (log.contact_id) {
        // Upsert dedupla por (contact_id, event_type, source_table, source_id):
        // 1 evento por tipo por email — os contadores vivem no log.
        const { error: eventError } = await supabaseServer.from('marketing_events').upsert(
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
        if (eventError) throw eventError;
      }
    }

    // 2. Bounce definitivo ou queixa de spam suprime o endereço — mesmo que o envio não
    //    seja de marketing, uma morada inválida ou que marcou spam nunca mais deve
    //    receber marketing. Bounces transitórios só suprimem se se repetirem.
    if (SUPPRESSING_EVENTS.has(type) && toEmails.length) {
      const bounceType = String(data.bounce?.type || '');
      for (const email of toEmails) {
        let reason = type === 'email.bounced' ? 'bounce' : 'spam_complaint';

        if (type === 'email.bounced' && bounceType === 'Transient') {
          const since = new Date(Date.now() - TRANSIENT_BOUNCE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
          const { count, error: countError } = await supabaseServer
            .from('marketing_message_logs')
            .select('id', { count: 'exact', head: true })
            .eq('to_email', email)
            .eq('metadata->>bounce_type', 'Transient')
            .gte('created_at', since);
          if (countError) throw countError;
          if ((count || 0) < TRANSIENT_BOUNCES_TO_SUPPRESS) continue;
          reason = 'bounce_repeated_transient';
        }

        const { data: existing } = await supabaseServer
          .from('marketing_suppression_list')
          .select('id')
          .eq('normalized_email', email)
          .maybeSingle();
        if (!existing?.id) {
          const { error: insertError } = await supabaseServer.from('marketing_suppression_list').insert({
            normalized_email: email,
            reason,
            source: 'resend_webhook',
          });
          if (insertError) throw insertError;
        }
        const { error: contactError } = await supabaseServer
          .from('marketing_contacts')
          .update({ consent_state: 'suppressed', lifecycle_stage: 'suppressed', updated_at: new Date().toISOString() })
          .eq('normalized_email', email);
        if (contactError) throw contactError;
      }
    }

    return NextResponse.json({ received: true, type, matchedLog: Boolean(log?.id) });
  } catch (error: any) {
    console.error('[Resend Webhook] Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
