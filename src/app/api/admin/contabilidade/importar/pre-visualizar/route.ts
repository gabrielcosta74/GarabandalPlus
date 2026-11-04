import { markDuplicates, readStatementFile } from '../../../../../../lib/ledger/read-statement';
import {
  getMontepioAccount,
  loadCustomRules,
  loadExistingFingerprints,
  readFormFile,
  requireAdmin,
  statementRequestTooLarge,
} from '../../../../../../lib/ledger/server';
import { supabaseServer } from '../../../../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Reads a Montepio statement and returns what an import would do, without
 * writing anything: movements, suggested categories, duplicates and the
 * balance check. Works before the ledger tables exist (preview mode).
 */
export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  if (statementRequestTooLarge(req)) return Response.json({ error: 'O ficheiro é demasiado grande (máximo 10 MB).' }, { status: 413 });

  try {
    const file = readFormFile(await req.formData());
    const bytes = new Uint8Array(await file.arrayBuffer());

    const account = await getMontepioAccount();
    const accountId = account?.id || 'montepio';
    const customRules = account ? await loadCustomRules() : [];

    const preview = await readStatementFile(file.name, bytes, { accountId, customRules });
    if (account) {
      const existing = await loadExistingFingerprints(preview.periodFrom, preview.periodTo);
      markDuplicates(preview, existing);
    }

    let alreadyImportedAt: string | null = null;
    if (account && supabaseServer) {
      const { data } = await supabaseServer
        .from('bank_import_batches')
        .select('created_at')
        .eq('file_sha256', preview.fileSha256)
        .maybeSingle();
      alreadyImportedAt = (data?.created_at as string) || null;
    }

    return Response.json({ dbReady: !!account, alreadyImportedAt, preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível ler o extrato.';
    return Response.json({ error: message }, { status: 400 });
  }
}
