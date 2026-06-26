import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { sendVolunteerApplicationEmail } from '../../../../lib/email';
import { getAppUrl } from '../../../../lib/config';

export const dynamic = 'force-dynamic';

const VALID_LANGS = ['pt', 'es', 'en', 'fr', 'it', 'de', 'outra'];

async function authMember(req: Request) {
    if (!supabaseServer) return { error: 'Server configuration error', status: 500 as const };

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!bearerToken) return { error: 'Autenticação necessária.', status: 401 as const };

    const { data, error } = await supabaseServer.auth.getUser(bearerToken);
    if (error || !data?.user) return { error: 'Sessão inválida.', status: 401 as const };
    return { user: data.user };
}

// GET — devolve se o membro já respondeu (para o popup forçado decidir se aparece).
export async function GET(req: Request) {
    const auth = await authMember(req);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { data } = await supabaseServer!
        .from('voluntariado_garabandal')
        .select('status, created_at')
        .eq('membro_id', auth.user.id)
        .maybeSingle();

    return NextResponse.json({
        responded: !!data,
        status: data?.status ?? null,
    });
}

// POST — guarda a resposta do membro (candidatura ou "sem interesse").
export async function POST(req: Request) {
    const auth = await authMember(req);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const user = auth.user;

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
    }

    const status = body?.status === 'nao_interessado' ? 'nao_interessado' : 'candidato';

    if (status === 'candidato') {
        if (!body?.compromisso_formacao || !body?.compromisso_colete) {
            return NextResponse.json(
                { error: 'É necessário aceitar a formação obrigatória e o uso do colete.' },
                { status: 400 }
            );
        }
    }

    const linguas: string[] = Array.isArray(body?.linguas)
        ? body.linguas.filter((l: unknown) => typeof l === 'string' && VALID_LANGS.includes(l))
        : [];

    const clean = (v: unknown, max = 2000) =>
        typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

    const record = {
        membro_id: user.id,
        status,
        linguas: status === 'candidato' ? linguas : [],
        disponibilidade: status === 'candidato' ? clean(body?.disponibilidade) : null,
        esteve_garabandal: status === 'candidato' ? clean(body?.esteve_garabandal, 200) : null,
        condicao_fisica: status === 'candidato' ? clean(body?.condicao_fisica, 200) : null,
        compromisso_formacao: status === 'candidato' ? !!body?.compromisso_formacao : false,
        compromisso_colete: status === 'candidato' ? !!body?.compromisso_colete : false,
        motivacao: status === 'candidato' ? clean(body?.motivacao) : null,
    };

    const { error } = await supabaseServer!
        .from('voluntariado_garabandal')
        .upsert(record, { onConflict: 'membro_id' });

    if (error) {
        console.error('[voluntariado] upsert error', error);
        return NextResponse.json({ error: 'Não foi possível guardar a candidatura.' }, { status: 500 });
    }

    // Notificar o Apostolado apenas em candidaturas reais (não para "sem interesse").
    if (status === 'candidato') {
        try {
            const { data: membro } = await supabaseServer!
                .from('membros')
                .select('nome, email, telefone, numero_socio')
                .eq('id', user.id)
                .maybeSingle();

            const labelLang: Record<string, string> = {
                pt: 'Português', es: 'Espanhol', en: 'Inglês',
                fr: 'Francês', it: 'Italiano', de: 'Alemão', outra: 'Outra',
            };

            await sendVolunteerApplicationEmail({
                memberName: membro?.nome,
                memberEmail: membro?.email && !membro.email.endsWith('@sem-email.local') ? membro.email : null,
                memberPhone: membro?.telefone,
                numeroSocio: membro?.numero_socio,
                linguas: linguas.map((l) => labelLang[l] || l),
                disponibilidade: record.disponibilidade,
                esteveGarabandal: record.esteve_garabandal,
                condicaoFisica: record.condicao_fisica,
                motivacao: record.motivacao,
                adminUrl: `${getAppUrl()}/admin/membros/voluntariado`,
            });
        } catch (e) {
            console.error('[voluntariado] email notify failed', e);
        }
    }

    return NextResponse.json({ ok: true, status });
}
