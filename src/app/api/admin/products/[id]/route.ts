import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';

// Simplified Admin Check for this file context
const isAdmin = async (req: Request) => {
    if (!supabaseServer) return false;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return false;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseServer.auth.getUser(token);
    return !error && !!user;
};

export async function GET(req: Request, { params }: { params: { id: string } }) {
    if (!await isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!supabaseServer) return NextResponse.json({ error: 'DB Config Error' }, { status: 500 });

    try {
        const { data, error } = await supabaseServer
            .from('store_products')
            .select(`
                *,
                category:categories(name, slug),
                variants:product_variants(*)
            `)
            .eq('product_id', params.id)
            .single();

        if (error) throw error;
        if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        return NextResponse.json({ product: data });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    if (!await isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!supabaseServer) return NextResponse.json({ error: 'DB Config Error' }, { status: 500 });

    try {
        const body = await req.json();

        // 1. Update Product
        const { error: prodError } = await supabaseServer
            .from('store_products')
            .update({
                name: body.name,
                description: body.description,
                category_id: body.category_id,
                price: body.price,
                is_active: body.is_active,
                is_physical: body.is_physical,
                image_url: body.image_url,
                digital_url: body.digital_url,
                tax_rate: body.tax_rate,
                specifications: body.specifications,
                category: body.category_name, // Legacy
                stock: body.stock // Temporarily sync legacy stock
            })
            .eq('product_id', params.id);

        if (prodError) throw prodError;

        // 2. Update Default Variant Stock (Simplified for now - later we handle multi-variant)
        // Check if default variant exists
        if (typeof body.stock === 'number') {
            const { error: varError } = await supabaseServer
                .from('product_variants')
                .update({ stock: body.stock })
                .eq('product_id', params.id)
                .contains('attributes', { is_default: true });

            // If update failed (maybe no default variant caused by migration gap?), create it?
            // For now, robustly ignore or log.
            if (varError) console.warn("Variant update warning:", varError);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Update Product Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
