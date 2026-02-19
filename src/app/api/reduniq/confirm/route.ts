import { NextResponse } from 'next/server';
import { z } from 'zod';
import { reduniqClient } from '../../../../lib/reduniq/client';
import { supabaseServer } from '../../../../lib/supabase';
import {
  handleDonationSuccess,
  handleMembershipSuccess,
  handlePilgrimageSuccess,
  handleStoreSuccess,
  handlePaymentFailedOrCanceled,
  PaymentHandlerContext,
} from '../../../../lib/payment-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  orderRef: z.string().trim().min(3).optional(),
  token: z.string().trim().min(10).optional(),
});

const statusLabels: Record<string, string> = {
  '0': 'Não iniciada',
  '1': 'Aguarda seleção do meio de pagamento',
  '2': 'Em curso',
  '3': 'Erro / terminada',
  '4': 'Sucesso / terminada',
};

async function findTokenByOrderRef(orderRef: string) {
  if (!supabaseServer) return null;

  const { data: donation } = await supabaseServer
    .from('donations')
    .select('payment_intent_id')
    .eq('external_reference', orderRef)
    .maybeSingle();
  if (donation?.payment_intent_id) return String(donation.payment_intent_id);

  const { data: quota } = await supabaseServer
    .from('pagamentos_quotas')
    .select('payment_intent_id')
    .eq('external_reference', orderRef)
    .maybeSingle();
  if (quota?.payment_intent_id) return String(quota.payment_intent_id);

  const { data: storeOrder } = await supabaseServer
    .from('store_orders')
    .select('payment_reference')
    .eq('order_ref', orderRef)
    .maybeSingle();
  if (storeOrder?.payment_reference) return String(storeOrder.payment_reference);

  const { data: pilgrimagePayment } = await supabaseServer
    .from('pilgrimage_payments')
    .select('payment_intent_id')
    .eq('external_reference', orderRef)
    .maybeSingle();
  if (pilgrimagePayment?.payment_intent_id) return String(pilgrimagePayment.payment_intent_id);

  return null;
}

function extractOrderRefFromResult(data: any): string | null {
  if (data?.order?.ref) return String(data.order.ref);
  const privateData = Array.isArray(data?.privateData) ? data.privateData : [];
  const fromPrivate = privateData.find((item: any) => item?.name === 'orderRef')?.value;
  if (fromPrivate) return String(fromPrivate);
  return null;
}

function parsePaymentDate(data: any): Date | undefined {
  const raw = data?.transaction?.date;
  if (!raw || typeof raw !== 'string') return undefined;
  // Expected formats in docs: "YYYY-MM-DD HH:mm:ss" (sometimes with +00)
  const normalized = raw.trim().replace(' ', 'T');
  const maybeIso = normalized.includes('T') ? normalized : raw;
  const dt = new Date(maybeIso);
  if (Number.isNaN(dt.getTime())) return undefined;
  return dt;
}

function normalizeGatewayStatus(value: any): string {
  if (value === null || value === undefined) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (['0', '1', '2', '3', '4'].includes(raw)) return raw;
  const normalized = raw.toLowerCase();
  if (normalized === 'success' || normalized === 'succeeded' || normalized === 'paid') return '4';
  if (normalized === 'failed' || normalized === 'error' || normalized === 'canceled' || normalized === 'cancelled') return '3';
  if (normalized === 'pending' || normalized === 'processing' || normalized === 'in_progress') return '2';
  return '';
}

function parseGatewayDate(value: any): number {
  if (!value) return 0;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  if (typeof value !== 'string') return 0;
  const normalized = value.trim().replace(' ', 'T');
  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) return 0;
  return dt.getTime();
}

type SearchTxCandidate = {
  status: string;
  transactionId: string | null;
  orderRef: string | null;
  at: number;
};

