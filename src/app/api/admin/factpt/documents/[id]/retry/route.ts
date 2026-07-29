import { NextResponse } from 'next/server';

import { verifyAdmin } from '../../../../../../../lib/admin-auth';
import { getFactPtUnitId } from '../../../../../../../lib/factpt/config';
import { buildInitialFactPtFiscalSnapshot } from '../../../../../../../lib/factpt/processor';
import { loadFactPtSourceSnapshot } from '../../../../../../../lib/factpt/source-snapshots';
import { supabaseServer } from '../../../../../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
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
  const { data: document, error } = await supabaseServer
    .from('factpt_documents')
    .select('id, environment, status, last_error_code, source_type, source_table, source_id, fiscal_snapshot')
    .eq('id', id)
    .single();
  if (error || !document) {
    return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
  }
  if (!['failed', 'needs_data'].includes(document.status)) {
    return NextResponse.json(
      { error: 'Apenas documentos com erro ou dados em falta podem ser repetidos.' },
      { status: 409 },
    );
  }
  if (document.last_error_code?.endsWith('_reconciliation_required')) {
    return NextResponse.json(
      {
        error:
          'A emissão ficou ambígua após timeout. Confirme primeiro na FACT.pt se o identifierId já foi emitido.',
      },
      { status: 409 },
    );
  }

  let refreshedFields: Record<string, unknown> = {};
  if (document.status === 'needs_data') {
    try {
      const source = await loadFactPtSourceSnapshot(
        supabaseServer as never,
        document.source_type,
        document.source_id,
        document.source_table,
      );
      const refreshed = buildInitialFactPtFiscalSnapshot(
        source,
        getFactPtUnitId(document.environment),
      );
      const existing =
        document.fiscal_snapshot
        && typeof document.fiscal_snapshot === 'object'
        && Array.isArray((document.fiscal_snapshot as { lines?: unknown }).lines)
          ? document.fiscal_snapshot as Record<string, unknown>
          : null;
      refreshedFields = {
        fiscal_snapshot: existing
          ? { ...existing, customer: refreshed.customer }
          : refreshed,
        email_to: refreshed.customer.email,
      };
    } catch (refreshError) {
      return NextResponse.json(
        {
          error:
            refreshError instanceof Error
              ? refreshError.message
              : 'Os dados fiscais continuam incompletos.',
        },
        { status: 409 },
      );
    }
  }

  const { error: updateError } = await supabaseServer
    .from('factpt_documents')
    .update({
      status: document.status === 'needs_data' ? 'awaiting_approval' : 'pending',
      next_attempt_at: new Date().toISOString(),
      processing_started_at: null,
      last_error: null,
      last_error_code: null,
      ...(document.status === 'needs_data'
        ? {
            review_prepared_at: null,
            approved_at: null,
            approved_by: null,
            approved_snapshot_hash: null,
          }
        : {}),
      ...refreshedFields,
    })
    .eq('id', id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    status: document.status === 'needs_data' ? 'awaiting_approval' : 'pending',
  });
}
