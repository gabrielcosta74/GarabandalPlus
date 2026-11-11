import { fileUrl } from '../../../../../../lib/ledger/files';
import { requireAdmin } from '../../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** A short-lived link to open one document, from whichever bucket holds it. */
export async function GET(req: Request, context: { params: Promise<{ docId: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const { docId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(docId)) return Response.json({ error: 'Documento inválido.' }, { status: 400 });
  try {
    const link = await fileUrl(docId, new URL(req.url).searchParams.has('download'));
    if (!link) return Response.json({ error: 'Documento não encontrado.' }, { status: 404 });
    return Response.json({ url: link.url }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Sem acesso ao ficheiro.' }, { status: 500 });
  }
}
