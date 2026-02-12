import { NextResponse } from 'next/server';

export function requireReduniqAdmin(request: Request) {
  const secret = process.env.REDUNIQ_ADMIN_SECRET || '';
  if (!secret) {
    return { ok: false as const, response: NextResponse.json({ success: false, message: 'REDUNIQ_ADMIN_SECRET não configurado.' }, { status: 403 }) };
  }

  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
  if (!token || token !== secret) {
    return { ok: false as const, response: NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 }) };
  }

  return { ok: true as const };
}

