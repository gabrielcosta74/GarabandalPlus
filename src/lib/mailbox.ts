import { ImapFlow, type ListResponse, type MessageAddressObject } from 'imapflow';
import { simpleParser, type AddressObject } from 'mailparser';
import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Caixa de correio geral (geral@…) vista do admin.
 *
 * O email continua alojado onde está (hoje na Webnode); o admin é só um
 * cliente IMAP/SMTP. Trocar de fornecedor = trocar os envs.
 *
 * A ligação IMAP fica aberta entre pedidos (o login custa ~600 ms, o resto
 * dos comandos 50–200 ms) e fecha sozinha ao fim de uns minutos parada. O
 * Railway é um processo contínuo, por isso o estado em memória aguenta.
 */

const config = () => {
    const user = process.env.MAILBOX_USER?.trim();
    const password = process.env.MAILBOX_PASSWORD;
    if (!user || !password) return null;
    return {
        user,
        password,
        fromName: process.env.MAILBOX_FROM_NAME?.trim() || 'Apostolado de Garabandal',
        imapHost: process.env.MAILBOX_IMAP_HOST?.trim() || 'imap.mail.webnode.com',
        imapPort: Number(process.env.MAILBOX_IMAP_PORT || 993),
        smtpHost: process.env.MAILBOX_SMTP_HOST?.trim() || 'smtp.mail.webnode.com',
        smtpPort: Number(process.env.MAILBOX_SMTP_PORT || 465),
    };
};

export class MailboxNotConfiguredError extends Error {
    constructor() {
        super('A caixa de email não está configurada (MAILBOX_USER / MAILBOX_PASSWORD).');
    }
}

const requireConfig = () => {
    const cfg = config();
    if (!cfg) throw new MailboxNotConfiguredError();
    return cfg;
};

export const mailboxAddress = () => config()?.user ?? null;
export const mailboxFrom = () => {
    const cfg = requireConfig();
    return { name: cfg.fromName, address: cfg.user };
};

const IDLE_CLOSE_MS = 5 * 60_000;

type Pool = {
    key: string | null;
    client: ImapFlow | null;
    connecting: Promise<ImapFlow> | null;
    idleTimer: ReturnType<typeof setTimeout> | null;
};

// Em globalThis para sobreviver ao HMR do next dev sem abrir ligações a mais.
const globalPool = globalThis as typeof globalThis & { __mailboxPool?: Pool };
const pool: Pool = (globalPool.__mailboxPool ??= { key: null, client: null, connecting: null, idleTimer: null });

const dropClient = (client: ImapFlow | null) => {
    if (!client) return;
    if (pool.client === client) pool.client = null;
    client.logout().catch(() => client.close());
};

async function getClient(): Promise<ImapFlow> {
    const cfg = requireConfig();
    const key = `${cfg.user}@${cfg.imapHost}:${cfg.imapPort}:${cfg.password.length}`;
    if (pool.key !== key) {
        // Mudaram as credenciais: a ligação antiga já não serve.
        dropClient(pool.client);
        pool.key = key;
    }
    if (pool.client?.usable) return pool.client;
    if (!pool.connecting) {
        pool.connecting = (async () => {
            const client = new ImapFlow({
                host: cfg.imapHost,
                port: cfg.imapPort,
                secure: cfg.imapPort === 993,
                auth: { user: cfg.user, pass: cfg.password },
                logger: false,
            });
            client.on('error', (error) => console.warn('[mailbox] ligação IMAP', error?.message));
            client.on('close', () => { if (pool.client === client) pool.client = null; });
            await client.connect();
            pool.client = client;
            return client;
        })().finally(() => { pool.connecting = null; });
    }
    return pool.connecting;
}

const scheduleIdleClose = () => {
    if (pool.idleTimer) clearTimeout(pool.idleTimer);
    pool.idleTimer = setTimeout(() => dropClient(pool.client), IDLE_CLOSE_MS);
    pool.idleTimer.unref?.();
};

async function withImap<T>(fn: (client: ImapFlow) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
        const client = await getClient();
        try {
            return await fn(client);
        } catch (error) {
            // Ligação caiu a meio (timeout do servidor, rede): tentar uma vez de novo.
            if (attempt === 0 && !client.usable) {
                dropClient(client);
                continue;
            }
            throw error;
        } finally {
            scheduleIdleClose();
        }
    }
}

/* ------------------------- Cache das mensagens abertas ------------------------- */

// Fonte das últimas mensagens abertas: reabrir e descarregar anexos não volta
// ao servidor. A chave leva o UIDVALIDITY, que muda se a pasta for recriada.
// Pequena: o servidor corre com --max-old-space-size=384.
const SOURCE_CACHE_BYTES = 12 * 1024 * 1024;
const SOURCE_CACHE_MAX_ITEM = 3 * 1024 * 1024;
const globalCache = globalThis as typeof globalThis & { __mailboxSources?: Map<string, Buffer> };
const sources: Map<string, Buffer> = (globalCache.__mailboxSources ??= new Map());

