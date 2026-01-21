import { NextResponse } from 'next/server';
import { stripe } from '../../../../lib/payments';
import { supabaseServer } from '../../../../lib/supabase';
import { processPaidStoreOrder } from '../../../../lib/store-orders';


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!stripe) return NextResponse.json({ message: 'Stripe não configurado' }, { status: 500 });
  if (!supabaseServer) {
    return NextResponse.json({ message: 'Supabase não configurado' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : null;

  if (!sessionId) {
    return NextResponse.json({ message: 'Session ID ausente' }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const type = (session.metadata?.type as 'store' | undefined) ?? undefined;
    const orderRef = session.metadata?.orderRef || session.metadata?.order_ref || null;

    if (type !== 'store' || !orderRef) {
      return NextResponse.json({ message: 'Sessão inválida para loja' }, { status: 400 });
    }

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return NextResponse.json({ ok: false, status: session.payment_status }, { status: 200 });
    }

    await processPaidStoreOrder({
      supabaseServer,
      orderRef,
      amountCents: session.amount_total ?? null,
      paymentReference: (session.payment_intent as string | null) || session.id,
      buyerName: session.customer_details?.name || null,
      buyerEmail: session.customer_details?.email || null,
      buyerPhone: session.customer_details?.phone || null,
      paymentProvider: 'stripe',
      paymentMethod: 'stripe_checkout',
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Erro ao confirmar checkout da loja:', err);
    return NextResponse.json({ message: 'Erro ao confirmar pagamento' }, { status: 500 });
  }
}
