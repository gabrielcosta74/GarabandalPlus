import { NextResponse } from 'next/server';
import { z } from 'zod';
import { reduniqClient } from '../../../../lib/reduniq/client';
import { requireReduniqAdmin } from '../_auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  transactionId: z.string().trim().min(6),
  reference: z.string().trim().min(1).max(50).optional(),
  comment: z.string().trim().min(1).max(255).optional(),
});

export async function POST(request: Request) {
  const auth = requireReduniqAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = bodySchema.parse(await request.json());
    const result = await reduniqClient.doVoid({
      transactionId: body.transactionId,
      reference: body.reference,
      comment: body.comment,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.error || `HTTP ${result.status}`, raw: result.text }, { status: 502 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || 'Erro inesperado.' }, { status: 400 });
  }
}

