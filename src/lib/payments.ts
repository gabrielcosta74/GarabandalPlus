import Stripe from 'stripe';
import { initReduniqPayment } from './reduniq';
import { supabaseServer } from './supabase';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const MEMBERSHIP_RENEW_WINDOW_DAYS = 30;

if (!stripeSecretKey) {
  console.warn('⚠️ STRIPE_SECRET_KEY não definido. A criação de checkout falhará.');
}

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey)
  : null;

export type CheckoutPayload = {
  amount: number;
  type: 'donation' | 'membership';
  userId?: string;
  donorName?: string;
  donorEmail?: string;
  donorAddress?: string;
  donorCity?: string;
  donorZip?: string;
  donorCountry?: string;
  donorNif?: string | null;
  donorMessage?: string | null;
};

export type ReduniqCheckoutPayload = Omit<CheckoutPayload, 'type'> & {
  type: 'donation' | 'membership' | 'store';
  solution?: number | null;
  metadata?: Record<string, string>;
  orderRef?: string;
};

type MemberSnapshot = {
  id: string;
  is_membro?: boolean;
  estado_quota?: string | null;
  proxima_quota?: string | null;
  tipo_subscricao?: string | null;
};

const isFounder = (member?: MemberSnapshot | null) => {
  const tipo = (member?.tipo_subscricao || '').toLowerCase();
  return tipo.includes('fundador');
};

const isWithinRenewWindow = (proximaQuota?: string | null, windowDays = MEMBERSHIP_RENEW_WINDOW_DAYS) => {
  if (!proximaQuota) return true; // sem data, deixamos pagar
  const today = new Date();
  const quotaDate = new Date(proximaQuota);
  const windowStart = new Date(quotaDate);
  windowStart.setDate(quotaDate.getDate() - windowDays);
  return today >= windowStart;
};

async function ensureCanPayMembership(userId: string) {
  if (!supabaseServer) return;
  const { data: member, error } = await supabaseServer
    .from('membros')
    .select('id, is_membro, estado_quota, proxima_quota, tipo_subscricao')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('Não foi possível validar membro antes de criar checkout:', error);
    return;
  }

  if (!member) {
    return; // sem registo, permitimos (novo membro)
  }

  if (isFounder(member)) {
    throw new Error('Membros fundadores não precisam de pagar quota.');
  }

  const status = (member.estado_quota || '').toLowerCase();
  const isPaidStatus = status === 'pago' || status === 'paid';
  const proximaQuota = member.proxima_quota;
  const renewWindow = isWithinRenewWindow(proximaQuota);
  const isPaidAndOutsideWindow = member.is_membro && isPaidStatus && proximaQuota && !renewWindow;

  if (isPaidAndOutsideWindow) {
    throw new Error('A quota atual ainda está em dia. Volta quando estiver perto do prazo de renovação.');
  }
}

