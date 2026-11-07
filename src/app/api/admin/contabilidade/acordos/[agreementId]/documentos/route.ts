import { logAdminAudit } from '../../../../../../../lib/admin-audit';
import { storeAgreementDocument } from '../../../../../../../lib/ledger/document-store';
import { db, requireAdmin } from '../../../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** The proforma, or the supplier's final invoice once everything is paid. */
export async function POST(req: Request, context: { params: Promise<{ agreementId: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const { agreementId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(agreementId)) return Response.json({ error: 'Acordo inválido.' }, { status: 400 });
  try {
    const { data: agreement, error } = await db().from('supplier_agreements').select('id').eq('id', agreementId).maybeSingle();
    if (error) throw error;
    if (!agreement) return Response.json({ error: 'Acordo não encontrado.' }, { status: 404 });
    const result = await storeAgreementDocument(req, agreementId, admin.email);
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    await logAdminAudit({ adminEmail: admin.email, action: 'ledger.attach_agreement_document', details: { agreement_id: agreementId, document_id: result.id } });
    return Response.json({ ok: true, id: result.id });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível guardar o ficheiro.' }, { status: 500 });
  }
}
