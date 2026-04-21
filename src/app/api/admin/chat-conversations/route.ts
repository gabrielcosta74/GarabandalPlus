import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../lib/admin-auth';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getDb() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
    const auth = await verifyAdmin(req);
    if (!auth.authorized) {
        return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = 30;
    const offset = (page - 1) * limit;
    const slug = searchParams.get('slug') || null;

    const db = getDb();
    if (!db) return NextResponse.json({ error: 'DB error' }, { status: 500 });

    let query = db
        .from('chat_conversations')
        .select('id, session_id, pilgrimage_slug, pilgrimage_title, messages, created_at, updated_at', { count: 'exact' })
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (slug) query = query.eq('pilgrimage_slug', slug);

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ conversations: data, total: count, page, limit });
}
