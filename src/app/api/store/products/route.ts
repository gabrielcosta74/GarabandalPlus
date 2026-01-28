import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!supabaseServer) {
    return NextResponse.json({ products: [] });
  }

  try {
    const { data, error } = await supabaseServer
      .from('store_products')
      .select(
        'product_id, name, description, category, price, currency, stock, is_active, is_physical, image_url, digital_url, allowed_countries',
      )
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.warn('Erro ao carregar stock:', error);
      return NextResponse.json({ products: [] });
    }

    const products = (data || []).map((product) => ({
      id: product.product_id,
      name: product.name || 'Produto',
      description: product.description || '',
      category: product.category || null,
      price: Number(product.price ?? 0),
      currency: product.currency || 'EUR',
      image: product.image_url || '/images/produto-placeholder.jpg',
      tag: product.is_physical ? 'Fisico' : 'Digital',
      format: product.is_physical ? 'Produto físico' : 'PDF digital',
      isPhysical: product.is_physical ?? true,
      digitalUrl: product.digital_url || null,
      stock: typeof product.stock === 'number' ? product.stock : null,
      allowedCountries: product.allowed_countries || [],
    }));

    return NextResponse.json({ products });
  } catch (err) {
    console.warn('Stock indisponível:', err);
    return NextResponse.json({ products: [] });
  }
}
