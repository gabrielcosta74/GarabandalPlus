import { NextResponse } from 'next/server';
import { verifyPortalAccess } from '../../../../lib/prayer-portal-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const result = await verifyPortalAccess(req);
  if (!result.authorized) {
    return NextResponse.json({ authorized: false, error: result.error }, { status: 401 });
  }
  return NextResponse.json({ authorized: true, user: result.user });
}
