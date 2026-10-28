"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    BellRing,
    Bot,
    CalendarClock,
    CheckCircle2,
    Clock3,
    Globe2,
    RefreshCw,
    Send,
    Settings2,
    ShieldCheck,
    Smartphone,
    Users,
    X,
    Zap,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import AdminLayout from '../../../components/admin/AdminLayout';
import { getBrowserAccessToken } from '../../../lib/supabase-browser';
import { PUSH_DESTINATIONS } from '../../../lib/push-destinations';

type Stats = {
    reachablePeople: number;
    reachableDevices: number;
    activeDevices30d: number;
    ios: number;
    android: number;
    english: number;
    acceptedLast30Days: number;
    reactivationAcceptedLast30Days: number;
    disabledDevices: number;
};

type Automation = {
    key: string;
    name: string;
    description: string;
    enabled: boolean;
    send_hour_local: number;
    inactivity_days: number;
    cooldown_days: number;
    title_pt: string;
    body_pt: string;
    title_en: string;
    body_en: string;
    destination_url: string;
    updated_at: string | null;
};

type Campaign = {
    id: string;
    name: string;
    title_pt: string;
    body_pt: string;
    status: string;
    destination_url: string;
    scheduled_for: string | null;
    sent_at: string | null;
    recipient_count: number;
    device_count: number;
    delivered_count: number;
    failed_count: number;
    error_message: string | null;
    created_at: string;
};

type DashboardData = {
    setupRequired: boolean;
    stats: Stats;
    automation: Automation;
    campaigns: Campaign[];
};

type Composer = {
    name: string;
    titlePt: string;
    bodyPt: string;
    titleEn: string;
    bodyEn: string;
    destinationUrl: string;
    mode: 'send_now' | 'schedule';
    scheduledFor: string;
};

const EMPTY_COMPOSER: Composer = {
    name: '',
    titlePt: '',
    bodyPt: '',
    titleEn: '',
    bodyEn: '',
    destinationUrl: '/',
    mode: 'send_now',
    scheduledFor: '',
};

const LOCAL_AUTOMATIONS = [
    { name: 'Lembrete diário da novena', detail: 'Hora escolhida por cada pessoa', icon: BellRing },
    { name: 'Quotas e pagamentos', detail: 'Vencimentos de quota, sinal e prestações', icon: CalendarClock },
    { name: 'Eventos online', detail: 'Véspera e início do encontro', icon: Activity },
    { name: 'Preparação de viagem', detail: 'Documentos, bagagem e partida', icon: Globe2 },
];

