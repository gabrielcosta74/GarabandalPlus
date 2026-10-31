import { Resend } from 'resend';
import { supabaseServer } from './supabase';
import { isDeliverableMarketingEmail, normalizeEmail } from './marketing-core';
import { isPaidStatus, normalizeQuotaStatus } from './membership-status';
import { buildSentCopy, mailboxFrom, saveCopy, type OutgoingAttachment } from './mailbox';

/**
 * Grupos para escrever a várias pessoas de uma vez a partir da caixa geral.
 * São grupos operacionais (inscritos de uma peregrinação, membros) — a
 * newsletter e as campanhas continuam na plataforma de marketing.
 *
 * Cada pessoa recebe o seu próprio email (ninguém vê os outros endereços) e
 * sai pelo Resend: o SMTP da Webnode não aguenta envios em massa.
 */

export type MailGroup = { id: string; label: string; description: string; count: number };
type Recipient = { email: string; name: string | null };

const MAX_GROUP_SIZE = 600;

const dedupe = (rows: Recipient[]) => {
    const seen = new Map<string, Recipient>();
    for (const row of rows) {
        const email = normalizeEmail(row.email);
        if (!email || !isDeliverableMarketingEmail(email) || seen.has(email)) continue;
        seen.set(email, { email, name: row.name?.trim() || null });
    }
    return [...seen.values()];
};

const formatMonth = (value: string | null) =>
    value ? new Date(value).toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' }) : '';

async function pilgrimageRecipients(pilgrimageId: string, status: 'confirmed' | 'pending') {
    if (!supabaseServer) return [];
    const { data, error } = await supabaseServer
        .from('bookings')
        .select('id, pilgrims ( full_name, email )')
        .eq('pilgrimage_id', pilgrimageId)
        .eq('status', status);
    if (error) throw error;
    return dedupe(
        ((data || []) as { pilgrims: { full_name: string | null; email: string | null }[] | null }[]).flatMap((booking) =>
            (booking.pilgrims || []).map((p) => ({ email: p.email || '', name: p.full_name })),
        ),
    );
}

async function memberRecipients(kind: 'active' | 'expired') {
    if (!supabaseServer) return [];
    const { data, error } = await supabaseServer.from('membros').select('nome, email, estado_quota, is_membro');
    if (error) throw error;
    return dedupe(
        ((data || []) as { nome: string | null; email: string | null; estado_quota: string | null; is_membro: boolean | null }[])
            .filter((m) => (kind === 'active'
                ? m.is_membro && isPaidStatus(m.estado_quota)
                : normalizeQuotaStatus(m.estado_quota) === 'expirado'))
            .map((m) => ({ email: m.email || '', name: m.nome })),
    );
}

export async function resolveGroup(id: string): Promise<Recipient[]> {
    const [kind, ref] = id.split(':');
    if (kind === 'members' && (ref === 'active' || ref === 'expired')) return memberRecipients(ref);
    if (kind === 'pilgrimage' && ref) return pilgrimageRecipients(ref, 'confirmed');
    if (kind === 'pilgrimage-pending' && ref) return pilgrimageRecipients(ref, 'pending');
    throw new Error('Grupo desconhecido.');
}

export type MailContact = { name: string | null; email: string; tag: string };

/** Sugestões para o campo "Para": membros e peregrinos pelo nome ou email. */
export async function searchContacts(raw: string): Promise<MailContact[]> {
    // Sem os carateres que partem o filtro or() do PostgREST.
    const q = raw.replace(/[,()%*\\]/g, ' ').trim();
    if (!supabaseServer || q.length < 2) return [];
    const pattern = `%${q}%`;
    const [members, pilgrims] = await Promise.all([
        supabaseServer.from('membros').select('nome, email, numero_socio')
            .or(`nome.ilike.${pattern},email.ilike.${pattern}`).not('email', 'is', null).limit(8),
        supabaseServer.from('pilgrims').select('full_name, email')
            .or(`full_name.ilike.${pattern},email.ilike.${pattern}`).not('email', 'is', null).limit(8),
    ]);

    const out = new Map<string, MailContact>();
    for (const m of members.data || []) {
        const email = normalizeEmail(m.email);
        if (!email || !isDeliverableMarketingEmail(email) || out.has(email)) continue;
        out.set(email, { name: m.nome?.trim() || null, email, tag: m.numero_socio != null ? `Membro ${m.numero_socio}` : 'Membro' });
    }
    for (const p of pilgrims.data || []) {
        const email = normalizeEmail(p.email);
        if (!email || !isDeliverableMarketingEmail(email) || out.has(email)) continue;
        out.set(email, { name: p.full_name?.trim() || null, email, tag: 'Peregrino' });
    }
    return [...out.values()].slice(0, 10);
}

