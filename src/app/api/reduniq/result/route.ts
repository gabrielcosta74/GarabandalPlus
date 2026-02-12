import { NextResponse } from 'next/server';
import { reduniqClient } from '../../../../lib/reduniq/client';
import { supabaseServer } from '../../../../lib/supabase';

export const runtime = 'nodejs';

const statusLabels: Record<string, string> = {
  '0': 'Não iniciada',
  '1': 'Aguarda seleção do meio de pagamento',
  '2': 'Em curso',
  '3': 'Erro / terminada',
  '4': 'Sucesso / terminada',
};

async function findTokenByOrderRef(orderRef: string) {
  if (!supabaseServer) return null;

  // Donations (we store Reduniq token in payment_intent_id)
  const { data: donation } = await supabaseServer
    .from('donations')
    .select('payment_intent_id')
    .eq('external_reference', orderRef)
    .maybeSingle();
  if (donation?.payment_intent_id) return String(donation.payment_intent_id);

  // Membership payments
  const { data: quota } = await supabaseServer
    .from('pagamentos_quotas')
    .select('payment_intent_id')
    .eq('external_reference', orderRef)
    .maybeSingle();
  if (quota?.payment_intent_id) return String(quota.payment_intent_id);

  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenParam = searchParams.get('token');
    const orderRef = searchParams.get('orderRef');

    if (!tokenParam && !orderRef) {
      return NextResponse.json({ success: false, message: 'Token ou orderRef em falta.' }, { status: 400 });
    }

    // Prefer token param, but fall back to DB lookup using orderRef.
    let tokenToUse = tokenParam || null;
    if (!tokenToUse && orderRef) {
      tokenToUse = await findTokenByOrderRef(orderRef);
    }
    if (!tokenToUse) {
      return NextResponse.json({ success: false, message: 'Não foi possível obter token para validar.' }, { status: 400 });
    }

    let result = await reduniqClient.getResult(tokenToUse);
    const maybeInvalidTokenCode = result.ok && result.data?.result?.code === '00100007';

    // If token param is invalid, retry using the token we stored when we created the payment.
    if (maybeInvalidTokenCode && orderRef) {
      const storedToken = await findTokenByOrderRef(orderRef);
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
    const resultCode = data?.result?.code || null;
    const resultMessage = data?.result?.message || null;
    const transactionStatus = String(data?.transaction?.status || '');

    const response: Record<string, any> = {
      success: true,
      token: tokenToUse,
      orderRef: orderRef || null,
      resultCode,
      resultMessage,
      transactionStatus,
      statusLabel: statusLabels[transactionStatus] || 'Desconhecido',
      transactionId: data?.transaction?.id || null,
      paymentSolution: data?.payment?.solution || null,
      paymentAmount: data?.payment?.amount || null,
      extraData: Array.isArray(data?.transaction?.extraData) ? data.transaction.extraData : [],
    };

    if (process.env.NODE_ENV !== 'production') {
      response.raw = data;
    }

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error?.message || 'Erro inesperado.',
    }, { status: 500 });
  }
}
