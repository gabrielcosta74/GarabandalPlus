import { logAdminAudit } from '../../../../../../../lib/admin-audit';
import { linkFile, unlinkFile } from '../../../../../../../lib/ledger/files';
import { UUID, handle, invalid } from '../../../../../../../lib/ledger/files-http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Context = { params: Promise<{ fileId: string }> };
type Body = { type?: unknown; targetId?: unknown; label?: unknown };

/** Link a file to a movement (or a FACT.pt document, payment, cost, agreement). Writes only the link. */
export async function POST(req: Request, context: Context) {
  return handle(req, async admin => {
    const { fileId } = await context.params;
    if (!UUID.test(fileId)) return invalid('Ficheiro inválido.');
    const body = await req.json().catch(() => ({})) as Body;
    await linkFile(fileId, { type: body.type, targetId: body.targetId, label: body.label }, admin.email);
    await logAdminAudit({ adminEmail: admin.email, action: 'ledger.file.link', details: { document_id: fileId, type: body.type, target_id: body.targetId } });
  });
}

export async function DELETE(req: Request, context: Context) {
  return handle(req, async admin => {
    const { fileId } = await context.params;
    if (!UUID.test(fileId)) return invalid('Ficheiro inválido.');
    const body = await req.json().catch(() => ({})) as Body;
    await unlinkFile(fileId, { type: body.type, targetId: body.targetId });
    await logAdminAudit({ adminEmail: admin.email, action: 'ledger.file.unlink', details: { document_id: fileId, type: body.type, target_id: body.targetId } });
  });
}
