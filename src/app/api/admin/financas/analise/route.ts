import { loadAnalysis } from '../../../../../lib/ledger/analysis-server';
import { requireAdmin } from '../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;

  try {
    return Response.json(await loadAnalysis(), { headers: NO_STORE });
  } catch (error) {
    console.error('[financas/analise]', error);
    return Response.json({ error: 'Não foi possível carregar a análise.' }, { status: 500, headers: NO_STORE });
  }
}
