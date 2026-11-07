import { listDocuments } from '../../../../../lib/ledger/document-archive';
import { requireAdmin } from '../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Read only. The year's documents, for the folder view. */
export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const year = new URL(req.url).searchParams.get('year') || String(new Date().getFullYear());
  if (!/^\d{4}$/.test(year)) return Response.json({ error: 'Ano inválido.' }, { status: 400 });
  try {
    // Storage paths stay on the server; the page opens files through signed links.
    const documents = (await listDocuments({ year })).map(document => ({ ...document, storagePath: undefined }));
    return Response.json({ year, documents }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível ler os documentos.' }, { status: 500 });
  }
}
