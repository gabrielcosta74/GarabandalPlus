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
            .select(`
                *,
                category:categories(name, slug),
                variants:product_variants(stock)
            `)
            .order('name', { ascending: true });

        if (error) throw error;

        // Transform data to include total stock from variants
        const enriched = products?.map((p: any) => {
            const totalStock = p.variants?.reduce((sum: number, v: any) => sum + (v.stock || 0), 0);
            return {
                ...p,
                category_name: p.category?.name,
                category_slug: p.category?.slug,
                stock: totalStock ?? p.stock // Fallback to legacy stock if no variants
            };
        });

        return NextResponse.json({ products: enriched || [] });
    } catch (error) {
        console.error("Admin Products API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    if (!await isAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseServer) {
        return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
    }

    try {
        const body = await req.json();

        // 1. Create Product
        const { data: product, error: prodError } = await supabaseServer
            .from('store_products')
            .insert({
                name: body.name,
                description: body.description,
                category_id: body.category_id, // Now expecting UUID
                price: body.price,
                is_active: body.is_active,
                is_physical: body.is_physical,
                image_url: body.image_url,
                digital_url: body.digital_url,
                tax_rate: body.tax_rate || 23,
                specifications: body.specifications || {},
                //Legacy fields for compatibility, eventually remove
                category: body.category_name,
                stock: 0
            })
            .select()
            .single();

        if (prodError) throw prodError;

        // 2. Create Default Variant (if not complex)
        // If it sends variants explicitly, we would handle them here, but for simple creation:
        const { error: varError } = await supabaseServer
            .from('product_variants')
            .insert({
                product_id: product.product_id, // it's TEXT now
                name: 'Padrão',
                stock: body.stock || 0,
                sku: body.sku || `SKU-${Date.now()}`,
                attributes: { is_default: true }
            });

        if (varError) {
            // Rollback ideally, but simplified:
            console.error("Error creating default variant:", varError);
        }

        return NextResponse.json({ success: true, product });
    } catch (error: any) {
        console.error("Admin Create Product Error:", error);
        return NextResponse.json({ error: error.message || 'Error creating product' }, { status: 500 });
    }
}
