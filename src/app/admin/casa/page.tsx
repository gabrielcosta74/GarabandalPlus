"use client";

import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import { getBrowserAccessToken } from '../../../lib/supabase-browser';
import { Toaster, toast } from 'sonner';
import {
    CalendarRange, Check, Copy, HandCoins, Hash, House, KeyRound, Loader2, Lock, Mail, MessageSquare,
    Phone, ScrollText, Settings, Users, X, type LucideIcon,
} from 'lucide-react';

type Status = 'pending' | 'confirmed' | 'declined' | 'cancelled';

type Booking = {
    id: string;
    membro_id: string;
    check_in: string;
    check_out: string;
    guests: number;
    contact_name: string;
    contact_phone: string;
    contact_email: string;
    notes: string | null;
    status: Status;
    team_message: string | null;
    wants_to_donate: boolean;
    decided_at: string | null;
    decided_by: string | null;
    cancelled_at: string | null;
    created_at: string;
    house_booking_guests: { position: number; full_name: string }[];
    membros: { nome: string | null; numero_socio: number | string | null } | null;
};

type Code = {
    id: string;
    /** Por extenso; os primeiros códigos só guardaram o hash. */
    code: string | null;
    code_hint: string;
    membro_id: string;
    valid_until: string | null;
    waive_seniority: boolean;
    note: string | null;
    issued_by: string | null;
    revoked_at: string | null;
    created_at: string;
    membros: { nome: string | null; numero_socio: number | string | null } | null;
};

type Blocked = { id: string; starts_on: string; ends_on: string; reason: string | null };

type HouseSettings = {
    enabled: boolean;
    max_guests: number;
    max_nights: number;
    min_member_years: number;
    booking_horizon_days: number;
    rules_content_id: string | null;
    rules_version: number;
    rules_pt: string;
    rules_en: string;
};

type Member = { id: string; nome: string | null; email: string | null; numero_socio: number | string | null };
type Doc = { id: string; title: string };

type Data = {
    settings: HouseSettings | null;
    bookings: Booking[];
    codes: Code[];
    blocked: Blocked[];
    documents: Doc[];
    members: Member[];
};

const STATUS: Record<Status, { label: string; color: string; bg: string }> = {
    pending: { label: 'À espera', color: '#1d4ed8', bg: '#dbeafe' },
    confirmed: { label: 'Confirmada', color: '#15803d', bg: '#dcfce7' },
    declined: { label: 'Recusada', color: '#b91c1c', bg: '#fee2e2' },
    cancelled: { label: 'Cancelada pelo membro', color: '#64748b', bg: '#f1f5f9' },
};

