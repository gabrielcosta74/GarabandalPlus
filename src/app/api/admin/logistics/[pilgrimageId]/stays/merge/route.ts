import { NextResponse } from 'next/server';

import { supabaseServer } from '../../../../../../../lib/supabase';
import { guardStay, missingTableMessage } from '../../../../../../../lib/logistics/route-guard';

/**
 * POST { keepId, dropId }: junta duas estadias seguidas do mesmo hotel numa só.
 * A base de dados mantém o total (média dos preços pelas noites), passa linhas
 * e prestações e recusa se a que sai tiver acordo.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ pilgrimageId: string }> }) {
    const { pilgrimageId } = await params;
    const body = await req.json().catch(() => ({})) as { keepId?: string; dropId?: string };
    const keepId = String(body.keepId || '');
    const dropId = String(body.dropId || '');
    for (const id of [keepId, dropId]) {
        const denied = await guardStay(req, pilgrimageId, id);
        if (denied) return denied;
    }
    const { error } = await supabaseServer!.rpc('logistics_merge_stays', { p_keep: keepId, p_drop: dropId });
    if (error) {
        const message = /function .* does not exist|Could not find the function/i.test(error.message)
            ? missingTableMessage('does not exist')
            : error.message;
        return NextResponse.json({ error: message }, { status: error.code === 'P0001' ? 409 : 400 });
    }
    return NextResponse.json({ ok: true });
}