const remember = (key: string, source: Buffer) => {
    sources.delete(key);
    // Mensagens com anexos grandes não ficam em memória.
    if (source.length > SOURCE_CACHE_MAX_ITEM) return;
    sources.set(key, source);
    let total = 0;
    for (const buf of sources.values()) total += buf.length;
    for (const [oldKey, buf] of sources) {
        if (total <= SOURCE_CACHE_BYTES || oldKey === key) break;
        sources.delete(oldKey);
        total -= buf.length;
    }
};

/* --------------------------------- Pastas --------------------------------- */

export type MailFolder = {
    path: string;
    name: string;
    specialUse: string | null;
    total: number;
    unseen: number;
};

const FOLDER_ORDER = ['\\Inbox', '\\Drafts', '\\Sent', '\\Junk', '\\Archive', '\\Trash'];
const FOLDER_LABELS: Record<string, string> = {
    '\\Inbox': 'Caixa de entrada',
    '\\Drafts': 'Rascunhos',
    '\\Sent': 'Enviados',
    '\\Junk': 'Spam',
    '\\Archive': 'Arquivo',
    '\\Trash': 'Lixo',
};

const folderRank = (folder: MailFolder) => {
    const index = folder.specialUse ? FOLDER_ORDER.indexOf(folder.specialUse) : -1;
    return index === -1 ? FOLDER_ORDER.length : index;
};

const toFolder = (entry: ListResponse): MailFolder => ({
    path: entry.path,
    name: (entry.specialUse && FOLDER_LABELS[entry.specialUse]) || entry.name,
    specialUse: entry.specialUse || null,
    total: entry.status?.messages ?? 0,
    unseen: entry.status?.unseen ?? 0,
});

export async function listFolders(): Promise<MailFolder[]> {
    return withImap(async (client) => {
        const entries = await client.list({ statusQuery: { messages: true, unseen: true } });
        return entries
            .filter((entry) => !entry.flags.has('\\Noselect'))
            .map(toFolder)
            .sort((a, b) => folderRank(a) - folderRank(b) || a.name.localeCompare(b.name, 'pt'));
    });
}

const findSpecialFolder = async (client: ImapFlow, specialUse: string) => {
    const entries = await client.list();
    return entries.find((entry) => entry.specialUse === specialUse)?.path ?? null;
};

/* -------------------------------- Mensagens -------------------------------- */

export type MailAddress = { name: string; address: string };

export type MailSummary = {
    uid: number;
    subject: string;
    from: MailAddress[];
    to: MailAddress[];
    date: string | null;
    seen: boolean;
    flagged: boolean;
    answered: boolean;
    hasAttachments: boolean;
    size: number;
};

const toAddresses = (list?: MessageAddressObject[]): MailAddress[] =>
    (list || [])
        .filter((item) => item.address)
        .map((item) => ({ name: item.name || '', address: item.address || '' }));

const parsedAddresses = (value?: AddressObject | AddressObject[]): MailAddress[] =>
    (Array.isArray(value) ? value : value ? [value] : [])
        .flatMap((group) => group.value)
        .filter((item) => item.address)
        .map((item) => ({ name: item.name || '', address: item.address || '' }));

type BodyNode = { disposition?: string; type?: string; childNodes?: BodyNode[] };
const hasAttachment = (node?: BodyNode): boolean =>
    !!node && (node.disposition === 'attachment' || (node.childNodes || []).some(hasAttachment));

export const PAGE_SIZE = 40;

