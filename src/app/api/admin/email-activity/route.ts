import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../lib/admin-auth';
import {
  buildEmailActivitySummary,
  normalizeResendEmailActivityItem,
} from '../../../../lib/resend-email-activity';

export const dynamic = 'force-dynamic';

const RESEND_API_BASE = 'https://api.resend.com';

const getResendApiKey = () => {
  const apiKey = process.env.RESEND_API_KEY || '';
  if (!apiKey) {
    throw new Error('RESEND_API_KEY não configurada.');
  }
  return apiKey;
};

const fetchResend = async (path: string) => {
  const res = await fetch(`${RESEND_API_BASE}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${getResendApiKey()}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(String(payload?.message || payload?.error || 'Falha ao comunicar com a Resend.'));
  }

  return payload;
};

export async function GET(req: Request) {
  const { authorized, error: authError } = await verifyAdmin(req);
  if (!authorized) {
    const status = authError === 'Forbidden: Not an Admin' ? 403 : 401;
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 100);
    const after = String(searchParams.get('after') || '').trim();
    const before = String(searchParams.get('before') || '').trim();

    const query = new URLSearchParams();
    query.set('limit', String(limit));
    if (after) query.set('after', after);
    if (before) query.set('before', before);

    const payload = await fetchResend(`/emails?${query.toString()}`);
    const rawEntries: Record<string, unknown>[] = Array.isArray(payload?.data) ? payload.data : [];
    const emails = rawEntries
      .map((entry) => normalizeResendEmailActivityItem(entry))
      .filter((entry: ReturnType<typeof normalizeResendEmailActivityItem>) => Boolean(entry.id));

    return NextResponse.json({
      emails,
      summary: buildEmailActivitySummary(emails),
      hasMore: Boolean(payload?.has_more),
    });
  } catch (error: any) {
    console.error('[Admin Email Activity] Failed to list emails', error);
    return NextResponse.json(
      { error: String(error?.message || 'Não foi possível carregar a atividade de emails.') },
      { status: 500 },
    );
  }
}
