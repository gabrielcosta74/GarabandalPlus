import { NextResponse } from 'next/server';
import { buildMarketingContacts, persistMarketingContacts } from '../../../../../lib/marketing-data';
import { jsonError, requireMarketingAdmin } from '../../../../../lib/marketing-api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const contacts = await buildMarketingContacts(auth.supabase);
    const result = await persistMarketingContacts(auth.supabase, contacts);
    return NextResponse.json({
      success: true,
      sourceContacts: contacts.length,
      ...result,
    });
  } catch (error) {
    return jsonError(error, 'Não foi possível sincronizar contactos.');
  }
}