function collectSearchTxCandidates(node: any, bucket: SearchTxCandidate[] = [], depth = 0): SearchTxCandidate[] {
  if (!node || depth > 6) return bucket;
  if (Array.isArray(node)) {
    for (const item of node) collectSearchTxCandidates(item, bucket, depth + 1);
    return bucket;
  }
  if (typeof node !== 'object') return bucket;

  const rawStatus =
    node.status ??
    node.transactionStatus ??
    node.state ??
    node.transaction?.status ??
    null;
  const status = normalizeGatewayStatus(rawStatus);
  if (status) {
    const privateData = Array.isArray(node.privateData) ? node.privateData : [];
    const orderRef =
      node.orderRef ||
      node.order_ref ||
      node.order?.ref ||
      node.ref ||
      privateData.find((item: any) => item?.name === 'orderRef')?.value ||
      privateData.find((item: any) => item?.name === 'order.ref')?.value ||
      null;
    const transactionId = node.transactionId || node.transaction_id || node.transaction?.id || node.id || null;
    const at = parseGatewayDate(
      node.date ||
      node.createdAt ||
      node.created_at ||
      node.transactionDate ||
      node.updatedAt ||
      node.updated_at ||
      node.transaction?.date ||
      null,
    );
    bucket.push({
      status,
      transactionId: transactionId ? String(transactionId) : null,
      orderRef: orderRef ? String(orderRef) : null,
      at,
    });
  }

  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') {
      collectSearchTxCandidates(value, bucket, depth + 1);
    }
  }
  return bucket;
}

async function findBestStatusByOrderRef(orderRef: string): Promise<SearchTxCandidate | null> {
  const lookup = await reduniqClient.searchTransactions({ orderRef, limit: 25 });
  if (!lookup.ok) return null;

  const all = collectSearchTxCandidates(lookup.data);
  if (!all.length) return null;

  const sameRef = all.filter((candidate) => !candidate.orderRef || candidate.orderRef === orderRef);
  const pool = sameRef.length ? sameRef : all;

  const score = (status: string) => {
    if (status === '4') return 4;
    if (status === '2') return 3;
    if (status === '1') return 2;
    if (status === '0') return 1;
    return 0;
  };

  const [best] = [...pool].sort((a, b) => {
    const scoreDiff = score(b.status) - score(a.status);
    if (scoreDiff !== 0) return scoreDiff;
    return b.at - a.at;
  });
  return best || null;
}