export async function listMessages(folder: string, options: { page?: number; query?: string; unseenOnly?: boolean } = {}) {
    const page = Math.max(1, options.page || 1);
    const query = options.query?.trim();

    return withImap(async (client) => {
        const lock = await client.getMailboxLock(folder);
        try {
            const exists = client.mailbox ? client.mailbox.exists : 0;
            let range: string | number[] = [];
            let total = 0;
            let byUid = true;

            if (!query && !options.unseenOnly) {
                // Sem filtros a página sai das posições (as mais recentes no
                // fim): evita um SEARCH a milhares de mensagens a cada página.
                const end = exists - (page - 1) * PAGE_SIZE;
                total = exists;
                byUid = false;
                if (end >= 1) range = `${Math.max(1, end - PAGE_SIZE + 1)}:${end}`;
            } else {
                const criteria = {
                    ...(query ? { or: [{ from: query }, { to: query }, { subject: query }] } : { all: true }),
                    ...(options.unseenOnly ? { seen: false } : {}),
                };
                const found = await client.search(criteria, { uid: true });
                const uids = (found || []).sort((a, b) => b - a);
                total = uids.length;
                range = uids.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
            }

            const messages: MailSummary[] = [];
            if (range.length) {
                for await (const msg of client.fetch(range, { uid: true, envelope: true, flags: true, bodyStructure: true, size: true, internalDate: true }, { uid: byUid })) {
                    const flags = msg.flags || new Set<string>();
                    const date = msg.envelope?.date || msg.internalDate;
                    messages.push({
                        uid: msg.uid,
                        subject: msg.envelope?.subject || '(sem assunto)',
                        from: toAddresses(msg.envelope?.from),
                        to: toAddresses(msg.envelope?.to),
                        date: date ? new Date(date).toISOString() : null,
                        seen: flags.has('\\Seen'),
                        flagged: flags.has('\\Flagged'),
                        answered: flags.has('\\Answered'),
                        hasAttachments: hasAttachment(msg.bodyStructure as BodyNode | undefined),
                        size: msg.size || 0,
                    });
                }
            }
            messages.sort((a, b) => b.uid - a.uid);
            return { messages, total, page, pageSize: PAGE_SIZE };
        } finally {
            lock.release();
        }
    });
}

export type MailAttachment = { index: number; filename: string; contentType: string; size: number };

export type MailMessage = MailSummary & {
    cc: MailAddress[];
    replyTo: MailAddress[];
    messageId: string | null;
    references: string[];
    html: string;
    text: string;
    attachments: MailAttachment[];
};

const sanitizeHtml = (html: string) =>
    DOMPurify.sanitize(html, {
        WHOLE_DOCUMENT: true,
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'base', 'meta'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    });

const escapeHtml = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Fonte da mensagem (da cache ou do servidor) e as flags atuais. Com
 * markSeen, marca-a como lida no mesmo passo.
 */
const loadSource = async (folder: string, uid: number, markSeen: boolean) =>
    withImap(async (client) => {
        const lock = await client.getMailboxLock(folder);
        try {
            const key = `${folder}:${client.mailbox ? client.mailbox.uidValidity : ''}:${uid}`;
            const cached = sources.get(key);
            const msg = await client.fetchOne(String(uid), { uid: true, flags: true, size: true, ...(cached ? {} : { source: true }) }, { uid: true });
            if (!msg || (!cached && !msg.source)) throw new Error('Mensagem não encontrada.');
            const source = cached || msg.source!;
            remember(key, source);
            const flags = new Set(msg.flags || []);
            if (markSeen && !flags.has('\\Seen')) {
                await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
                flags.add('\\Seen');
            }
            return { source, flags, size: msg.size || source.length };
        } finally {
            lock.release();
        }
    });

/** Abre uma mensagem e marca-a como lida. */
export async function getMessage(folder: string, uid: number): Promise<MailMessage> {
    const { source, flags, size } = await loadSource(folder, uid, true);
    // Fora do lock: enquanto se interpreta esta, a ligação já serve outros pedidos.
    const parsed = await simpleParser(source);

    const visible = parsed.attachments.filter((att) => att.contentDisposition !== 'inline' || !att.cid);
    const html = parsed.html
        ? sanitizeHtml(parsed.html)
        : `<pre style="white-space:pre-wrap;font:14px/1.5 system-ui,sans-serif;margin:0">${escapeHtml(parsed.text || '')}</pre>`;

    return {
        uid,
        subject: parsed.subject || '(sem assunto)',
        from: parsedAddresses(parsed.from),
        to: parsedAddresses(parsed.to),
        cc: parsedAddresses(parsed.cc),
        replyTo: parsedAddresses(parsed.replyTo),
        date: parsed.date ? parsed.date.toISOString() : null,
        seen: true,
        flagged: flags.has('\\Flagged'),
        answered: flags.has('\\Answered'),
        hasAttachments: visible.length > 0,
        size,
        messageId: parsed.messageId || null,
        references: Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [],
        html,
        text: parsed.text || '',
        attachments: parsed.attachments
            .map((att, index) => ({ att, index }))
            .filter(({ att }) => visible.includes(att))
            .map(({ att, index }) => ({
                index,
                filename: att.filename || `anexo-${index + 1}`,
                contentType: att.contentType,
                size: att.size,
            })),
    };
}

export async function getAttachment(folder: string, uid: number, index: number) {
    const { source } = await loadSource(folder, uid, false);
    const parsed = await simpleParser(source);
    const att = parsed.attachments[index];
    if (!att) throw new Error('Anexo não encontrado.');
    return { filename: att.filename || `anexo-${index + 1}`, contentType: att.contentType, content: att.content };
}

