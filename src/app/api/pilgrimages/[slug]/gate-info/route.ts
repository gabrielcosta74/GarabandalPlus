import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { getEarlyAccessConfig, isPreLaunch } from '../../../../../lib/pilgrimage-early-access';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

// Public teaser for the access gate: returns only the non-sensitive fields the
// cinematic gate needs (cover image + launch time). Full content stays behind
// the code. Responds 404 for anything that is not a pre-launch pilgrimage, so
// the detail page can tell "gated" apart from "not found".
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    if (!supabaseServer) {
        return NextResponse.json({ preLaunch: false }, { status: 500, headers: noStore });
    }

    const { slug } = await params;
    const { data } = await supabaseServer
        .from('pilgrimages')
        .select('id, slug, title, title_en, cover_image, cover_image_en, pricing_config')
        .eq('slug', slug)
        .maybeSingle();

    if (!data || !isPreLaunch(data)) {
        return NextResponse.json({ preLaunch: false }, { status: 404, headers: noStore });
    }

    return NextResponse.json(
        {
            preLaunch: true,
            title: data.title,
            title_en: data.title_en,
            cover_image: data.cover_image,
            cover_image_en: data.cover_image_en,
            public_launch_at: getEarlyAccessConfig(data)?.public_launch_at ?? null,
        },
        { headers: noStore },
    );
}
