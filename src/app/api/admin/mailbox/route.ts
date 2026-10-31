import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../lib/admin-auth';
import { logAdminAudit } from '../../../../lib/admin-audit';
import {
    MailboxNotConfiguredError,
    getAttachment,
    getMessage,
    listFolders,
    listMessages,
    mailboxAddress,
    sendMail,
    updateMessages,
    type MailAction,
    type MailAddress,
    type OutgoingAttachment,
} from '../../../../lib/mailbox';
import addressparser from 'nodemailer/lib/addressparser';
import { listGroups, resolveGroup, searchContacts, sendToGroup } from '../../../../lib/mailbox-groups';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_ATTACHMENTS_BYTES = 15 * 1024 * 1024;

// A caixa faz muitos pedidos seguidos (lista, abrir, marcar…). Guardar por um
// minuto a resposta do Supabase para o mesmo token poupa uma ida por pedido.
const AUTH_CACHE_MS = 60_000;
const authCache = new Map<string, { at: number; result: Awaited<ReturnType<typeof verifyAdmin>> }>();

async function verifyAdminCached(req: Request) {
    const token = req.headers.get('Authorization') || '';
    const hit = authCache.get(token);
    if (hit && Date.now() - hit.at < AUTH_CACHE_MS) return hit.result;
    const result = await verifyAdmin(req);
    if (result.authorized) {
        if (authCache.size > 50) authCache.clear();
        authCache.set(token, { at: Date.now(), result });
    }
    return result;
}
const ACTIONS: MailAction[] = ['seen', 'unseen', 'flag', 'unflag', 'trash', 'move'];

const fail = (error: unknown) => {
    if (error instanceof MailboxNotConfiguredError) {
        return NextResponse.json({ error: error.message, notConfigured: true }, { status: 503 });
    }
    // Palavra-passe errada: parar aqui (a página deixa de tentar) em vez de
    // insistir e arriscar um bloqueio da caixa pelo fornecedor.
    if ((error as { authenticationFailed?: boolean })?.authenticationFailed) {
        return NextResponse.json({
            error: 'O servidor de email recusou o login. Confirme a palavra-passe em MAILBOX_PASSWORD (é a da caixa geral@, não a da conta Webnode).',
            notConfigured: true,
        }, { status: 503 });
    }
    console.error('[admin/mailbox]', error);
    const message = error instanceof Error ? error.message : 'Falha na caixa de email.';
    return NextResponse.json({ error: message }, { status: 500 });
};

// Aceita "email", "Nome <email>" e listas separadas por vírgula, como vêm das
// respostas (os destinatários originais trazem o nome).
const emailList = (value: unknown): MailAddress[] => {
    const raw = (Array.isArray(value) ? value.map(String) : typeof value === 'string' ? [value] : []).join(', ');
    return addressparser(raw.replace(/;/g, ','), { flatten: true })
        .map((item) => ({ name: (item.name || '').trim(), address: (item.address || '').trim() }))
        .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.address));
};

const parseAttachments = (value: unknown): OutgoingAttachment[] => {
    if (!Array.isArray(value)) return [];
    const files = value
        .filter((item) => item && typeof item.filename === 'string' && typeof item.content === 'string')
        .map((item) => ({
            filename: String(item.filename).slice(0, 200),
            contentType: typeof item.contentType === 'string' ? item.contentType : undefined,
            content: Buffer.from(item.content, 'base64'),
        }));
    const total = files.reduce((sum, file) => sum + file.content.length, 0);
    if (total > MAX_ATTACHMENTS_BYTES) throw new Error('Os anexos passam dos 15 MB.');
    return files;
};

