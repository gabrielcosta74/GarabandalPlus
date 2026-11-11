import { ACCOUNTING_ARCHIVE_BUCKET, archiveDisplayName, archivePath } from '../../../../../../lib/ledger/accounting-archive';
import { verifyAdmin } from '../../../../../../lib/admin-auth';
import { supabaseServer } from '../../../../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin.authorized || !admin.user?.email) return Response.json({ error: 'Sem acesso.' }, { status: 403 });
  if (!supabaseServer) return Response.json({ error: 'Arquivo indisponível.' }, { status: 503 });

  const path = archivePath(new URL(req.url).searchParams.get('path'), true);
  if (!path) return Response.json({ error: 'Documento inválido.' }, { status: 400 });

  const { data, error } = await supabaseServer.storage.from(ACCOUNTING_ARCHIVE_BUCKET).download(path);
  if (error || !data) return Response.json({ error: 'Documento não encontrado no arquivo privado.' }, { status: 404 });

  // Log the exact file before releasing sensitive accounting data.
  const { error: auditError } = await supabaseServer.from('admin_audit_logs').insert({
    admin_email: admin.user.email,
    member_id: null,
    action: 'ledger.archive.download',
    details: { path },
  });
  if (auditError) return Response.json({ error: 'Não foi possível registar o acesso ao documento.' }, { status: 503 });

  const fileName = archiveDisplayName(path.split('/').at(-1) || '', true) || 'documento';
  const extension = fileName.split('.').at(-1)?.toLowerCase() || 'bin';
  const fallback = `documento.${extension === 'jpeg' ? 'jpg' : extension}`;
  return new Response(data.stream(), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(data.size),
      'Content-Disposition': `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
