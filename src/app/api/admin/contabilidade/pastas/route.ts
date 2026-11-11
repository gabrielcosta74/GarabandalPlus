import { logAdminAudit } from '../../../../../lib/admin-audit';
import { createFolder, filesReady, listFolders } from '../../../../../lib/ledger/files';
import { handle } from '../../../../../lib/ledger/files-http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Every folder with its file counts, plus the "Sem pasta" and "Por ligar" totals. */
export async function GET(req: Request) {
  return handle(req, async () => {
    if (!(await filesReady())) return { ready: false, folders: [], unfiled: 0, unlinked: 0, total: 0 };
    return { ready: true, ...(await listFolders()) };
  });
}

export async function POST(req: Request) {
  return handle(req, async admin => {
    const body = await req.json().catch(() => ({})) as { name?: unknown; parentId?: unknown };
    const id = await createFolder(body, admin.email);
    await logAdminAudit({ adminEmail: admin.email, action: 'ledger.folder.create', details: { folder_id: id, name: body.name } });
    return { ok: true, id };
  });
}
