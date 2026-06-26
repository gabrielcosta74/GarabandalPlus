import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { verifyAdmin } from '../../../../lib/admin-auth';

export const dynamic = 'force-dynamic';

// GET — lista todas as candidaturas a voluntário (com dados do membro).
export async function GET(req: Request) {
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }
    if (!supabaseServer) {
        return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
    }

    const { data, error } = await supabaseServer
        .from('voluntariado_garabandal')
        .select(`
            id, membro_id, status, linguas, disponibilidade, esteve_garabandal,
            condicao_fisica, compromisso_formacao, compromisso_colete, motivacao,
            admin_estado, admin_notas, created_at,
            membros:membro_id ( nome, email, telefone, numero_socio, country )
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[admin/voluntariado] list error', error);
        return NextResponse.json({ error: 'Falha ao carregar candidaturas.' }, { status: 500 });
    }

    return NextResponse.json({ applications: data || [] });
}

// PATCH — atualiza o estado interno / notas de uma candidatura.
export async function PATCH(req: Request) {
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }
    if (!supabaseServer) {
        return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
    }

    const { id, admin_estado, admin_notas } = body || {};
    if (!id) return NextResponse.json({ error: 'id em falta.' }, { status: 400 });

    const update: Record<string, unknown> = {};
    if (admin_estado && ['novo', 'em_analise', 'aceite', 'recusado'].includes(admin_estado)) {
        update.admin_estado = admin_estado;
    }
    if (typeof admin_notas === 'string') {
        update.admin_notas = admin_notas.slice(0, 4000);
    }

    if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 });
    }

    const { error } = await supabaseServer
        .from('voluntariado_garabandal')
        .update(update)
        .eq('id', id);

    if (error) {
        console.error('[admin/voluntariado] update error', error);
        return NextResponse.json({ error: 'Falha ao atualizar.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
