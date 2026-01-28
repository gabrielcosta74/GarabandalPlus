import { supabaseServer } from '../../lib/supabase';
import { Product } from './data';

export async function getProduct(id: string): Promise<Product | null> {
    if (!supabaseServer) return null;

    try {
        const { data, error } = await supabaseServer
            .from('store_products')
            .select('product_id, name, description, category, price, currency, stock, is_active, is_physical, image_url, digital_url, allowed_countries')
            .eq('product_id', id)
            .eq('is_active', true)
            .maybeSingle();

        if (error || !data) return null;

        return {
            id: data.product_id,
            name: data.name || 'Produto',
            description: data.description || '',
            category: data.category || null,
            price: Number(data.price ?? 0),
            currency: data.currency || 'EUR',
            image: data.image_url || '/images/produto-placeholder.jpg',
            tag: data.is_physical ? 'Físico' : 'Digital',
            format: data.is_physical ? 'Produto físico' : 'PDF digital',
            isPhysical: data.is_physical ?? true,
            digitalUrl: data.digital_url || null,
            stock: typeof data.stock === 'number' ? data.stock : null,
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
            .select('product_id, name, description, category, price, currency, stock, is_active, is_physical, image_url')
            .eq('is_active', true)
            .neq('product_id', currentId)
            .limit(4);

        if (category) {
            query = query.eq('category', category);
        }

        const { data } = await query;

        return (data || []).map((p) => ({
            id: p.product_id,
            name: p.name || 'Produto',
            description: p.description || '',
            category: p.category || null,
            price: Number(p.price ?? 0),
            currency: p.currency || 'EUR',
            image: p.image_url || '/images/produto-placeholder.jpg',
            tag: p.is_physical ? 'Físico' : 'Digital',
            format: p.is_physical ? 'Produto físico' : 'PDF digital',
            isPhysical: p.is_physical ?? true,
            stock: typeof p.stock === 'number' ? p.stock : null,
        })) as Product[];

    } catch {
        return [];
    }
}
