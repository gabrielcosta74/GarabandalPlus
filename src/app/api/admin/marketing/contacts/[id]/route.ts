import { NextResponse } from 'next/server';
import { buildMarketingContacts } from '../../../../../../lib/marketing-data';
import { jsonError, requireMarketingAdmin } from '../../../../../../lib/marketing-api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const contacts = await buildMarketingContacts(auth.supabase);
    const contact = contacts.find((item) => item.id === id);
    if (!contact) return NextResponse.json({ error: 'Contacto não encontrado.' }, { status: 404 });

    const { data: persisted } = contact.normalized_email
      ? await auth.supabase
          .from('marketing_contacts')
          .select('id,consent_state,recommendation,lead_score,lifecycle_stage')
          .eq('normalized_email', contact.normalized_email)
          .maybeSingle()
      : { data: null };

    const messages = persisted?.id
      ? await auth.supabase.from('marketing_message_logs').select('*').eq('contact_id', persisted.id).order('created_at', { ascending: false }).limit(20)
      : { data: [] };

    return NextResponse.json({
      contact,
      persisted,
      messages: messages.data || [],
    });
  } catch (error) {
    return jsonError(error, 'Não foi possível carregar contacto.');
  }
}
