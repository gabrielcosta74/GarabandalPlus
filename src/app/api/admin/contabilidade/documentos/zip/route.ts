// jszip ships with exceljs, a direct dependency, so no new package is installed for this.
import JSZip from 'jszip';

import { archivePaths, listDocuments } from '../../../../../../lib/ledger/document-archive';
import { db, requireAdmin } from '../../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 250 * 1024 * 1024;

/** The month's documents in one ZIP, one folder per category: what the accountant opens. */
export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const period = new URL(req.url).searchParams.get('period') || '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return Response.json({ error: 'Mês inválido.' }, { status: 400 });

  try {
    const documents = await listDocuments({ period });
    if (documents.length === 0) return Response.json({ error: 'Este mês ainda não tem documentos.' }, { status: 404 });
    const total = documents.reduce((sum, document) => sum + (document.sizeBytes || 0), 0);
    if (total > MAX_BYTES) return Response.json({ error: 'O mês tem demasiados ficheiros para um só ZIP. Descarregue por categoria.' }, { status: 413 });

    const zip = new JSZip();
    const paths = archivePaths(documents);
    for (const document of documents) {
      const { data, error } = await db().storage.from(document.storageBucket || 'ledger-documents').download(document.storagePath);
      if (error || !data) throw error || new Error(`Falta o ficheiro ${document.fileName}.`);
      zip.file(paths.get(document.id)!, new Uint8Array(await data.arrayBuffer()));
    }
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
    return new Response(bytes as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="documentos-${period}.zip"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível preparar o ZIP.' }, { status: 500 });
  }
}
