
import { ProductRow } from './page';

export interface ProductView {
    id: string;
    name: string;
    sku: string;
    category: string;
    categoryId: string | null;
    price: number;
    currency: string;
    stock: number;
    type: 'fisico' | 'digital';
    status: string;
    image: string;
    digitalUrl: string;
    tags: string[];
    lowStockThreshold: number;
    allowedCountries: string[];
    specifications: Record<string, any>;
    taxRate: number;
    description: string;
}

export const normalizeProduct = (p: ProductRow): ProductView => ({
    id: p.product_id,
    name: p.name || 'Sem nome',
    sku: p.sku || 'N/A',
    category: p.category_name || 'Geral',
    categoryId: p.category_id || null,
    price: Number(p.price || 0),
    currency: p.currency || 'EUR',
    stock: p.stock ?? 0,
    type: p.is_physical ? 'fisico' : 'digital',
    status: p.is_active ? 'ativo' : 'inativo',
    image: p.image_url || '',
    digitalUrl: p.digital_url || '',
    tags: Array.isArray(p.tags) ? p.tags : [],
    lowStockThreshold: p.low_stock_threshold || 5,
    allowedCountries: p.allowed_countries || [],
    specifications: p.specifications || {},
    taxRate: p.tax_rate ?? 0.23,
    description: p.description || ''
});

export const isLowStock = (stock: number, threshold: number) => stock <= threshold && stock > 0;
export const isOutOfStock = (stock: number) => stock <= 0;
