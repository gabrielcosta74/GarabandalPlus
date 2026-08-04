import { NextResponse } from 'next/server';

import { verifyAdmin } from '../../../../../../lib/admin-auth';
import { supabaseServer } from '../../../../../../lib/supabase';
import { getPilgrimageAccounts } from '../../../../../../lib/logistics-accounts';

/**
 * GET /api/admin/logistics/[pilgrimageId]/accounts
 *
 * Contas e cobranças reais de uma peregrinação, para a área de Logística.
 * Leitura apenas: não escreve em inscrições nem em pagamentos.
 */
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET(
    req: Request,
    { params }: { params: Promise<{ pilgrimageId: string }> },
) {
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseServer) {
        return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const { pilgrimageId } = await params;

    try {
        const accounts = await getPilgrimageAccounts(supabaseServer, pilgrimageId);
        return NextResponse.json(accounts);
    } catch (error: any) {
        console.error('[logistics/accounts]', error);
        return NextResponse.json({ error: error?.message || 'Erro ao carregar contas' }, { status: 500 });
    }
}
