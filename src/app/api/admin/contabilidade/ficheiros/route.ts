import { logAdminAudit } from '../../../../../lib/admin-audit';
import { listFiles, storeFile, type FileView } from '../../../../../lib/ledger/files';
import { UUID, handle, invalid } from '../../../../../lib/ledger/files-http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Files of one view: ?view=folder&folderId=… | unfiled | unlinked | search&q=… | movement&movementId=…
 */
export async function GET(req: Request) {
  return handle(req, async () => {
    const params = new URL(req.url).searchParams;
    const name = params.get('view') || 'unlinked';
    let view: FileView;
    if (name === 'folder') {
      const folderId = params.get('folderId') || '';
      if (!UUID.test(folderId)) return invalid('Pasta inválida.');
      view = { view: 'folder', folderId };
    } else if (name === 'movement') {
      const movementId = params.get('movementId') || '';
      if (!UUID.test(movementId)) return invalid('Movimento inválido.');
      view = { view: 'movement', movementId };
    } else if (name === 'search') view = { view: 'search', q: (params.get('q') || '').slice(0, 100) };
    else if (name === 'unfiled') view = { view: 'unfiled' };
    else if (name === 'unlinked') view = { view: 'unlinked' };
    else return invalid();
    return { files: await listFiles(view) };
  });
}

/** Upload: multipart with file, kind, optional folderId and movementId. */
export async function POST(req: Request) {
  return handle(req, async admin => {
    const saved = await storeFile(req, admin.email);
    await logAdminAudit({ adminEmail: admin.email, action: 'ledger.file.upload', details: { document_id: saved.id } });
    return { ok: true, id: saved.id };
  });
}
