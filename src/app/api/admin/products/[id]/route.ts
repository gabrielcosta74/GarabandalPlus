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
                sku: body.sku, // Allow updating SKU
                description: body.description,
                category_id: body.category_id,
                price: body.price,
                is_active: body.is_active,
                is_physical: body.is_physical,
                type_id: body.type_id, // NEW
                metadata: body.metadata, // NEW
                image_url: body.image_url,
                digital_url: body.digital_url,
                tax_rate: body.tax_rate,
                specifications: body.specifications,
                category: body.category_name, // Legacy
                stock: body.stock // Temporarily sync legacy stock
            })
            .eq('product_id', params.id);

        if (prodError) throw prodError;

        // 2. Sync Variants
        if (body.variants && Array.isArray(body.variants)) {
            // A. Fetch existing IDs to determine deletions
            const { data: existingVars } = await supabaseServer
                .from('product_variants')
                .select('id')
                .eq('product_id', params.id);

            const existingIds = existingVars?.map(v => v.id) || [];
            const payloadIds = body.variants.filter((v: any) => v.id).map((v: any) => v.id);
            const toDelete = existingIds.filter(id => !payloadIds.includes(id));

            // B. Delete removed variants
            if (toDelete.length > 0) {
                await supabaseServer.from('product_variants').delete().in('id', toDelete);
            }

            // C. Prepare data
            const cleanVariants = body.variants.map((v: any) => ({
                ...(v.id ? { id: v.id } : {}), // Only include ID if exists
                product_id: params.id,
                name: v.name || "Opção Standard",
                stock: v.stock || 0,
                sku: v.sku || `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                attributes: v.attributes || {}
            }));

            // D. Upsert (Handles both updates and inserts if ID matches, but for new ones without ID we strictly use insert to let DB generate UUID? 
            // Actually Supabase upsert needs ID to match. If no ID, it inserts.
            // But we cleaned the ID from object if it didn't exist.
            const { error: upsertError } = await supabaseServer
                .from('product_variants')
                .upsert(cleanVariants, { onConflict: 'id' });

            if (upsertError) {
                console.error("Variant Upsert Error:", upsertError);
                throw upsertError;
            }
        } else if (typeof body.stock === 'number') {
            // Fallback for simple stock update (Legacy support)
            const { error: varError } = await supabaseServer
                .from('product_variants')
                .update({ stock: body.stock })
                .eq('product_id', params.id)
                .contains('attributes', { is_default: true });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Update Product Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    if (!await isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!supabaseServer) return NextResponse.json({ error: 'DB Config Error' }, { status: 500 });

    try {
        // Deleting the product will automatically delete variants due to CASCADE if set up, 
        // but let's be explicit if not.
        await supabaseServer.from('product_variants').delete().eq('product_id', params.id);

        const { error } = await supabaseServer
            .from('store_products')
            .delete()
            .eq('product_id', params.id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Delete Product Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