export async function listGroups(): Promise<MailGroup[]> {
    if (!supabaseServer) return [];
    // Só peregrinações publicadas que não acabaram há mais de um mês (os
    // rascunhos são testes e demonstrações das lojas de apps).
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const { data: pilgrimages, error } = await supabaseServer
        .from('pilgrimages')
        .select('id, title, start_date, end_date')
        .neq('status', 'draft')
        .or(`end_date.gte.${since},end_date.is.null`)
        .order('start_date', { ascending: true });
    if (error) throw error;

    const [active, expired] = await Promise.all([memberRecipients('active'), memberRecipients('expired')]);
    const groups: MailGroup[] = [
        { id: 'members:active', label: 'Membros com quota em dia', description: 'Membros ativos', count: active.length },
        { id: 'members:expired', label: 'Membros com quota expirada', description: 'Quota expirada', count: expired.length },
    ];

    for (const p of pilgrimages || []) {
        const [confirmed, pending] = await Promise.all([
            pilgrimageRecipients(p.id, 'confirmed'),
            pilgrimageRecipients(p.id, 'pending'),
        ]);
        const when = formatMonth(p.start_date);
        groups.push({ id: `pilgrimage:${p.id}`, label: p.title, description: `Inscritos confirmados${when ? ` · ${when}` : ''}`, count: confirmed.length });
        if (pending.length) {
            groups.push({ id: `pilgrimage-pending:${p.id}`, label: p.title, description: `Inscrições por confirmar${when ? ` · ${when}` : ''}`, count: pending.length });
        }
    }
    return groups;
}

export async function sendToGroup(input: {
    groupId: string;
    subject: string;
    html: string;
    text?: string;
    attachments?: OutgoingAttachment[];
}) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY em falta.');
    const recipients = await resolveGroup(input.groupId);
    if (!recipients.length) throw new Error('O grupo não tem ninguém com email.');
    if (recipients.length > MAX_GROUP_SIZE) throw new Error(`O grupo tem ${recipients.length} pessoas; o máximo é ${MAX_GROUP_SIZE}.`);

    const resend = new Resend(apiKey);
    const from = mailboxFrom();
    const fromHeader = `${from.name} <${from.address}>`;
    const base = { from: fromHeader, replyTo: from.address, subject: input.subject, html: input.html, text: input.text };

    const failed: string[] = [];
    if (input.attachments?.length) {
        // O batch do Resend não aceita anexos: um a um, ao ritmo da API.
        const attachments = input.attachments.map((att) => ({ filename: att.filename, content: att.content }));
        for (const r of recipients) {
            const { error } = await resend.emails.send({ ...base, to: r.email, attachments });
            if (error) failed.push(r.email);
            await new Promise((resolve) => setTimeout(resolve, 550));
        }
    } else {
        for (let i = 0; i < recipients.length; i += 100) {
            const chunk = recipients.slice(i, i + 100);
            const { error } = await resend.batch.send(chunk.map((r) => ({ ...base, to: r.email })));
            if (error) failed.push(...chunk.map((r) => r.email));
            if (i + 100 < recipients.length) await new Promise((resolve) => setTimeout(resolve, 600));
        }
    }

    // Uma cópia em Enviados, com a lista em Bcc, para a equipa ver o que saiu.
    const sentTo = recipients.map((r) => r.email).filter((email) => !failed.includes(email));
    if (sentTo.length) {
        const raw = await buildSentCopy({ to: [from.address], bcc: sentTo, subject: input.subject, html: input.html, text: input.text, attachments: input.attachments });
        await saveCopy(raw).catch((error) => console.warn('[mailbox] grupo enviado, sem cópia em Enviados', error));
    }

    return { sent: sentTo.length, failed };
}
