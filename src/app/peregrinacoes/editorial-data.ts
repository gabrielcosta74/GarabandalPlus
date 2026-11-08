import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';

// Dados extra da página /peregrinacoes (testemunhos e galeria),
// lidos no servidor para chegarem já no HTML. Tudo público (anon key).

export type EditorialTestimonial = {
    id: string;
    author_name: string;
    role: string | null;
    role_en: string | null;
    text: string;
    text_en: string | null;
};

export type EditorialGalleryImage = { id: string; image_url: string };

export type EditorialData = {
    testimonials: EditorialTestimonial[];
    gallery: EditorialGalleryImage[];
};

const EMPTY: EditorialData = { testimonials: [], gallery: [] };

const loadEditorialData = unstable_cache(async (): Promise<EditorialData> => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return EMPTY;

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const [testimonials, gallery] = await Promise.all([
        supabase
            .from('testimonials')
            .select('id,author_name,role,role_en,text,text_en')
            .order('display_order', { ascending: true }),
        supabase
            .from('gallery_images')
            .select('id,image_url')
            .eq('is_active', true)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false })
            .limit(12),
    ]);

    return {
        testimonials: (testimonials.data as EditorialTestimonial[] | null) ?? [],
        gallery: ((gallery.data as EditorialGalleryImage[] | null) ?? []).filter((img) => !!img.image_url),
    };
}, ['pilgrimages-editorial-data-v2'], { revalidate: 300 });

export async function getEditorialData(): Promise<EditorialData> {
    try {
        return await loadEditorialData();
    } catch (err) {
        console.error('❌ [Peregrinacoes] Editorial data failed:', err);
        return EMPTY;
    }
}
