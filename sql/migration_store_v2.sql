-- Migration: Store V2 (Categories, Variants, Specifications)

-- 1. Create Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    attributes_template JSONB DEFAULT '{}'::jsonb, -- Defines structural requirements
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insert Default Categories
INSERT INTO public.categories (name, slug, attributes_template) VALUES
('Livros Físicos', 'livros-fisicos', '{"fields": ["isbn", "author", "pages", "publisher"]}'),
('Livros Digitais', 'livros-digitais', '{"fields": ["author", "pages", "file_format"]}'),
('Vestuário', 'vestuario', '{"fields": ["material", "gender"]}'),
('Artigos Religiosos', 'artigos-religiosos', '{"fields": ["material", "dimensions"]}'),
('Outros', 'outros', '{}')
ON CONFLICT (slug) DO NOTHING;

-- 3. Modify Products Table
ALTER TABLE public.store_products
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id),
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 23.00, -- 6, 13, 23
ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS is_digital BOOLEAN DEFAULT FALSE;

-- 4. Create Product Variants Table (for Stock/Sizes)
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id TEXT REFERENCES public.store_products(product_id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "S", "Red", "Default"
    sku TEXT UNIQUE,
    price_override NUMERIC(10,2), -- If different from base product
    stock INTEGER DEFAULT 0,
    attributes JSONB DEFAULT '{}'::jsonb, -- {"size": "S", "color": "Red"}
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Migrate Existing Stock to Default Variant
-- This ensures existing products don't lose stock info.
-- We create a 'Default' variant for every product that doesn't have variants yet.
INSERT INTO public.product_variants (product_id, name, stock, attributes, sku)
SELECT 
    product_id, 
    'Padrão', 
    COALESCE(stock, 0), 
    '{"is_default": true}'::jsonb,
    'SKU-' || product_id::text
FROM public.store_products
WHERE product_id NOT IN (SELECT DISTINCT product_id FROM public.product_variants)
ON CONFLICT (sku) DO NOTHING;

-- 6. Setup RLS (Security)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- Public Read Access
CREATE POLICY "Public Read Categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Public Read Variants" ON public.product_variants FOR SELECT USING (true);

-- Admin Write Access (Assuming authenticated users with admin role logic handled in app or specific policy)
-- For now, allowing all authenticated to READ. Write policies usually depend on a specific 'admin' claim or table.
-- Adjusting to likely existing pattern:
CREATE POLICY "Auth Read Categories" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth Read Variants" ON public.product_variants FOR SELECT TO authenticated USING (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO service_role;
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.product_variants TO anon, authenticated;

-- Force 'Outros' category for existing products without category
UPDATE public.store_products 
SET category_id = (SELECT id FROM public.categories WHERE slug = 'outros')
WHERE category_id IS NULL;
