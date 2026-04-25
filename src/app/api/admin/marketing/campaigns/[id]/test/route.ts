import { NextResponse } from 'next/server';
import { renderMarketingEmail, sendMarketingEmail } from '../../../../../../../lib/marketing-email';
import { jsonError, requireMarketingAdmin } from '../../../../../../../lib/marketing-api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { data: campaign, error } = await auth.supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;

    const testEmail = String(body?.testEmail || auth.user?.email || '').trim().toLowerCase();
    if (!testEmail.includes('@')) return NextResponse.json({ error: 'Email de teste inválido.' }, { status: 400 });

    const contact = {
      display_name: 'Teste Admin',
      normalized_email: testEmail,
      language: 'pt' as const,
      recommendation: 'Pré-visualização da campanha',
      source_summary: {},
    };

    if (body?.send === true) {
      const result = await sendMarketingEmail({
        contact,
        subject: campaign.subject || campaign.name,
        body: campaign.body,
        templateKey: campaign.template_key,
      });

      await auth.supabase.from('marketing_message_logs').insert({
        campaign_id: campaign.id,
        channel: 'email',
        to_email: testEmail,
        provider_message_id: result.providerId || null,
        subject: campaign.subject || campaign.name,
        template_key: campaign.template_key || 'brochure_followup_1',
        status: result.sent ? 'test' : 'failed',
        error_message: result.sent ? null : result.error,
        sent_at: result.sent ? new Date().toISOString() : null,
        metadata: { test: true },
      });

      return NextResponse.json({ sent: result.sent, error: result.error || null });
    }

    return NextResponse.json({
      preview: renderMarketingEmail({
        contact,
        subject: campaign.subject || campaign.name,
        body: campaign.body,
        templateKey: campaign.template_key,
      }),
    });
  } catch (error) {
    return jsonError(error, 'Não foi possível testar campanha.');
  }
}