// GET ?view=folders | messages&folder&page&q&unseen | message&folder&uid
//     | attachment&folder&uid&index | groups | group&id | contacts&q
export async function GET(req: Request) {
    const { authorized, error: authError } = await verifyAdminCached(req);
    if (!authorized) return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const view = url.searchParams.get('view') || 'folders';
    const folder = url.searchParams.get('folder') || 'INBOX';
    const uid = Number(url.searchParams.get('uid'));

    try {
        switch (view) {
            case 'folders':
                return NextResponse.json({ address: mailboxAddress(), folders: await listFolders() });
            case 'messages':
                return NextResponse.json(await listMessages(folder, {
                    page: Number(url.searchParams.get('page')) || 1,
                    query: url.searchParams.get('q') || undefined,
                    unseenOnly: url.searchParams.get('unseen') === '1',
                }));
            case 'message':
                if (!uid) return NextResponse.json({ error: 'Falta o uid.' }, { status: 400 });
                return NextResponse.json(await getMessage(folder, uid));
            case 'attachment': {
                const att = await getAttachment(folder, uid, Number(url.searchParams.get('index')));
                return new NextResponse(new Uint8Array(att.content), {
                    headers: {
                        'Content-Type': att.contentType || 'application/octet-stream',
                        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(att.filename)}`,
                        'Cache-Control': 'private, no-store',
                    },
                });
            }
            case 'groups':
                return NextResponse.json({ groups: await listGroups() });
            case 'group':
                return NextResponse.json({ recipients: await resolveGroup(url.searchParams.get('id') || '') });
            case 'contacts':
                return NextResponse.json({ contacts: await searchContacts(url.searchParams.get('q') || '') });
            default:
                return NextResponse.json({ error: 'Vista desconhecida.' }, { status: 400 });
        }
    } catch (error) {
        return fail(error);
    }
}

// POST { action: 'send' | 'group' | 'update', ... }
export async function POST(req: Request) {
    const { authorized, user, error: authError } = await verifyAdminCached(req);
    if (!authorized) return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });

    try {
        if (body.action === 'update') {
            const action = body.op as MailAction;
            const uids = (Array.isArray(body.uids) ? body.uids : []).map(Number).filter(Number.isInteger);
            if (!ACTIONS.includes(action)) return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
            await updateMessages(String(body.folder || 'INBOX'), uids, action, body.destination ? String(body.destination) : undefined);
            return NextResponse.json({ ok: true });
        }

        const subject = String(body.subject || '').trim();
        const html = String(body.html || '');
        const text = typeof body.text === 'string' ? body.text : undefined;
        if (!subject) return NextResponse.json({ error: 'Falta o assunto.' }, { status: 400 });
        if (!text?.trim() && !html.replace(/<[^>]*>/g, '').trim()) {
            return NextResponse.json({ error: 'A mensagem está vazia.' }, { status: 400 });
        }
        const attachments = parseAttachments(body.attachments);

        if (body.action === 'send') {
            const to = emailList(body.to);
            if (!to.length) return NextResponse.json({ error: 'Indique pelo menos um destinatário válido.' }, { status: 400 });
            const answered = body.answered && Number(body.answered.uid)
                ? { folder: String(body.answered.folder || 'INBOX'), uid: Number(body.answered.uid) }
                : null;
            const result = await sendMail({
                to,
                cc: emailList(body.cc),
                bcc: emailList(body.bcc),
                subject,
                html,
                text,
                inReplyTo: typeof body.inReplyTo === 'string' ? body.inReplyTo : null,
                references: Array.isArray(body.references) ? body.references.map(String) : [],
                attachments,
                answered,
            });
            await logAdminAudit({ adminEmail: user?.email, action: 'mailbox_send', details: { to: to.map((a) => a.address), subject } });
            return NextResponse.json({ ok: true, ...result });
        }

        if (body.action === 'group') {
            const groupId = String(body.groupId || '');
            const result = await sendToGroup({ groupId, subject, html, text, attachments });
            await logAdminAudit({ adminEmail: user?.email, action: 'mailbox_group_send', details: { groupId, subject, ...result } });
            return NextResponse.json({ ok: true, ...result });
        }

        return NextResponse.json({ error: 'Ação desconhecida.' }, { status: 400 });
    } catch (error) {
        return fail(error);
    }
}
