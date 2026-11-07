import { listAgreements } from '../../../../../../lib/ledger/agreements';
import { db, requireAdmin } from '../../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Read only. One agreement with its payments and its documents. */
export async function GET(req: Request, context: { params: Promise<{ agreementId: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const { agreementId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(agreementId)) return Response.json({ error: 'Acordo inválido.' }, { status: 400 });
  try {
    const [agreement] = (await listAgreements({ ids: [agreementId] })) || [];
    if (!agreement) return Response.json({ error: 'Acordo não encontrado.' }, { status: 404 });
    const { data: links, error } = await db().from('bank_transaction_links').select('bank_transaction_id').eq('target_type', 'agreement').eq('target_id', agreementId);
    if (error) throw error;
    const ids = (links || []).map(link => link.bank_transaction_id as string);
    const [movements, files] = await Promise.all([
      ids.length ? db().from('bank_transactions').select('id, booking_date, amount, description_raw, period').in('id', ids).order('booking_date') : Promise.resolve({ data: [], error: null }),
      db().from('expense_documents').select('id, file_name, doc_kind, storage_path, bank_transaction_id, agreement_id')
        .or(`agreement_id.eq.${agreementId}${ids.length ? `,bank_transaction_id.in.(${ids.join(',')})` : ''}`),
    ]);
    for (const result of [movements, files]) if (result.error) throw result.error;
    const documents = await Promise.all((files.data || []).map(async file => {
      const { data: signed } = await db().storage.from('ledger-documents').createSignedUrl(file.storage_path, 300);
      return { id: file.id, fileName: file.file_name, kind: file.doc_kind, onAgreement: !!file.agreement_id, movementId: file.bank_transaction_id, url: signed?.signedUrl ?? null };
    }));
    return Response.json({ agreement, payments: movements.data || [], documents }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível ler o acordo.' }, { status: 500 });
  }
}
