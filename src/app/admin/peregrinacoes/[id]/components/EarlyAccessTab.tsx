'use client';

import { useEffect, useState } from 'react';
import { Rocket, Lock, Copy, RefreshCw, Trash2, Link2, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabaseBrowser } from '../../../../../lib/supabase-browser';

interface Props {
    form: any;
    setForm: (updater: (prev: any) => any) => void;
    pilgrimageId: string;
    onSave: () => Promise<void> | void;
}

const toLocalInput = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromLocalInput = (value: string) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export default function EarlyAccessTab({ form, setForm, pilgrimageId, onSave }: Props) {
    const early = form?.pricing_config?.early_access || {};
    const enabled: boolean = early.enabled === true;
    const launchIso: string | null = early.public_launch_at ?? null;
    const slug: string = form?.slug || '';

    const [code, setCode] = useState<string | null>(null);
    const [loadingCode, setLoadingCode] = useState(true);
    const [busy, setBusy] = useState(false);

    const authFetch = async (input: string, init: RequestInit = {}) => {
        const { data: sessionData } = await supabaseBrowser!.auth.getSession();
        const token = sessionData.session?.access_token;
        return fetch(input, {
            ...init,
            headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
    };

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const res = await authFetch(`/api/admin/pilgrimages/${pilgrimageId}/early-access-code`);
                const body = await res.json().catch(() => ({}));
                if (active) setCode(body?.code ?? null);
            } finally {
                if (active) setLoadingCode(false);
            }
        })();
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pilgrimageId]);

    const patchEarly = (patch: Record<string, unknown>) => {
        setForm((prev) => ({
            ...prev,
            pricing_config: {
                ...(prev.pricing_config || {}),
                early_access: { ...(prev.pricing_config?.early_access || {}), ...patch },
            },
        }));
    };

    const codeAction = async (action: 'generate' | 'clear') => {
        setBusy(true);
        try {
            const res = await authFetch(`/api/admin/pilgrimages/${pilgrimageId}/early-access-code`, {
                method: 'POST',
                body: JSON.stringify({ action }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body?.error || 'Erro');
            setCode(body?.code ?? null);
            toast.success(action === 'clear' ? 'Código removido' : 'Código gerado');
        } catch (e: any) {
            toast.error(e?.message || 'Erro ao atualizar código');
        } finally {
            setBusy(false);
        }
    };

    const copy = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success(`${label} copiado`);
        } catch {
            toast.error('Não foi possível copiar');
        }
    };

    const shareLink = typeof window !== 'undefined' && slug ? `${window.location.origin}/peregrinacoes/${slug}` : '';
    const launchDate = launchIso ? new Date(launchIso) : null;
    const isFutureLaunch = !!launchDate && launchDate.getTime() > Date.now();
    const fullyActive = enabled && isFutureLaunch && !!code;

    const quickSet = (hours: number) => patchEarly({ public_launch_at: new Date(Date.now() + hours * 3600 * 1000).toISOString() });

    return (
        <div className="space-y-6">
            {/* Intro */}
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white">
                <div className="flex items-center gap-2 text-amber-300">
                    <Rocket className="h-5 w-5" />
                    <span className="text-sm font-black uppercase tracking-wider">Acesso antecipado</span>
                </div>
                <p className="mt-2 max-w-2xl text-sm text-white/70">
                    Publique a peregrinação de forma privada: ela fica escondida de todas as listagens públicas e do Google, e
                    a página só abre com um código. Partilhe o código no grupo de WhatsApp para dar acesso exclusivo antes do
                    lançamento público. No momento definido abaixo, tudo abre ao público automaticamente.
                </p>
            </div>

            {/* Slug guard */}
            {!slug && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                    <p className="text-sm font-medium">
                        Defina um <strong>slug</strong> na aba “Informação Geral” e guarde antes de ativar o acesso antecipado —
                        o link privado depende dele.
                    </p>
                </div>
            )}

            {/* Enable + schedule */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <label className="flex cursor-pointer items-center justify-between gap-4">
                    <span>
                        <span className="block text-sm font-bold text-slate-900">Ativar acesso antecipado</span>
                        <span className="block text-xs text-slate-500">Esconde a peregrinação do público e ativa o portão de código.</span>
                    </span>
                    <button
                        type="button"
                        onClick={() => patchEarly({ enabled: !enabled })}
                        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                        aria-pressed={enabled}
                    >
                        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? 'left-6' : 'left-1'}`} />
                    </button>
                </label>

                <div className="mt-6 border-t border-slate-100 pt-5">
                    <label className="mb-2 block text-sm font-bold text-slate-900">Abertura ao público</label>
                    <input
                        type="datetime-local"
                        value={toLocalInput(launchIso)}
                        onChange={(e) => patchEarly({ public_launch_at: fromLocalInput(e.target.value) })}
                        className="w-full max-w-sm rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-amber-500 focus:outline-none"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => quickSet(48)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100">Público daqui a 48h</button>
                        <button type="button" onClick={() => quickSet(72)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100">72h</button>
                        <button type="button" onClick={() => quickSet(24 * 7)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100">1 semana</button>
                    </div>
                    {launchDate && (
                        <p className="mt-3 text-xs text-slate-500">
                            {isFutureLaunch
                                ? <>Abre ao público em <strong>{launchDate.toLocaleString('pt-PT')}</strong>.</>
                                : <>Data no passado — a página já estaria pública.</>}
                        </p>
                    )}
                </div>
            </div>

            {/* Access code */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="mb-4 flex items-center gap-2 text-slate-900">
                    <Lock className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-bold">Código de acesso</span>
                </div>

                {loadingCode ? (
                    <div className="h-14 w-full animate-pulse rounded-xl bg-slate-100" />
                ) : code ? (
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 px-5 py-3 font-mono text-2xl font-black tracking-[0.3em] text-slate-900">
                            {code}
                        </div>
                        <button type="button" onClick={() => copy(code, 'Código')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Copy className="h-3.5 w-3.5" /> Copiar código</button>
                        {shareLink && (
                            <button type="button" onClick={() => copy(shareLink, 'Link')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Link2 className="h-3.5 w-3.5" /> Copiar link</button>
                        )}
                        <button type="button" disabled={busy} onClick={() => codeAction('generate')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" /> Gerar novo</button>
                        <button type="button" disabled={busy} onClick={() => codeAction('clear')} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Remover</button>
                    </div>
                ) : (
                    <button type="button" disabled={busy} onClick={() => codeAction('generate')} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-md hover:shadow-lg disabled:opacity-50">
                        <Sparkles className="h-4 w-4" /> Gerar código de acesso
                    </button>
                )}
                <p className="mt-3 text-xs text-slate-500">O código é guardado em segurança no servidor e nunca é exposto ao público. Regenerar invalida o anterior.</p>
            </div>

            {/* Status + save reminder */}
            <div className={`flex items-start gap-3 rounded-2xl border p-4 ${fullyActive ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                {fullyActive ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />}
                <div className="text-sm">
                    {fullyActive ? (
                        <p><strong>Tudo pronto.</strong> A página está privada e abre ao público em {launchDate!.toLocaleString('pt-PT')}. Não esqueça de <strong>Guardar</strong> para persistir o agendamento.</p>
                    ) : (
                        <p>Para ativar, precisa de: {enabled ? '✓' : '✗'} ativação · {isFutureLaunch ? '✓' : '✗'} data futura · {code ? '✓' : '✗'} código. Depois clique <strong>Guardar</strong>.</p>
                    )}
                </div>
            </div>

            <div className="flex justify-end">
                <button type="button" onClick={() => onSave()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800">
                    <CheckCircle2 className="h-4 w-4" /> Guardar agendamento
                </button>
            </div>
        </div>
    );
}