const TABS = [
    { key: 'pedidos', label: 'Pedidos', icon: CalendarRange },
    { key: 'codigos', label: 'Códigos de formação', icon: KeyRound },
    { key: 'datas', label: 'Datas fechadas', icon: Lock },
    { key: 'regras', label: 'Regras da casa', icon: ScrollText },
    { key: 'definicoes', label: 'Definições', icon: Settings },
] as const;
type Tab = (typeof TABS)[number]['key'];

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (day: string, days: number) => {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};
const nights = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const formatDay = (day: string) => new Intl.DateTimeFormat('pt-PT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${day}T00:00:00Z`));
const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
const memberLabel = (m: { nome: string | null; numero_socio: number | string | null } | null) =>
    `${m?.nome || 'Membro'}${m?.numero_socio != null ? ` · Sócio ${m.numero_socio}` : ''}`;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Falha no pedido.');

async function call(method: 'GET' | 'PATCH', body?: unknown) {
    const token = await getBrowserAccessToken();
    const res = await fetch('/api/admin/house', {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Falha no pedido.');
    return data;
}

/**
 * Casa do Apostolado: a equipa confirma os pedidos feitos na app, emite os
 * códigos de formação, fecha datas e escolhe o documento das regras.
 */
export default function AdminCasaPage() {
    const [data, setData] = useState<Data | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('pedidos');

    const load = async () => {
        try {
            setData(await call('GET'));
        } catch (e) {
            toast.error(errorMessage(e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const pending = data?.bookings.filter((b) => b.status === 'pending').length ?? 0;

    return (
        <AdminLayout title="Casa do Apostolado" isLoading={loading}>
            <Toaster position="top-center" richColors />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                {TABS.map(({ key, label, icon: Icon }) => {
                    const active = tab === key;
                    return (
                        <button key={key} type="button" onClick={() => setTab(key)} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 999,
                            fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                            border: `1.5px solid ${active ? '#0f4c81' : '#e2e8f0'}`,
                            color: active ? '#0f4c81' : '#475569', background: active ? 'rgba(15,76,129,0.06)' : '#fff',
                        }}>
                            <Icon size={15} /> {label}
                            {key === 'pedidos' && pending > 0 && (
                                <span style={{ fontSize: 11.5, padding: '1px 7px', borderRadius: 999, background: '#1d4ed8', color: '#fff' }}>{pending}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {data && tab === 'pedidos' && <BookingsTab bookings={data.bookings} reload={load} />}
            {data && tab === 'codigos' && <CodesTab codes={data.codes} members={data.members} reload={load} />}
            {data && tab === 'datas' && <BlockedTab blocked={data.blocked} reload={load} />}
            {data && tab === 'regras' && data.settings && <RulesTab documents={data.documents} reload={load} settings={data.settings} />}
            {data && tab === 'definicoes' && data.settings && <SettingsTab reload={load} settings={data.settings} />}

            <style>{`.hs-spin{animation:hs-spin .8s linear infinite}@keyframes hs-spin{to{transform:rotate(360deg)}}`}</style>
        </AdminLayout>
    );
}

/* ---------------------------------- Pedidos --------------------------------- */

function BookingsTab({ bookings, reload }: { bookings: Booking[]; reload: () => Promise<void> }) {
    const now = today();
    const groups = useMemo(() => [
        { title: 'À espera de resposta', items: bookings.filter((b) => b.status === 'pending') },
        { title: 'Próximas estadias', items: bookings.filter((b) => b.status === 'confirmed' && b.check_out > now) },
        {
            title: 'Anteriores, recusadas e canceladas',
            items: bookings
                .filter((b) => !(b.status === 'pending') && !(b.status === 'confirmed' && b.check_out > now))
                .sort((a, b) => b.check_in.localeCompare(a.check_in)),
        },
    ], [bookings, now]);

    if (bookings.length === 0) return <Empty>Ainda não há pedidos para a casa.</Empty>;

    return (
        <div style={{ display: 'grid', gap: 28 }}>
            {groups.filter((g) => g.items.length).map((group) => (
                <section key={group.title} style={{ display: 'grid', gap: 14 }}>
                    <h2 style={sectionTitle}>{group.title} <span style={{ color: '#94a3b8', fontWeight: 600 }}>({group.items.length})</span></h2>
                    {group.items.map((booking) => <BookingCard booking={booking} key={booking.id} reload={reload} />)}
                </section>
            ))}
        </div>
    );
}

function BookingCard({ booking, reload }: { booking: Booking; reload: () => Promise<void> }) {
    const [message, setMessage] = useState(booking.team_message || '');
    const [busy, setBusy] = useState(false);
    const status = STATUS[booking.status];
    const open = booking.status === 'pending' || booking.status === 'confirmed';
    const companions = [...(booking.house_booking_guests || [])].sort((a, b) => a.position - b.position);

    const act = async (body: Record<string, unknown>, success: string) => {
        setBusy(true);
        try {
            const result = await call('PATCH', { id: booking.id, teamMessage: message, ...body });
            toast.success(result?.pushed ? `${success} O membro foi avisado na app.` : success);
            await reload();
        } catch (e) {
            toast.error(errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    const decline = () => {
        if (!window.confirm('Recusar este pedido? As datas ficam livres para outros membros.')) return;
        act({ action: 'decide', status: 'declined' }, 'Pedido recusado.');
    };

    return (
        <div style={card}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
                        {formatDay(booking.check_in)} → {formatDay(booking.check_out)}
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                        {nights(booking.check_in, booking.check_out)} noites · {booking.guests} {booking.guests === 1 ? 'pessoa' : 'pessoas'} · pedido a {formatDate(booking.created_at)}
                    </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 999, color: status.color, background: status.bg }}>{status.label}</span>
            </div>

            <div style={{ padding: 20, display: 'grid', gap: 12 }}>
                <Line icon={Hash} value={memberLabel(booking.membros)} />
                <Line icon={Users} value={[`${booking.contact_name} (responsável)`, ...companions.map((g) => g.full_name)].join('\n')} />
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                    <Line icon={Phone} value={booking.contact_phone} />
                    <Line icon={Mail} value={booking.contact_email} />
                </div>
                {booking.notes && <Line icon={MessageSquare} value={booking.notes} />}
                {booking.wants_to_donate && <Line icon={HandCoins} value="Quis fazer um donativo para a casa" />}
                {booking.decided_by && (
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Decidido por {booking.decided_by}{booking.decided_at ? ` a ${formatDate(booking.decided_at)}` : ''}</div>
                )}
            </div>

            {open ? (
                <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'grid', gap: 10 }}>
                    <label style={label}>Mensagem para o membro (aparece na app)</label>
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={2}
                        maxLength={1000}
                        placeholder="Ex.: a chave fica com a D. Maria, junto à igreja."
                        style={{ ...input, resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        {booking.status === 'pending' && (
                            <button type="button" disabled={busy} onClick={() => act({ action: 'decide', status: 'confirmed' }, 'Pedido confirmado.')} style={button('#15803d')}>
                                <Check size={15} /> Confirmar
                            </button>
                        )}
                        {booking.status === 'confirmed' && (
                            <button type="button" disabled={busy} onClick={() => act({ action: 'message' }, 'Mensagem guardada.')} style={button('#0f4c81')}>
                                Guardar mensagem
                            </button>
                        )}
                        <button type="button" disabled={busy} onClick={decline} style={outline('#b91c1c')}>
                            <X size={15} /> {booking.status === 'confirmed' ? 'Anular e recusar' : 'Recusar'}
                        </button>
                        {busy && <Loader2 size={16} className="hs-spin" color="#94a3b8" />}
                    </div>
                </div>
            ) : booking.team_message ? (
                <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', fontSize: 13.5, color: '#475569' }}>
                    Mensagem enviada: {booking.team_message}
                </div>
            ) : null}
        </div>
    );
}

/* ---------------------------------- Códigos --------------------------------- */

function CodesTab({ codes, members, reload }: { codes: Code[]; members: Member[]; reload: () => Promise<void> }) {
    const [search, setSearch] = useState('');
    const [membroId, setMembroId] = useState('');
    const [validUntil, setValidUntil] = useState('');
    const [waive, setWaive] = useState(false);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [issued, setIssued] = useState<{ code: string; member: string } | null>(null);

    const matches = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return [];
        return members
            .filter((m) => [m.nome, m.email, m.numero_socio].some((v) => String(v ?? '').toLowerCase().includes(needle)))
            .slice(0, 8);
    }, [members, search]);
    const chosen = members.find((m) => m.id === membroId) || null;

    const issue = async () => {
        if (!chosen) { toast.error('Escolha o membro.'); return; }
        setBusy(true);
        try {
            const result = await call('PATCH', { action: 'issue_code', membroId, validUntil: validUntil || null, waiveSeniority: waive, note });
            setIssued({ code: result.code, member: memberLabel(chosen) });
            setMembroId(''); setSearch(''); setValidUntil(''); setWaive(false); setNote('');
            await reload();
        } catch (e) {
            toast.error(errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    const revoke = async (code: Code) => {
        if (!window.confirm(`Anular o código de ${code.membros?.nome || 'este membro'}?`)) return;
        try {
            await call('PATCH', { action: 'revoke_code', id: code.id });
            toast.success('Código anulado.');
            await reload();
        } catch (e) {
            toast.error(errorMessage(e));
        }
    };

    const now = today();

    return (
        <div style={{ display: 'grid', gap: 24 }}>
            {issued && (
                <div style={{ ...card, padding: 22, borderColor: '#86efac', background: '#f0fdf4', display: 'grid', gap: 10 }}>
                    <div style={{ fontWeight: 700, color: '#15803d' }}>Código emitido para {issued.member}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 30, fontWeight: 800, letterSpacing: 4, color: '#0f172a' }}>{issued.code}</span>
                        <button type="button" onClick={() => { void navigator.clipboard.writeText(issued.code); toast.success('Copiado.'); }} style={outline('#15803d')}>
                            <Copy size={15} /> Copiar
                        </button>
                    </div>
                    <div style={{ fontSize: 13, color: '#475569' }}>
                        Envie-o ao membro. Fica também na lista de códigos emitidos, para o poder reenviar.
                    </div>
                    <div><button type="button" onClick={() => setIssued(null)} style={outline('#64748b')}>Fechar</button></div>
                </div>
            )}

            <div style={{ ...card, padding: 20, display: 'grid', gap: 14 }}>
                <h2 style={sectionTitle}>Emitir código depois da formação</h2>
                <div style={{ display: 'grid', gap: 6 }}>
                    <label style={label}>Membro</label>
                    {chosen ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>{memberLabel(chosen)}</span>
                            <button type="button" onClick={() => setMembroId('')} style={outline('#64748b')}>Trocar</button>
                        </div>
                    ) : (
                        <>
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, email ou nº de sócio" style={input} />
                            {matches.length > 0 && (
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                                    {matches.map((m) => (
                                        <button key={m.id} type="button" onClick={() => setMembroId(m.id)} style={{
                                            display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: '#fff',
                                            border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 14,
                                        }}>
                                            <strong>{m.nome || 'Sem nome'}</strong>
                                            <span style={{ color: '#64748b' }}>{m.numero_socio != null ? ` · Sócio ${m.numero_socio}` : ''}{m.email ? ` · ${m.email}` : ''}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'grid', gap: 6 }}>
                        <label style={label}>Válido até (opcional)</label>
                        <input type="date" value={validUntil} min={now} onChange={(e) => setValidUntil(e.target.value)} style={input} />
                    </div>
                    <div style={{ display: 'grid', gap: 6, flex: 1, minWidth: 220 }}>
                        <label style={label}>Nota interna (opcional)</label>
                        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Ex.: formação de outubro" style={input} />
                    </div>
                </div>
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: '#334155', cursor: 'pointer' }}>
                    <input type="checkbox" checked={waive} onChange={(e) => setWaive(e.target.checked)} style={{ marginTop: 3 }} />
                    <span>
                        <strong>Dispensar a regra dos anos de quota</strong><br />
                        <span style={{ color: '#64748b' }}>Para membros que já cumprem mas cujos pagamentos antigos não estão registados.</span>
                    </span>
                </label>
                <div>
                    <button type="button" disabled={busy || !chosen} onClick={issue} style={{ ...button('#0f4c81'), opacity: busy || !chosen ? 0.5 : 1 }}>
                        {busy ? <Loader2 size={15} className="hs-spin" /> : <KeyRound size={15} />} Emitir código
                    </button>
                </div>
            </div>

            <section style={{ display: 'grid', gap: 10 }}>
                <h2 style={sectionTitle}>Códigos emitidos ({codes.length})</h2>
                {codes.length === 0 ? <Empty>Ainda não foi emitido nenhum código.</Empty> : (
                    <div style={card}>
                        {codes.map((code, index) => {
                            const state = code.revoked_at ? 'Anulado' : code.valid_until && code.valid_until < now ? 'Expirado' : 'Ativo';
                            const active = state === 'Ativo';
                            return (
                                <div key={code.id} style={{ padding: '14px 20px', borderTop: index ? '1px solid #f1f5f9' : 'none', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: 220 }}>
                                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{memberLabel(code.membros)}</div>
                                        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>
                                            emitido a {formatDate(code.created_at)}
                                            {code.valid_until ? ` · válido até ${formatDay(code.valid_until)}` : ''}
                                            {code.waive_seniority ? ' · antiguidade dispensada' : ''}
                                            {code.note ? ` · ${code.note}` : ''}
                                        </div>
                                    </div>
                                    <span style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 17, fontWeight: 800, letterSpacing: 2, color: active ? '#0f172a' : '#94a3b8' }}>
                                        {code.code || `••••-${code.code_hint}`}
                                    </span>
                                    {active && code.code && (
                                        <button type="button" onClick={() => { void navigator.clipboard.writeText(code.code as string); toast.success('Copiado.'); }} style={outline('#0f4c81')}>
                                            <Copy size={14} /> Copiar
                                        </button>
                                    )}
                                    <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 999, color: active ? '#15803d' : '#64748b', background: active ? '#dcfce7' : '#f1f5f9' }}>{state}</span>
                                    {active && <button type="button" onClick={() => revoke(code)} style={outline('#b91c1c')}>Anular</button>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}

/* ------------------------------- Datas fechadas ------------------------------ */

function BlockedTab({ blocked, reload }: { blocked: Blocked[]; reload: () => Promise<void> }) {
    const [from, setFrom] = useState('');
    const [until, setUntil] = useState('');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    const add = async () => {
        if (!from || !until || until < from) { toast.error('Escolha a primeira e a última noite.'); return; }
        setBusy(true);
        try {
            // Na base de dados o fim é exclusivo: o dia a seguir à última noite fechada.
            await call('PATCH', { action: 'block', startsOn: from, endsOn: addDays(until, 1), reason });
            toast.success('Datas fechadas.');
            setFrom(''); setUntil(''); setReason('');
            await reload();
        } catch (e) {
            toast.error(errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    const remove = async (item: Blocked) => {
        if (!window.confirm('Reabrir estas datas?')) return;
        try {
            await call('PATCH', { action: 'unblock', id: item.id });
            toast.success('Datas reabertas.');
            await reload();
        } catch (e) {
            toast.error(errorMessage(e));
        }
    };

    return (
        <div style={{ display: 'grid', gap: 24 }}>
            <div style={{ ...card, padding: 20, display: 'grid', gap: 14 }}>
                <h2 style={sectionTitle}>Fechar noites</h2>
                <div style={{ fontSize: 13.5, color: '#64748b' }}>Para manutenção ou uso do Apostolado. Os membros veem estes dias como ocupados.</div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'grid', gap: 6 }}>
                        <label style={label}>Primeira noite</label>
                        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={input} />
                    </div>
                    <div style={{ display: 'grid', gap: 6 }}>
                        <label style={label}>Última noite</label>
                        <input type="date" value={until} min={from || undefined} onChange={(e) => setUntil(e.target.value)} style={input} />
                    </div>
                    <div style={{ display: 'grid', gap: 6, flex: 1, minWidth: 220 }}>
                        <label style={label}>Motivo (só para a equipa)</label>
                        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Ex.: obras na cozinha" style={input} />
                    </div>
                </div>
                <div>
                    <button type="button" disabled={busy} onClick={add} style={button('#0f4c81')}>
                        {busy ? <Loader2 size={15} className="hs-spin" /> : <Lock size={15} />} Fechar datas
                    </button>
                </div>
            </div>

            {blocked.length === 0 ? <Empty>Não há datas fechadas.</Empty> : (
                <div style={card}>
                    {blocked.map((item, index) => (
                        <div key={item.id} style={{ padding: '14px 20px', borderTop: index ? '1px solid #f1f5f9' : 'none', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                                    {formatDay(item.starts_on)} → {formatDay(addDays(item.ends_on, -1))}
                                </div>
                                <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>
                                    {nights(item.starts_on, item.ends_on)} noites{item.reason ? ` · ${item.reason}` : ''}
                                </div>
                            </div>
                            <button type="button" onClick={() => remove(item)} style={outline('#64748b')}>Reabrir</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ------------------------------ Regras da casa ------------------------------ */

const splitRules = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean);

function RulesTab({ documents, reload, settings }: { documents: Doc[]; reload: () => Promise<void>; settings: HouseSettings }) {
    const [rulesPt, setRulesPt] = useState(settings.rules_pt);
    const [rulesEn, setRulesEn] = useState(settings.rules_en);
    const [rulesContentId, setRulesContentId] = useState(settings.rules_content_id || '');
    const [busy, setBusy] = useState(false);
    const preview = splitRules(rulesPt);

    const save = async () => {
        setBusy(true);
        try {
            const result = await call('PATCH', { action: 'rules', rulesPt, rulesEn, rulesContentId });
            toast.success(result?.changed ? 'Regras guardadas. Os pedidos novos pedem nova aceitação.' : 'Sem alterações.');
            await reload();
        } catch (e) {
            toast.error(errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
            <div style={{ ...card, padding: 20, display: 'grid', gap: 16 }}>
                <div>
                    <h2 style={sectionTitle}>Regras que o membro lê e aceita</h2>
                    <div style={{ fontSize: 13.5, color: '#64748b', marginTop: 4 }}>Uma regra por linha. Versão atual: {settings.rules_version}.</div>
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                    <label style={label}>Português</label>
                    <textarea value={rulesPt} onChange={(e) => setRulesPt(e.target.value)} rows={10} style={{ ...input, resize: 'vertical', lineHeight: 1.6 }} />
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                    <label style={label}>English</label>
                    <textarea value={rulesEn} onChange={(e) => setRulesEn(e.target.value)} rows={8} style={{ ...input, resize: 'vertical', lineHeight: 1.6 }} />
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                    <label style={label}>Documento completo (opcional)</label>
                    <select value={rulesContentId} onChange={(e) => setRulesContentId(e.target.value)} style={input}>
                        <option value="">Sem documento</option>
                        {documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.title}</option>)}
                    </select>
                    <span style={{ fontSize: 12.5, color: '#64748b' }}>Carregue o PDF em Doc. Privada. Aparece por baixo das regras na app.</span>
                </div>
                <div>
                    <button type="button" disabled={busy} onClick={save} style={button('#0f4c81')}>
                        {busy ? <Loader2 size={15} className="hs-spin" /> : <Check size={15} />} Guardar regras
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
                <div style={label}>Como aparece na app</div>
                <div style={{ background: '#0C0D10', borderRadius: 24, padding: 20, display: 'grid', gap: 2 }}>
                    {preview.length === 0 ? (
                        <div style={{ color: 'rgba(235,235,245,0.46)', fontSize: 15 }}>Sem regras.</div>
                    ) : preview.map((rule, index) => (
                        <div key={index} style={{ display: 'flex', gap: 14, padding: '12px 0', borderTop: index ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                            <span style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 14, background: 'rgba(78,164,246,0.16)', color: '#4EA4F6', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{index + 1}</span>
                            <span style={{ color: '#F3F3F5', fontSize: 15.5, lineHeight: 1.45 }}>{rule}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* -------------------------------- Definições -------------------------------- */

function SettingsTab({ reload, settings }: { reload: () => Promise<void>; settings: HouseSettings }) {
    const [form, setForm] = useState({
        enabled: settings.enabled,
        maxGuests: String(settings.max_guests),
        maxNights: String(settings.max_nights),
        minMemberYears: String(settings.min_member_years),
        horizonDays: String(settings.booking_horizon_days),
    });
    const [busy, setBusy] = useState(false);
    const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

    const save = async () => {
        setBusy(true);
        try {
            await call('PATCH', { action: 'settings', ...form });
            toast.success('Definições guardadas.');
            await reload();
        } catch (e) {
            toast.error(errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ ...card, padding: 20, display: 'grid', gap: 18, maxWidth: 640 }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14.5, fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
                Reservas abertas na app
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <NumberField label="Máximo de pessoas" value={form.maxGuests} onChange={(v) => set({ maxGuests: v })} />
                <NumberField label="Máximo de noites seguidas" value={form.maxNights} onChange={(v) => set({ maxNights: v })} />
                <NumberField label="Anos de quota necessários" value={form.minMemberYears} onChange={(v) => set({ minMemberYears: v })} />
                <NumberField label="Pode reservar até (dias)" value={form.horizonDays} onChange={(v) => set({ horizonDays: v })} />
            </div>

            <div>
                <button type="button" disabled={busy} onClick={save} style={button('#0f4c81')}>
                    {busy ? <Loader2 size={15} className="hs-spin" /> : <House size={15} />} Guardar definições
                </button>
            </div>
        </div>
    );
}

/* --------------------------------- Peças ------------------------------------ */

function NumberField({ label: text, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
    return (
        <div style={{ display: 'grid', gap: 6 }}>
            <label style={label}>{text}</label>
            <input type="number" min={0} value={value} onChange={(e) => onChange(e.target.value)} style={input} />
        </div>
    );
}

function Line({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
    return (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14.5, color: '#0f172a' }}>
            <Icon size={16} color="#0f4c81" style={{ marginTop: 3, flexShrink: 0 }} />
            <span style={{ whiteSpace: 'pre-wrap' }}>{value}</span>
        </div>
    );
}

function Empty({ children }: { children: string }) {
    return (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
            {children}
        </div>
    );
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 18, border: '1px solid #e2e8f0', overflow: 'hidden' };
const sectionTitle: React.CSSProperties = { fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 };
const label: React.CSSProperties = { fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 };
const input: React.CSSProperties = {
    border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', fontSize: 14.5, color: '#0f172a', background: '#fff', fontFamily: 'inherit',
};
const button = (color: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 999, border: 'none',
    background: color, color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
});
const outline = (color: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999,
    border: `1.5px solid ${color}`, background: '#fff', color, fontSize: 13, fontWeight: 700, cursor: 'pointer',
});
