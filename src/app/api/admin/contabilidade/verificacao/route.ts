import { loadReverseCheck } from '../../../../../lib/ledger/reverse-check-data';
import { isMissingTableError, requireAdmin } from '../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  try {
    return Response.json(await loadReverseCheck(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (isMissingTableError(error as { code?: string; message?: string })) return Response.json({ checked: 0, missing: [] });
    const message = error instanceof Error ? error.message : 'Não foi possível conferir os pagamentos.';
    return Response.json({ error: message }, { status: 500 });
  }
}
