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

    const result = await reduniqClient.getResult(tokenToUse);
    if (!result.ok) {
      return NextResponse.json({
        success: false,
        message: result.error || `Erro ao contactar Reduniq (HTTP ${result.status}).`,
      }, { status: 502 });
    }

    const data = result.data || {};
    const transactionStatus = String(data?.transaction?.status || '');
    const transactionId = data?.transaction?.id ? String(data.transaction.id) : null;
    const paymentSolution = data?.payment?.solution ? String(data.payment.solution) : null;
    const paymentAmount = data?.payment?.amount ? String(data.payment.amount) : null;
    const extraData = Array.isArray(data?.transaction?.extraData) ? data.transaction.extraData : [];
    const orderRefFromResult = extractOrderRefFromResult(data);
    const referenceToMatch = orderRefFromResult || orderRefParam;

    if (!referenceToMatch) {
      return NextResponse.json({ success: false, message: 'Não foi possível obter orderRef do pagamento.' }, { status: 400 });
    }

    const isSuccess = transactionStatus === '4';
    const isFailed = transactionStatus === '3';
    const paymentDate = parsePaymentDate(data);

    let updated = false;

    // 1) Store Orders
    const { data: storeOrder } = await supabaseServer.from('store_orders').select('*').eq('order_ref', referenceToMatch).maybeSingle();
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
        await handleStoreSuccess(ctx);
        updated = true;
      } else if (isFailed) {
        await handlePaymentFailedOrCanceled(ctx, 'failed');
        updated = true;
      }
    }

    // 2) Donations
    if (!updated) {
      const { data: donation } = await supabaseServer.from('donations').select('*').eq('external_reference', referenceToMatch).maybeSingle();
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
            reduniqTransactionId: transactionId,
          },
          paymentDate,
        };

        if (isSuccess) {
          updated = await handleDonationSuccess(ctx);
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
      const { data: quota } = await supabaseServer.from('pagamentos_quotas').select('*').eq('external_reference', referenceToMatch).maybeSingle();
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
          updated = await handleMembershipSuccess(ctx);
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
        .eq('external_reference', referenceToMatch)
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
          updated = await handlePilgrimageSuccess(ctx);
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
      orderRef: referenceToMatch,
      resultCode: data?.result?.code || null,
      resultMessage: data?.result?.message || null,
      transactionStatus,
      statusLabel: statusLabels[transactionStatus] || 'Desconhecido',
      transactionId,
      paymentSolution,
      paymentAmount,
      extraData,
      ...(process.env.NODE_ENV !== 'production' ? { raw: data } : {}),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error?.message || 'Erro inesperado.',
    }, { status: 500 });
  }
}
