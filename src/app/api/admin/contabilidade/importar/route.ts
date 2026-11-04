import { logAdminAudit } from '../../../../../lib/admin-audit';
import { readStatementFile } from '../../../../../lib/ledger/read-statement';
import { movementMatchKey } from '../../../../../lib/ledger/classify';
import { enrichIncomingMovements } from '../../../../../lib/ledger/enrich';
import {
  db,
  getMontepioAccount,
  loadCustomRules,
  readFormFile,
  requireAdmin,
  statementRequestTooLarge,
} from '../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Saves a Montepio statement. The file is parsed again on the server (the
 * browser preview is never trusted) and stored atomically through
 * ledger_import_statement: all lines or none, duplicates skipped.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  if (statementRequestTooLarge(req)) return Response.json({ error: 'O ficheiro é demasiado grande (máximo 10 MB).' }, { status: 413 });

  try {
    const account = await getMontepioAccount();
    if (!account) {
      return Response.json(
        { error: 'As tabelas da contabilidade ainda não foram criadas. A importação fica disponível depois de aplicar a migração.' },
        { status: 503 },
      );
    }

    const file = readFormFile(await req.formData());
    const bytes = new Uint8Array(await file.arrayBuffer());
    const preview = await readStatementFile(file.name, bytes, {
      accountId: account.id,
      customRules: await loadCustomRules(),
    });

    const { data: previous } = await db()
      .from('bank_import_batches')
      .select('created_at, imported_by')
      .eq('file_sha256', preview.fileSha256)
      .maybeSingle();
    if (previous) {
      return Response.json(
        { error: `Este ficheiro já foi importado (${String(previous.created_at).slice(0, 10)}, ${previous.imported_by || 'admin'}).` },
        { status: 409 },
      );
    }

    const rows = preview.rows.map(row => ({
      booking_date: row.bookingDate,
      value_date: row.valueDate,
      amount: row.amount.toFixed(2),
      description_raw: row.description,
      balance_after: row.balanceAfter === null ? null : row.balanceAfter.toFixed(2),
      fingerprint: row.fingerprint,
      match_key: movementMatchKey(row.description),
      parsed_kind: row.kind,
      counterparty_name: row.counterpartyName,
      category_code: row.categoryCode,
      status: row.categoryCode ? 'suggested' : 'unreviewed',
      needs_document: row.needsDocument,
      raw: {
        source_row: row.sourceRow,
        suggested_category: row.suggestedCategoryCode,
      },
    }));

    const { data, error } = await db().rpc('ledger_import_statement', {
      p_batch: {
        account_id: account.id,
        source: preview.source,
        file_name: preview.fileName,
        file_sha256: preview.fileSha256,
        imported_by: admin.email,
        period_from: preview.periodFrom,
        period_to: preview.periodTo,
        balance_ok: preview.balanceOk,
        warnings: preview.warnings,
      },
      p_rows: rows,
    });
    if (error) throw new Error(error.message);

    const result = data as { batch_id: string; rows_new: number; rows_duplicate: number };
    await enrichIncomingMovements().catch(error => console.error('Contabilidade: falhou o cruzamento com a faturação', error));
    await logAdminAudit({
      adminEmail: admin.email,
      action: 'ledger.statement_imported',
      details: {
        batch_id: result.batch_id,
        file_name: preview.fileName,
        period_from: preview.periodFrom,
        period_to: preview.periodTo,
        rows_new: result.rows_new,
        rows_duplicate: result.rows_duplicate,
        balance_ok: preview.balanceOk,
      },
    });

    return Response.json({ ok: true, ...result, periodFrom: preview.periodFrom, periodTo: preview.periodTo });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível importar o extrato.';
    return Response.json({ error: message }, { status: 400 });
  }
}
