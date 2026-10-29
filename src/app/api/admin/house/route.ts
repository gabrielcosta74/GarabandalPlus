import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { verifyAdmin } from '../../../../lib/admin-auth';
import { logAdminAudit } from '../../../../lib/admin-audit';
import { newHouseCode, notifyHouseDecision } from '../../../../lib/house-admin';

export const dynamic = 'force-dynamic';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

type PatchBody = {
    action?: string;
    id?: string;
    status?: string;
    teamMessage?: unknown;
    membroId?: string;
    validUntil?: string | null;
    waiveSeniority?: boolean;
    note?: unknown;
    startsOn?: string;
    endsOn?: string;
    reason?: unknown;
    enabled?: boolean;
    maxGuests?: unknown;
    maxNights?: unknown;
    minMemberYears?: unknown;
    horizonDays?: unknown;
    rulesContentId?: string | null;
    bumpRulesVersion?: boolean;
};

// GET — tudo o que a página da casa mostra: pedidos, códigos, datas fechadas,
// definições, documentos possíveis para as regras e a lista de membros.
export async function GET(req: Request) {
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    if (!supabaseServer) return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });

    const [settings, bookings, codes, blocked, documents, members] = await Promise.all([
        supabaseServer.from('house_settings').select('*').limit(1).maybeSingle(),
        supabaseServer
            .from('house_bookings')
            .select(`
                id, membro_id, check_in, check_out, guests, contact_name, contact_phone, contact_email, notes,
                status, team_message, wants_to_donate, decided_at, decided_by, cancelled_at, created_at,
                house_booking_guests ( position, full_name ),
                membros:membro_id ( nome, numero_socio )
            `)
            .order('check_in', { ascending: true }),
        supabaseServer
            .from('house_training_codes')
            .select('id, code_hint, membro_id, valid_until, waive_seniority, note, issued_by, revoked_at, created_at, membros:membro_id ( nome, numero_socio )')
            .order('created_at', { ascending: false }),
        supabaseServer.from('house_blocked_dates').select('*').order('starts_on', { ascending: true }),
        supabaseServer.from('member_contents').select('id, title').eq('is_published', true).order('title'),
        supabaseServer.from('membros').select('id, nome, email, numero_socio').order('nome'),
    ]);

    const failed = [settings, bookings, codes, blocked, documents, members].find((result) => result.error);
    if (failed?.error) {
        console.error('[admin/house] load error', failed.error);
        return NextResponse.json({ error: 'Falha ao carregar a casa.' }, { status: 500 });
    }

    return NextResponse.json({
        settings: settings.data,
        bookings: bookings.data || [],
        codes: codes.data || [],
        blocked: blocked.data || [],
        documents: documents.data || [],
        members: members.data || [],
    });
}

