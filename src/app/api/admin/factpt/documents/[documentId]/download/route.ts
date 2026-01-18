import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../../lib/admin-auth';
import { downloadFactPtDocumentPdf, getFactPtConfig } from '../../../../../../../lib/factpt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { documentId: string } },
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const config = getFactPtConfig(undefined, true);
  if (!config) {
    return NextResponse.json({ message: 'fact.pt nao configurado.' }, { status: 500 });
  }

  const documentId = params.documentId;
  if (!documentId) {
    return NextResponse.json({ message: 'Documento invalido.' }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = await downloadFactPtDocumentPdf(documentId, config);
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || 'Erro ao descarregar documento.' },
      { status: 502 },
    );
  }
  const contentType = 'application/pdf';
  const filename = `documento-${documentId}.pdf`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
