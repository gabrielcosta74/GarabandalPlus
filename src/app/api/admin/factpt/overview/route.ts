import { NextResponse } from 'next/server';

import { verifyAdmin } from '../../../../../lib/admin-auth';
import {
  buildFactPtAdminOverview,
  currentLisbonCivilMonthPeriod,
  normalizeFactPtAdminPayments,
  type FactPtAdminDocumentRow,
  type FactPtAdminEnvironment,
  type FactPtAdminPeriod,
  type FactPtAdminSettings,
} from '../../../../../lib/factpt/admin-overview';
import { supabaseServer } from '../../../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FACTPT_DOCUMENT_SELECT = [
  'id',
  'environment',
  'source_type',
  'source_table',
  'source_id',
  'source_reference',
  'series_code',
  'document_type',
  'status',
  'identifier_id',
  'amount',
  'currency',
  'payment_method',
  'payment_confirmed_at',
  'email_to',
  'comments',
  'source_snapshot',
  'fiscal_snapshot',
  'client_action',
  'factpt_document_id',
  'factpt_number',
  'permanent_url',
  'pdf_url',
  'attempt_count',
  'email_attempt_count',
  'next_attempt_at',
  'processing_started_at',
  'last_error_code',
  'last_error',
  'email_last_error',
  'issued_at',
  'email_sent_at',
  'review_prepared_at',
  'approved_at',
  'created_at',
  'updated_at',
].join(', ');

const asRecords = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value)
    ? value.filter(
        (row): row is Record<string, unknown> =>
          Boolean(row) && typeof row === 'object' && !Array.isArray(row),
      )
    : [];

const parseEnvironment = (value: string | null): FactPtAdminEnvironment | null => {
  if (!value) return 'production';
  return value === 'production' || value === 'sandbox' ? value : null;
};

const parsePeriod = (url: URL): FactPtAdminPeriod | null => {
  const fallback = currentLisbonCivilMonthPeriod();
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  const from = fromParam ? new Date(fromParam) : new Date(fallback.from);
  const to = toParam ? new Date(toParam) : new Date(fallback.to);
  if (
    Number.isNaN(from.getTime())
    || Number.isNaN(to.getTime())
    || from.getTime() >= to.getTime()
  ) {
    return null;
  }
  return {
    ...fallback,
    from: from.toISOString(),
    to: to.toISOString(),
    label:
      fromParam || toParam
        ? `${from.toLocaleDateString('pt-PT', {
            timeZone: 'Europe/Lisbon',
          })} – ${new Date(to.getTime() - 1).toLocaleDateString('pt-PT', {
            timeZone: 'Europe/Lisbon',
          })}`
        : fallback.label,
  };
};

