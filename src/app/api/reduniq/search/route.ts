import { NextResponse } from 'next/server';
import { z } from 'zod';
import { reduniqClient } from '../../../../lib/reduniq/client';
import { requireReduniqAdmin } from '../_auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  startDate: z.string().trim().regex(/^\\d{4}-\\d{2}-\\d{2}$/).optional(),
  endDate: z.string().trim().regex(/^\\d{4}-\\d{2}-\\d{2}$/).optional(),
  orderRef: z.string().trim().min(1).max(50).optional(),
  transactionId: z.string().trim().min(1).max(50).optional(),
  solution: z.number().int().optional(),
  status: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(2000).optional(),
});

export async function POST(request: Request) {
  const auth = requireReduniqAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = bodySchema.parse(await request.json());
    const result = await reduniqClient.searchTransactions({
      startDate: body.startDate,
      endDate: body.endDate,
      orderRef: body.orderRef,
      transactionId: body.transactionId,
      solution: body.solution,
      status: body.status,
      offset: body.offset,
      limit: body.limit,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.error || `HTTP ${result.status}`, raw: result.text }, { status: 502 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || 'Erro inesperado.' }, { status: 400 });
  }
}

