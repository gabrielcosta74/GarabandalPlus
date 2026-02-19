import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { authorized, user, error } = await verifyAdmin(req);
    if (!authorized) {
        const status = error === 'Forbidden: Not an Admin' ? 403 : 401;
        return NextResponse.json({ authorized: false, error: error || 'Unauthorized' }, { status });
    }

    return NextResponse.json({
        authorized: true,
        user: { id: user?.id, email: user?.email || null },
    });
}
