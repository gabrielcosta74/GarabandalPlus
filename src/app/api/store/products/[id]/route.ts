import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { inferIsDigitalProduct } from '../../../../../lib/product-kind';
import { inferRequestLocale } from '../../../../../lib/locale-routing';
import { getStoreProductTypeText, localizeStoreProductText } from '../../../../../lib/store-i18n';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const rawId = decodeURIComponent(id);
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') === 'en' ? 'en' : inferRequestLocale(request);

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
                'product_id, name, name_en, description, description_en, category_id, category, price, currency, stock, is_active, is_physical, type_id, metadata, image_url, digital_url, allowed_countries, tax_rate, specifications, variants:product_variants(*), category_info:categories(name)'
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
        const category = Array.isArray(categoryInfo)
            ? categoryInfo[0]?.name
            : categoryInfo?.name || productData.category || null;
        const isDigital = inferIsDigitalProduct({
            isPhysical: productData.is_physical,
            typeId: productData.type_id,
            category,
            name: productData.name,
            digitalUrl: productData.digital_url,
        });
        const isPhysical = !isDigital;
        const localizedProduct = localizeStoreProductText(productData, locale);
        const localizedCategory = localizeStoreProductText({ category, type_id: productData.type_id }, locale).category;
        const typeText = getStoreProductTypeText(isPhysical, locale);

        const mappedProduct = {
            id: productData.product_id,
            name: localizedProduct.name,
            description: localizedProduct.description,
            category: localizedCategory,
            categoryId: productData.category_id || null,
            price: Number(productData.price ?? 0),
            currency: productData.currency || 'EUR',
            image: productData.image_url || '/images/produto-placeholder.jpg',
            tag: typeText.tag,
            format: typeText.format,
            isPhysical,
            digitalUrl: productData.digital_url || null,
            stock: isPhysical && typeof productData.stock === 'number' ? productData.stock : null,
            allowedCountries: productData.allowed_countries || [],
            taxRate: productData.tax_rate ?? 0.23,
            specifications: productData.specifications || {},
            variants: productData.variants || [],
            type_id: productData.type_id,
            metadata: productData.metadata || {},
        };

        return NextResponse.json({ product: mappedProduct }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                Pragma: 'no-cache',
                Expires: '0',
            },
        });
    } catch (err) {
        console.error('Erro ao buscar produto:', err);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
