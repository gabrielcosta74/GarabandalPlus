"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { scorePerson, type IntentScore, type SitePersonSignals } from '../../../lib/site-intent-score';
import { renderReportMarkdown } from '../../../lib/report-markdown';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Activity, Loader2, MousePointerClick, Route, Users, X, AlertTriangle, Globe, Flame, Link2, Sparkles, Copy, Check, MessageCircle } from 'lucide-react';

/*
 * Conversão das peregrinações a partir do tracking próprio (site_events).
 * Conta todas as visitas (com ou sem consentimento de cookies); o perfil da
 * pessoa junta todas as sessões ligadas ao mesmo email.
 */

type PilgrimageOption = { id: string; title: string; slug: string; start_date: string };
type FunnelRow = { stage_order: number; stage: string; visitors: number };
type SourceRow = { source: string; visitors: number; cta_clicks: number; forms: number; bookings: number; paid: number };
type SiteEvent = { visitor_id: string; session_id: string; name: string; props: Record<string, any>; created_at: string; path?: string | null };
type PersonRow = SitePersonSignals & {
    first_source: string | null;
    first_campaign: string | null;
    first_seen: string;
    lead_name: string | null;
    lead_phone: string | null;
    total_amount: number | string | null;
    chat_session_ids: string[] | null;
};
type ScoredPerson = PersonRow & IntentScore;
type WeeklyReport = { id: string; created_at: string; period_start: string; period_end: string; analysis: string | null; model: string | null; emailed_to: string | null; trigger: string };
type SiteSession = { id: string; visitor_id: string; started_at: string; landing_path: string | null; referrer_host: string | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; device: string | null; browser: string | null; os: string | null; country: string | null };

const PERIODS = [7, 30, 90] as const;
const PAGE_SIZE = 1000;

const EVENT_LABELS: Record<string, string> = {
    page_view: 'Abriu página',
    page_leave: 'Saiu da página',
    pilgrimage_viewed: 'Viu a peregrinação',
    section_view: 'Leu secção',
    pilgrimage_nav_clicked: 'Usou o menu da página',
    pilgrimage_cta_clicked: 'Clicou em inscrever',
    pilgrimage_info_opened: 'Abriu informação',
    pilgrimage_payment_warning_shown: 'Viu aviso de pagamento',
    pilgrimage_payment_warning_continue: 'Continuou após aviso',
    pilgrimage_payment_warning_cancel: 'Cancelou no aviso',
    pilgrimage_waitlist_clicked: 'Clicou lista de espera',
    pilgrimage_waitlist_opened: 'Abriu lista de espera',
    registration_step_viewed: 'Passo do formulário',
    registration_validation_failed: 'Erro de validação',
    registration_back_clicked: 'Voltou atrás',
    registration_pilgrim_added: 'Adicionou pessoa',
    registration_submitted: 'Confirmou inscrição',
    registration_heard_from: 'Disse como conheceu',
    registration_submit_failed: 'Falhou a inscrição',
    lead_identified: 'Deixou o email',
    booking_created: 'Inscrição criada',
    chat_opened: 'Abriu o chat',
    chat_message_sent: 'Mensagem no chat',
    chat_cta_clicked: 'Clicou no chat',
    whatsapp_contact_clicked: 'Clicou WhatsApp',
    brochure_requested: 'Pediu brochura',
};

const STEP_LABELS: Record<string, string> = {
    identificacao: 'Identificação',
    dados: 'Dados pessoais',
    quartos: 'Quartos',
    voos: 'Voos',
    pagamento: 'Pagamento',
};

const SECTION_LABELS: Record<string, string> = {
    overview: 'Resumo',
    team: 'Equipa',
    itinerary: 'Roteiro',
    pricing: 'Preço (desktop)',
    trip_details: 'Preço (telemóvel)',
};

const HEARD_FROM_LABELS: Record<string, string> = {
    whatsapp_grupo: 'Grupo de WhatsApp',
    amigo_familia: 'Amigo ou familiar',
    paroquia: 'Paróquia ou grupo de oração',
    ja_peregrinou: 'Já peregrinou connosco',
    email: 'Email do Apostolado',
    facebook_instagram: 'Facebook ou Instagram',
    youtube: 'YouTube',
    google: 'Google',
    app: 'App do Apostolado',
    outro: 'Outro',
};

const pct = (part: number, total: number) => (total > 0 ? `${Math.round((part / total) * 100)}%` : '—');

