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
                variants:product_variants(*)
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
                product_id: crypto.randomUUID(),
                sku: body.sku, // Editable reference
                name: body.name,
                description: body.description,
                category_id: body.category_id,
                price: body.price,
                is_active: body.is_active,
                is_physical: body.is_physical,
                type_id: body.type_id, // NEW
                metadata: body.metadata || {}, // NEW
                image_url: body.image_url,
                digital_url: body.digital_url,
                tax_rate: body.tax_rate || 23,
                specifications: body.specifications || {},
                //Legacy fields
                category: body.category_name,
                stock: 0
            })
            .select()
            .single();

        if (prodError) throw prodError;

        // 2. Create Variants
        if (body.variants && body.variants.length > 0) {
            const varsToInsert = body.variants.map((v: any) => ({
                product_id: product.product_id,
                name: v.name,
                stock: v.stock || 0,
                sku: v.sku || `${body.sku}-${v.name.toUpperCase().slice(0, 3)}`,
                attributes: v.attributes || {}
            }));

            const { error: varError } = await supabaseServer
                .from('product_variants')
                .insert(varsToInsert);

            if (varError) {
                console.error("Error creating variants:", varError);
                throw new Error(`Error creating variants: ${varError.message}`);
            }
        } else {
            // Default Variant (Legacy/Simple)
            const { error: varError } = await supabaseServer
                .from('product_variants')
                .insert({
                    product_id: product.product_id,
                    name: 'Padrão',
                    stock: body.stock || 0, // Fallback to body.stock
                    sku: body.sku || `SKU-${Date.now()}`,
                    attributes: { is_default: true }
                });

            if (varError) console.error("Error creating default variant:", varError);
        }

        return NextResponse.json({ success: true, product });
    } catch (error: any) {
        console.error("Admin Create Product Error:", error);
        return NextResponse.json({ error: error.message || 'Error creating product' }, { status: 500 });
    }
}
