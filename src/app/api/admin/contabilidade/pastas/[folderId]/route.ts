import { logAdminAudit } from '../../../../../../lib/admin-audit';
import { deleteFolder, updateFolder } from '../../../../../../lib/ledger/files';
import { UUID, handle, invalid } from '../../../../../../lib/ledger/files-http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Context = { params: Promise<{ folderId: string }> };

/** Rename or move a folder. */
export async function PATCH(req: Request, context: Context) {
  return handle(req, async admin => {
    const { folderId } = await context.params;
    if (!UUID.test(folderId)) return invalid('Pasta inválida.');
    const body = await req.json().catch(() => ({})) as { name?: unknown; parentId?: unknown };
    await updateFolder(folderId, body);
    await logAdminAudit({ adminEmail: admin.email, action: 'ledger.folder.update', details: { folder_id: folderId, ...body } });
  });
}

/** Only an empty folder can be deleted. */
export async function DELETE(req: Request, context: Context) {
  return handle(req, async admin => {
    const { folderId } = await context.params;
    if (!UUID.test(folderId)) return invalid('Pasta inválida.');
    await deleteFolder(folderId);
    await logAdminAudit({ adminEmail: admin.email, action: 'ledger.folder.delete', details: { folder_id: folderId } });
  });
}
