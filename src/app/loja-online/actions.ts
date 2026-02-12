'use server';

import { supabaseServer } from '../../lib/supabase';
import { unstable_cache } from 'next/cache';

const getFeaturedProductsCached = unstable_cache(async () => {
    if (!supabaseServer) return [];

    try {
        const { data, error } = await supabaseServer
            .from('store_products')
            .select('product_id, name, price, currency, image_url, is_physical, category, description')
            .eq('is_active', true)
            .limit(8)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching featured products:', error);
            return [];
        }

        return data.map(p => ({
            id: p.product_id,
            name: p.name,
            price: Number(p.price),
            currency: p.currency,
            image: p.image_url || '/images/produto-placeholder.jpg',
            category: p.category,
            isPhysical: p.is_physical
        }));
    } catch (err) {
        console.error('Error in getFeaturedProducts:', err);
        return [];
    }
}, ['featured-products'], { revalidate: 300 });

export async function getFeaturedProducts() {
    return getFeaturedProductsCached();
}