export async function createCheckoutSession({
  amount,
  type,
  userId,
  donorName,
  donorEmail,
  donorAddress,
  donorCity,
  donorZip,
  donorCountry,
  donorNif,
  donorMessage,
}: CheckoutPayload) {
  if (!stripe) throw new Error('Stripe não configurado.');
  if (!Number.isFinite(amount) || amount < 1) throw new Error('Valor inválido.');

  if (type === 'membership') {
    if (!userId) {
      throw new Error('userId é obrigatório para quota.');
    }
    await ensureCanPayMembership(userId);
  }

  const lineItemName = type === 'membership' ? 'Quota anual' : 'Donativo';
  const priceLabel = type === 'membership' ? 'Quota Apostolado' : 'Doação Apostolado';

  const donorNameValue = donorName?.trim().slice(0, 200) || '';
  const donorEmailValue = donorEmail?.trim().slice(0, 200) || '';
  const donorAddressValue = donorAddress?.trim().slice(0, 200) || '';
  const donorCityValue = donorCity?.trim().slice(0, 100) || '';
  const donorZipValue = donorZip?.trim().slice(0, 40) || '';
  const donorCountryValue = donorCountry?.trim().slice(0, 2).toUpperCase() || '';
  const donorNifValue = donorNif ? donorNif.replace(/\D/g, '').slice(0, 20) : '';

  const successUrl = `${siteUrl.replace(/\/$/, '')}/thank-you?type=${type}&amount=${amount}`;
  const cancelUrl =
    type === 'donation'
      ? `${siteUrl.replace(/\/$/, '')}/donations?canceled=true`
      : `${siteUrl.replace(/\/$/, '')}/membership?canceled=true`;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    success_url: successUrl,
    cancel_url: cancelUrl,
    ...(donorEmailValue ? { customer_email: donorEmailValue } : {}),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(amount * 100),
          product_data: { name: priceLabel, description: lineItemName },
        },
      },
    ],
    metadata: {
      type,
      userId: userId || '',
      donorName: donorNameValue,
      donorEmail: donorEmailValue,
      donorAddress: donorAddressValue,
      donorCity: donorCityValue,
      donorZip: donorZipValue,
      donorCountry: donorCountryValue,
      donorNif: donorNifValue,
      donorMessage: donorMessage?.trim().slice(0, 500) || '',
    },
  });

  // Guarda um registo preliminar (opcional)
  if (supabaseServer) {
    try {
      if (type === 'donation') {
        await supabaseServer.from('donations').insert({
          user_id: userId ?? null,
          amount_cents: Math.round(amount * 100),
          currency: 'EUR',
          method: 'stripe_checkout',
          status: 'pending',
          payment_intent_id: session.payment_intent,
          external_reference: session.id,
          description: 'Doação (checkout)',
          donor_name: donorNameValue || null,
          donor_email: donorEmailValue || null,
          donor_address: donorAddressValue || null,
          donor_city: donorCityValue || null,
          donor_zip: donorZipValue || null,
          donor_country: donorCountryValue || null,
          donor_nif: donorNifValue || null,
        });
      } else {
        await supabaseServer.from('pagamentos_quotas').insert({
          user_id: userId ?? null,
          valor: amount,
          metodo_pagamento: 'stripe_checkout',
          estado: 'pendente',
          payment_intent_id: session.payment_intent,
          external_reference: session.id,
          data_pagamento: new Date().toISOString().slice(0, 10),
        });
      }
    } catch (err) {
      console.warn('Não foi possível registar pagamento preliminar no Supabase:', err);
    }
  }

  return session.url;
}

export async function createReduniqPayment({
  amount,
  type,
  userId,
  solution,
  metadata,
  orderRef,
}: ReduniqCheckoutPayload) {
  if (!Number.isFinite(amount) || amount < 1) throw new Error('Valor inválido.');

  if (type === 'membership') {
    if (!userId) {
      throw new Error('userId é obrigatório para quota.');
    }
    await ensureCanPayMembership(userId);
  }

  const { token, redirectUrl, orderRef: reduniqOrderRef } = await initReduniqPayment({
    amount,
    type,
    userId,
    solution: solution ?? undefined,
    metadata,
    orderRef,
  });

  if (supabaseServer && type !== 'store') {
    try {
      if (type === 'donation') {
        const donorNameValue = metadata?.donorName?.trim() || null;
        const donorEmailValue = metadata?.donorEmail?.trim() || null;
        const donorAddressValue = metadata?.donorAddress?.trim() || null;
        const donorCityValue = metadata?.donorCity?.trim() || null;
        const donorZipValue = metadata?.donorZip?.trim() || null;
        const donorCountryValue = metadata?.donorCountry?.trim().toUpperCase() || null;
        const donorNifValue = metadata?.donorNif?.trim() || null;
        await supabaseServer.from('donations').insert({
          user_id: userId ?? null,
          amount_cents: Math.round(amount * 100),
          currency: 'EUR',
          method: solution ? `reduniq_${solution}` : 'reduniq',
          status: 'pending',
          payment_intent_id: null,
          external_reference: token,
          description: 'Doação (reduniq)',
          donor_name: donorNameValue,
          donor_email: donorEmailValue,
          donor_address: donorAddressValue,
          donor_city: donorCityValue,
          donor_zip: donorZipValue,
          donor_country: donorCountryValue,
          donor_nif: donorNifValue,
        });
      } else {
        await supabaseServer.from('pagamentos_quotas').insert({
          user_id: userId ?? null,
          valor: amount,
          metodo_pagamento: solution ? `reduniq_${solution}` : 'reduniq',
          estado: 'pendente',
          payment_intent_id: null,
          external_reference: token,
          data_pagamento: new Date().toISOString().slice(0, 10),
        });
      }
    } catch (err) {
      console.warn('Não foi possível registar pagamento preliminar REDUNIQ:', err);
    }
  }

  return { url: redirectUrl, token, orderRef: reduniqOrderRef };
}
