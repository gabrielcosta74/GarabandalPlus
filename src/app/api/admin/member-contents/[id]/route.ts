import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../lib/admin-auth';

// GET a specific member content
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    try {
        const { data, error } = await supabaseServer!
            .from('member_contents')
            .select(`
                *,
                member_gallery_images(*)
            `)
            .eq('id', resolvedParams.id)
            .order('display_order', { referencedTable: 'member_gallery_images', ascending: true })
            .single();

        if (error) throw error;

        return NextResponse.json({ content: data });

    } catch (error: any) {
        console.error("Admin API Error fetching member content:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

// PUT update a specific member content
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { title, description, is_published, file_url } = body;

        const { data, error } = await supabaseServer!
            .from('member_contents')
            .update({
                title,
                description,
                is_published,
                file_url,
                updated_at: new Date().toISOString()
            })
            .eq('id', resolvedParams.id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, content: data });

    } catch (error: any) {
        console.error("Admin API Error updating member content:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE a specific member content
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    try {
        // First fetch to know if we need to delete files from storage
        const { data: content, error: fetchError } = await supabaseServer!
            .from('member_contents')
            .select('*, member_gallery_images(*)')
            .eq('id', resolvedParams.id)
            .single();
            
        if (fetchError) throw fetchError;

        // Note: The actual files in the 'member-private-files' bucket should be deleted too.
        // We'll extract paths and delete them.
        const pathsToDelete: string[] = [];
        
        if (content.type === 'pdf' || content.type === 'audio') {
            if (content.file_url) {
                // Extract path from URL assuming standard format: /storage/v1/object/public/bucket/path
                // Or just delete the path if we stored only the path. 
                // Let's assume file_url is the full path stored in db after upload.
                pathsToDelete.push(content.file_url);
            }
        } else if (content.type === 'gallery' && content.member_gallery_images) {
            content.member_gallery_images.forEach((img: any) => {
                 if (img.image_url) pathsToDelete.push(img.image_url);
            });
        }

        if (pathsToDelete.length > 0) {
            // we remove the public URL part to get the storage path
            // e.g. "https://xxxx.supabase.co/storage/v1/object/public/member-private-files/path/to/file"
            // -> "path/to/file"
            const cleanedPaths = pathsToDelete.map(url => {
                const parts = url.split('/member-private-files/');
                return parts.length > 1 ? parts[1] : url;
            });
            const { error: storageError } = await supabaseServer!
                .storage
                .from('member-private-files')
                .remove(cleanedPaths);
                
            if (storageError) {
                console.warn("Failed to delete some files from storage", storageError);
            }
        }

        // Delete from DB (cascade restricts will delete member_gallery_images automatically)
        const { error: deleteError } = await supabaseServer!
            .from('member_contents')
            .delete()
            .eq('id', resolvedParams.id);

        if (deleteError) throw deleteError;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Admin API Error deleting member content:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
