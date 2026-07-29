import { NextResponse } from 'next/server';
import { z } from 'zod';

import { verifyAdmin } from '../../../../../lib/admin-auth';
import { getFactPtUnitId } from '../../../../../lib/factpt/config';
import { buildInitialFactPtFiscalSnapshot } from '../../../../../lib/factpt/processor';
import { buildFactPtIdentifier } from '../../../../../lib/factpt/rules';
import { loadFactPtSourceSnapshot } from '../../../../../lib/factpt/source-snapshots';
import { getPrivatePilgrimageTestUserId } from '../../../../../lib/pilgrimage-private-test';
import { supabaseServer } from '../../../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  sourceType: z.enum(['quota', 'store', 'donation', 'pilgrimage']),
  sourceId: z.string().uuid(),
  sourceTable: z
    .enum(['pagamentos_quotas', 'store_orders', 'donations', 'pilgrimage_payments'])
    .optional(),
  confirmFictitious: z.literal(true),
});

async function isExplicitPrivatePilgrimageFixture(
  paymentId: string,
  customerUserId: string | null,
) {
  if (!supabaseServer || !customerUserId) return false;

  const { data, error } = await supabaseServer
    .from('pilgrimage_payments')
    .select(`
      booking:bookings(
        user_id,
        notes,
        pilgrimage:pilgrimages(pricing_config)
      )
    `)
    .eq('id', paymentId)
    .maybeSingle();
  if (error || !data?.booking) return false;

  const booking = Array.isArray(data.booking) ? data.booking[0] : data.booking;
  const pilgrimage = Array.isArray(booking?.pilgrimage)
    ? booking.pilgrimage[0]
    : booking?.pilgrimage;
  const privateTestUserId = getPrivatePilgrimageTestUserId(pilgrimage);

  return (
    privateTestUserId === customerUserId
    && booking?.user_id === customerUserId
    && String(booking?.notes || '').includes('[FACTPT:SANDBOX_TEST]')
  );
}

export async function POST(request: Request) {
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

  try {
    const body = bodySchema.parse(await request.json());
    const source = await loadFactPtSourceSnapshot(
      supabaseServer as never,
      body.sourceType,
      body.sourceId,
      body.sourceTable,
    );

    // This route exists only for explicitly selected fictitious sandbox data.
    // A real customer address is never accepted, even though email delivery is
    // separately redirected to the configured sandbox recipient.
    const isPrivatePilgrimageFixture =
      source.sourceType === 'pilgrimage'
      && await isExplicitPrivatePilgrimageFixture(
        source.sourceId,
        source.customer.userId,
      );
    if (
      !source.customer.email.toLowerCase().endsWith('.test')
      && !isPrivatePilgrimageFixture
    ) {
      return NextResponse.json(
        {
          error:
            'A sandbox só aceita emails .test ou uma peregrinação privada FACT.pt explicitamente marcada.',
        },
        { status: 409 },
      );
    }

    const fiscalSnapshot = buildInitialFactPtFiscalSnapshot(
      source,
      getFactPtUnitId(),
    );
    const { data, error } = await supabaseServer
      .from('factpt_documents')
      .insert({
        environment: 'sandbox',
        status: 'awaiting_approval',
        source_type: source.sourceType,
        source_table: source.sourceTable,
        source_id: source.sourceId,
        source_reference: source.sourceReference,
        series_code: source.seriesCode,
        credential_alias: source.seriesCode,
        identifier_id: buildFactPtIdentifier(source.sourceType, source.sourceId),
        amount: source.amount,
        currency: source.currency.toUpperCase(),
        payment_method: source.paymentMethod,
        payment_confirmed_at: source.paymentDate,
        email_to: source.customer.email,
        comments: source.comments,
        source_snapshot: source,
        fiscal_snapshot: fiscalSnapshot,
      })
      .select('id, status, series_code')
      .single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Este pagamento já está na fila FACT.pt sandbox.' },
          { status: 409 },
        );
      }
      throw error;
    }
    return NextResponse.json(
      {
        ok: true,
        document: data,
        message:
          'Dados guardados para validação; nenhuma fatura foi emitida.',
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Pedido sandbox inválido.', details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Falha ao criar teste sandbox.',
      },
      { status: 500 },
    );
  }
}
