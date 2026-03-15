import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { verifyAdmin } from '../../../../lib/admin-auth';

// GET all member contents for admin
export async function GET(req: Request) {
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    try {
        // Get all items including those not published
        const { data, error } = await supabaseServer!
            .from('member_contents')
            .select(`
                *,
                category:member_content_categories(id, name, slug),
                member_gallery_images(count)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ contents: data });

    } catch (error: any) {
        console.error("Admin API Error fetching member contents:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

// POST create new member content
export async function POST(req: Request) {
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { title, description, type, file_url, is_published, category_id, cover_image_url } = body;

        if (!title || !type) {
             return NextResponse.json({ error: 'Title and type are required' }, { status: 400 });
        }

        // Create the content
        const { data, error } = await supabaseServer!
            .from('member_contents')
            .insert({
                title,
                description,
                type,
                file_url: file_url || null,
                category_id: type === 'pdf' ? category_id || null : null,
                cover_image_url: type === 'pdf' ? cover_image_url || null : null,
                is_published: is_published || false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, content: data });

    } catch (error: any) {
        console.error("Admin API Error creating member content:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
