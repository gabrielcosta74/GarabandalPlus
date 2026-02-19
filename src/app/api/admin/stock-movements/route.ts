import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { verifyAdmin } from '../../../../lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        const status = authError === 'Forbidden: Not an Admin' ? 403 : 401;
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status });
    }

    if (!supabaseServer) {
        return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
    }

    try {
        const { data: movements, error } = await supabaseServer
            .from('store_stock_movements')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        return NextResponse.json({ movements: movements || [] });
    } catch (error) {
        console.error("Admin Stock Movements API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