// PATCH — uma ação de cada vez (`action`).
export async function PATCH(req: Request) {
    const { authorized, user, error: authError } = await verifyAdmin(req);
    if (!authorized) return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    if (!supabaseServer) return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
    const db = supabaseServer;
    const adminEmail: string | null = user?.email ?? null;

    let body: PatchBody;
    try {
        body = ((await req.json()) ?? {}) as PatchBody;
    } catch {
        return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
    }
    const action = body?.action;
    const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

    // Confirmar ou recusar um pedido, com uma mensagem opcional que o membro vê na app.
    if (action === 'decide') {
        const status = body.status;
        if (!body.id || (status !== 'confirmed' && status !== 'declined')) {
            return NextResponse.json({ error: 'Pedido ou estado inválido.' }, { status: 400 });
        }
        const { data, error } = await db
            .from('house_bookings')
            .update({
                status,
                team_message: text(body.teamMessage, 1000) || null,
                decided_at: new Date().toISOString(),
                decided_by: adminEmail,
                updated_at: new Date().toISOString(),
            })
            .eq('id', body.id)
            .in('status', ['pending', 'confirmed'])
            .select('id, membro_id, check_in, check_out')
            .maybeSingle();
        if (error || !data) {
            console.error('[admin/house] decide error', error);
            return NextResponse.json({ error: 'Não foi possível atualizar o pedido (já cancelado?).' }, { status: 409 });
        }
        await logAdminAudit({ adminEmail, memberId: data.membro_id, action: `house_booking_${status}`, details: { bookingId: data.id } });
        const delivered = await notifyHouseDecision(db, data, status);
        return NextResponse.json({ ok: true, pushed: delivered > 0 });
    }

    if (action === 'message') {
        if (!body.id) return NextResponse.json({ error: 'Pedido em falta.' }, { status: 400 });
        const { error } = await db
            .from('house_bookings')
            .update({ team_message: text(body.teamMessage, 1000) || null, updated_at: new Date().toISOString() })
            .eq('id', body.id);
        if (error) return NextResponse.json({ error: 'Falha ao guardar a mensagem.' }, { status: 500 });
        return NextResponse.json({ ok: true });
    }

    // Emite um código de formação para um membro. O código só é devolvido agora.
    if (action === 'issue_code') {
        if (!body.membroId) return NextResponse.json({ error: 'Escolha o membro.' }, { status: 400 });
        if (body.validUntil && !datePattern.test(body.validUntil)) {
            return NextResponse.json({ error: 'Data de validade inválida.' }, { status: 400 });
        }
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const code = newHouseCode();
            const { error } = await db.from('house_training_codes').insert({
                code_hash: code.hash,
                code_hint: code.hint,
                membro_id: body.membroId,
                valid_until: body.validUntil || null,
                waive_seniority: body.waiveSeniority === true,
                note: text(body.note, 500) || null,
                issued_by: adminEmail,
            });
            if (!error) {
                await logAdminAudit({ adminEmail, memberId: body.membroId, action: 'house_code_issued', details: { hint: code.hint, waiveSeniority: body.waiveSeniority === true } });
                return NextResponse.json({ ok: true, code: code.display });
            }
            if (error.code !== '23505') {
                console.error('[admin/house] issue code error', error);
                return NextResponse.json({ error: 'Falha ao emitir o código.' }, { status: 500 });
            }
        }
        return NextResponse.json({ error: 'Falha ao emitir o código.' }, { status: 500 });
    }

    if (action === 'revoke_code') {
        if (!body.id) return NextResponse.json({ error: 'Código em falta.' }, { status: 400 });
        const { data, error } = await db
            .from('house_training_codes')
            .update({ revoked_at: new Date().toISOString() })
            .eq('id', body.id)
            .is('revoked_at', null)
            .select('membro_id, code_hint')
            .maybeSingle();
        if (error) return NextResponse.json({ error: 'Falha ao anular o código.' }, { status: 500 });
        if (data) await logAdminAudit({ adminEmail, memberId: data.membro_id, action: 'house_code_revoked', details: { hint: data.code_hint } });
        return NextResponse.json({ ok: true });
    }

    // Fecha noites (manutenção, uso interno). `endsOn` é o dia em que reabre.
    if (action === 'block') {
        const startsOn = body.startsOn ?? '';
        const endsOn = body.endsOn ?? '';
        if (!datePattern.test(startsOn) || !datePattern.test(endsOn) || endsOn <= startsOn) {
            return NextResponse.json({ error: 'Datas inválidas.' }, { status: 400 });
        }
        const { error } = await db.from('house_blocked_dates').insert({
            starts_on: body.startsOn,
            ends_on: body.endsOn,
            reason: text(body.reason, 200) || null,
        });
        if (error) return NextResponse.json({ error: 'Falha ao fechar as datas.' }, { status: 500 });
        await logAdminAudit({ adminEmail, action: 'house_dates_blocked', details: { startsOn: body.startsOn, endsOn: body.endsOn } });
        return NextResponse.json({ ok: true });
    }

    if (action === 'unblock') {
        if (!body.id) return NextResponse.json({ error: 'Datas em falta.' }, { status: 400 });
        const { error } = await db.from('house_blocked_dates').delete().eq('id', body.id);
        if (error) return NextResponse.json({ error: 'Falha ao reabrir as datas.' }, { status: 500 });
        return NextResponse.json({ ok: true });
    }

    if (action === 'settings') {
        const { data: current } = await db.from('house_settings').select('rules_version, rules_content_id').limit(1).maybeSingle();
        const int = (value: unknown, min: number, max: number) => {
            const parsed = Math.round(Number(value));
            return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
        };
        const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (typeof body.enabled === 'boolean') update.enabled = body.enabled;
        const maxGuests = int(body.maxGuests, 1, 20);
        const maxNights = int(body.maxNights, 1, 60);
        const minYears = int(body.minMemberYears, 0, 50);
        const horizon = int(body.horizonDays, 30, 1095);
        if (maxGuests !== null) update.max_guests = maxGuests;
        if (maxNights !== null) update.max_nights = maxNights;
        if (minYears !== null) update.min_member_years = minYears;
        if (horizon !== null) update.booking_horizon_days = horizon;
        if (body.rulesContentId !== undefined) update.rules_content_id = body.rulesContentId || null;
        // Regras novas pedem nova aceitação: quem estiver a meio do pedido tem de as ler outra vez.
        const rulesChanged = body.bumpRulesVersion === true
            || (body.rulesContentId !== undefined && (body.rulesContentId || null) !== (current?.rules_content_id ?? null));
        if (rulesChanged) update.rules_version = (current?.rules_version ?? 1) + 1;

        const { error } = await db.from('house_settings').update(update).eq('id', true);
        if (error) {
            console.error('[admin/house] settings error', error);
            return NextResponse.json({ error: 'Falha ao guardar as definições.' }, { status: 500 });
        }
        await logAdminAudit({ adminEmail, action: 'house_settings_updated', details: update });
        return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Ação desconhecida.' }, { status: 400 });
}
