import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createCheckoutSession, createReduniqPayment } from '../../../lib/payments';
import { validatePostalCode } from '../../../lib/country-utils';

const bodySchema = z.object({
  amount: z.number().positive(),
  type: z.enum(['donation', 'membership']),
  userId: z.string().optional(),
  provider: z.enum(['reduniq']).default('reduniq'),
  reduniqSolution: z.number().int().optional(),
  donorName: z.string().trim().min(1).optional(),
  donorEmail: z.string().trim().min(3).optional(),
  donorAddress: z.string().trim().min(3).optional().nullable(),
  donorCity: z.string().trim().min(2).optional().nullable(),
  donorZip: z.string().trim().min(3).optional().nullable(),
  donorCountry: z.string().trim().min(2).optional(),
  donorNif: z.string().trim().optional().nullable(),
  donorMessage: z.string().trim().optional().nullable(),
  receiptRequired: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const {
      amount,
      type,
      userId,
      provider,
      reduniqSolution,
      donorName,
      donorEmail,
      donorAddress,
      donorCity,
      donorZip,
      donorCountry,
      donorNif,
      donorMessage,
      receiptRequired
    } = bodySchema.parse(json);

    if (type === 'membership' && !userId) {
      return NextResponse.json(
        { message: 'userId é obrigatório para pagar quota.' },
        { status: 400 },
      );
    }

    const normalizedCountry = donorCountry?.trim().toUpperCase();
    const normalizedNif = donorNif ? donorNif.replace(/\D/g, '') : '';

    if (type === 'donation') {
      if (!donorName || !donorEmail || !donorEmail.includes('@')) {
        return NextResponse.json(
          { message: 'Nome e email são obrigatórios para a doação.' },
          { status: 400 },
        );
      }

      // Only require address if receipt is required
      if (receiptRequired) {
        if (!donorAddress || !donorCity || !donorZip || !normalizedCountry) {
          return NextResponse.json(
            { message: 'Endereço completo e país são obrigatórios para emissão de recibo.' },
            { status: 400 },
          );
        }
        if (!['PT', 'BR'].includes(normalizedCountry)) {
          return NextResponse.json(
            { message: 'País inválido para recibo. Usa PT ou BR.' },
            { status: 400 },
          );
        }
        if (!validatePostalCode(normalizedCountry, donorZip || '')) {
          return NextResponse.json(
            { message: 'Código postal inválido para o país selecionado.' },
            { status: 400 },
          );
        }
        if (normalizedNif) {
          const nifValid =
            (normalizedCountry === 'PT' && normalizedNif.length === 9) ||
            (normalizedCountry === 'BR' && normalizedNif.length === 11);
          if (!nifValid) {
            return NextResponse.json(
              {
                message:
                  normalizedCountry === 'BR'
                    ? 'CPF inválido. Use 11 dígitos.'
                    : 'NIF inválido. Use 9 dígitos.',
              },
              { status: 400 },
            );
          }
        }
      }
    }

    // Only Reduniq is supported for donations
    const { url, token } = await createReduniqPayment({
      amount,
      type,
      userId,
      solution: reduniqSolution,
      metadata: {
        donorName: donorName || '',
        donorEmail: donorEmail || '',
        donorAddress: donorAddress || '',
        donorCity: donorCity || '',
        donorZip: donorZip || '',
        donorCountry: normalizedCountry || '',
        donorNif: normalizedNif || '',
        donorMessage: donorMessage || '',
      },
    });
    return NextResponse.json({ url, token });
  } catch (err: any) {
    console.error('Erro em /api/checkout:', err);
    const message = err?.message || 'Erro ao iniciar checkout.';
    return NextResponse.json({ message }, { status: 400 });
  }
}
