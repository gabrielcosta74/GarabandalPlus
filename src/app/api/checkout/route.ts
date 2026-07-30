import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

import { createCheckoutSession } from '../../../lib/payments';
import {
  isValidDonationEmail,
} from '../../../lib/donation-fiscal';
import {
  fiscalBillingErrorMessage,
  fiscalBillingMissingFields,
  normalizeFiscalBilling,
} from '../../../lib/fiscal-billing';
import { getAppUrl } from '../../../lib/config';
import { getMembershipAmountServer } from '../../../lib/membership-pricing';
import { inferRequestLocale } from '../../../lib/locale-routing';

const bodySchema = z.object({
  amount: z.number().positive(), // Validated but overridden for membership
  type: z.enum(['donation', 'membership']),
  locale: z.enum(['pt', 'en']).optional(),
  userId: z.string().optional(),
  provider: z.enum(['stripe', 'reduniq']).default('stripe'),
  reduniqSolution: z.number().int().optional(),
  reduniqAction: z.union([z.literal(100), z.literal(101)]).optional(),
  paymentOptionId: z.string().trim().optional(),
  // Donation fields
  donorName: z.string().trim().min(1).optional(),
  donorEmail: z.string().trim().min(3).optional(),
  donorAddress: z.string().trim().min(3).optional().nullable(),
  donorCity: z.string().trim().min(2).optional().nullable(),
  donorZip: z.string().trim().min(3).optional().nullable(),
  donorCountry: z.string().trim().min(2).optional(),
  donorNif: z.string().trim().optional().nullable(),
  donorMessage: z.string().trim().optional().nullable(),
  receiptRequired: z.boolean().optional().default(false),
  referralCode: z.string().trim().optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const data = bodySchema.parse(json);
    const locale = data.locale || inferRequestLocale(request);
    const { type, userId, provider, donorName, donorEmail } = data;
    const orderRef = provider === 'reduniq'
      ? `reduniq_${Date.now()}_${Math.random().toString(36).substring(7)}`
      : undefined;

    // 1. Enforce Rules
    if (type === 'membership') {
      if (!userId) {
        return NextResponse.json({ message: 'userId é obrigatório para pagar quota.' }, { status: 400 });
      }
      data.amount = getMembershipAmountServer();
    }

    if (type === 'donation') {
      if (!donorName || !isValidDonationEmail(donorEmail)) {
        return NextResponse.json({ message: 'Nome e email são obrigatórios.' }, { status: 400 });
      }
      if (provider !== 'reduniq') {
        return NextResponse.json({ message: 'As doações online usam exclusivamente a Reduniq.' }, { status: 400 });
      }

      const billing = normalizeFiscalBilling({
        name: data.donorName,
        email: data.donorEmail,
        address: data.donorAddress,
        city: data.donorCity,
        postalCode: data.donorZip,
        country: data.donorCountry,
        taxIdRequested: data.receiptRequired,
        nif: data.donorNif,
      });
      const missingBillingFields = fiscalBillingMissingFields(billing);
      if (missingBillingFields.length > 0) {
        return NextResponse.json({
          message: fiscalBillingErrorMessage(missingBillingFields, locale === 'en'),
        }, { status: 400 });
      }
      data.donorName = billing.name;
      data.donorEmail = billing.email;
      data.donorAddress = billing.address;
      data.donorCity = billing.city;
      data.donorZip = billing.postalCode;
      data.donorCountry = billing.country;
      data.donorNif = billing.nif;
      data.receiptRequired = billing.taxIdRequested;
    }

    // 2. Create Session (Stripe or Reduniq)
    // createCheckoutSession handles URLs internally based on type and provider
    const checkoutUrl = await createCheckoutSession({
      amount: data.amount,
      type: type,
      locale,
      userId: userId,
      provider: provider, // Passed through
      orderRef,
      reduniqSolution: data.reduniqSolution,
      reduniqAction: data.reduniqAction,
      paymentOptionId: data.paymentOptionId,
      donorName: data.donorName,
      donorEmail: data.donorEmail,
      donorAddress: data.donorAddress || undefined,
      donorCity: data.donorCity || undefined,
      donorZip: data.donorZip || undefined,
      donorCountry: data.donorCountry || undefined,
      donorNif: data.donorNif,
      donorMessage: data.donorMessage,
      receiptRequired: data.receiptRequired,
    });

    if (!checkoutUrl) {
      throw new Error('Falha ao obter URL de pagamento.');
    }

    return NextResponse.json({ url: checkoutUrl, ...(orderRef ? { orderRef } : {}) });

  } catch (err: any) {
    console.error('Erro em /api/checkout:', err);
    return NextResponse.json({ message: err.message || 'Erro ao iniciar checkout.' }, { status: 400 });
  }
}
