import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../../../lib/admin-auth';
import { supabaseServer } from '../../../../../../lib/supabase';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

// Unambiguous alphabet (no 0/O/1/I) for a shareable code.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generateCode = () => {
    let out = '';
    for (let i = 0; i < 8; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return `${out.slice(0, 4)}-${out.slice(4)}`;
};

const guard = async (req: Request) => {
    const { authorized, error } = await verifyAdmin(req);
    if (!authorized) {
        const status = error === 'Forbidden: Not an Admin' ? 403 : 401;
        return NextResponse.json({ error: error || 'Unauthorized' }, { status, headers: noStore });
    }
    if (!supabaseServer) {
        return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: noStore });
    }
    return null;
};

// Read the current code so the admin editor can display it.
export async function GET(
    req: Request,
    { params }: { params: Promise<{ pilgrimageId: string }> },
) {
    const blocked = await guard(req);
    if (blocked) return blocked;

    const { pilgrimageId } = await params;
    const { data } = await supabaseServer!
        .from('pilgrimage_access')
        .select('access_code')
        .eq('pilgrimage_id', pilgrimageId)
        .maybeSingle();

    return NextResponse.json({ code: data?.access_code ?? null }, { headers: noStore });
}

// action: 'generate' | 'set' | 'clear'
export async function POST(
    req: Request,
    { params }: { params: Promise<{ pilgrimageId: string }> },
) {
    const blocked = await guard(req);
    if (blocked) return blocked;

    const { pilgrimageId } = await params;
    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const action = String(body?.action || 'generate');

    if (action === 'clear') {
        await supabaseServer!.from('pilgrimage_access').delete().eq('pilgrimage_id', pilgrimageId);
        return NextResponse.json({ code: null }, { headers: noStore });
    }

    const code = action === 'set'
        ? String(body?.code || '').trim().toUpperCase()
        : generateCode();

    if (!code) {
        return NextResponse.json({ error: 'empty_code' }, { status: 400, headers: noStore });
    }

    const { error } = await supabaseServer!
        .from('pilgrimage_access')
        .upsert({ pilgrimage_id: pilgrimageId, access_code: code, updated_at: new Date().toISOString() }, { onConflict: 'pilgrimage_id' });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500, headers: noStore });
    }

    return NextResponse.json({ code }, { headers: noStore });
}
