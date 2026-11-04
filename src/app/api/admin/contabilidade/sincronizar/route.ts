import { syncMontepio } from '../../../../../lib/ledger/bank-sync';
import { enrichIncomingMovements, reclassifyOpenMovements } from '../../../../../lib/ledger/enrich';
import { requireAdmin } from '../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  try {
    // The admin is present: send their IP so the bank treats this read as attended.
    const forwarded = req.headers.get('cf-connecting-ip')?.trim()
      || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')?.trim() || '';
    const ipAddress = /^[0-9a-fA-F:.]{3,45}$/.test(forwarded) ? forwarded : '';
    const result = await syncMontepio({
      manual: true,
      psu: ipAddress ? { ipAddress, userAgent: req.headers.get('user-agent') } : undefined,
    });
    await reclassifyOpenMovements().catch(error => console.error('Contabilidade: falhou a reclassificação', error));
    const enriched = await enrichIncomingMovements().catch(error => {
      console.error('Contabilidade: falhou o cruzamento com a faturação', error);
      return null;
    });
    const status = result.status === 'failed' ? 502
        : result.status === 'not_configured' || result.status === 'not_ready' || result.status === 'expired' ? 503 : 200;
    return Response.json({ ...result, enriched }, { status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Não foi possível sincronizar o Montepio. Tente novamente mais tarde.' }, { status: 500 });
  }
}
