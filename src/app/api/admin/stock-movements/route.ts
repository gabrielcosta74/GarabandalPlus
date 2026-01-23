import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

// Helper to validate Admin Session
const isAdmin = async (req: Request) => {
    if (!supabaseServer) return false;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return false;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseServer.auth.getUser(token);
    return !error && !!user;
};

export async function GET(req: Request) {
    if (!await isAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
