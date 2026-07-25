import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { getPublicLaunchTimestamp, isPreLaunch } from '../../../../lib/pilgrimage-early-access';
import { signEarlyAccessToken, earlyAccessCookieName, codesMatch } from '../../../../lib/early-access-token';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

const normalize = (value: string) => value.trim().toUpperCase().replace(/\s+/g, '');

// Verify a shared early-access code and, on success, grant a signed cookie that
// unlocks the pilgrimage until its public launch.
export async function POST(req: Request) {
    if (!supabaseServer) {
        return NextResponse.json({ ok: false, error: 'server' }, { status: 500, headers: noStore });
    }

    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const slug = String(body?.slug || '').trim();
    const code = String(body?.code || '').trim();
    if (!slug || !code) {
        return NextResponse.json({ ok: false, error: 'missing' }, { status: 400, headers: noStore });
    }

    const { data: pilgrimage } = await supabaseServer
        .from('pilgrimages')
        .select('id, slug, pricing_config')
        .eq('slug', slug)
        .maybeSingle();

    if (!pilgrimage) {
        return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404, headers: noStore });
    }

    // If the window already opened there is nothing to unlock.
    if (!isPreLaunch(pilgrimage)) {
        return NextResponse.json({ ok: true, alreadyPublic: true }, { headers: noStore });
    }

    const { data: access } = await supabaseServer
        .from('pilgrimage_access')
        .select('access_code')
        .eq('pilgrimage_id', pilgrimage.id)
        .maybeSingle();

    if (!access?.access_code || !codesMatch(normalize(code), normalize(access.access_code))) {
        return NextResponse.json({ ok: false, error: 'invalid_code' }, { status: 401, headers: noStore });
    }

    const launch = getPublicLaunchTimestamp(pilgrimage) ?? Date.now() + 48 * 60 * 60 * 1000;
    const token = signEarlyAccessToken(pilgrimage.id, launch);

    const res = NextResponse.json({ ok: true }, { headers: noStore });
    res.cookies.set(earlyAccessCookieName(pilgrimage.id), token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: new Date(launch),
    });
    return res;
}