const describeEvent = (event: SiteEvent) => {
    const label = EVENT_LABELS[event.name] || event.name;
    const p = event.props || {};
    if (event.name === 'page_view') return `${label}: ${event.path || ''}`;
    if (event.name === 'page_leave') return `${label} · ${p.active_seconds ?? 0}s ativo · scroll ${p.max_scroll ?? 0}%`;
    if (event.name === 'section_view') return `${label}: ${SECTION_LABELS[p.section] || p.section}`;
    if (event.name === 'registration_step_viewed') {
        const sub = p.sub_section !== null && p.sub_section !== undefined ? ` (parte ${Number(p.sub_section) + 1})` : '';
        return `${label}: ${STEP_LABELS[p.step_name] || p.step_name}${sub}`;
    }
    if (event.name === 'registration_validation_failed') return `${label}: ${p.fields || '—'}`;
    if (event.name === 'pilgrimage_cta_clicked') return `${label} (${p.placement || '—'})`;
    if (event.name === 'pilgrimage_info_opened') return `${label}: ${p.mode === 'flights' ? 'voos' : 'incluído'}`;
    if (event.name === 'registration_submit_failed') return `${label}: ${p.error || ''}`;
    if (event.name === 'registration_heard_from') return `${label}: ${HEARD_FROM_LABELS[p.source] || p.source}`;
    return label;
};

const sourceOf = (s: { utm_source?: string | null; referrer_host?: string | null }) =>
    s.utm_source || s.referrer_host || 'direto';

const LEVEL_STYLES: Record<string, string> = {
    quente: 'bg-rose-50 text-rose-700 border-rose-100',
    morno: 'bg-amber-50 text-amber-700 border-amber-100',
    frio: 'bg-slate-100 text-slate-500 border-slate-200',
};

const STAGE_LABELS: Record<string, [string, string]> = {
    pagou: ['Pagou', 'bg-emerald-50 text-emerald-700'],
    por_pagar: ['Inscrito, sem pagamento', 'bg-amber-50 text-amber-700'],
    em_aberto: ['Não concluiu', 'bg-slate-100 text-slate-600'],
};

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>, max = 20_000) {
    const rows: T[] = [];
    for (let from = 0; from < max; from += PAGE_SIZE) {
        const { data, error } = await build(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < PAGE_SIZE) break;
    }
    return rows;
}

