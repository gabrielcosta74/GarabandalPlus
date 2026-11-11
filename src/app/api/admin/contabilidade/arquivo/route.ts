import { ACCOUNTING_ARCHIVE_BUCKET, ACCOUNTING_ARCHIVE_ROOT, archiveDisplayName, archivePath } from '../../../../../lib/ledger/accounting-archive';
import { verifyAdmin } from '../../../../../lib/admin-auth';
import { supabaseServer } from '../../../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin.authorized) return Response.json({ error: 'Sem acesso.' }, { status: 403 });
  if (!supabaseServer) return Response.json({ error: 'Arquivo indisponível.' }, { status: 503 });

  const params = new URL(req.url).searchParams;
  const path = archivePath(params.get('path'), false);
  const offset = Number(params.get('offset') || '0');
  if (!path || !Number.isSafeInteger(offset) || offset < 0 || offset > 10000) {
    return Response.json({ error: 'Pasta inválida.' }, { status: 400 });
  }

  const { data, error } = await supabaseServer.storage.from(ACCOUNTING_ARCHIVE_BUCKET).list(path, {
    limit: 200, offset, sortBy: { column: 'name', order: 'asc' },
  });
  if (error) return Response.json({ error: 'Não foi possível carregar o arquivo privado.' }, { status: 503 });

  const items = (data || []).map(item => ({
    name: archiveDisplayName(item.name, item.id !== null),
    path: `${path}/${item.name}`,
    kind: item.id === null ? 'folder' : 'file',
    size: item.id === null ? null : Number(item.metadata?.size || 0),
  })).filter((item): item is typeof item & { name: string } =>
    !!item.name && !!archivePath(item.path, item.kind === 'file'));
  items.sort((a, b) => Number(a.kind === 'file') - Number(b.kind === 'file') || a.name.localeCompare(b.name, 'pt'));
  const breadcrumbs = path.split('/').map((segment, index, parts) => ({
    name: index === 0 ? ACCOUNTING_ARCHIVE_ROOT : archiveDisplayName(segment, false),
    path: parts.slice(0, index + 1).join('/'),
  }));
  return Response.json({ root: ACCOUNTING_ARCHIVE_ROOT, path, breadcrumbs, items,
    nextOffset: offset + (data || []).length, hasMore: (data || []).length === 200 }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