export type MailAction = 'seen' | 'unseen' | 'flag' | 'unflag' | 'trash' | 'move';

export async function updateMessages(folder: string, uids: number[], action: MailAction, destination?: string) {
    if (!uids.length) return;
    return withImap(async (client) => {
        const lock = await client.getMailboxLock(folder);
        try {
            switch (action) {
                case 'seen': await client.messageFlagsAdd(uids, ['\\Seen'], { uid: true }); break;
                case 'unseen': await client.messageFlagsRemove(uids, ['\\Seen'], { uid: true }); break;
                case 'flag': await client.messageFlagsAdd(uids, ['\\Flagged'], { uid: true }); break;
                case 'unflag': await client.messageFlagsRemove(uids, ['\\Flagged'], { uid: true }); break;
                case 'move':
                    if (!destination) throw new Error('Falta a pasta de destino.');
                    await client.messageMove(uids, destination, { uid: true });
                    break;
                case 'trash': {
                    // Já no lixo: apagar de vez. Noutra pasta: mover para o lixo.
                    const trash = await findSpecialFolder(client, '\\Trash');
                    if (!trash || trash === folder) await client.messageDelete(uids, { uid: true });
                    else await client.messageMove(uids, trash, { uid: true });
                    break;
                }
            }
        } finally {
            lock.release();
        }
    });
}

/* --------------------------------- Enviar --------------------------------- */

export type OutgoingAttachment = { filename: string; contentType?: string; content: Buffer };

type Recipient = string | MailAddress;

export type OutgoingMail = {
    to: Recipient[];
    cc?: Recipient[];
    bcc?: Recipient[];
    subject: string;
    html: string;
    text?: string;
    inReplyTo?: string | null;
    references?: string[];
    attachments?: OutgoingAttachment[];
    /** Pasta + UID da mensagem respondida, para a marcar como respondida. */
    answered?: { folder: string; uid: number } | null;
};

/**
 * A mensagem que sai nunca leva o cabeçalho Bcc; a cópia em Enviados leva
 * (keepBcc), para a equipa saber a quem foi. As duas partilham o Message-ID.
 */
const buildRaw = (mail: OutgoingMail, options: { keepBcc: boolean; messageId: string }) => {
    const from = mailboxFrom();
    const composer = new MailComposer({
        messageId: options.messageId,
        from,
        to: mail.to,
        cc: mail.cc,
        bcc: mail.bcc,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        inReplyTo: mail.inReplyTo || undefined,
        references: mail.references?.length ? mail.references : undefined,
        attachments: mail.attachments?.map((att) => ({ filename: att.filename, contentType: att.contentType, content: att.content })),
    });
    const node = composer.compile();
    node.keepBcc = options.keepBcc;
    return node.build();
};

const newMessageId = () => {
    const domain = mailboxFrom().address.split('@')[1] || 'localhost';
    return `<${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 12)}@${domain}>`;
};

/**
 * Envia pelo SMTP da própria caixa e guarda uma cópia em Enviados — o SMTP
 * da Webnode não o faz sozinho, e sem isto as respostas não apareciam lá.
 */
export async function sendMail(mail: OutgoingMail) {
    const cfg = requireConfig();
    const messageId = newMessageId();
    const raw = await buildRaw(mail, { keepBcc: false, messageId });

    const transport = nodemailer.createTransport({
        host: cfg.smtpHost,
        port: cfg.smtpPort,
        secure: cfg.smtpPort === 465,
        auth: { user: cfg.user, pass: cfg.password },
    });
    const recipients = [...mail.to, ...(mail.cc || []), ...(mail.bcc || [])]
        .map((r) => (typeof r === 'string' ? r : r.address));
    const info = await transport.sendMail({ envelope: { from: cfg.user, to: recipients }, raw });

    const copy = await buildRaw(mail, { keepBcc: true, messageId });
    await saveCopy(copy, mail.answered).catch((error) => {
        console.warn('[mailbox] enviado, mas não foi possível guardar em Enviados', error);
    });
    return { messageId: info.messageId };
}

/** Guarda uma mensagem já enviada (por SMTP ou pelo Resend) em Enviados. */
export async function saveCopy(raw: Buffer, answered?: { folder: string; uid: number } | null) {
    return withImap(async (client) => {
        const sent = await findSpecialFolder(client, '\\Sent');
        if (sent) await client.append(sent, raw, ['\\Seen']);
        if (answered) {
            const lock = await client.getMailboxLock(answered.folder);
            try {
                await client.messageFlagsAdd(String(answered.uid), ['\\Answered'], { uid: true });
            } finally {
                lock.release();
            }
        }
    });
}

export const buildSentCopy = (mail: Omit<OutgoingMail, 'answered'>) => buildRaw(mail, { keepBcc: true, messageId: newMessageId() });
