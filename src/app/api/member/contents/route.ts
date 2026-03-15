import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/auth-utils';

export async function GET() {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data, error } = await supabase
            .from('member_contents')
            .select(`
                *,
                category:member_content_categories(id, name, slug),
                member_gallery_images(*)
            `)
            .eq('is_published', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ contents: data });

    } catch (error: any) {
        console.error("Member API Error fetching contents:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
