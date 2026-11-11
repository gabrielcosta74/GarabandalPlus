import { logAdminAudit } from '../../../../../../lib/admin-audit';
import { deleteFile, fileUrl, getFile, updateFile } from '../../../../../../lib/ledger/files';
import { UUID, handle, invalid } from '../../../../../../lib/ledger/files-http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Context = { params: Promise<{ fileId: string }> };

/** One file with its links; ?url=1 (or ?download=1) returns a 5-minute link to the bytes. */
export async function GET(req: Request, context: Context) {
  return handle(req, async () => {
    const { fileId } = await context.params;
    if (!UUID.test(fileId)) return invalid('Ficheiro inválido.');
    const params = new URL(req.url).searchParams;
    if (params.has('url') || params.has('download')) {
      const link = await fileUrl(fileId, params.has('download'));
      if (!link) return Response.json({ error: 'Ficheiro não encontrado.' }, { status: 404 });
      return link;
    }
    const file = await getFile(fileId);
    if (!file) return Response.json({ error: 'Ficheiro não encontrado.' }, { status: 404 });
    return { file };
  });
}

/** Move to another folder, change the kind or rename. */
export async function PATCH(req: Request, context: Context) {
  return handle(req, async admin => {
    const { fileId } = await context.params;
    if (!UUID.test(fileId)) return invalid('Ficheiro inválido.');
    const body = await req.json().catch(() => ({})) as { folderId?: unknown; kind?: unknown; fileName?: unknown };
    await updateFile(fileId, body);
    await logAdminAudit({ adminEmail: admin.email, action: 'ledger.file.update', details: { document_id: fileId, ...body } });
  });
}

export async function DELETE(req: Request, context: Context) {
  return handle(req, async admin => {
    const { fileId } = await context.params;
    if (!UUID.test(fileId)) return invalid('Ficheiro inválido.');
    const removed = await deleteFile(fileId);
    await logAdminAudit({ adminEmail: admin.email, action: 'ledger.file.delete', details: { document_id: fileId, file_name: removed.fileName } });
  });
}
