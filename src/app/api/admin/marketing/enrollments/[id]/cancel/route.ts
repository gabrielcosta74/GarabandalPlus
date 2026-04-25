import { NextResponse } from 'next/server';
import { jsonError, requireMarketingAdmin } from '../../../../../../../lib/marketing-api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const { data, error } = await auth.supabase
      .from('marketing_enrollments')
      .update({ status: 'stopped', stopped_reason: 'admin_cancelled', next_run_at: null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ enrollment: data });
  } catch (error) {
    return jsonError(error, 'Não foi possível cancelar inscrição.');
  }
}
