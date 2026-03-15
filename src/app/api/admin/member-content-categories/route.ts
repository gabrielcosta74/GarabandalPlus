import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../lib/admin-auth';
import { slugify } from '../../../../lib/slug';
import { supabaseServer } from '../../../../lib/supabase';

export async function GET(req: Request) {
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    try {
        const { data, error } = await supabaseServer!
            .from('member_content_categories')
            .select('*')
            .order('name');

        if (error) throw error;

        return NextResponse.json({ categories: data || [] });
    } catch (error: any) {
        console.error('Admin API Error fetching member content categories:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const name = body?.name?.trim();

        if (!name) {
            return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
        }

        const slug = slugify(name);

        const { data: existingCategory, error: existingError } = await supabaseServer!
            .from('member_content_categories')
            .select('*')
            .eq('slug', slug)
            .maybeSingle();

        if (existingError) throw existingError;

        if (existingCategory) {
            return NextResponse.json({ category: existingCategory, created: false });
        }

        const { data, error } = await supabaseServer!
            .from('member_content_categories')
            .insert({
                name,
                slug,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ category: data, created: true });
    } catch (error: any) {
        console.error('Admin API Error creating member content category:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
