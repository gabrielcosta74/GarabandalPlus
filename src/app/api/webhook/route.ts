import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '../../../lib/payments';
import { supabaseServer } from '../../../lib/supabase';
import {
  handleDonationSuccess,
  handleMembershipSuccess,
  handlePilgrimageSuccess,
  handleStoreSuccess,
  handlePaymentFailedOrCanceled,
  PaymentHandlerContext
} from '../../../lib/payment-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function HEAD() {
  return NextResponse.json({ ok: true });
}

export async function OPTIONS() {
  return NextResponse.json({ ok: true });
}



const formatISODate = (date: Date) => date.toISOString().slice(0, 10);

const normalizeMeta = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export async function POST(request: Request) {
  if (!stripe) return NextResponse.json({ message: 'Stripe não configurado' }, { status: 500 });

  const sig = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ message: 'Assinatura ausente' }, { status: 400 });
  }

  let event: Stripe.Event;
  const body = await request.text();

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err?.message);
    return NextResponse.json({ message: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const type = (session.metadata?.type as 'donation' | 'membership' | 'store' | 'pilgrimage_payment' | undefined) ?? 'donation';
    // const userId = session.metadata?.userId || null; // Handled in context
    const amountCents = session.amount_total ?? 0;
    const paymentIntent = session.payment_intent as string | null;
    const externalRef = session.id;

    if (supabaseServer) {
      try {
        const context: PaymentHandlerContext = {
          supabaseServer,
          amountCents,
          currency: session.currency?.toUpperCase() ?? 'EUR',
          paymentReference: typeof paymentIntent === 'string' ? paymentIntent : externalRef, // Best effort reference
          externalReference: externalRef,
          method: 'stripe_checkout',
          metadata: session.metadata || {},
          customerDetails: {
            name: session.customer_details?.name,
            email: session.customer_details?.email,
            address: session.customer_details?.address,
            phone: session.customer_details?.phone
          },
          paymentDate: session.created ? new Date(session.created * 1000) : new Date()
        };

        if (type === 'donation') {
          await handleDonationSuccess(context);
        } else if (type === 'membership') {
          await handleMembershipSuccess(context);
        } else if (type === 'pilgrimage_payment') {
          await handlePilgrimageSuccess(context);
        } else if (type === 'store') {
          await handleStoreSuccess(context);
        }
      } catch (err: any) {
        console.error(`Erro ao processar webhook (${type}):`, err);
        return NextResponse.json({ message: 'Error processing webhook', error: err.message }, { status: 500 });
      }
    }
  } // Closes if (checkout.session.completed)

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent;
    const paymentIntent = pi.id;
    const externalRef = pi.metadata?.checkout_session_id || null;
    const type = (pi.metadata?.type as 'donation' | 'membership' | 'store' | undefined) ?? undefined;

    if (supabaseServer) {
      // Construct partial context for failure handling
      const context: PaymentHandlerContext = {
        supabaseServer,
        amountCents: pi.amount,
        currency: pi.currency,
        paymentReference: paymentIntent,
        externalReference: externalRef || '',
        method: 'stripe_checkout',
        metadata: pi.metadata
      };
      await handlePaymentFailedOrCanceled(context, 'failed');
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentIntent = session.payment_intent as string | null;
    const externalRef = session.id;
    const type = (session.metadata?.type as 'donation' | 'membership' | 'store' | undefined) ?? undefined;

    if (supabaseServer) {
      const context: PaymentHandlerContext = {
        supabaseServer,
        amountCents: session.amount_total || 0,
        currency: session.currency || 'eur',
        paymentReference: paymentIntent || '', // might be null if expired before intent
        externalReference: externalRef,
        method: 'stripe_checkout',
        metadata: session.metadata || {}
      };
      await handlePaymentFailedOrCanceled(context, 'canceled');
    }
  }

  return NextResponse.json({ received: true });
}
