import { NextResponse } from 'next/server';

import { verifyAdmin } from '../../../../../../../lib/admin-auth';
import { approveFactPtDocument } from '../../../../../../../lib/factpt/processor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { authorized, user, error: authError } = await verifyAdmin(request);
  if (!authorized || !user?.id) {
    return NextResponse.json(
      { error: authError || 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const document = await approveFactPtDocument(
      id,
      String(user.id),
      body?.confirmProduction === true,
    );
    return NextResponse.json({
      ok: true,
      document,
      message:
        'Fatura aprovada e colocada na fila. A emissão e o email serão processados pelo worker.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível aprovar a fatura.',
      },
      { status: 409 },
    );
  }
}
