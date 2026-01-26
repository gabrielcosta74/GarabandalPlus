import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    if (!supabaseServer) {
        return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '50');

        const { data: orders, error } = await supabaseServer
            .from('store_orders')
            .select('*, items:store_order_items(*)')
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) throw error;

        return NextResponse.json({ orders: orders || [] });

    } catch (error) {
        console.error("Admin Orders API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
