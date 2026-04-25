import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../lib/admin-auth';

export const dynamic = 'force-dynamic';

const parseFiniteNumber = (value: unknown, fallback: number) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (typeof value === 'string') {
        const normalized = value
            .trim()
            .replace(/\s/g, '')
            .replace(',', '.')
            .replace(/[^\d.-]/g, '');
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const parseStockValue = (value: unknown) => {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const VALID_PRODUCT_TYPE_IDS = new Set(['book_digital', 'book_physical', 'clothing', 'event_ticket', 'religious_article']);

const normalizeProductTypeId = (typeId: unknown, isPhysical: boolean) => {
    const candidate = String(typeId || '').trim();
    if (VALID_PRODUCT_TYPE_IDS.has(candidate)) return candidate;
    return isPhysical ? 'religious_article' : 'book_digital';
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        const status = authError === 'Forbidden: Not an Admin' ? 403 : 401;
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status });
    }
    if (!supabaseServer) return NextResponse.json({ error: 'DB Config Error' }, { status: 500 });

    const { id } = await params;
    try {
        const { data, error } = await supabaseServer
            .from('store_products')
            .select(`
                *,
                category:categories(name, slug),
                variants:product_variants(*)
            `)
            .eq('product_id', id)
            .single();

        if (error) throw error;
        if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        return NextResponse.json({ product: data });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        const status = authError === 'Forbidden: Not an Admin' ? 403 : 401;
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status });
    }
    if (!supabaseServer) return NextResponse.json({ error: 'DB Config Error' }, { status: 500 });

    const { id } = await params;
    try {
        const body = await req.json();
        const isPhysical = body.is_physical !== false;
        const typeId = normalizeProductTypeId(body.type_id, isPhysical);
        const price = parseFiniteNumber(body.price, NaN);
        if (!Number.isFinite(price) || price < 0) {
            return NextResponse.json({ error: 'Preço inválido' }, { status: 400 });
        }
        const taxRate = parseFiniteNumber(body.tax_rate, 0.23);
        const normalizedTaxRate = Math.min(1, Math.max(0, taxRate));
        const stock = isPhysical ? parseStockValue(body.stock) : null;

        // 1. Update Product
        const { error: prodError } = await supabaseServer
            .from('store_products')
            .update({
                name: body.name,
                name_en: body.name_en || null,
                sku: body.sku, // Allow updating SKU
                description: body.description,
                description_en: body.description_en || null,
                category_id: body.category_id,
                price,
                is_active: body.is_active,
                is_physical: isPhysical,
                type_id: typeId,
                metadata: body.metadata, // NEW
                image_url: body.image_url,
                digital_url: body.digital_url,
                allowed_countries: Array.isArray(body.allowed_countries) ? body.allowed_countries : [],
                tax_rate: normalizedTaxRate,
                specifications: body.specifications,
                category: body.category_name, // Legacy
                stock // Digital products keep infinite stock (null)
            })
            .eq('product_id', id);

        if (prodError) throw prodError;

        // 2. Sync Variants
        if (isPhysical && Array.isArray(body.variants) && body.variants.length > 0) {
            // A. Fetch existing IDs to determine deletions
            const { data: existingVars } = await supabaseServer
                .from('product_variants')
                .select('id')
                .eq('product_id', id);

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
                product_id: id,
                name: v.name || "Opção Standard",
                stock: parseStockValue(v.stock),
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
        } else if (isPhysical) {
            // Fallback for simple stock update (Legacy support)
            const { data: defaultVariant, error: fetchDefaultError } = await supabaseServer
                .from('product_variants')
                .select('id')
                .eq('product_id', id)
                .contains('attributes', { is_default: true })
                .maybeSingle();

            if (fetchDefaultError) throw fetchDefaultError;

            if (defaultVariant?.id) {
                const { error: varError } = await supabaseServer
                    .from('product_variants')
                    .update({ stock })
                    .eq('id', defaultVariant.id);

                if (varError) throw varError;
            } else {
                const { error: insertDefaultError } = await supabaseServer
                    .from('product_variants')
                    .insert({
                        product_id: id,
                        name: 'Padrão',
                        stock,
                        sku: body.sku || `SKU-${Date.now()}`,
                        attributes: { is_default: true }
                    });

                if (insertDefaultError) throw insertDefaultError;
            }
        } else if (!isPhysical) {
            // Digital products: no stock variants
            await supabaseServer
                .from('product_variants')
                .delete()
                .eq('product_id', id);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Update Product Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        const status = authError === 'Forbidden: Not an Admin' ? 403 : 401;
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status });
    }
    if (!supabaseServer) return NextResponse.json({ error: 'DB Config Error' }, { status: 500 });

    const { id } = await params;
    try {
        // Deleting the product will automatically delete variants due to CASCADE if set up, 
        // but let's be explicit if not.
        await supabaseServer.from('product_variants').delete().eq('product_id', id);

        const { error } = await supabaseServer
            .from('store_products')
            .delete()
            .eq('product_id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Delete Product Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
