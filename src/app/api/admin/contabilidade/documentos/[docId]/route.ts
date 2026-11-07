import { db, requireAdmin } from '../../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** A short-lived link to open one document. */
export async function GET(req: Request, context: { params: Promise<{ docId: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const { docId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(docId)) return Response.json({ error: 'Documento inválido.' }, { status: 400 });
  const { data, error } = await db().from('expense_documents').select('storage_path').eq('id', docId).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: 'Documento não encontrado.' }, { status: 404 });
  const { data: signed, error: signError } = await db().storage.from('ledger-documents').createSignedUrl(data.storage_path, 300);
  if (signError || !signed) return Response.json({ error: signError?.message || 'Sem acesso ao ficheiro.' }, { status: 500 });
  return Response.json({ url: signed.signedUrl }, { headers: { 'Cache-Control': 'no-store' } });
}
