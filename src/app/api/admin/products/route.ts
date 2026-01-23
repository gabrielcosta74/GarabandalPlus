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
        const { data: products, error } = await supabaseServer
            .from('store_products')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ products: products || [] });
    } catch (error) {
        console.error("Admin Products API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    if (!await isAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pathname } = new URL(req.url);
    const id = pathname.split('/').pop();

    if (!id || id === 'products') {
        return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
    }

    try {
        const body = await req.json();
        const { data, error } = await supabaseServer!
            .from('store_products')
            .update(body)
            .eq('product_id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ product: data });
    } catch (error) {
        console.error("Admin Product Patch Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
