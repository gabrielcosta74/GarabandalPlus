import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../../lib/admin-auth';
import { normalizeResendEmailActivityDetail } from '../../../../../lib/resend-email-activity';

export const dynamic = 'force-dynamic';

const RESEND_API_BASE = 'https://api.resend.com';

const getResendApiKey = () => {
  const apiKey = process.env.RESEND_API_KEY || '';
  if (!apiKey) {
    throw new Error('RESEND_API_KEY não configurada.');
  }
  return apiKey;
};

export async function GET(
  req: Request,
  context: { params: Promise<{ emailId: string }> },
) {
  const { authorized, error: authError } = await verifyAdmin(req);
  if (!authorized) {
    const status = authError === 'Forbidden: Not an Admin' ? 403 : 401;
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status });
  }

  try {
    const { emailId } = await context.params;
    const res = await fetch(`${RESEND_API_BASE}/emails/${encodeURIComponent(emailId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${getResendApiKey()}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(String(payload?.message || payload?.error || 'Não foi possível obter o detalhe do email.'));
    }

    const email = normalizeResendEmailActivityDetail((payload?.data || payload || {}) as Record<string, unknown>);

    return NextResponse.json({ email });
  } catch (error: any) {
    console.error('[Admin Email Activity] Failed to load email detail', error);
    return NextResponse.json(
      { error: String(error?.message || 'Não foi possível carregar o detalhe do email.') },
      { status: 500 },
    );
  }
}
