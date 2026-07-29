import { NextResponse } from 'next/server';

import { verifyAdmin } from '../../../../../../../lib/admin-auth';
import { resendFactPtDocument } from '../../../../../../../lib/factpt/processor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { authorized, error: authError } = await verifyAdmin(request);
  if (!authorized) {
    return NextResponse.json(
      { error: authError || 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { id } = await context.params;
    await resendFactPtDocument(id);
    return NextResponse.json({ ok: true, status: 'issued' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha no reenvio.' },
      { status: 500 },
    );
  }
}
