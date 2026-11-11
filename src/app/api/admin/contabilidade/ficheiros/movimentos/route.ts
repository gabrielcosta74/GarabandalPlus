import { movementCandidates } from '../../../../../../lib/ledger/files';
import { handle } from '../../../../../../lib/ledger/files-http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Movements to link a file to (?q= text or amount, ?period=YYYY-MM). Read only. */
export async function GET(req: Request) {
  return handle(req, async () => {
    const params = new URL(req.url).searchParams;
    return { movements: await movementCandidates({ q: params.get('q')?.slice(0, 80), period: params.get('period') }) };
  });
}
