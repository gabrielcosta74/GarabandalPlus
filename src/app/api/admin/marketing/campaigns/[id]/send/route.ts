import { NextResponse } from 'next/server';
import { isContactInSegment } from '../../../../../../../lib/marketing-core';
import { buildMarketingContacts } from '../../../../../../../lib/marketing-data';
import { sendMarketingEmail } from '../../../../../../../lib/marketing-email';
import { jsonError, requireMarketingAdmin } from '../../../../../../../lib/marketing-api';
import { countMarketingSendsForContact, getMarketingEmailLimits } from '../../../../../../../lib/marketing-limits';

export const dynamic = 'force-dynamic';

const persistContactForLog = async (supabase: any, contact: any) => {
  if (!contact.normalized_email) return null;
  const { data } = await supabase
    .from('marketing_contacts')
    .upsert(
      {
        normalized_email: contact.normalized_email,
        normalized_phone: contact.normalized_phone,
        display_name: contact.display_name,
        country: contact.country,
        language: contact.language,
        consent_state: contact.consent_state,
        source_summary: contact.source_summary,
        latest_activity_at: contact.latest_activity_at,
        lead_score: contact.lead_score,
        lifecycle_stage: contact.lifecycle_stage,
        recommendation: contact.recommendation,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'normalized_email' },
    )
    .select('id')
    .single();
  return data?.id || null;
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun !== false;
    const limits = getMarketingEmailLimits();

    const { data: campaign, error } = await auth.supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    if (!campaign.subject) return NextResponse.json({ error: 'Campanha sem assunto.' }, { status: 400 });
    if (!campaign.segment_slug) return NextResponse.json({ error: 'Campanha sem segmento.' }, { status: 400 });

    const contacts = (await buildMarketingContacts(auth.supabase))
      .filter((contact) => isContactInSegment(contact, campaign.segment_slug))
      .filter((contact) => contact.normalized_email && contact.consent_state !== 'suppressed' && contact.consent_state !== 'unsubscribed')
      .slice(0, limits.campaignAudienceLimit);

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        limits,
        eligible: contacts.length,
        sample: contacts.slice(0, 10).map((contact) => ({
          id: contact.id,
          name: contact.display_name,
          email: contact.normalized_email,
          score: contact.lead_score,
        })),
      });
    }

    const results = [];
    for (const contact of contacts) {
      const contactId = await persistContactForLog(auth.supabase, contact);
      const sendCounts = await countMarketingSendsForContact(auth.supabase, contactId, new Date(), limits);

      if (sendCounts.recent >= 1 || sendCounts.week >= limits.maxEmailsPer7Days) {
        await auth.supabase.from('marketing_message_logs').insert({
          contact_id: contactId,
          campaign_id: campaign.id,
          to_email: contact.normalized_email,
          subject: campaign.subject,
          template_key: campaign.template_key || 'marketing_generic',
          status: 'skipped',
          error_message: `Limite de frequência atingido (máx. 1 email/dia; teto ${limits.maxEmailsPer7Days} por 7 dias).`,
          metadata: { reason: 'rate_limited', limits, sendCounts },
        });
        results.push({ email: contact.normalized_email, sent: false, skipped: true, reason: 'rate_limited' });
        continue;
      }

      const result = await sendMarketingEmail({
        contact,
        subject: campaign.subject,
        body: campaign.body,
        templateKey: campaign.template_key,
      });

      await auth.supabase.from('marketing_message_logs').insert({
        contact_id: contactId,
        campaign_id: campaign.id,
        channel: 'email',
        to_email: contact.normalized_email,
        provider_message_id: result.providerId || null,
        subject: campaign.subject,
        template_key: campaign.template_key || 'marketing_generic',
        status: result.sent ? 'sent' : 'failed',
        error_message: result.sent ? null : result.error,
        sent_at: result.sent ? new Date().toISOString() : null,
      });

      results.push({ email: contact.normalized_email, sent: result.sent, error: result.error || null });
    }

    await auth.supabase
      .from('marketing_campaigns')
      .update({
        status: 'completed',
        metrics: {
          sent: results.filter((result) => result.sent).length,
          failed: results.filter((result) => result.error).length,
          skipped: results.filter((result) => result.skipped).length,
          eligible: contacts.length,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaign.id);

    return NextResponse.json({ success: true, processed: results.length, results });
  } catch (error) {
    return jsonError(error, 'Não foi possível enviar campanha.');
  }
}