const statusMeta: Record<string, { label: string; className: string }> = {
    scheduled: { label: 'Agendado', className: 'bg-blue-50 text-blue-700 ring-blue-200' },
    sending: { label: 'A enviar', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
    sent: { label: 'Enviado', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    partial: { label: 'Parcial', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
    failed: { label: 'Falhou', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
    cancelled: { label: 'Cancelado', className: 'bg-slate-100 text-slate-500 ring-slate-200' },
    draft: { label: 'Rascunho', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

const formatDateTime = (value?: string | null) => {
    if (!value) return '—';
    return new Intl.DateTimeFormat('pt-PT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
};

async function api(init?: RequestInit) {
    const token = await getBrowserAccessToken();
    const response = await fetch('/api/admin/push-notifications', {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(init?.headers || {}),
        },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Não foi possível concluir o pedido.');
    return body;
}

function StatusPill({ status }: { status: string }) {
    const meta = statusMeta[status] || statusMeta.draft;
    return (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${meta.className}`}>
            {meta.label}
        </span>
    );
}

function StatCard({ icon: Icon, label, value, detail }: { icon: typeof Users; label: string; value: number; detail: string }) {
    return (
        <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/[0.02]">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value.toLocaleString('pt-PT')}</p>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
        </section>
    );
}

export default function PushNotificationsAdmin() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [composer, setComposer] = useState<Composer>(EMPTY_COMPOSER);
    const [showEnglish, setShowEnglish] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [automationOpen, setAutomationOpen] = useState(false);
    const [automation, setAutomation] = useState<Automation | null>(null);

    const load = useCallback(async (silent = false) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        try {
            const next = await api();
            setData(next);
            setAutomation(next.automation);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Erro ao carregar notificações.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const destinationLabel = useMemo(
        () => PUSH_DESTINATIONS.find((item) => item.value === composer.destinationUrl)?.label || 'Início',
        [composer.destinationUrl],
    );

    const validateComposer = () => {
        if (data?.setupRequired) return 'Falta aplicar a migration de gestão de push.';
        if (composer.name.trim().length < 2) return 'Dá um nome interno a este envio.';
        if (composer.titlePt.trim().length < 2) return 'Escreve o título em português.';
        if (composer.bodyPt.trim().length < 2) return 'Escreve a mensagem em português.';
        if (composer.mode === 'schedule' && !composer.scheduledFor) return 'Escolhe a data e hora do envio.';
        if (!composer.titleEn.trim() || !composer.bodyEn.trim()) return 'Completa a versão em inglês.';
        return null;
    };

    const requestConfirmation = () => {
        const error = validateComposer();
        if (error) return toast.error(error);
        setConfirmOpen(true);
    };

    const submitCampaign = async () => {
        setSubmitting(true);
        try {
            const result = await api({
                method: 'POST',
                body: JSON.stringify({
                    action: 'create_campaign',
                    mode: composer.mode,
                    name: composer.name,
                    titlePt: composer.titlePt,
                    bodyPt: composer.bodyPt,
                    titleEn: composer.titleEn,
                    bodyEn: composer.bodyEn,
                    destinationUrl: composer.destinationUrl,
                    scheduledFor: composer.mode === 'schedule'
                        ? new Date(composer.scheduledFor).toISOString()
                        : null,
                }),
            });
            setConfirmOpen(false);
            setComposer(EMPTY_COMPOSER);
            setShowEnglish(false);
            toast.success(
                composer.mode === 'schedule'
                    ? 'Notificação agendada.'
                    : `${result.outcome?.delivered || 0} notificações aceites pela Expo.`,
            );
            await load(true);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Falha ao criar o envio.');
        } finally {
            setSubmitting(false);
        }
    };

    const saveAutomation = async () => {
        if (!automation) return;
        setSubmitting(true);
        try {
            await api({
                method: 'POST',
                body: JSON.stringify({
                    action: 'update_automation',
                    enabled: automation.enabled,
                    sendHourLocal: Number(automation.send_hour_local),
                    inactivityDays: Number(automation.inactivity_days),
                    cooldownDays: Number(automation.cooldown_days),
                    titlePt: automation.title_pt,
                    bodyPt: automation.body_pt,
                    titleEn: automation.title_en,
                    bodyEn: automation.body_en,
                    destinationUrl: automation.destination_url,
                }),
            });
            toast.success('Automação atualizada.');
            setAutomationOpen(false);
            await load(true);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Falha ao guardar a automação.');
        } finally {
            setSubmitting(false);
        }
    };

    const cancelCampaign = async (campaignId: string) => {
        try {
            await api({ method: 'POST', body: JSON.stringify({ action: 'cancel_campaign', campaignId }) });
            toast.success('Envio cancelado.');
            await load(true);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Não foi possível cancelar.');
        }
    };

    const minSchedule = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16);

    return (
        <AdminLayout
            title="Notificações push"
            description="Envios e automações da app Garabandal+"
            isLoading={loading}
        >
            <Toaster richColors position="top-right" />

            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-600">Garabandal+ · App</p>
                        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Centro de notificações</h2>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                            Comunica com todas as pessoas que aceitaram push e acompanha o que é enviado automaticamente.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void load(true)}
                        disabled={refreshing}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60"
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Atualizar
                    </button>
                </div>

                {data?.setupRequired && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold">Configuração da base de dados pendente</p>
                            <p className="mt-1 text-xs leading-5 text-amber-800">A visualização está disponível, mas é preciso aplicar a nova migration antes de criar ou agendar envios.</p>
                        </div>
                    </div>
                )}

                {data && (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard icon={Users} label="Pessoas alcançáveis" value={data.stats.reachablePeople} detail="Contas com pelo menos um dispositivo disponível" />
                        <StatCard icon={Smartphone} label="Dispositivos com push" value={data.stats.reachableDevices} detail={`${data.stats.ios} iOS · ${data.stats.android} Android`} />
                        <StatCard icon={Activity} label="Ativos nos últimos 30 dias" value={data.stats.activeDevices30d} detail={`${data.stats.disabledDevices} dispositivos desligaram todos os avisos`} />
                        <StatCard icon={CheckCircle2} label="Aceites em 30 dias" value={data.stats.acceptedLast30Days} detail="Notificações aceites pelo serviço Expo" />
                    </div>
                )}

                <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <section className="rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Send className="h-[18px] w-[18px] text-slate-500" />
                                    <h3 className="text-base font-semibold text-slate-900">Nova notificação</h3>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">Será enviada a todas as pessoas com push ativo.</p>
                            </div>
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                {data?.stats.reachablePeople || 0} pessoas
                            </span>
                        </div>

                        <div className="space-y-5 p-5 sm:p-6">
                            <label className="block">
                                <span className="text-xs font-semibold text-slate-700">Nome interno</span>
                                <input
                                    value={composer.name}
                                    onChange={(event) => setComposer((current) => ({ ...current, name: event.target.value }))}
                                    maxLength={80}
                                    placeholder="Ex.: Novena de setembro"
                                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5"
                                />
                            </label>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="block">
                                    <span className="flex items-center justify-between text-xs font-semibold text-slate-700"><span>Título · PT</span><span className="font-normal text-slate-400">{composer.titlePt.length}/60</span></span>
                                    <input
                                        value={composer.titlePt}
                                        onChange={(event) => setComposer((current) => ({ ...current, titlePt: event.target.value }))}
                                        maxLength={60}
                                        placeholder="Um convite para hoje"
                                        className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5"
                                    />
                                </label>
                                <label className="block sm:row-span-2">
                                    <span className="flex items-center justify-between text-xs font-semibold text-slate-700"><span>Mensagem · PT</span><span className="font-normal text-slate-400">{composer.bodyPt.length}/180</span></span>
                                    <textarea
                                        value={composer.bodyPt}
                                        onChange={(event) => setComposer((current) => ({ ...current, bodyPt: event.target.value }))}
                                        maxLength={180}
                                        rows={4}
                                        placeholder="Escreve uma mensagem curta e clara."
                                        className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-5 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-xs font-semibold text-slate-700">Abrir na app</span>
                                    <select
                                        value={composer.destinationUrl}
                                        onChange={(event) => setComposer((current) => ({ ...current, destinationUrl: event.target.value }))}
                                        className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                                    >
                                        {PUSH_DESTINATIONS.map((destination) => <option key={destination.value} value={destination.value}>{destination.label}</option>)}
                                    </select>
                                </label>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-slate-50/70">
                                <button
                                    type="button"
                                    onClick={() => setShowEnglish((current) => !current)}
                                    aria-expanded={showEnglish}
                                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-700"
                                >
                                    <span className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-slate-400" />Versão em inglês</span>
                                    <span className="text-xs font-medium text-slate-400">{showEnglish ? 'Ocultar' : 'Obrigatório'}</span>
                                </button>
                                {showEnglish && (
                                    <div className="grid gap-4 border-t border-slate-200 p-4 sm:grid-cols-2">
                                        <label className="block">
                                            <span className="text-xs font-semibold text-slate-700">Title · EN</span>
                                            <input value={composer.titleEn} onChange={(event) => setComposer((current) => ({ ...current, titleEn: event.target.value }))} maxLength={60} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400" />
                                        </label>
                                        <label className="block sm:row-span-2">
                                            <span className="text-xs font-semibold text-slate-700">Message · EN</span>
                                            <textarea value={composer.bodyEn} onChange={(event) => setComposer((current) => ({ ...current, bodyEn: event.target.value }))} maxLength={180} rows={4} className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400" />
                                        </label>
                                        <p className="text-xs leading-5 text-slate-500">A versão inglesa é obrigatória para enviar a todos os dispositivos.</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-4 border-t border-slate-100 pt-5 lg:flex-row lg:items-end lg:justify-between">
                                <div className="flex flex-wrap gap-2">
                                    {(['send_now', 'schedule'] as const).map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setComposer((current) => ({ ...current, mode }))}
                                            className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors ${composer.mode === mode ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            {mode === 'send_now' ? <Zap className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
                                            {mode === 'send_now' ? 'Enviar agora' : 'Agendar'}
                                        </button>
                                    ))}
                                    {composer.mode === 'schedule' && (
                                        <input
                                            type="datetime-local"
                                            min={minSchedule}
                                            value={composer.scheduledFor}
                                            onChange={(event) => setComposer((current) => ({ ...current, scheduledFor: event.target.value }))}
                                            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                                        />
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={requestConfirmation}
                                    disabled={submitting || !data?.stats.reachablePeople}
                                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {composer.mode === 'send_now' ? <Send className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
                                    {composer.mode === 'send_now' ? 'Rever e enviar' : 'Rever agendamento'}
                                </button>
                            </div>
                            {composer.mode === 'schedule' && <p className="text-[11px] leading-5 text-slate-400">Os agendamentos são processados pelo ciclo horário do servidor e podem sair até uma hora depois da hora escolhida.</p>}
                        </div>
                    </section>

                    <aside className="sticky top-24 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-slate-900">Preview</p>
                                <p className="mt-0.5 text-[11px] text-slate-400">Como aparece no telefone</p>
                            </div>
                            <Smartphone className="h-5 w-5 text-slate-400" />
                        </div>
                        <div className="mt-5 rounded-[28px] bg-slate-950 p-3 shadow-xl shadow-slate-900/15">
                            <div className="min-h-[300px] rounded-[20px] bg-gradient-to-b from-slate-700 to-slate-900 px-3 py-5">
                                <p className="text-center text-[10px] font-medium text-white/70">agora</p>
                                <div className="mt-4 rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur">
                                    <div className="flex items-center gap-2">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-amber-400"><BellRing className="h-4 w-4" /></span>
                                        <div className="flex-1"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Garabandal+</p></div>
                                        <span className="text-[10px] text-slate-400">agora</span>
                                    </div>
                                    <p className="mt-2 text-[13px] font-semibold leading-5 text-slate-900">{composer.titlePt || 'Título da notificação'}</p>
                                    <p className="mt-0.5 text-[12px] leading-[18px] text-slate-600">{composer.bodyPt || 'A mensagem aparece aqui, curta e fácil de ler.'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                            <Globe2 className="h-4 w-4 text-slate-400" />
                            Ao tocar, abre: <strong className="font-semibold text-slate-800">{destinationLabel}</strong>
                        </div>
                    </aside>
                </div>

                {automation && (
                    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                            <div>
                                <div className="flex items-center gap-2"><Bot className="h-[18px] w-[18px] text-slate-500" /><h3 className="text-base font-semibold text-slate-900">Automações</h3></div>
                                <p className="mt-1 text-xs text-slate-500">O que o servidor e o próprio telefone enviam sem intervenção manual.</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" />Preferências individuais respeitadas</div>
                        </div>

                        <div className="grid gap-4 p-5 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                            <div className="rounded-xl border border-slate-200 p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${automation.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}><Zap className="h-5 w-5" /></span>
                                        <div><div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-semibold text-slate-900">{automation.name}</h4><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${automation.enabled ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}`}>{automation.enabled ? 'Ativa' : 'Pausada'}</span></div><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">{automation.description}</p></div>
                                    </div>
                                    <button type="button" onClick={() => setAutomationOpen((current) => !current)} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Settings2 className="h-4 w-4" />Configurar</button>
                                </div>
                                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                                    <div className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Ausência</p><p className="mt-1 text-sm font-semibold text-slate-800">{automation.inactivity_days} dias</p></div>
                                    <div className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Hora local</p><p className="mt-1 text-sm font-semibold text-slate-800">{String(automation.send_hour_local).padStart(2, '0')}:00</p></div>
                                    <div className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Intervalo mínimo</p><p className="mt-1 text-sm font-semibold text-slate-800">{automation.cooldown_days} dias</p></div>
                                </div>
                                <p className="mt-3 text-[11px] font-medium text-slate-500">{data?.stats.reactivationAcceptedLast30Days || 0} notificações de reativação aceites nos últimos 30 dias.</p>

                                {automationOpen && (
                                    <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
                                        <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5"><span><span className="block text-sm font-semibold text-slate-800">Automação ativa</span><span className="block text-[11px] text-slate-500">Pausar impede novos envios.</span></span><input type="checkbox" checked={automation.enabled} onChange={(event) => setAutomation({ ...automation, enabled: event.target.checked })} className="h-4 w-4 accent-slate-900" /></label>
                                        <div className="grid gap-3 sm:grid-cols-3">
                                            <label className="text-xs font-semibold text-slate-700">Inatividade (dias)<input type="number" min={1} max={365} value={automation.inactivity_days} onChange={(event) => setAutomation({ ...automation, inactivity_days: Number(event.target.value) })} className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" /></label>
                                            <label className="text-xs font-semibold text-slate-700">Hora local<input type="number" min={0} max={23} value={automation.send_hour_local} onChange={(event) => setAutomation({ ...automation, send_hour_local: Number(event.target.value) })} className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" /></label>
                                            <label className="text-xs font-semibold text-slate-700">Intervalo (dias)<input type="number" min={1} max={730} value={automation.cooldown_days} onChange={(event) => setAutomation({ ...automation, cooldown_days: Number(event.target.value) })} className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" /></label>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <label className="text-xs font-semibold text-slate-700">Título · PT<input value={automation.title_pt} maxLength={60} onChange={(event) => setAutomation({ ...automation, title_pt: event.target.value })} className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" /></label>
                                            <label className="text-xs font-semibold text-slate-700">Title · EN<input value={automation.title_en} maxLength={60} onChange={(event) => setAutomation({ ...automation, title_en: event.target.value })} className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" /></label>
                                            <label className="text-xs font-semibold text-slate-700">Mensagem · PT<textarea value={automation.body_pt} maxLength={180} rows={3} onChange={(event) => setAutomation({ ...automation, body_pt: event.target.value })} className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" /></label>
                                            <label className="text-xs font-semibold text-slate-700">Message · EN<textarea value={automation.body_en} maxLength={180} rows={3} onChange={(event) => setAutomation({ ...automation, body_en: event.target.value })} className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" /></label>
                                        </div>
                                        <label className="block text-xs font-semibold text-slate-700">Abrir na app<select value={automation.destination_url} onChange={(event) => setAutomation({ ...automation, destination_url: event.target.value })} className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-slate-400">{PUSH_DESTINATIONS.map((destination) => <option key={destination.value} value={destination.value}>{destination.label}</option>)}</select></label>
                                        <div className="flex justify-end"><button type="button" onClick={() => void saveAutomation()} disabled={submitting || data?.setupRequired} className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />Guardar alterações</button></div>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-xl border border-slate-200 p-5">
                                <div className="flex items-center justify-between"><div><h4 className="text-sm font-semibold text-slate-900">Lembretes no dispositivo</h4><p className="mt-1 text-xs text-slate-500">Agendados localmente pela app.</p></div><Smartphone className="h-5 w-5 text-slate-400" /></div>
                                <div className="mt-3 divide-y divide-slate-100">
                                    {LOCAL_AUTOMATIONS.map((item) => <div key={item.name} className="flex items-center gap-3 py-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500"><item.icon className="h-4 w-4" /></span><div><p className="text-xs font-semibold text-slate-800">{item.name}</p><p className="mt-0.5 text-[11px] text-slate-500">{item.detail}</p></div><span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Na app</span></div>)}
                                </div>
                                <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2.5 text-[11px] leading-5 text-blue-700">Cada pessoa pode ligar, desligar e escolher a hora destes lembretes. Por isso não entram no histórico de broadcasts.</p>
                            </div>
                        </div>
                    </section>
                )}

                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><h3 className="text-base font-semibold text-slate-900">Histórico e agenda</h3><p className="mt-1 text-xs text-slate-500">Broadcasts criados neste painel.</p></div><Clock3 className="h-5 w-5 text-slate-400" /></div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left">
                            <thead className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400"><tr><th className="px-5 py-3 sm:px-6">Envio</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Alcance</th><th className="px-4 py-3">Data</th><th className="px-5 py-3 text-right sm:px-6">Ação</th></tr></thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {(data?.campaigns || []).map((campaign) => <tr key={campaign.id} className="hover:bg-slate-50/50"><td className="px-5 py-4 sm:px-6"><p className="font-semibold text-slate-900">{campaign.name}</p><p className="mt-0.5 max-w-md truncate text-xs text-slate-500">{campaign.title_pt} · {campaign.body_pt}</p></td><td className="px-4 py-4"><StatusPill status={campaign.status} />{campaign.error_message && <p className="mt-1 max-w-[180px] truncate text-[11px] text-rose-600" title={campaign.error_message}>{campaign.error_message}</p>}</td><td className="px-4 py-4"><p className="font-semibold text-slate-800">{campaign.delivered_count} aceites</p><p className="mt-0.5 text-[11px] text-slate-500">{campaign.recipient_count} pessoas · {campaign.device_count} dispositivos</p></td><td className="px-4 py-4 text-xs text-slate-500">{formatDateTime(campaign.sent_at || campaign.scheduled_for || campaign.created_at)}</td><td className="px-5 py-4 text-right sm:px-6">{campaign.status === 'scheduled' ? <button type="button" onClick={() => void cancelCampaign(campaign.id)} className="text-xs font-semibold text-rose-600 hover:text-rose-700">Cancelar</button> : <span className="text-xs text-slate-300">—</span>}</td></tr>)}
                            </tbody>
                        </table>
                        {(data?.campaigns || []).length === 0 && <div className="flex flex-col items-center justify-center px-6 py-12 text-center"><BellRing className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">Ainda não há broadcasts</p><p className="mt-1 text-xs text-slate-500">O primeiro envio aparecerá aqui com o respetivo resultado.</p></div>}
                    </div>
                </section>
            </div>

            {confirmOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="push-confirm-title">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><AlertTriangle className="h-5 w-5" /></span><button type="button" onClick={() => setConfirmOpen(false)} disabled={submitting} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
                        <h3 id="push-confirm-title" className="mt-4 text-lg font-semibold text-slate-900">{composer.mode === 'send_now' ? 'Confirmar envio para todos' : 'Confirmar agendamento'}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-500">{composer.mode === 'send_now' ? <>Esta notificação será enviada agora para <strong className="font-semibold text-slate-800">{data?.stats.reachablePeople || 0} pessoas</strong> em {data?.stats.reachableDevices || 0} dispositivos.</> : <>Fica agendada para <strong className="font-semibold text-slate-800">{formatDateTime(new Date(composer.scheduledFor).toISOString())}</strong>.</>}</p>
                        <div className="mt-4 rounded-xl bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-900">{composer.titlePt}</p><p className="mt-1 text-xs leading-5 text-slate-600">{composer.bodyPt}</p><p className="mt-2 text-[11px] text-slate-400">Abre em: {destinationLabel}</p></div>
                        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setConfirmOpen(false)} disabled={submitting} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600">Voltar</button><button type="button" onClick={() => void submitCampaign()} disabled={submitting} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60">{submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{composer.mode === 'send_now' ? 'Enviar agora' : 'Agendar'}</button></div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
