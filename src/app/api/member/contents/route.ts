import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/auth-utils';

export async function GET(req: Request) {
    try {
        const locale = new URL(req.url).searchParams.get('locale');
        const isEn = locale === 'en';
        const supabase = await createSupabaseServerClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data, error } = await supabase
            .from('member_contents')
            .select(`
                *,
                category:member_content_categories(id, name, name_en, slug),
                member_gallery_images(*)
            `)
            .eq('is_published', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const contents = (data || []).map((item: any) => ({
            ...item,
            title: isEn ? item.title_en || item.title : item.title,
            description: isEn ? item.description_en || item.description : item.description,
            category: item.category
                ? {
                    ...item.category,
                    name: isEn ? item.category.name_en || item.category.name : item.category.name,
                }
                : null,
        }));

        return NextResponse.json({ contents });

    } catch (error: any) {
        console.error("Member API Error fetching contents:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
