import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../../../lib/admin-auth';

// DELETE a specific image from a gallery
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string, imageId: string }> }) {
    const resolvedParams = await params;
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    try {
        // 1. Get image to know url
        const { data: image, error: fetchError } = await supabaseServer!
            .from('member_gallery_images')
            .select('image_url')
            .eq('id', resolvedParams.imageId)
            .eq('content_id', resolvedParams.id)
            .single();

        if (fetchError) throw fetchError;

        // 2. Delete from storage
        if (image?.image_url) {
            const urlParts = image.image_url.split('/member-private-files/');
            const filePath = urlParts.length > 1 ? urlParts[1] : image.image_url;
            
            const { error: storageError } = await supabaseServer!
                .storage
                .from('member-private-files')
                .remove([filePath]);
                
            if (storageError) {
                console.warn("Could not delete image from storage:", storageError);
            }
        }

        // 3. Delete from DB
        const { error: deleteError } = await supabaseServer!
            .from('member_gallery_images')
            .delete()
            .eq('id', resolvedParams.imageId)
            .eq('content_id', resolvedParams.id);

        if (deleteError) throw deleteError;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Admin API Error deleting gallery image:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