export async function GET(request: Request) {
  const { authorized, error: authError } = await verifyAdmin(request);
  if (!authorized) {
    return NextResponse.json(
      { error: authError || 'Unauthorized' },
      { status: 401 },
    );
  }
  if (!supabaseServer) {
    return NextResponse.json(
      { error: 'Database Config Error' },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const environment = parseEnvironment(url.searchParams.get('environment'));
  const period = parsePeriod(url);
  if (!environment || !period) {
    return NextResponse.json(
      {
        error:
          'Filtros inválidos. environment deve ser production/sandbox '
          + 'e from deve ser anterior a to.',
      },
      { status: 400 },
    );
  }

  try {
    const documentsQuery = supabaseServer
      .from('factpt_documents')
      .select(FACTPT_DOCUMENT_SELECT)
      .eq('environment', environment)
      .gte('payment_confirmed_at', period.from)
      .lt('payment_confirmed_at', period.to)
      .order('payment_confirmed_at', { ascending: false });

    const [
      documentsResult,
      settingsResult,
      donationsResult,
      pilgrimageResult,
      storeResult,
      quotaResult,
    ] = await Promise.all([
      documentsQuery,
      supabaseServer
        .from('factpt_settings')
        .select(
          'environment, auto_enabled, go_live_at, '
          + 'production_pilgrimages_only, production_donations_enabled, '
          + 'donations_go_live_at, auto_issue_reconciled_reduniq',
        )
        .eq('environment', environment)
        .maybeSingle(),
      supabaseServer
        .from('donations')
        .select(
          'id, amount_cents, currency, method, status, payment_intent_id, '
          + 'external_reference, metadata, created_at, updated_at, donor_name, donor_email, '
          + 'invoice_sent_at',
        )
        .eq('status', 'succeeded'),
      supabaseServer
        .from('pilgrimage_payments')
        .select(
          'id, user_id, amount, charged_amount, method, status, transaction_id, '
          + 'external_reference, payment_intent_id, verified_at, created_at, '
          + 'deleted, notes, invoice_sent_at',
        )
        .in('status', ['verified', 'succeeded', 'paid', 'manual'])
        .not('deleted', 'is', true),
      supabaseServer
        .from('store_orders')
        .select(
          'id, order_ref, buyer_name, buyer_email, total_amount, currency, '
          + 'status, payment_provider, payment_method, payment_reference, created_at, '
          + 'invoice_sent_at',
        )
        .eq('status', 'paid'),
      supabaseServer
        .from('pagamentos_quotas')
        .select(
          'id, user_id, data_pagamento, valor, metodo_pagamento, estado, '
          + 'payment_intent_id, external_reference, notes, invoice_sent_at',
        )
        .in('estado', ['pago', 'paid']),
    ]);

    const results = [
      ['factpt_documents', documentsResult],
      ['factpt_settings', settingsResult],
      ['donations', donationsResult],
      ['pilgrimage_payments', pilgrimageResult],
      ['store_orders', storeResult],
      ['pagamentos_quotas', quotaResult],
    ] as const;
    const failed = results.find(([, result]) => result.error);
    if (failed) {
      console.error(
        `FACT.pt overview query failed (${failed[0]}):`,
        failed[1].error,
      );
      return NextResponse.json(
        { error: 'Não foi possível carregar os dados de faturação.' },
        { status: 503 },
      );
    }

    const pilgrimageRows = asRecords(pilgrimageResult.data);
    const quotaRows = asRecords(quotaResult.data);
    const userIds = [
      ...pilgrimageRows.map((row) => row.user_id),
      ...quotaRows.map((row) => row.user_id),
    ].filter((value): value is string => typeof value === 'string' && value.length > 0);
    const uniqueUserIds = [...new Set(userIds)];
    const membersResult = uniqueUserIds.length > 0
      ? await supabaseServer
          .from('membros')
          .select('id, nome, email')
          .in('id', uniqueUserIds)
      : { data: [], error: null };
    if (membersResult.error) {
      console.error('FACT.pt overview member query failed:', membersResult.error);
      return NextResponse.json(
        { error: 'Não foi possível carregar os titulares dos pagamentos.' },
        { status: 503 },
      );
    }

    const payments = normalizeFactPtAdminPayments({
      donations: asRecords(donationsResult.data),
      pilgrimagePayments: pilgrimageRows,
      storeOrders: asRecords(storeResult.data),
      quotaPayments: quotaRows,
      members: asRecords(membersResult.data),
    });
    const overview = buildFactPtAdminOverview({
      environment,
      period,
      settings: settingsResult.data as FactPtAdminSettings | null,
      documents: asRecords(documentsResult.data) as unknown as FactPtAdminDocumentRow[],
      payments,
    });

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        ...overview,
      },
      {
        headers: {
          'Cache-Control': 'private, no-store, max-age=0',
        },
      },
    );
  } catch (error) {
    console.error('FACT.pt overview error:', error);
    return NextResponse.json(
      { error: 'Não foi possível carregar a área de faturação.' },
      { status: 500 },
    );
  }
}
