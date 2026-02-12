import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';

export const runtime = 'nodejs';
export const revalidate = 300;

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const rawId = decodeURIComponent(params.id);

    if (!supabaseServer) {
        return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    try {
        const candidates = new Set<string>([rawId]);
        if (rawId.includes('--')) {
            candidates.add(rawId.split('--')[0]);
        }
        if (rawId.includes('-')) {
            const parts = rawId.split('-');
            for (let i = parts.length - 1; i >= 1; i--) {
                candidates.add(parts.slice(0, i).join('-'));
            }
        }

        const candidateList = Array.from(candidates);
        const { data: products, error } = await supabaseServer
            .from('store_products')
            .select(
                'product_id, name, description, category_id, category, price, currency, stock, is_active, is_physical, type_id, metadata, image_url, digital_url, allowed_countries, tax_rate, specifications, variants:product_variants(*), category_info:categories(name)'
            )
            .in('product_id', candidateList)
            .eq('is_active', true);

        if (error || !products || products.length === 0) {
            return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
        }

        const product = products.reduce((best: any, current: any) => {
            if (!best) return current;
            return (current.product_id || '').length > (best.product_id || '').length ? current : best;
        }, null as any);

        const productData = product as any;
        const categoryInfo = productData.category_info;

        const mappedProduct = {
            id: productData.product_id,
            name: productData.name || 'Produto',
            description: productData.description || '',
            category: Array.isArray(categoryInfo) ? categoryInfo[0]?.name : categoryInfo?.name || productData.category || null,
            categoryId: productData.category_id || null,
            price: Number(productData.price ?? 0),
            currency: productData.currency || 'EUR',
            image: productData.image_url || '/images/produto-placeholder.jpg',
            tag: productData.is_physical ? 'Fisico' : 'Digital',
            format: productData.is_physical ? 'Produto físico' : 'PDF digital',
            isPhysical: productData.is_physical ?? true,
            digitalUrl: productData.digital_url || null,
            stock: typeof productData.stock === 'number' ? productData.stock : null,
            allowedCountries: productData.allowed_countries || [],
            taxRate: productData.tax_rate ?? 0.23,
            specifications: productData.specifications || {},
            variants: productData.variants || [],
            type_id: productData.type_id,
            metadata: productData.metadata || {},
        };

        return NextResponse.json({ product: mappedProduct }, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
            },
        });
    } catch (err) {
        console.error('Erro ao buscar produto:', err);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
