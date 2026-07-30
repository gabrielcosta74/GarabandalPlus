import { NextResponse } from 'next/server';
import { z } from 'zod';

import { logAdminAudit } from '../../../../../../../lib/admin-audit';
import { verifyAdmin } from '../../../../../../../lib/admin-auth';
import { getFactPtUnitId } from '../../../../../../../lib/factpt/config';
import { buildInitialFactPtFiscalSnapshot } from '../../../../../../../lib/factpt/processor';
import { normalizeFactPtTin } from '../../../../../../../lib/factpt/rules';
import { loadFactPtSourceSnapshot } from '../../../../../../../lib/factpt/source-snapshots';
import type { FactPtFiscalSnapshot } from '../../../../../../../lib/factpt/types';
import { supabaseServer } from '../../../../../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const optionalText = (max: number) =>
  z.union([z.string().trim().max(max), z.null()]).optional();

const draftSchema = z.object({
  expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
  customer: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    email: z.string().trim().email().max(254).optional(),
    nif: optionalText(20),
    address: optionalText(100),
    postalCode: optionalText(30),
    city: optionalText(50),
    country: optionalText(2),
    phone: optionalText(30),
  }).strict(),
}).strict();

function cleanOptional(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { authorized, user, error: authError } = await verifyAdmin(request);
  if (!authorized || !user?.id) {
    return NextResponse.json(
      { error: authError || 'Unauthorized' },
      { status: 401 },
    );
  }
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
  }

  const parsed = draftSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Revê os dados fiscais introduzidos.',
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const { data, error } = await supabaseServer
    .from('factpt_documents')
    .select('id, environment, source_type, source_table, source_id, status, fiscal_snapshot, approved_at, updated_at')
    .eq('id', id)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: 'Documento fiscal não encontrado.' }, { status: 404 });
  }
  if (!['awaiting_approval', 'needs_data'].includes(data.status) || data.approved_at) {
    return NextResponse.json(
      { error: 'Este documento já não pode ser alterado antes da emissão.' },
      { status: 409 },
    );
  }

  let fiscal: FactPtFiscalSnapshot;
  if (
    data.fiscal_snapshot
    && typeof data.fiscal_snapshot === 'object'
    && Array.isArray((data.fiscal_snapshot as { lines?: unknown }).lines)
    && (data.fiscal_snapshot as { customer?: unknown }).customer
  ) {
    fiscal = data.fiscal_snapshot as FactPtFiscalSnapshot;
  } else {
    const source = await loadFactPtSourceSnapshot(
      supabaseServer as never,
      data.source_type,
      data.source_id,
      data.source_table,
    );
    fiscal = buildInitialFactPtFiscalSnapshot(
      source,
      getFactPtUnitId(data.environment),
    );
  }

  const customerPatch = parsed.data.customer;
  let normalizedNif = fiscal.customer.nif ?? null;
  if ('nif' in customerPatch) {
    const rawNif = cleanOptional(customerPatch.nif);
    normalizedNif = rawNif ? normalizeFactPtTin(rawNif) : null;
    if (rawNif && !normalizedNif) {
      return NextResponse.json(
        { error: 'O NIF deve conter entre 5 e 15 algarismos.' },
        { status: 400 },
      );
    }
  }

  const nextCustomer = {
    ...fiscal.customer,
    ...('name' in customerPatch ? { name: customerPatch.name!.trim() } : {}),
    ...('email' in customerPatch
      ? { email: customerPatch.email!.trim().toLowerCase() }
      : {}),
    ...('nif' in customerPatch ? { nif: normalizedNif } : {}),
    ...('address' in customerPatch
      ? { address: cleanOptional(customerPatch.address) }
      : {}),
    ...('postalCode' in customerPatch
      ? { postalCode: cleanOptional(customerPatch.postalCode) }
      : {}),
    ...('city' in customerPatch
      ? { city: cleanOptional(customerPatch.city) }
      : {}),
    ...('country' in customerPatch
      ? { country: cleanOptional(customerPatch.country)?.toLowerCase() || null }
      : {}),
    ...('phone' in customerPatch
      ? { phone: cleanOptional(customerPatch.phone) }
      : {}),
  };
  const nextFiscal: FactPtFiscalSnapshot = {
    ...fiscal,
    customer: nextCustomer,
    // A escolha de um cliente remoto anterior deixa de ser válida quando o
    // administrador altera a identidade fiscal.
    existingClientId: undefined,
    existingClientMatchReason: undefined,
  };

  let updateQuery = supabaseServer
    .from('factpt_documents')
    .update({
      fiscal_snapshot: nextFiscal,
      email_to: nextCustomer.email,
      status: 'awaiting_approval',
      document_type: null,
      review_prepared_at: null,
      approved_at: null,
      approved_by: null,
      approved_snapshot_hash: null,
      processing_started_at: null,
      last_error_code: null,
      last_error: null,
    })
    .eq('id', id)
    .in('status', ['awaiting_approval', 'needs_data'])
    .is('approved_at', null);
  if (parsed.data.expectedUpdatedAt) {
    updateQuery = updateQuery.eq('updated_at', parsed.data.expectedUpdatedAt);
  }
  const { data: updated, error: updateError } = await updateQuery
    .select('id, status, fiscal_snapshot, email_to, review_prepared_at, updated_at')
    .single();
  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message || 'O documento foi alterado por outro processo.' },
      { status: 409 },
    );
  }

  await logAdminAudit({
    adminEmail: user.email,
    action: 'factpt_document_draft_updated',
    details: {
      documentId: id,
      updatedFields: Object.keys(customerPatch).map((field) => `customer.${field}`),
    },
  });

  return NextResponse.json({ ok: true, document: updated });
}
