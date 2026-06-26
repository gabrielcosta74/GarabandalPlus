"use client";

import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../../../components/admin/AdminLayout';
import { getBrowserAccessToken } from '../../../../lib/supabase-browser';
import { Toaster, toast } from 'sonner';
import {
    HeartHandshake, Globe, CalendarRange, MapPin, Footprints,
    GraduationCap, ShieldCheck, MessageSquareHeart, Phone, Mail,
    Hash, Loader2, Users,
} from 'lucide-react';

type Membro = {
    nome: string | null;
    email: string | null;
    telefone: string | null;
    numero_socio: number | null;
    country: string | null;
};

type Application = {
    id: string;
    membro_id: string;
    status: 'candidato' | 'nao_interessado';
    linguas: string[];
    disponibilidade: string | null;
    esteve_garabandal: string | null;
    condicao_fisica: string | null;
    compromisso_formacao: boolean;
    compromisso_colete: boolean;
    motivacao: string | null;
    admin_estado: 'novo' | 'em_analise' | 'aceite' | 'recusado';
    admin_notas: string | null;
    created_at: string;
    membros: Membro | null;
};

const LANG_LABEL: Record<string, string> = {
    pt: 'Português', es: 'Espanhol', en: 'Inglês', fr: 'Francês', it: 'Italiano', de: 'Alemão', outra: 'Outra',
};
const ESTEVE_LABEL: Record<string, string> = {
    varias: 'Sim, várias vezes', uma: 'Sim, uma vez', nao: 'Ainda não',
};
const FISICA_LABEL: Record<string, string> = {
    sem_limitacoes: 'Sem limitações', algumas_limitacoes: 'Algumas limitações', dificuldade: 'Dificuldade em subidas',
};
const ESTADO_LABEL: Record<Application['admin_estado'], { label: string; color: string; bg: string }> = {
    novo: { label: 'Novo', color: '#1d4ed8', bg: '#dbeafe' },
    em_analise: { label: 'Em análise', color: '#b45309', bg: '#fef3c7' },
    aceite: { label: 'Aceite', color: '#15803d', bg: '#dcfce7' },
    recusado: { label: 'Recusado', color: '#b91c1c', bg: '#fee2e2' },
};

const formatDate = (v: string) => new Date(v).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });

