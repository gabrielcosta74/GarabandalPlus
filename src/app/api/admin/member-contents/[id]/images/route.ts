import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../../lib/admin-auth';

// POST add image to gallery
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { image_url, display_order } = body;

        if (!image_url) {
             return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
        }

        const { data, error } = await supabaseServer!
            .from('member_gallery_images')
            .insert({
                content_id: resolvedParams.id,
                image_url,
                display_order: display_order || 0,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, image: data });

    } catch (error: any) {
        console.error("Admin API Error adding gallery image:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
