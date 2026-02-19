
import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../../lib/admin-auth';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
    // Await params as per Next.js 15+ async params requirement
    const { id } = await context.params;

    if (!supabaseServer) return NextResponse.json({ error: 'DB Error' }, { status: 500 });

    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        const status = authError === 'Forbidden: Not an Admin' ? 403 : 401;
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status });
    }

    const { error } = await supabaseServer
        .from('admin_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