export async function POST(request: Request) {
  try {
    if (!supabaseServer) {
      return NextResponse.json({ success: false, message: 'Db indisponível' }, { status: 500 });
    }

    const body = bodySchema.parse(await request.json());
    const orderRefParam = body.orderRef || null;
    const tokenParam = body.token || null;

    if (!orderRefParam && !tokenParam) {
      return NextResponse.json({ success: false, message: 'Token ou orderRef em falta.' }, { status: 400 });
    }

    let tokenToUse = tokenParam;
    if (!tokenToUse && orderRefParam) {
      tokenToUse = await findTokenByOrderRef(orderRefParam);
    }
    if (!tokenToUse) {
      return NextResponse.json({ success: false, message: 'Não foi possível obter token para validar.' }, { status: 400 });
    }

    let result = await reduniqClient.getResult(tokenToUse);
    const maybeInvalidTokenCode = result.ok && result.data?.result?.code === '00100007';

    // If token from URL is invalid, fall back to the token stored for this orderRef.
    if (maybeInvalidTokenCode && orderRefParam) {
      const storedToken = await findTokenByOrderRef(orderRefParam);
      if (storedToken && storedToken !== tokenToUse) {
        result = await reduniqClient.getResult(storedToken);
        tokenToUse = storedToken;
      }
    }

    if (!result.ok) {
      return NextResponse.json({
        success: false,
        message: result.error || `Erro ao contactar Reduniq (HTTP ${result.status}).`,
      }, { status: 502 });
    }

    const data = result.data || {};
    let transactionStatus = normalizeGatewayStatus(data?.transaction?.status);
    let transactionId = data?.transaction?.id ? String(data.transaction.id) : null;
    const paymentSolution = data?.payment?.solution ? String(data.payment.solution) : null;
    const paymentAmount = data?.payment?.amount ? String(data.payment.amount) : null;
    let resultCode = data?.result?.code ? String(data.result.code) : null;
    let resultMessage = data?.result?.message ? String(data.result.message) : null;
    const extraData = Array.isArray(data?.transaction?.extraData) ? data.transaction.extraData : [];
    let orderRefFromResult = extractOrderRefFromResult(data);
    const shouldTrySearchFallback = Boolean(orderRefParam) && (
      resultCode === '00100007' ||
      resultCode === '10000000999' ||
      transactionStatus === '3' ||
      !transactionStatus
    );
    if (shouldTrySearchFallback && orderRefParam) {
      const fallback = await findBestStatusByOrderRef(orderRefParam);
      if (fallback) {
        const fallbackImprovesStatus =
          fallback.status === '4' ||
          ((fallback.status === '2' || fallback.status === '1' || fallback.status === '0') && transactionStatus !== '4');
        if (fallbackImprovesStatus) {
          transactionStatus = fallback.status;
          if (fallback.transactionId) transactionId = fallback.transactionId;
          if (!orderRefFromResult && fallback.orderRef) orderRefFromResult = fallback.orderRef;
          if (resultCode === '00100007' || resultCode === '10000000999') {
            resultCode = '00000000';
            if (fallback.status === '4') {
              resultMessage = 'Pagamento confirmado após validação adicional.';
            } else if (!resultMessage) {
              resultMessage = 'Pagamento em processamento.';
            }
          }
        }
      }
    }

    if (transactionStatus === '3') {
      console.warn('[Reduniq][Confirm] Pagamento devolvido como falha.', {
        orderRef: orderRefParam || orderRefFromResult || null,
        token: tokenToUse,
        resultCode,
        resultMessage,
      });
    }

    const resolvedReference = orderRefFromResult || orderRefParam;
    if (!resolvedReference) {
      return NextResponse.json({ success: false, message: 'Não foi possível obter orderRef do pagamento.' }, { status: 400 });
    }

    const isSuccess = transactionStatus === '4';
    const isFailed = transactionStatus === '3';
    const paymentDate = parsePaymentDate(data);

    let updated = false;
    let storePayload: {
      digitalDownloadLinks?: Array<{ name: string; url: string }>;
      buyerEmail?: string;
      accountExists?: boolean;
      hasDigital?: boolean;
      hasPhysical?: boolean;
    } | null = null;

    // 1) Store Orders
    const { data: storeOrder } = await supabaseServer.from('store_orders').select('*').eq('order_ref', resolvedReference).maybeSingle();
    if (storeOrder) {
      const ctx: PaymentHandlerContext = {
        supabaseServer,
        amountCents: Math.round((storeOrder.total_amount || 0) * 100),
        currency: storeOrder.currency || 'EUR',
        paymentReference: tokenToUse,
        externalReference: storeOrder.order_ref,
        method: 'reduniq',
        metadata: { type: 'store', orderRef: storeOrder.order_ref, reduniqTransactionId: transactionId },
        customerDetails: { name: storeOrder.buyer_name, email: storeOrder.buyer_email },
        paymentDate,
      };

      if (isSuccess) {
        const storeResult = await handleStoreSuccess(ctx);
        if (storeResult) {
          storePayload = {
            digitalDownloadLinks: storeResult.digitalDownloadLinks || [],
            buyerEmail: storeResult.buyerEmail,
            accountExists: storeResult.accountExists,
            hasDigital: storeResult.hasDigital,
            hasPhysical: storeResult.hasPhysical,
          };
        }
        updated = true;
      } else if (isFailed) {
        await handlePaymentFailedOrCanceled(ctx, 'failed');
        updated = true;
      }
    }

    // 2) Donations
    if (!updated) {
      const { data: donation } = await supabaseServer.from('donations').select('*').eq('external_reference', resolvedReference).maybeSingle();
      if (donation) {
        const ctx: PaymentHandlerContext = {
          supabaseServer,
          amountCents: donation.amount_cents,
          currency: donation.currency,
          paymentReference: tokenToUse,
          externalReference: donation.external_reference,
          method: 'reduniq',
          metadata: {
            type: 'donation',
            userId: donation.user_id,
            donorName: donation.donor_name,
            donorEmail: donation.donor_email,
            donorNif: donation.donor_nif,
            donorAddress: donation.donor_address,
            donorCity: donation.donor_city,
            donorZip: donation.donor_zip,
            donorCountry: donation.donor_country,
            receiptRequired: donation.receipt_required,
            reduniq_method: (donation.metadata as any)?.reduniq_method || null,
            reduniqTransactionId: transactionId,
          },
          paymentDate,
        };

        if (isSuccess) {
          await handleDonationSuccess(ctx);
          updated = true;
        } else if (isFailed) {
          await handlePaymentFailedOrCanceled(ctx, 'failed');
          updated = true;
        }

        if (transactionId && supabaseServer) {
          const nextMeta = { ...(donation.metadata || {}), reduniqTransactionId: transactionId, reduniqToken: tokenToUse, reduniqSolution: paymentSolution };
          await supabaseServer.from('donations').update({ metadata: nextMeta }).eq('id', donation.id);
        }
      }
    }

    // 3) Membership
    if (!updated) {
      const { data: quota } = await supabaseServer.from('pagamentos_quotas').select('*').eq('external_reference', resolvedReference).maybeSingle();
      if (quota) {
        const ctx: PaymentHandlerContext = {
          supabaseServer,
          amountCents: Math.round((quota.valor || 0) * 100),
          currency: 'EUR',
          paymentReference: tokenToUse,
          externalReference: quota.external_reference,
          method: 'reduniq',
          metadata: { type: 'membership', userId: quota.user_id, reduniqTransactionId: transactionId },
          paymentDate,
        };

        if (isSuccess) {
          await handleMembershipSuccess(ctx);
          updated = true;
        } else if (isFailed) {
          await handlePaymentFailedOrCanceled(ctx, 'failed');
          updated = true;
        }
      }
    }

    // 4) Pilgrimages
    if (!updated) {
      const { data: pilgrimagePayment } = await supabaseServer
        .from('pilgrimage_payments')
        .select('*')
        .eq('external_reference', resolvedReference)
        .maybeSingle();

      if (pilgrimagePayment) {
        const ctx: PaymentHandlerContext = {
          supabaseServer,
          amountCents: Math.round((pilgrimagePayment.amount || 0) * 100),
          currency: 'EUR',
          paymentReference: tokenToUse,
          externalReference: pilgrimagePayment.external_reference,
          method: 'reduniq',
          metadata: { type: 'pilgrimage_payment', booking_id: pilgrimagePayment.booking_id, reduniqTransactionId: transactionId },
          paymentDate,
        };

        if (isSuccess) {
          await handlePilgrimageSuccess(ctx);
          updated = true;
        } else if (isFailed) {
          await handlePaymentFailedOrCanceled(ctx, 'failed');
          updated = true;
        }
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      token: tokenToUse,
      orderRef: resolvedReference,
      resultCode,
      resultMessage,
      transactionStatus,
      statusLabel: statusLabels[transactionStatus] || 'Desconhecido',
      transactionId,
      paymentSolution,
      paymentAmount,
      extraData,
      ...(storePayload || {}),
      ...(process.env.NODE_ENV !== 'production' ? { raw: data } : {}),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error?.message || 'Erro inesperado.',
    }, { status: 500 });
  }
}
