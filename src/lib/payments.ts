import Stripe from 'stripe';
import { supabaseServer } from './supabase';
import { getAppUrl } from './config';
import { isPaidStatus } from './membership-status';
import { reduniqClient } from './reduniq/client';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const siteUrl = getAppUrl();
const MEMBERSHIP_RENEW_START_MONTH = 11; // December (0-based)
const MEMBERSHIP_RENEW_START_DAY = 1;

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
  provider?: 'stripe' | 'reduniq';
  orderRef?: string;
  reduniqSolution?: number;
  reduniqAction?: 100 | 101;
  donorName?: string;
  donorEmail?: string;
  donorAddress?: string;
  donorCity?: string;
  donorZip?: string;
  donorCountry?: string;
  donorNif?: string | null;
  donorMessage?: string | null;
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

const isWithinRenewWindow = (proximaQuota?: string | null) => {
  if (!proximaQuota) return true; // sem data, deixamos pagar
  const quotaDate = new Date(proximaQuota);
  if (Number.isNaN(quotaDate.getTime())) return true;
  const windowStart = new Date(Date.UTC(quotaDate.getUTCFullYear() - 1, MEMBERSHIP_RENEW_START_MONTH, MEMBERSHIP_RENEW_START_DAY));
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return todayUtc >= windowStart.getTime();
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

  const isPaid = isPaidStatus(member.estado_quota);
  const proximaQuota = member.proxima_quota;
  const renewWindow = isWithinRenewWindow(proximaQuota);
  const isPaidAndOutsideWindow = member.is_membro && isPaid && proximaQuota && !renewWindow;

  if (isPaidAndOutsideWindow) {
    throw new Error('A quota atual ainda está em dia. Volta quando estiver perto do prazo de renovação.');
  }
}

export async function createCheckoutSession({
  amount,
  type,
  userId,
  provider = 'stripe',
  orderRef: orderRefOverride,
  reduniqSolution,
  reduniqAction,
  donorName,
  donorEmail,
  donorAddress,
  donorCity,
  donorZip,
  donorCountry,
  donorNif,
  donorMessage,
}: CheckoutPayload) {
  if (provider === 'stripe' && !stripe) throw new Error('Stripe não configurado.');
  if (!Number.isFinite(amount) || amount < 1) throw new Error('Valor inválido.');

  if (type === 'membership') {
    if (!userId) {
      throw new Error('userId é obrigatório para quota.');
    }
    await ensureCanPayMembership(userId);
  }

  const normalizedAmount = type === 'membership' ? 25 : amount;

  // Prep Common Data
  const donorNameValue = donorName?.trim().slice(0, 200) || '';
  const donorEmailValue = donorEmail?.trim().slice(0, 200) || '';
  const donorAddressValue = donorAddress?.trim().slice(0, 200) || '';
  const donorCityValue = donorCity?.trim().slice(0, 100) || '';
  const donorZipValue = donorZip?.trim().slice(0, 40) || '';
  const donorCountryValue = donorCountry?.trim().slice(0, 2).toUpperCase() || '';
  const donorNifValue = donorNif ? donorNif.replace(/\D/g, '').slice(0, 20) : '';

  // REDUNIQ LOGIC
  if (provider === 'reduniq') {
    const orderRef = orderRefOverride || `reduniq_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const safeSiteUrl = siteUrl.replace(/\/$/, '');
    const successUrl = `${safeSiteUrl}/thank-you?type=${type}&amount=${normalizedAmount}&provider=reduniq&orderRef=${orderRef}&status=success`;
    const errorUrl = `${safeSiteUrl}/thank-you?type=${type}&amount=${normalizedAmount}&provider=reduniq&orderRef=${orderRef}&status=failed&canceled=true`;
    const languageCode = donorCountryValue === 'PT' || donorCountryValue === 'BR' ? 'por' : 'eng';

    const attemptInit = async (solution?: number) => await reduniqClient.initiatePayment({
      amount: normalizedAmount,
      orderRef,
      customerName: donorNameValue,
      customerEmail: donorEmailValue,
      returnUrlOk: successUrl,
      returnUrlError: errorUrl,
      notificationUrl: `${safeSiteUrl}/api/webhooks/reduniq`,
      description: type === 'membership' ? 'Quota anual' : 'Doação',
      solution,
      languageCode,
      action: reduniqAction,
    });

    // Initiate Reduniq Payment
    let initResult = await attemptInit(reduniqSolution);
    if (!initResult.success && reduniqSolution) {
      const msg = (initResult.error || '').toLowerCase();
      const code = (initResult.resultCode || '').toLowerCase();
      const looksLikeInvalidSolution =
        msg.includes('invalid payment solution') ||
        msg.includes('invalid parameter') && msg.includes('payment.solution') ||
        code.startsWith('003');

      if (looksLikeInvalidSolution) {
        console.warn(`[Reduniq] Solution ${reduniqSolution} rejected; retrying without forcing solution.`);
        initResult = await attemptInit(undefined);
      }
    }

    if (!initResult.success || !initResult.url) {
      throw new Error(initResult.error || 'Falha ao iniciar pagamento Reduniq.');
    }

    // Record in DB
    if (supabaseServer) {
      try {
        if (type === 'donation') {
          await supabaseServer.from('donations').insert({
            user_id: userId ?? null,
            amount_cents: Math.round(normalizedAmount * 100),
            currency: 'EUR',
            // donations.method is an enum (e.g. stripe_card, bank_transfer, pix).
            // Reduniq in our system is also a card checkout, so we persist it as stripe_card
            // and keep the provider in metadata for traceability.
            method: 'stripe_card',
            status: 'pending',
            payment_intent_id: initResult.token || initResult.transactionId || orderRef,
            external_reference: orderRef,
            description: 'Doação (Reduniq)',
            metadata: { provider: 'reduniq', forcedSolution: reduniqSolution || null, action: reduniqAction || 101 },
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
            valor: normalizedAmount,
            metodo_pagamento: 'reduniq',
            estado: 'pendente',
            payment_intent_id: initResult.token || initResult.transactionId || orderRef,
            external_reference: orderRef,
            data_pagamento: new Date().toISOString().slice(0, 10),
          });
        }
      } catch (err) {
        console.warn('DB Error (Reduniq Pending):', err);
      }
    }

    return initResult.url;
  }

  // STRIPE LOGIC (Default)
  const lineItemName = type === 'membership' ? 'Quota anual' : 'Donativo';
  const priceLabel = type === 'membership' ? 'Quota Apostolado' : 'Doação Apostolado';

  const successUrl = `${siteUrl.replace(/\/$/, '')}/thank-you?type=${type}&amount=${normalizedAmount}&provider=stripe`;
  const cancelUrl =
    type === 'donation'
      ? `${siteUrl.replace(/\/$/, '')}/donations?canceled=true`
      : `${siteUrl.replace(/\/$/, '')}/thank-you?type=${type}&amount=${normalizedAmount}&provider=stripe&status=failed&canceled=true`;

  const session = await stripe!.checkout.sessions.create({
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
          unit_amount: Math.round(normalizedAmount * 100),
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
          amount_cents: Math.round(normalizedAmount * 100),
          currency: 'EUR',
          method: 'stripe_card',
          status: 'pending',
          payment_intent_id: session.payment_intent,
          external_reference: session.id,
          description: 'Doação (checkout)',
          metadata: { provider: 'stripe' },
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
          valor: normalizedAmount,
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
