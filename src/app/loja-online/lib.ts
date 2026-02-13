import { supabaseServer } from '../../lib/supabase';
import { Product } from './data';
import { inferIsDigitalProduct } from '../../lib/product-kind';

export async function getProduct(id: string): Promise<Product | null> {
    if (!supabaseServer) return null;

    try {
        const { data, error } = await supabaseServer
            .from('store_products')
            .select('product_id, name, description, category, price, currency, stock, is_active, is_physical, type_id, image_url, digital_url, allowed_countries')
            .eq('product_id', id)
            .eq('is_active', true)
            .maybeSingle();

        if (error || !data) return null;

        const isDigital = inferIsDigitalProduct({
            isPhysical: data.is_physical,
            typeId: (data as any).type_id,
            category: data.category,
            name: data.name,
            digitalUrl: data.digital_url,
        });
        const isPhysical = !isDigital;

        return {
            id: data.product_id,
            name: data.name || 'Produto',
            description: data.description || '',
            category: data.category || null,
            price: Number(data.price ?? 0),
            currency: data.currency || 'EUR',
            image: data.image_url || '/images/produto-placeholder.jpg',
            tag: isPhysical ? 'Físico' : 'Digital',
            format: isPhysical ? 'Produto físico' : 'PDF digital',
            isPhysical,
            digitalUrl: data.digital_url || null,
            stock: isPhysical && typeof data.stock === 'number' ? data.stock : null,
            allowedCountries: data.allowed_countries || [],
        };
    } catch (err) {
        console.error('Error fetching product:', err);
        return null;
    }
}

export async function getRelatedProducts(currentId: string, category?: string | null): Promise<Product[]> {
    if (!supabaseServer) return [];

    try {
        let query = supabaseServer
            .from('store_products')
            .select('product_id, name, description, category, price, currency, stock, is_active, is_physical, type_id, image_url, digital_url')
            .eq('is_active', true)
            .neq('product_id', currentId)
            .limit(4);

        if (category) {
            query = query.eq('category', category);
        }

        const { data } = await query;

        return (data || []).map((p: any) => {
            const isDigital = inferIsDigitalProduct({
                isPhysical: p.is_physical,
                typeId: p.type_id,
                category: p.category,
                name: p.name,
                digitalUrl: p.digital_url,
            });
            const isPhysical = !isDigital;

            return {
            id: p.product_id,
            name: p.name || 'Produto',
            description: p.description || '',
            category: p.category || null,
            price: Number(p.price ?? 0),
            currency: p.currency || 'EUR',
            image: p.image_url || '/images/produto-placeholder.jpg',
            tag: isPhysical ? 'Físico' : 'Digital',
            format: isPhysical ? 'Produto físico' : 'PDF digital',
            isPhysical,
            stock: isPhysical && typeof p.stock === 'number' ? p.stock : null,
        };
        }) as Product[];

    } catch {
        return [];
    }
}
