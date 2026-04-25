import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { verifyAdmin } from '../../../../lib/admin-auth';

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
            const hasPhysicalVariants = (p.is_physical ?? true) && Array.isArray(p.variants) && p.variants.length > 0;
            const totalStock = hasPhysicalVariants
                ? p.variants.reduce((sum: number, v: any) => sum + (v.stock || 0), 0)
                : null;
            return {
                ...p,
                category_name: p.category?.name,
                category_slug: p.category?.slug,
                // Only override stock when physical variants exist.
                // For digital products, keep DB stock (normally null = infinite).
                stock: totalStock ?? p.stock
            };
        });

        return NextResponse.json({ products: enriched || [] });
    } catch (error) {
        console.error("Admin Products API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        const status = authError === 'Forbidden: Not an Admin' ? 403 : 401;
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status });
    }

    if (!supabaseServer) {
        return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
    }

    try {
        const body = await req.json();
        const price = parseFiniteNumber(body.price, NaN);
        if (!Number.isFinite(price) || price < 0) {
            return NextResponse.json({ error: 'Preço inválido' }, { status: 400 });
        }

        const isPhysical = body.is_physical !== false;
        const typeId = normalizeProductTypeId(body.type_id, isPhysical);
        const taxRate = parseFiniteNumber(body.tax_rate, 0.23);
        const normalizedTaxRate = Math.min(1, Math.max(0, taxRate));
        const stock = isPhysical ? parseStockValue(body.stock) : null;

        // 1. Create Product
        const { data: product, error: prodError } = await supabaseServer
            .from('store_products')
            .insert({
                product_id: crypto.randomUUID(),
                sku: body.sku, // Editable reference
                name: body.name,
                name_en: body.name_en || null,
                description: body.description,
                description_en: body.description_en || null,
                category_id: body.category_id,
                price,
                is_active: body.is_active,
                is_physical: isPhysical,
                type_id: typeId,
                metadata: body.metadata || {}, // NEW
                image_url: body.image_url,
                digital_url: body.digital_url,
                allowed_countries: Array.isArray(body.allowed_countries) ? body.allowed_countries : [],
                tax_rate: normalizedTaxRate,
                specifications: body.specifications || {},
                //Legacy fields
                category: body.category_name,
                stock
            })
            .select()
            .single();

        if (prodError) throw prodError;

        // 2. Create Variants
        if (isPhysical && body.variants && body.variants.length > 0) {
            const varsToInsert = body.variants.map((v: any) => ({
                product_id: product.product_id,
                name: v.name,
                stock: parseStockValue(v.stock),
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
        } else if (isPhysical) {
            // Default Variant (Legacy/Simple)
            const { error: varError } = await supabaseServer
                .from('product_variants')
                .insert({
                    product_id: product.product_id,
                    name: 'Padrão',
                    stock, // Fallback to body.stock
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
