"use client";

import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import {
    AlertTriangle,
    Ban,
    CheckCircle,
    Eye,
    EyeOff,
    Flag,
    ShieldCheck,
    Trash2,
} from 'lucide-react';

type ModerationItem = {
    intention: {
        id: string;
        novena_id: string | null;
        text: string;
        is_anonymous: boolean;
        is_hidden: boolean;
        prayer_count: number;
        created_at: string;
    };
    author: {
        id: string;
        name: string | null;
        email: string | null;
        blocked_by_count: number;
    };
    reports: { id: string; reason: string; created_at: string; resolved_at: string | null }[];
    report_count: number;
    open_count: number;
};

const REASON_LABELS: Record<string, string> = {
    offensive: 'Conteúdo ofensivo',
    harassment: 'Assédio ou ódio',
    inappropriate: 'Conteúdo impróprio',
    spam: 'Spam ou publicidade',
    other: 'Outro motivo',
};

const formatDate = (value: string) =>
    new Intl.DateTimeFormat('pt-PT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));

export default function AdminModeracaoPage() {
    const [items, setItems] = useState<ModerationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showResolved, setShowResolved] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const getToken = async () => {
        if (!supabaseBrowser) return null;
        const { data } = await supabaseBrowser.auth.getSession();
        return data.session?.access_token ?? null;
    };

    const load = useCallback(async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const token = await getToken();
            const res = await fetch(`/api/admin/moderation?resolved=${showResolved ? '1' : '0'}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Não foi possível carregar a fila.');
            setItems(json.items || []);
        } catch (error: any) {
            setErrorMsg(error?.message || 'Erro inesperado.');
        } finally {
            setLoading(false);
        }
    }, [showResolved]);

    useEffect(() => {
        load();
    }, [load]);

    const act = async (intentionId: string, action: 'hide' | 'restore' | 'delete' | 'dismiss') => {
        const confirmations: Record<typeof action, string | null> = {
            hide: null,
            restore: 'Repor esta intenção no mural, visível a todos os membros?',
            delete: 'Eliminar permanentemente esta intenção? Esta ação não pode ser anulada.',
            dismiss: 'Arquivar as denúncias sem alterar a intenção?',
        } as Record<typeof action, string | null>;

        const question = confirmations[action];
        if (question && !confirm(question)) return;

        setBusyId(intentionId);
        setErrorMsg(null);
        try {
            const token = await getToken();
            const res = await fetch('/api/admin/moderation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ action, intentionId }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Não foi possível concluir a ação.');
            await load();
        } catch (error: any) {
            setErrorMsg(error?.message || 'Erro inesperado.');
        } finally {
            setBusyId(null);
        }
    };

    const openCount = items.reduce((total, item) => total + item.open_count, 0);

    return (
        <AdminLayout>
            <div className="space-y-6 pb-20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Moderação</h1>
                        <p className="text-slate-500">
                            Denúncias do mural de intenções. Uma intenção é escondida automaticamente
                            ao fim de 3 denúncias distintas.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowResolved((value) => !value)}
                        className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-3 md:py-2 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-sm"
                    >
                        {showResolved ? <Flag className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        {showResolved ? 'Ver apenas pendentes' : 'Incluir arquivadas'}
                    </button>
                </div>

                {/* Resumo */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                                <Flag className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{openCount}</p>
                                <p className="text-sm text-slate-500">Denúncias por rever</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                                <EyeOff className="w-5 h-5 text-rose-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">
                                    {items.filter((item) => item.intention.is_hidden).length}
                                </p>
                                <p className="text-sm text-slate-500">Escondidas do mural</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                <ShieldCheck className="w-5 h-5 text-slate-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{items.length}</p>
                                <p className="text-sm text-slate-500">Intenções assinaladas</p>
                            </div>
                        </div>
                    </div>
                </div>

                {errorMsg ? (
                    <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3">
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                        <p className="text-sm">{errorMsg}</p>
                    </div>
                ) : null}

                {/* Fila */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 flex flex-col items-center shadow-sm">
                            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-4" />
                            <p>A carregar denúncias...</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center text-slate-500 flex flex-col items-center gap-4 shadow-sm">
                            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
                                <ShieldCheck className="w-8 h-8 text-emerald-500" />
                            </div>
                            <div>
                                <h3 className="text-slate-900 font-bold mb-1">Nada por rever</h3>
                                <p className="text-sm">Não há denúncias pendentes no mural de intenções.</p>
                            </div>
                        </div>
                    ) : (
                        items.map((item) => {
                            const busy = busyId === item.intention.id;

                            return (
                                <div
                                    key={item.intention.id}
                                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                                            <Flag className="w-3.5 h-3.5" />
                                            {item.open_count > 0
                                                ? `${item.open_count} por rever`
                                                : `${item.report_count} arquivadas`}
                                        </span>
                                        {item.intention.is_hidden ? (
                                            <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                                                <EyeOff className="w-3.5 h-3.5" />
                                                Escondida
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                                                <Eye className="w-3.5 h-3.5" />
                                                Visível
                                            </span>
                                        )}
                                        {item.author.blocked_by_count > 0 ? (
                                            <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                                                <Ban className="w-3.5 h-3.5" />
                                                Bloqueado por {item.author.blocked_by_count}
                                            </span>
                                        ) : null}
                                    </div>

                                    <blockquote className="border-l-4 border-slate-200 pl-4 text-slate-800 leading-relaxed whitespace-pre-wrap">
                                        {item.intention.text}
                                    </blockquote>

                                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
                                        <span>
                                            <span className="text-slate-400">Autor:</span>{' '}
                                            {item.author.name || 'Desconhecido'}
                                            {item.intention.is_anonymous ? ' (publicou como anónimo)' : ''}
                                        </span>
                                        {item.author.email ? (
                                            <span>
                                                <span className="text-slate-400">Email:</span> {item.author.email}
                                            </span>
                                        ) : null}
                                        <span>
                                            <span className="text-slate-400">Publicada:</span>{' '}
                                            {formatDate(item.intention.created_at)}
                                        </span>
                                    </div>

                                    <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                            Motivos denunciados
                                        </p>
                                        <ul className="space-y-1.5">
                                            {item.reports.map((report) => (
                                                <li
                                                    key={report.id}
                                                    className="flex flex-wrap items-center gap-2 text-sm text-slate-700"
                                                >
                                                    <span className="font-medium">
                                                        {REASON_LABELS[report.reason] || report.reason}
                                                    </span>
                                                    <span className="text-slate-400">
                                                        {formatDate(report.created_at)}
                                                    </span>
                                                    {report.resolved_at ? (
                                                        <span className="text-emerald-600 text-xs font-semibold">
                                                            arquivada
                                                        </span>
                                                    ) : null}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {item.intention.is_hidden ? (
                                            <button
                                                disabled={busy}
                                                onClick={() => act(item.intention.id, 'restore')}
                                                className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium disabled:opacity-50"
                                            >
                                                <Eye className="w-4 h-4" />
                                                Repor no mural
                                            </button>
                                        ) : (
                                            <button
                                                disabled={busy}
                                                onClick={() => act(item.intention.id, 'hide')}
                                                className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors text-sm font-medium disabled:opacity-50"
                                            >
                                                <EyeOff className="w-4 h-4" />
                                                Esconder
                                            </button>
                                        )}
                                        <button
                                            disabled={busy}
                                            onClick={() => act(item.intention.id, 'dismiss')}
                                            className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium disabled:opacity-50"
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                            Sem problema
                                        </button>
                                        <button
                                            disabled={busy}
                                            onClick={() => act(item.intention.id, 'delete')}
                                            className="inline-flex items-center gap-2 bg-white border border-rose-200 text-rose-700 px-4 py-2 rounded-xl hover:bg-rose-50 transition-colors text-sm font-medium disabled:opacity-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