export default function AdminVoluntariadoPage() {
    const [apps, setApps] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);

    const load = async () => {
        try {
            const token = await getBrowserAccessToken();
            const res = await fetch('/api/admin/voluntariado', {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store',
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || 'Falha ao carregar candidaturas.');
            setApps(data.applications || []);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const updateApp = async (id: string, patch: Partial<Pick<Application, 'admin_estado' | 'admin_notas'>>) => {
        setSavingId(id);
        // optimistic
        setApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
        try {
            const token = await getBrowserAccessToken();
            const res = await fetch('/api/admin/voluntariado', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ id, ...patch }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => null);
                throw new Error(d?.error || 'Falha ao atualizar.');
            }
            toast.success('Atualizado.');
        } catch (e: any) {
            toast.error(e.message);
            load();
        } finally {
            setSavingId(null);
        }
    };

    const candidatos = useMemo(() => apps.filter((a) => a.status === 'candidato'), [apps]);
    const semInteresse = useMemo(() => apps.filter((a) => a.status === 'nao_interessado').length, [apps]);

    return (
        <AdminLayout title="Voluntariado em Garabandal" isLoading={loading}>
            <Toaster position="top-center" richColors />

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                <StatPill icon={HeartHandshake} label="Candidatos" value={candidatos.length} />
                <StatPill icon={Users} label="Sem interesse" value={semInteresse} muted />
            </div>

            {candidatos.length === 0 && !loading && (
                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    Ainda não há candidaturas de voluntários.
                </div>
            )}

            <div style={{ display: 'grid', gap: 16 }}>
                {candidatos.map((app) => {
                    const m = app.membros;
                    const estado = ESTADO_LABEL[app.admin_estado];
                    return (
                        <div key={app.id} style={{ background: '#fff', borderRadius: 18, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                            {/* Header */}
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>{m?.nome || 'Membro'}</div>
                                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 6, fontSize: 13, color: '#64748b' }}>
                                        {m?.numero_socio != null && <span style={iconRow}><Hash size={13} /> Sócio {m.numero_socio}</span>}
                                        {m?.email && !m.email.endsWith('@sem-email.local') && <span style={iconRow}><Mail size={13} /> {m.email}</span>}
                                        {m?.telefone && <span style={iconRow}><Phone size={13} /> {m.telefone}</span>}
                                        {m?.country && <span>{m.country}</span>}
                                    </div>
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 999, color: estado.color, background: estado.bg }}>
                                    {estado.label}
                                </span>
                            </div>

                            {/* Answers */}
                            <div style={{ padding: 20, display: 'grid', gap: 14 }}>
                                <Answer icon={Globe} label="Línguas" value={app.linguas?.map((l) => LANG_LABEL[l] || l).join(', ') || '—'} />
                                <Answer icon={CalendarRange} label="Disponibilidade" value={app.disponibilidade || '—'} />
                                <Answer icon={MapPin} label="Já esteve em Garabandal" value={app.esteve_garabandal ? (ESTEVE_LABEL[app.esteve_garabandal] || app.esteve_garabandal) : '—'} />
                                <Answer icon={Footprints} label="Condição física" value={app.condicao_fisica ? (FISICA_LABEL[app.condicao_fisica] || app.condicao_fisica) : '—'} />
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <Commit ok={app.compromisso_formacao} icon={GraduationCap} label="Formação obrigatória" />
                                    <Commit ok={app.compromisso_colete} icon={ShieldCheck} label="Colete & orientações" />
                                </div>
                                {app.motivacao && <Answer icon={MessageSquareHeart} label="Motivação" value={app.motivacao} />}
                                <div style={{ fontSize: 12, color: '#94a3b8' }}>Candidatura de {formatDate(app.created_at)}</div>
                            </div>

                            {/* Admin controls */}
                            <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Estado:</span>
                                {(Object.keys(ESTADO_LABEL) as Application['admin_estado'][]).map((key) => {
                                    const active = app.admin_estado === key;
                                    const cfg = ESTADO_LABEL[key];
                                    return (
                                        <button key={key} type="button" disabled={savingId === app.id}
                                            onClick={() => updateApp(app.id, { admin_estado: key })}
                                            style={{
                                                fontSize: 12.5, fontWeight: 700, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                                                border: `1.5px solid ${active ? cfg.color : '#e2e8f0'}`,
                                                color: active ? cfg.color : '#64748b',
                                                background: active ? cfg.bg : '#fff',
                                            }}>
                                            {cfg.label}
                                        </button>
                                    );
                                })}
                                {savingId === app.id && <Loader2 size={15} className="vs-spin" color="#94a3b8" />}
                            </div>
                        </div>
                    );
                })}
            </div>
            <style>{`.vs-spin{animation:vs-spin .8s linear infinite}@keyframes vs-spin{to{transform:rotate(360deg)}}`}</style>
        </AdminLayout>
    );
}

const iconRow: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5 };

function StatPill({ icon: Icon, label, value, muted }: { icon: any; label: string; value: number; muted?: boolean }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 14,
            background: '#fff', border: '1px solid #e2e8f0', minWidth: 160,
        }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: muted ? '#f1f5f9' : 'rgba(15,76,129,0.08)' }}>
                <Icon size={20} color={muted ? '#94a3b8' : '#0f4c81'} />
            </div>
            <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>{label}</div>
            </div>
        </div>
    );
}

function Answer({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
    return (
        <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 9, background: 'rgba(15,76,129,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={17} color="#0f4c81" />
            </div>
            <div>
                <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: 14.5, color: '#0f172a', marginTop: 2, whiteSpace: 'pre-wrap' }}>{value}</div>
            </div>
        </div>
    );
}

function Commit({ ok, icon: Icon, label }: { ok: boolean; icon: any; label: string }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700,
            padding: '7px 12px', borderRadius: 999,
            color: ok ? '#15803d' : '#b91c1c', background: ok ? '#dcfce7' : '#fee2e2',
        }}>
            <Icon size={14} /> {label} {ok ? '✓' : '✗'}
        </span>
    );
}
