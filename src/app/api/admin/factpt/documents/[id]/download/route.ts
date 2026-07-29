import { NextResponse } from 'next/server';

import { verifyAdmin } from '../../../../../../../lib/admin-auth';
import { FactPtClient } from '../../../../../../../lib/factpt/client';
import { getFactPtConfig } from '../../../../../../../lib/factpt/config';
import type {
  FactPtEnvironment,
  FactPtSourceType,
} from '../../../../../../../lib/factpt/types';
import { supabaseServer } from '../../../../../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { authorized, error: authError } = await verifyAdmin(request);
  if (!authorized) {
    return NextResponse.json(
      { error: authError || 'Unauthorized' },
      { status: 401 },
    );
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
  }

  const { id } = await context.params;
  const { data, error } = await supabaseServer
    .from('factpt_documents')
    .select('environment, source_type, factpt_document_id, factpt_number')
    .eq('id', id)
    .single();
  if (error || !data?.factpt_document_id) {
    return NextResponse.json(
      { error: 'Documento FACT.pt emitido não encontrado.' },
      { status: 404 },
    );
  }

  try {
    const client = new FactPtClient(
      getFactPtConfig(
        data.source_type as FactPtSourceType,
        data.environment as FactPtEnvironment,
      ),
    );
    const pdf = await client.downloadDocumentPdf(data.factpt_document_id);
    const filename = `${data.factpt_number || data.factpt_document_id}.pdf`
      .replace(/[^a-z0-9_.-]+/gi, '-');
    return new Response(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (downloadError) {
    return NextResponse.json(
      {
        error:
          downloadError instanceof Error
            ? downloadError.message
            : 'Falha no download.',
      },
      { status: 502 },
    );
  }
}
