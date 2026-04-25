import { NextResponse } from 'next/server';
import { processMarketingEnrollment } from '../../../../../../../lib/marketing-automation-engine';
import { jsonError, requireMarketingAdmin } from '../../../../../../../lib/marketing-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const { data: enrollment, error } = await auth.supabase
      .from('marketing_enrollments')
      .select('*, contact:marketing_contacts(*), funnel:marketing_funnels(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    if (!enrollment) return NextResponse.json({ error: 'Follow-up não encontrado.' }, { status: 404 });

    const result = await processMarketingEnrollment(auth.supabase, enrollment);
    return NextResponse.json({ result });
  } catch (error) {
    return jsonError(error, 'Não foi possível enviar agora.');
  }
}
