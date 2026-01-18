import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/admin-auth';
import { factptRequest, getFactPtConfig } from '../../../../../lib/factpt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const config = getFactPtConfig(undefined, true);
  if (!config) {
    return NextResponse.json({ message: 'fact.pt nao configurado.' }, { status: 500 });
  }

  try {
    const response = await factptRequest<{ data?: Array<{ id: string }> }>(config, 'GET', '/taxes');
    const count = response?.data?.length ?? 0;
    return NextResponse.json({ ok: true, count, baseUrl: config.baseUrl });
  } catch (err: any) {
    const message = err?.message || 'Erro ao comunicar com fact.pt.';
    return NextResponse.json({ ok: false, message }, { status: 502 });
  }
}
