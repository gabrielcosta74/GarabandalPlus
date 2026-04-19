
export interface ProductVariant {
    id?: string;
    product_id?: string;
    name: string;
    sku: string;
    stock: number;
    price_override?: number;
    attributes?: Record<string, any>;
}

export interface ProductRow {
    product_id: string;
    name?: string | null;
    sku?: string | null;
    category_name?: string | null;
    category_slug?: string | null;
    category_id?: string | null;
    price?: number | string | null;
    currency?: string | null;
    stock?: number | null;
    type_id?: string | null;
    metadata?: Record<string, any> | null;
    is_physical?: boolean | null;
    is_active?: boolean | null;
    image_url?: string | null;
    digital_url?: string | null;
    tags?: any[] | null;
    low_stock_threshold?: number | null;
    allowed_countries?: string[] | null;
    specifications?: Record<string, any> | null;
    tax_rate?: number | null;
    description?: string | null;
    variants?: ProductVariant[] | null;
    // EN translations
    name_en?: string | null;
    description_en?: string | null;
}

export interface ProductView {
    id: string;
    name: string;
    sku: string;
    category: string;
    categoryId: string | null;
    price: number;
    currency: string;
    stock: number | null;
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
    typeId: string;
    metadata: Record<string, any>;
    variants: ProductVariant[];
    slug?: string;
    // EN translations
    name_en?: string;
    description_en?: string;
}

// --- NEW CONFIGURATION CONSTANTS ---

export type ProductFieldConf = {
    key: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'boolean';
    options?: string[];
    placeholder?: string;
    suffix?: string;
};

export interface ProductTypeDefinition {
    id: string;
    label: string;
    isPhysical: boolean;
    hasVariants: boolean;
    requiresFile: boolean;
    defaultCategorySlug?: string;
    metadataFields: ProductFieldConf[];
}

export const PRODUCT_DEFINITIONS: Record<string, ProductTypeDefinition> = {
    'book_physical': {
        id: 'book_physical',
        label: 'Livro Físico',
        isPhysical: true,
        hasVariants: false,
        requiresFile: false,
        defaultCategorySlug: 'livros-fisicos',
        metadataFields: [
            { key: 'author', label: 'Autor', type: 'text', placeholder: 'Ex: Santa Teresa' },
            { key: 'publisher', label: 'Editora', type: 'text' },
            { key: 'isbn', label: 'ISBN', type: 'text' },
            { key: 'pages', label: 'Nº Páginas', type: 'number' },
            { key: 'cover_type', label: 'Tipo Capa', type: 'select', options: ['Mole', 'Dura'] }
        ]
    },
    'book_digital': {
        id: 'book_digital',
        label: 'Livro Digital (E-book)',
        isPhysical: false,
        hasVariants: false,
        requiresFile: true,
        defaultCategorySlug: 'livros-digitais',
        metadataFields: [
            { key: 'author', label: 'Autor', type: 'text' },
            { key: 'publisher', label: 'Editora', type: 'text' },
            { key: 'isbn', label: 'ISBN', type: 'text' },
            { key: 'pages', label: 'Nº Páginas', type: 'number' },
            { key: 'format', label: 'Formato', type: 'select', options: ['PDF', 'EPUB', 'MOBI'] }
        ]
    },
    'clothing': {
        id: 'clothing',
        label: 'Vestuário / Têxtil',
        isPhysical: true,
        hasVariants: true,
        requiresFile: false,
        defaultCategorySlug: 'vestuario',
        metadataFields: [
            { key: 'material', label: 'Material', type: 'text', placeholder: 'Ex: Algodão 100%' },
            { key: 'gender', label: 'Género', type: 'select', options: ['Unisex', 'Masculino', 'Feminino'] },
            { key: 'care_instructions', label: 'Instruções Lavagem', type: 'text' }
        ]
    },
    'religious_article': {
        id: 'religious_article',
        label: 'Artigo Religioso / Diversos',
        isPhysical: true,
        hasVariants: false, // Usually simple, but could change
        requiresFile: false,
        defaultCategorySlug: 'artigos-religiosos',
        metadataFields: [
            { key: 'material', label: 'Material', type: 'text' },
            { key: 'dimensions', label: 'Dimensões', type: 'text', placeholder: 'Ex: 10x15 cm' },
            { key: 'weight_g', label: 'Peso (g)', type: 'number', suffix: 'g' }
        ]
    },
    'digital_generic': { // For prayers, guides, etc.
        id: 'digital_generic',
        label: 'Download Digital (Genérico)',
        isPhysical: false,
        hasVariants: false,
        requiresFile: true,
        defaultCategorySlug: 'digitais',
        metadataFields: [
            { key: 'file_type', label: 'Tipo Ficheiro', type: 'text', placeholder: 'Ex: ZIP, PDF, MP3' },
            { key: 'version', label: 'Versão', type: 'text' }
        ]
    },
    'event_ticket': {
        id: 'event_ticket',
        label: 'Bilhete de Evento',
        isPhysical: false, // Usually virtual
        hasVariants: true, // Different tiers
        requiresFile: false, // Maybe generates one later
        defaultCategorySlug: 'eventos',
        metadataFields: [
            { key: 'event_date', label: 'Data Evento', type: 'text', placeholder: 'YYYY-MM-DD' },
            { key: 'location', label: 'Localização', type: 'text' }
        ]
    }
};

export const normalizeProduct = (p: ProductRow): ProductView => {
    // Infer definition to help normalization if needed
    // const def = PRODUCT_DEFINITIONS[p.type_id || 'religious_article'];
    const isDigitalType = !!(p.type_id && ['book_digital', 'event_ticket', 'digital_generic'].includes(p.type_id));
    const normalizeText = (value: unknown) =>
        String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();

    const categoryName = normalizeText(p.category_name);
    const categorySlug = normalizeText(p.category_slug);
    const categoryLooksDigital =
        categoryName.includes('digit') ||
        categoryName.includes('e-book') ||
        categoryName.includes('ebook') ||
        categoryName.includes('pdf') ||
        categorySlug.includes('digit');
    const isDigital = p.is_physical === false || isDigitalType || !!p.digital_url || categoryLooksDigital;
    const normalizedStock = isDigital
        ? null
        : (typeof p.stock === 'number' ? p.stock : 0);

    return {
        id: p.product_id,
        name: p.name || 'Sem nome',
        sku: p.sku || p.product_id || 'N/A',
        category: p.category_name || 'Geral',
        categoryId: p.category_id || null,
        price: Number(p.price || 0),
        currency: p.currency || 'EUR',
        stock: normalizedStock,
        typeId: p.type_id || 'religious_article',
        metadata: p.metadata || {},
        type: isDigital ? 'digital' : 'fisico',
        status: p.is_active ? 'ativo' : 'inativo',
        image: p.image_url || '',
        digitalUrl: p.digital_url || '',
        tags: Array.isArray(p.tags) ? p.tags : [],
        lowStockThreshold: p.low_stock_threshold || 5,
        allowedCountries: p.allowed_countries || [],
        specifications: p.specifications || {},
        taxRate: p.tax_rate ?? 0.23,
        description: p.description || '',
        variants: Array.isArray(p.variants) ? p.variants : [],
        name_en: p.name_en || '',
        description_en: p.description_en || '',
    };
};

export const isLowStock = (stock: number, threshold: number) => stock <= threshold && stock > 0;
export const isOutOfStock = (stock: number) => stock <= 0;
