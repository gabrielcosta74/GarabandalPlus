import { NextResponse } from 'next/server';

import { verifyAdmin } from '../../../../../../../lib/admin-auth';
import { logAdminAudit } from '../../../../../../../lib/admin-audit';
import { prepareFactPtDocumentForReview } from '../../../../../../../lib/factpt/processor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { authorized, user, error: authError } = await verifyAdmin(request);
  if (!authorized) {
    return NextResponse.json(
      { error: authError || 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { id } = await context.params;
    const preview = await prepareFactPtDocumentForReview(id);
    await logAdminAudit({
      adminEmail: user?.email,
      action: 'factpt_document_review_prepared',
      details: { documentId: id },
    });
    return NextResponse.json({ ok: true, preview });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível preparar a validação fiscal.',
      },
      { status: 409 },
    );
  }
}
