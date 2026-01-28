
import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../../lib/supabase';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
    // Await params as per Next.js 15+ async params requirement
    const { id } = await context.params;

    if (!supabaseServer) return NextResponse.json({ error: 'DB Error' }, { status: 500 });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No authorization header' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);

    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { error } = await supabaseServer
        .from('admin_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