function countBy<T>(items: T[], key: (item: T) => string | null | undefined) {
    const map = new Map<string, number>();
    for (const item of items) {
        const k = key(item);
        if (!k) continue;
        map.set(k, (map.get(k) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-600">{icon}</div>
                <h3 className="text-sm font-bold text-slate-700">{title}</h3>
            </div>
            {children}
        </div>
    );
}

function BarList({ rows, total, labels }: { rows: [string, number][]; total: number; labels?: Record<string, string> }) {
    if (!rows.length) return <p className="text-sm text-slate-400">Sem dados ainda.</p>;
    const max = Math.max(...rows.map(([, n]) => n));
    return (
        <ul className="space-y-2">
            {rows.map(([key, n]) => (
                <li key={key}>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                        <span className="truncate">{labels?.[key] || key}</span>
                        <span className="font-bold text-slate-800 shrink-0 ml-2">{n} <span className="font-normal text-slate-400">· {pct(n, total)}</span></span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-brand rounded-full" style={{ width: `${(n / max) * 100}%` }} />
                    </div>
                </li>
            ))}
        </ul>
    );
}

export default function AdminConversaoPage() {
    const [pilgrimages, setPilgrimages] = useState<PilgrimageOption[]>([]);
    const [pilgrimageId, setPilgrimageId] = useState<string>('');
    const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [funnel, setFunnel] = useState<FunnelRow[]>([]);
    const [sources, setSources] = useState<SourceRow[]>([]);
    const [events, setEvents] = useState<SiteEvent[]>([]);
    const [sessions, setSessions] = useState<SiteSession[]>([]);
    const [people, setPeople] = useState<ScoredPerson[]>([]);
    const [peopleFilter, setPeopleFilter] = useState<'acao' | 'todos'>('acao');
    const [profileEmail, setProfileEmail] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            if (!supabaseBrowser) return;
            const { data } = await supabaseBrowser
                .from('pilgrimages')
                .select('id, title, slug, start_date')
                .gte('start_date', new Date().toISOString().slice(0, 10))
                .order('start_date');
            const list = (data || []) as PilgrimageOption[];
            setPilgrimages(list);
            const fromUrl = new URLSearchParams(window.location.search).get('p');
            const preferred = list.find((p) => p.id === fromUrl || p.slug === fromUrl) || list.find((p) => p.slug === 'peregrinacao-mariana-2027') || list[0];
            if (preferred) setPilgrimageId(preferred.id);
            else setLoading(false);
        };
        load();
    }, []);

    const loadData = useCallback(async () => {
        if (!supabaseBrowser || !pilgrimageId) return;
        const client = supabaseBrowser;
        setLoading(true);
        setError(null);
        try {
            const to = new Date();
            const from = new Date(to.getTime() - days * 86_400_000);
            const range = { p_pilgrimage_id: pilgrimageId, p_from: from.toISOString(), p_to: new Date(to.getTime() + 60_000).toISOString() };

            const [funnelRes, sourcesRes, eventRows] = await Promise.all([
                client.rpc('site_pilgrimage_funnel', range),
                client.rpc('site_pilgrimage_sources', range),
                fetchAll<SiteEvent>((a, b) => client
                    .from('site_events')
                    .select('visitor_id, session_id, name, props, created_at, path')
                    .eq('pilgrimage_id', pilgrimageId)
                    .gte('created_at', from.toISOString())
                    .order('created_at', { ascending: true })
                    .range(a, b)),
            ]);
            if (funnelRes.error) throw funnelRes.error;
            if (sourcesRes.error) throw sourcesRes.error;
            setFunnel((funnelRes.data || []) as FunnelRow[]);
            setSources((sourcesRes.data || []) as SourceRow[]);
            setEvents(eventRows);

            const sessionIds = Array.from(new Set(eventRows.map((e) => e.session_id)));
            const sessionRows: SiteSession[] = [];
            for (let i = 0; i < sessionIds.length; i += 200) {
                const { data } = await client.from('site_sessions').select('*').in('id', sessionIds.slice(i, i + 200));
                sessionRows.push(...((data || []) as SiteSession[]));
            }
            setSessions(sessionRows);

            // Pessoas identificadas (agrupadas por email) com pontuação de interesse.
            const { data: peopleRows, error: peopleError } = await client.rpc('site_pilgrimage_people', range);
            if (peopleError) throw peopleError;
            setPeople(((peopleRows || []) as PersonRow[])
                .map((person) => ({ ...person, ...scorePerson(person) }))
                .sort((a, b) => (a.stage === 'pagou' ? 1 : 0) - (b.stage === 'pagou' ? 1 : 0) || b.score - a.score));
        } catch (err: any) {
            const message = String(err?.message || err);
            setError(/schema cache|does not exist/i.test(message)
                ? `As tabelas do tracking ainda não existem. Aplica a migração 20261102120000_site_tracking.sql. (${message})`
                : message);
        } finally {
            setLoading(false);
        }
    }, [pilgrimageId, days]);

    useEffect(() => { loadData(); }, [loadData]);

    const stats = useMemo(() => {
        const visitorsWith = (name: string, match?: (e: SiteEvent) => boolean) =>
            new Set(events.filter((e) => e.name === name && (!match || match(e))).map((e) => e.visitor_id));
        const viewers = visitorsWith('pilgrimage_viewed');
        const ctaEvents = events.filter((e) => e.name === 'pilgrimage_cta_clicked');
        const sectionVisitors = (section: string) => visitorsWith('section_view', (e) => e.props?.section === section).size;
        const leaves = events.filter((e) => e.name === 'page_leave' && !e.path?.includes('/inscrever'));
        const avgActive = leaves.length ? Math.round(leaves.reduce((sum, e) => sum + Number(e.props?.active_seconds || 0), 0) / leaves.length) : 0;
        const avgScroll = leaves.length ? Math.round(leaves.reduce((sum, e) => sum + Number(e.props?.max_scroll || 0), 0) / leaves.length) : 0;
        const validationFields = events
            .filter((e) => e.name === 'registration_validation_failed')
            .flatMap((e) => String(e.props?.fields || '').split(',').filter(Boolean).map((f) => f.replace(/^pilgrims\./, '')));
        const sessionsSeen = sessions.filter((s) => events.some((e) => e.session_id === s.id && e.name === 'pilgrimage_viewed'));
        return {
            viewers: viewers.size,
            sessions: new Set(events.filter((e) => e.name === 'pilgrimage_viewed').map((e) => e.session_id)).size,
            ctaByPlacement: countBy(ctaEvents, (e) => e.props?.placement || '—'),
            ctaTotal: ctaEvents.length,
            sections: (['overview', 'team', 'itinerary', 'pricing', 'trip_details'] as const).map((s) => [s, sectionVisitors(s)] as [string, number]).filter(([, n]) => n > 0),
            infoOpened: countBy(events.filter((e) => e.name === 'pilgrimage_info_opened'), (e) => (e.props?.mode === 'flights' ? 'Voos' : 'Incluído no terrestre')),
            validation: countBy(validationFields.map((f) => ({ f })), (x) => x.f),
            validationTotal: validationFields.length,
            heardFrom: countBy(Array.from(new Map(events.filter((e) => e.name === 'registration_heard_from').map((e) => [e.visitor_id, e])).values()), (e) => e.props?.source),
            backFrom: countBy(events.filter((e) => e.name === 'registration_back_clicked'), (e) => STEP_LABELS[e.props?.from] || e.props?.from),
            devices: countBy(sessionsSeen, (s) => s.device),
            countries: countBy(sessionsSeen, (s) => s.country).slice(0, 8),
            browsers: countBy(sessionsSeen, (s) => s.browser),
            avgActive,
            avgScroll,
        };
    }, [events, sessions]);

    const top = funnel[0]?.visitors || 0;
    const visiblePeople = peopleFilter === 'todos' ? people : people.filter((p) => p.stage !== 'pagou');

    return (
        <AdminLayout title="Conversão das peregrinações" isLoading={false}>
            <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={pilgrimageId}
                        onChange={(e) => setPilgrimageId(e.target.value)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 max-w-full"
                    >
                        {pilgrimages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                    <div className="flex rounded-xl border border-slate-200 bg-white p-1">
                        {PERIODS.map((d) => (
                            <button key={d} onClick={() => setDays(d)} className={`px-3 py-1 rounded-lg text-xs font-bold ${days === d ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>{d}d</button>
                        ))}
                    </div>
                    {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                    Tracking próprio: conta todas as visitas, com ou sem cookies aceites. Sem consentimento, cada visita é um visitante novo,
                    por isso &quot;visitantes&quot; aproxima-se mais de &quot;visitas&quot;. As inscrições e pagamentos vêm da base de dados.
                </p>

                {error && (
                    <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
                    </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        ['Visitantes na página', stats.viewers],
                        ['Visitas', stats.sessions],
                        ['Tempo ativo médio', `${stats.avgActive}s`],
                        ['Scroll médio', `${stats.avgScroll}%`],
                    ].map(([label, value]) => (
                        <div key={label as string} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                            <p className="text-xs font-bold text-slate-500">{label}</p>
                            <p className="text-2xl font-black text-slate-900 mt-1">{value}</p>
                        </div>
                    ))}
                </div>

                <WeeklyReportCard />

                <Card title={`Quem contactar (${visiblePeople.length})`} icon={<Flame className="w-4 h-4" />}>
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="text-xs text-slate-500">
                            Pessoas que deixaram o email, ordenadas por interesse. A pontuação junta visitas, tempo, secções lidas, passo do formulário, chat e WhatsApp.
                        </p>
                        <div className="flex shrink-0 rounded-xl border border-slate-200 bg-white p-1">
                            {([['acao', 'Por converter'], ['todos', 'Todos']] as const).map(([id, label]) => (
                                <button key={id} onClick={() => setPeopleFilter(id)} className={`px-3 py-1 rounded-lg text-xs font-bold ${peopleFilter === id ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>{label}</button>
                            ))}
                        </div>
                    </div>
                    {visiblePeople.length === 0 ? <p className="text-sm text-slate-400">Ninguém por converter neste período.</p> : (
                        <ul className="divide-y divide-slate-100">
                            {visiblePeople.map((p) => {
                                const digits = (p.lead_phone || '').replace(/[^\d]/g, '');
                                const [stageLabel, stageClass] = STAGE_LABELS[p.stage];
                                return (
                                    <li key={p.email} className="py-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                        <button className="text-left min-w-0 flex-1" onClick={() => setProfileEmail(p.email)}>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-black ${LEVEL_STYLES[p.level]}`}>
                                                    {p.level === 'quente' && <Flame className="w-3 h-3" />}{p.level} · {p.score}
                                                </span>
                                                <span className="font-semibold text-slate-800 truncate">{p.lead_name && !/rascunho|draft/i.test(p.lead_name) ? p.lead_name : p.email}</span>
                                                <span className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${stageClass}`}>{stageLabel}</span>
                                            </div>
                                            <p className="mt-1 text-xs font-semibold text-slate-700">{p.nextAction}</p>
                                            <p className="mt-0.5 text-[11px] text-slate-500">
                                                {p.reasons.slice(0, 4).join(' · ') || 'Poucos sinais ainda'}
                                                {' · '}{p.first_source || 'direto'}{p.first_campaign ? ` / ${p.first_campaign}` : ''}
                                                {' · '}visto {format(new Date(p.last_seen), "d MMM HH:mm", { locale: pt })}
                                            </p>
                                        </button>
                                        {digits && p.stage !== 'pagou' && (
                                            <a
                                                href={`https://wa.me/${digits}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-bold text-white"
                                            >
                                                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                                            </a>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Card>

                <Card title="Funil (visitantes distintos)" icon={<Route className="w-4 h-4" />}>
                    {funnel.length === 0 ? <p className="text-sm text-slate-400">Sem dados ainda.</p> : (
                        <ol className="space-y-2.5">
                            {funnel.map((row, index) => {
                                const prev = index > 0 ? funnel[index - 1].visitors : row.visitors;
                                return (
                                    <li key={row.stage_order}>
                                        <div className="flex justify-between gap-2 text-xs mb-1">
                                            <span className="font-semibold text-slate-700">{row.stage}</span>
                                            <span className="text-slate-500 shrink-0">
                                                <strong className="text-slate-900">{row.visitors}</strong>
                                                {index > 0 && <> · {pct(row.visitors, prev)} do passo anterior</>}
                                            </span>
                                        </div>
                                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-brand rounded-full" style={{ width: top ? `${Math.max(2, (row.visitors / top) * 100)}%` : '0%' }} />
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card title="Origem → resultado" icon={<Globe className="w-4 h-4" />}>
                        {sources.length === 0 ? <p className="text-sm text-slate-400">Sem dados ainda.</p> : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead className="text-slate-400 text-left">
                                        <tr><th className="py-1 pr-2">Origem</th><th className="text-right">Visit.</th><th className="text-right">Clique</th><th className="text-right">Form.</th><th className="text-right">Inscr.</th><th className="text-right">Pagas</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {sources.map((s) => (
                                            <tr key={s.source} className="text-slate-700">
                                                <td className="py-1.5 pr-2 truncate max-w-[160px]">{s.source}</td>
                                                <td className="text-right">{s.visitors}</td>
                                                <td className="text-right">{s.cta_clicks}</td>
                                                <td className="text-right">{s.forms}</td>
                                                <td className="text-right font-bold">{s.bookings}</td>
                                                <td className="text-right font-bold text-emerald-700">{s.paid}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>

                    <Card title="Que botão de inscrição é clicado" icon={<MousePointerClick className="w-4 h-4" />}>
                        <BarList rows={stats.ctaByPlacement} total={stats.ctaTotal} labels={{ pricing: 'Bloco de preço (desktop)', sticky_bar: 'Barra fixa', '—': 'Outro' }} />
                    </Card>

                    <Card title="Secções lidas (visitantes)" icon={<Activity className="w-4 h-4" />}>
                        <BarList rows={stats.sections} total={stats.viewers} labels={SECTION_LABELS} />
                        {stats.infoOpened.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <p className="text-xs font-bold text-slate-500 mb-2">Modais de informação abertos</p>
                                <BarList rows={stats.infoOpened} total={stats.viewers} />
                            </div>
                        )}
                    </Card>

                    <Card title="Onde o formulário falha" icon={<AlertTriangle className="w-4 h-4" />}>
                        <p className="text-xs font-bold text-slate-500 mb-2">Campos com erro de validação</p>
                        <BarList rows={stats.validation} total={stats.validationTotal} />
                        {stats.backFrom.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <p className="text-xs font-bold text-slate-500 mb-2">Voltou atrás a partir de</p>
                                <BarList rows={stats.backFrom} total={stats.backFrom.reduce((s, [, n]) => s + n, 0)} />
                            </div>
                        )}
                    </Card>

                    <Card title="Como conheceram (resposta no formulário)" icon={<Users className="w-4 h-4" />}>
                        <BarList rows={stats.heardFrom} total={stats.heardFrom.reduce((sum, [, n]) => sum + n, 0)} labels={HEARD_FROM_LABELS} />
                    </Card>

                    <Card title="Dispositivo e país" icon={<Globe className="w-4 h-4" />}>
                        <BarList rows={stats.devices} total={stats.sessions} labels={{ mobile: 'Telemóvel', tablet: 'Tablet', desktop: 'Computador' }} />
                        <div className="mt-4 pt-4 border-t border-slate-100">
                            <BarList rows={stats.countries} total={stats.sessions} />
                        </div>
                    </Card>
                </div>

                <UtmBuilder pilgrimage={pilgrimages.find((p) => p.id === pilgrimageId) || null} />
            </div>

            {profileEmail && <PersonProfile email={profileEmail} person={people.find((p) => p.email === profileEmail) || null} onClose={() => setProfileEmail(null)} />}
        </AdminLayout>
    );
}

type ChatConversation = { id: string; session_id: string; pilgrimage_title: string | null; updated_at: string; messages: { role: string; content: string }[] };

function PersonProfile({ email, person, onClose }: { email: string; person: ScoredPerson | null; onClose: () => void }) {
    const [loading, setLoading] = useState(true);
    const [sessions, setSessions] = useState<SiteSession[]>([]);
    const [events, setEvents] = useState<(SiteEvent & { path: string | null })[]>([]);
    const [bookings, setBookings] = useState<{ id: string; status: string; paid_amount: number | null; total_amount: number | null; created_at: string; pilgrimage_title: string | null }[]>([]);
    const [chats, setChats] = useState<ChatConversation[]>([]);

    useEffect(() => {
        const load = async () => {
            if (!supabaseBrowser) return;
            const client = supabaseBrowser;
            setLoading(true);
            const { data: visitors } = await client.from('site_visitors').select('id').eq('email', email.toLowerCase());
            const ids = (visitors || []).map((v) => v.id);
            let eventRows: (SiteEvent & { path: string | null })[] = [];
            if (ids.length) {
                const [{ data: s }, { data: e }] = await Promise.all([
                    client.from('site_sessions').select('*').in('visitor_id', ids).order('started_at', { ascending: false }),
                    client.from('site_events').select('visitor_id, session_id, name, props, created_at, path').in('visitor_id', ids).order('created_at', { ascending: true }).limit(1000),
                ]);
                setSessions((s || []) as SiteSession[]);
                eventRows = (e || []) as typeof eventRows;
                setEvents(eventRows);
            }
            const chatIds = Array.from(new Set(eventRows.map((e) => e.props?.chat_session_id).filter((id): id is string => typeof id === 'string')));
            const [{ data: b }, chatRes] = await Promise.all([
                client.rpc('site_person_bookings', { p_email: email }),
                chatIds.length
                    ? client.from('chat_conversations').select('id, session_id, pilgrimage_title, updated_at, messages').in('session_id', chatIds).order('updated_at', { ascending: false })
                    : Promise.resolve({ data: [] as ChatConversation[] }),
            ]);
            setBookings((b || []) as typeof bookings);
            setChats((chatRes.data || []) as ChatConversation[]);
            setLoading(false);
        };
        load();
    }, [email]);

    const eventsBySession = useMemo(() => {
        const map = new Map<string, typeof events>();
        for (const e of events) {
            const list = map.get(e.session_id) || [];
            list.push(e);
            map.set(e.session_id, list);
        }
        return map;
    }, [events]);

    const digits = (person?.lead_phone || '').replace(/[^\d]/g, '');

    return (
        <div className="fixed inset-0 z-[200] flex justify-end bg-slate-950/40" onClick={onClose}>
            <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Perfil</p>
                        {person?.lead_name && !/rascunho|draft/i.test(person.lead_name) && <p className="font-bold text-slate-900">{person.lead_name}</p>}
                        <h2 className="font-mono text-sm font-bold text-slate-900 break-all">{email}</h2>
                        {person?.lead_phone && <p className="font-mono text-xs text-slate-500">{person.lead_phone}</p>}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Fechar"><X className="w-4 h-4" /></button>
                </div>

                {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : (
                    <div className="space-y-5">
                        {person && (
                            <div className={`rounded-2xl border p-4 ${LEVEL_STYLES[person.level]}`}>
                                <p className="text-xs font-black uppercase tracking-wider">{person.level} · {person.score}/100</p>
                                <p className="mt-1 text-sm font-bold text-slate-900">{person.nextAction}</p>
                                {person.reasons.length > 0 && <p className="mt-1 text-xs text-slate-600">{person.reasons.join(' · ')}</p>}
                                {digits && person.stage !== 'pagou' && (
                                    <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-bold text-white">
                                        <MessageCircle className="w-3.5 h-3.5" /> Abrir WhatsApp
                                    </a>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xl font-black">{sessions.length}</p><p className="text-[11px] text-slate-500">visitas</p></div>
                            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xl font-black">{events.filter((e) => e.name === 'page_view').length}</p><p className="text-[11px] text-slate-500">páginas</p></div>
                            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xl font-black">{Math.round(events.filter((e) => e.name === 'page_leave').reduce((s, e) => s + Number(e.props?.active_seconds || 0), 0) / 60)}m</p><p className="text-[11px] text-slate-500">tempo ativo</p></div>
                        </div>

                        {bookings.length > 0 && (
                            <div>
                                <p className="text-xs font-bold text-slate-500 mb-2">Inscrições</p>
                                <ul className="space-y-1.5">
                                    {bookings.map((b) => (
                                        <li key={b.id} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                                            <span className="font-semibold text-slate-800">{b.pilgrimage_title || '—'}</span>
                                            <span className="block text-slate-500">{format(new Date(b.created_at), "d MMM yyyy", { locale: pt })} · {b.status} · pago {b.paid_amount ?? 0}€ de {b.total_amount ?? '—'}€</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {chats.length > 0 && (
                            <div>
                                <p className="text-xs font-bold text-slate-500 mb-2">Conversas no chat</p>
                                <div className="space-y-2">
                                    {chats.map((chat) => (
                                        <details key={chat.id} className="rounded-xl border border-slate-200 p-3 text-xs">
                                            <summary className="cursor-pointer font-semibold text-slate-700">
                                                {format(new Date(chat.updated_at), "d MMM HH:mm", { locale: pt })} · {chat.pilgrimage_title || 'Geral'} · {chat.messages.filter((m) => m.role === 'user').length} perguntas
                                            </summary>
                                            <ul className="mt-2 space-y-1.5">
                                                {chat.messages.map((m, i) => (
                                                    <li key={i} className={m.role === 'user' ? 'font-semibold text-slate-800' : 'text-slate-500'}>
                                                        {m.role === 'user' ? 'Pessoa: ' : 'Chat: '}{m.content.replace(/\[\[[^\]]*\]\]/g, '').slice(0, 400)}
                                                    </li>
                                                ))}
                                            </ul>
                                        </details>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <p className="text-xs font-bold text-slate-500 mb-2">Percurso</p>
                            {sessions.length === 0 && <p className="text-sm text-slate-400">Sem visitas registadas.</p>}
                            <div className="space-y-4">
                                {sessions.map((s) => (
                                    <div key={s.id} className="rounded-xl border border-slate-200 p-3">
                                        <p className="text-xs font-bold text-slate-800">
                                            {format(new Date(s.started_at), "d MMM yyyy 'às' HH:mm", { locale: pt })}
                                        </p>
                                        <p className="text-[11px] text-slate-500 mb-2">
                                            {sourceOf(s)}{s.utm_campaign ? ` · ${s.utm_campaign}` : ''} · {s.device || '—'} · {s.browser || '—'}/{s.os || '—'}{s.country ? ` · ${s.country}` : ''}
                                        </p>
                                        <ol className="space-y-1 border-l-2 border-slate-100 pl-3">
                                            {(eventsBySession.get(s.id) || []).map((e, i) => (
                                                <li key={i} className="text-xs text-slate-600">
                                                    <span className="text-slate-400 mr-2">{format(new Date(e.created_at), 'HH:mm:ss')}</span>
                                                    {describeEvent(e)}
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </aside>
        </div>
    );
}

/* -------------------------- relatórios do Claude --------------------------- */

// Escritos pelas tarefas agendadas do Claude Code (docs/conversao/README.md):
// boletim semanal às sextas (trigger 'semanal') e revisão mensal no dia 1 (trigger 'mensal').
const REPORT_KINDS = [
    { id: 'semanal', label: 'Semanais', empty: 'Ainda não há boletins. O Claude escreve um todas as sextas à tarde.' },
    { id: 'mensal', label: 'Mensais', empty: 'Ainda não há revisões. A primeira é no dia 1 do próximo mês.' },
] as const;

function WeeklyReportCard() {
    const [reports, setReports] = useState<WeeklyReport[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [kind, setKind] = useState<(typeof REPORT_KINDS)[number]['id']>('semanal');
    const [openId, setOpenId] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            if (!supabaseBrowser) return;
            const { data } = await supabaseBrowser
                .from('site_weekly_reports')
                .select('id, created_at, period_start, period_end, analysis, model, emailed_to, trigger')
                .in('trigger', REPORT_KINDS.map((k) => k.id))
                .order('created_at', { ascending: false })
                .limit(40);
            setReports((data || []) as WeeklyReport[]);
            setLoaded(true);
        };
        load();
    }, []);

    const visible = reports.filter((r) => r.trigger === kind);
    const current = REPORT_KINDS.find((k) => k.id === kind)!;

    return (
        <Card title="Relatórios do Claude" icon={<Sparkles className="w-4 h-4" />}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <p className="text-xs text-slate-500">Boletim semanal às sextas e revisão mensal no dia 1. O mais recente aparece aberto.</p>
                <div className="flex rounded-xl border border-slate-200 bg-white p-1">
                    {REPORT_KINDS.map((k) => (
                        <button key={k.id} onClick={() => { setKind(k.id); setOpenId(null); }} className={`px-3 py-1 rounded-lg text-xs font-bold ${kind === k.id ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>
                            {k.label} ({reports.filter((r) => r.trigger === k.id).length})
                        </button>
                    ))}
                </div>
            </div>
            {!loaded ? <p className="text-sm text-slate-400">A carregar…</p> : visible.length === 0 ? <p className="text-sm text-slate-400">{current.empty}</p> : (
                <ul className="divide-y divide-slate-100">
                    {visible.map((report, index) => {
                        const isOpen = openId ? openId === report.id : index === 0;
                        return (
                            <li key={report.id} className="py-2">
                                <button onClick={() => setOpenId(isOpen ? '__none__' : report.id)} className="flex w-full items-center justify-between gap-3 text-left">
                                    <span className="text-sm font-semibold text-slate-800">
                                        {format(new Date(report.period_start), 'd MMM', { locale: pt })} – {format(new Date(report.period_end), 'd MMM yyyy', { locale: pt })}
                                    </span>
                                    <span className="text-xs text-slate-400">{isOpen ? 'Fechar' : 'Ler'}</span>
                                </button>
                                {isOpen && report.analysis && (
                                    <div
                                        className="mt-3 text-sm text-slate-700 leading-relaxed [&_h2]:mt-4 [&_h2]:mb-1 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-slate-900 [&_h3]:mt-3 [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_p]:my-1.5"
                                        dangerouslySetInnerHTML={{ __html: renderReportMarkdown(report.analysis) }}
                                    />
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
}

/* --------------------------- links de campanha ---------------------------- */

const SITE_ORIGIN = 'https://apostoladodegarabandal.com';
const CHANNELS = [
    { id: 'wa_grupo', label: 'WhatsApp (grupo)', source: 'whatsapp', medium: 'grupo' },
    { id: 'wa_estado', label: 'WhatsApp (estado)', source: 'whatsapp', medium: 'estado' },
    { id: 'wa_direto', label: 'WhatsApp (pessoa)', source: 'whatsapp', medium: 'direto' },
    { id: 'fb_post', label: 'Facebook (publicação)', source: 'facebook', medium: 'social' },
    { id: 'fb_ads', label: 'Facebook (anúncio)', source: 'facebook', medium: 'paid' },
    { id: 'ig', label: 'Instagram', source: 'instagram', medium: 'social' },
    { id: 'yt', label: 'YouTube', source: 'youtube', medium: 'video' },
    { id: 'email', label: 'Email manual', source: 'email', medium: 'manual' },
] as const;

const slugify = (value: string) =>
    value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

function UtmBuilder({ pilgrimage }: { pilgrimage: PilgrimageOption | null }) {
    const [path, setPath] = useState('');
    const [channel, setChannel] = useState<(typeof CHANNELS)[number]['id']>('wa_grupo');
    const [campaign, setCampaign] = useState('');
    const [content, setContent] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (pilgrimage) setPath(`/peregrinacoes/${pilgrimage.slug}`);
    }, [pilgrimage]);

    const url = useMemo(() => {
        const preset = CHANNELS.find((c) => c.id === channel)!;
        const params = new URLSearchParams({ utm_source: preset.source, utm_medium: preset.medium });
        if (campaign.trim()) params.set('utm_campaign', slugify(campaign));
        if (content.trim()) params.set('utm_content', slugify(content));
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return `${SITE_ORIGIN}${cleanPath}?${params.toString()}`;
    }, [path, channel, campaign, content]);

    const copy = async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    return (
        <Card title="Links de campanha (para saber o que traz inscrições)" icon={<Link2 className="w-4 h-4" />}>
            <p className="text-xs text-slate-500 mb-3">
                Usa um link destes sempre que partilhares a página. Sem ele, quem vem do WhatsApp aparece como &quot;direto&quot; e não se sabe que grupo ou publicação trouxe a inscrição.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-bold text-slate-600">Página
                    <input value={path} onChange={(e) => setPath(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal" />
                </label>
                <label className="text-xs font-bold text-slate-600">Canal
                    <select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal">
                        {CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                </label>
                <label className="text-xs font-bold text-slate-600">Campanha (ex.: nome do grupo ou da publicação)
                    <input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="grupo-terco-sao-paulo" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal" />
                </label>
                <label className="text-xs font-bold text-slate-600">Variante (opcional)
                    <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="video-testemunho" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal" />
                </label>
            </div>
            <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
                <code className="flex-1 break-all rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">{url}</code>
                <div className="flex gap-2">
                    <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copiado' : 'Copiar'}
                    </button>
                    <a href={`https://wa.me/?text=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-bold text-white">
                        <MessageCircle className="w-3.5 h-3.5" /> Partilhar
                    </a>
                </div>
            </div>
        </Card>
    );
}
