"use client";

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import {
  ArrowUpRight,
  CheckCircle,
  Database,
  Eye,
  Filter,
  Mail,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Search,
  Send,
  Target,
  Users,
  Activity,
  Zap,
  MoreVertical,
  Calendar,
  Layers,
  ChevronRight,
  BarChart2
} from 'lucide-react';
import { toast, Toaster } from 'sonner';

type View = 'overview' | 'contacts' | 'segments' | 'campaigns' | 'funnels' | 'scheduled' | 'outbox' | 'templates' | 'tasks' | 'analytics';

type MarketingAdminClientProps = {
  view: View;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value || 0);

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const stageLabel = (stage?: string) => {
  const labels: Record<string, string> = {
    lead: 'Lead',
    prospect: 'Prospecto',
    pilgrim_lead: 'Lead peregrinação',
    pilgrim: 'Peregrino',
    donor: 'Doador',
    member: 'Membro',
    supporter: 'Apoiador',
    suppressed: 'Suprimido',
  };
  return labels[stage || ''] || stage || '—';
};

async function getToken() {
  if (!supabaseBrowser) throw new Error('Supabase não disponível.');
  const { data } = await supabaseBrowser.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão expirada.');
  return token;
}

async function api(path: string, init?: RequestInit) {
  const token = await getToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Erro no pedido.');
  return body;
}

function StatCard({ label, value, icon: Icon, trend, color = 'blue' }: { label: string; value: string | number; icon: any; trend?: string; color?: 'blue' | 'emerald' | 'amber' | 'purple' }) {
  const bgColors = {
    blue: 'from-blue-500/10 to-transparent text-blue-600 ring-blue-500/20',
    emerald: 'from-emerald-500/10 to-transparent text-emerald-600 ring-emerald-500/20',
    amber: 'from-amber-500/10 to-transparent text-amber-600 ring-amber-500/20',
    purple: 'from-purple-500/10 to-transparent text-purple-600 ring-purple-500/20',
  };

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      className="relative overflow-hidden rounded-3xl border border-slate-200/50 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all"
    >
      <div className={`absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br blur-3xl opacity-60 ${bgColors[color].split(' ')[0]}`} />

      <div className="relative z-10 flex items-start justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl font-black tracking-tighter text-slate-900">{value}</span>
            {trend && <span className={`text-xs font-bold ${color === 'emerald' ? 'text-emerald-500' : 'text-blue-500'}`}>{trend}</span>}
          </div>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 shadow-sm ${bgColors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const isHot = score >= 80;
  const isWarm = score >= 50;

  if (isHot) {
    return (
      <span className="relative inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-black text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]">
        <span className="absolute -right-1 -top-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-300"></span>
        </span>
        <Zap className="h-3 w-3" fill="currentColor" />
        {score}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ring-1 ${isWarm ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-slate-50 text-slate-600 ring-slate-200'}`}>
      {score}
    </span>
  );
}

function StatusPill({ label, tone = 'slate' }: { label: string; tone?: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    purple: 'bg-purple-50 text-purple-700 ring-purple-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    slate: 'bg-slate-50 text-slate-600 ring-slate-200',
  };
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ring-1 shadow-sm ${colors[tone] || colors.slate}`}>{label}</span>;
}

const platformNav: Array<{ view: View; label: string; href: string; icon: any }> = [
  { view: 'overview', label: 'Dashboard', href: '/admin/marketing', icon: BarChart2 },
  { view: 'contacts', label: 'CRM / Audiência', href: '/admin/marketing/contacts', icon: Users },
  { view: 'segments', label: 'Segmentos', href: '/admin/marketing/segments', icon: Layers },
  { view: 'funnels', label: 'Automações', href: '/admin/marketing/funnels', icon: Zap },
  { view: 'campaigns', label: 'Campanhas', href: '/admin/marketing/campaigns', icon: Send },
  { view: 'scheduled', label: 'Agenda', href: '/admin/marketing/scheduled', icon: Calendar },
  { view: 'outbox', label: 'Enviados', href: '/admin/marketing/outbox', icon: Mail },
  { view: 'templates', label: 'Templates', href: '/admin/marketing/templates', icon: Eye },
  { view: 'tasks', label: 'Tarefas', href: '/admin/marketing/tasks', icon: CheckCircle },
];

const campaignTemplateOptions = [
  { key: 'brochure_followup_1', label: 'Brochura - follow-up inicial' },
  { key: 'pilgrimage_testimony', label: 'Peregrinação - testemunho' },
  { key: 'abandoned_registration_1', label: 'Inscrição abandonada - recuperação' },
  { key: 'waitlist_open_spot', label: 'Waitlist - vaga disponível' },
  { key: 'donor_to_member', label: 'Doador para membro' },
  { key: 'membership_renewal', label: 'Renovação de membro' },
  { key: 'member_referral_activation', label: 'Membro - ativar partilha' },
  { key: 'share_mission', label: 'Partilhar missão' },
];

export default function MarketingAdminClient({ view: initialView }: MarketingAdminClientProps) {
  const [view, setView] = useState<View>(initialView);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [data, setData] = useState<any>(null);

  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('');
  const [scheduleBucket, setScheduleBucket] = useState('all');
  const [outboxStatus, setOutboxStatus] = useState('all');
  const [outboxSearch, setOutboxSearch] = useState('');
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    segment_slug: 'hot-pilgrimage-leads',
    template_key: 'brochure_followup_1',
    subject: '',
    body: '',
  });
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [previewLanguage, setPreviewLanguage] = useState<'pt' | 'en'>('pt');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Client-side routing interceptor for blazing fast UX
  const navigateTo = (newView: View, href: string) => {
    setView(newView);
    window.history.pushState({}, '', href);
  };

  const load = async (silent = false) => {
    if (!silent) {
      if (!data) setLoading(true);
      setIsFetching(true);
    }

    try {
      const endpoint =
        view === 'overview' || view === 'analytics'
          ? '/api/admin/marketing/overview'
          : view === 'contacts'
            ? `/api/admin/marketing/contacts?${new URLSearchParams({ ...(search ? { search } : {}), ...(segment ? { segment } : {}) }).toString()}`
            : view === 'scheduled'
              ? `/api/admin/marketing/scheduled?${new URLSearchParams({ ...(scheduleBucket !== 'all' ? { bucket: scheduleBucket } : {}) }).toString()}`
              : view === 'outbox'
                ? `/api/admin/marketing/outbox?${new URLSearchParams({ ...(outboxStatus !== 'all' ? { status: outboxStatus } : {}), ...(outboxSearch ? { q: outboxSearch } : {}) }).toString()}`
                : view === 'templates'
                  ? '/api/admin/marketing/templates'
            : `/api/admin/marketing/${view}`;

      const result = await api(endpoint);
      setData(result);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar marketing.');
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    if (view !== 'contacts') return;
    const timer = setTimeout(() => load(true), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, segment]);

  useEffect(() => {
    if (view !== 'scheduled') return;
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleBucket]);

  useEffect(() => {
    if (view !== 'outbox') return;
    const timer = setTimeout(() => load(true), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outboxStatus, outboxSearch]);

  const syncContacts = async () => {
    try {
      const result = await api('/api/admin/marketing/sync-contacts', { method: 'POST', body: '{}' });
      toast.success(`Sincronizados ${result.persistedContacts} contactos.`);
      await load(true);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao sincronizar.');
    }
  };

  const createCampaign = async () => {
    try {
      await api('/api/admin/marketing/campaigns', {
        method: 'POST',
        body: JSON.stringify(campaignForm),
      });
      setCampaignForm({ name: '', segment_slug: 'hot-pilgrimage-leads', template_key: 'brochure_followup_1', subject: '', body: '' });
      toast.success('Campanha criada com sucesso!');
      await load(true);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao criar campanha.');
    }
  };

  const updateTask = async (id: string, status: string) => {
    try {
      await api('/api/admin/marketing/tasks', { method: 'PATCH', body: JSON.stringify({ id, status }) });
      await load(true);
    } catch (error: any) { toast.error(error?.message || 'Erro ao atualizar tarefa.'); }
  };

  const updateFunnel = async (funnel: any, status: string) => {
    try {
      const result = await api('/api/admin/marketing/funnels', {
        method: 'PATCH',
        body: JSON.stringify({ id: funnel.id, status }),
      });
      if (status === 'active') {
        toast.success(`Automação ativada. ${result.preparation?.enrolled || 0} na fila.`);
      } else {
        toast.success('Automação pausada.');
      }
      await load(true);
    } catch (error: any) { toast.error('Erro ao atualizar automação.'); }
  };

  const prepareAutomations = async (funnelId?: string) => {
    try {
      const result = await api('/api/admin/marketing/automations/prepare', {
        method: 'POST',
        body: JSON.stringify(funnelId ? { funnel_id: funnelId } : {}),
      });
      toast.success(`${result.totals?.enrolled || 0} novos emails colocados na fila.`);
      await load(true);
    } catch (error: any) { toast.error('Erro ao processar fila.'); }
  };

  const updateEnrollment = async (id: string, action: 'pause' | 'cancel' | 'resume' | 'send-now') => {
    try {
      await api(`/api/admin/marketing/enrollments/${id}/${action}`, { method: 'POST', body: '{}' });
      toast.success('Ação concluída.');
      await load(true);
    } catch (error: any) { toast.error('Erro ao atualizar follow-up.'); }
  };
  const rescheduleEnrollment = async (id: string) => {
    const value = window.prompt('Nova data/hora para este follow-up (formato: 2026-04-24 15:30)');
    if (!value) return;
    const parsed = new Date(value.replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime())) {
      toast.error('Data inválida.');
      return;
    }
    try {
      await api(`/api/admin/marketing/enrollments/${id}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({ next_run_at: parsed.toISOString() }),
      });
      toast.success('Follow-up reagendado.');
      await load(true);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao reagendar follow-up.');
    }
  };

  const previewEmailTemplate = async (key: string) => {
    setPreviewLoading(true);
    try {
      const result = await api(`/api/admin/marketing/templates/${key}/preview`, { method: 'POST', body: JSON.stringify({ language: previewLanguage }) });
      setPreviewTemplate({ key, ...result.preview });
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao gerar preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const sendDryRun = async (campaignId: string) => {
    try {
      const result = await api(`/api/admin/marketing/campaigns/${campaignId}/send`, {
        method: 'POST',
        body: JSON.stringify({ dryRun: true }),
      });
      toast.success(`${result.eligible} contactos elegíveis.`);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao testar envio.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 px-6 pb-12">
      <Toaster richColors position="top-center" />

      <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row lg:gap-8 pt-6">

        {/* Dynamic Sidebar Navigation */}
        <aside className="mb-8 w-full shrink-0 lg:mb-0 lg:w-64">
          <div className="sticky top-6 rounded-3xl bg-slate-900 p-4 shadow-2xl shadow-slate-900/20">
            <div className="mb-6 px-4 pt-2">
              <a href="/admin/dashboard" className="mb-6 flex w-fit items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 transition-colors hover:bg-white/20 hover:text-white">
                <ChevronRight className="h-3 w-3 rotate-180" />
                Voltar ao Admin
              </a>
              <h1 className="text-xl font-black tracking-tight text-white">Centro de Comando</h1>
              <p className="mt-1 text-xs font-medium text-slate-400">Garabandal Growth Engine</p>
            </div>

            <nav className="flex flex-col gap-1">
              {platformNav.map((item) => {
                const Icon = item.icon;
                const active = item.view === view;
                return (
                  <button
                    key={item.view}
                    onClick={() => navigateTo(item.view, item.href)}
                    className={`relative flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition-all ${
                      active ? 'text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="active-sidebar-tab"
                        className="absolute inset-0 z-0 rounded-2xl bg-white/10 ring-1 ring-white/20"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <Icon className="relative z-10 h-5 w-5" />
                    <span className="relative z-10">{item.label}</span>
                    {active && <ChevronRight className="relative z-10 ml-auto h-4 w-4 opacity-50" />}
                  </button>
                );
              })}
            </nav>

            <div className="mt-8 border-t border-white/10 px-4 pt-6 pb-2">
              <button onClick={syncContacts} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-white/10">
                <Database className="h-3.5 w-3.5" />
                Sincronizar CRM
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">

          {/* Top Actions & Breadcrumb */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">
                {platformNav.find(n => n.view === view)?.label}
              </h2>
              {isFetching && !loading && (
                <div className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-400">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Atualizando...
                </div>
              )}
            </div>

            <div className="flex gap-3">
              {(view === 'funnels' || view === 'scheduled') && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => prepareAutomations()}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-500/25 transition-colors hover:bg-emerald-600"
                >
                  <PlayCircle className="h-5 w-5" />
                  Processar Fila
                </motion.button>
              )}
              <button onClick={() => load(false)} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 shadow-sm">
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {loading && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-64 items-center justify-center rounded-3xl border border-slate-200/50 bg-white/50 backdrop-blur-md">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
                  <p className="text-sm font-bold text-slate-500">A processar dados...</p>
                </div>
              </motion.div>
            )}

            {/* OVERVIEW BENTO GRID */}
            {!loading && (view === 'overview' || view === 'analytics') && data && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="space-y-8"
              >
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Total CRM" value={data.stats.total_contacts} icon={Users} color="blue" trend="+12 hoje" />
                  <StatCard label="Inscritos Mailing" value={data.stats.marketable_contacts} icon={Mail} color="purple" />
                  <StatCard label="Hot Leads" value={data.stats.hot_pilgrimage_leads} icon={Zap} color="emerald" trend="Alta conversão" />
                  <StatCard label="Pipeline Total" value={formatCurrency(data.stats.total_value)} icon={BarChart2} color="amber" />
                </div>

                <div className="grid gap-8 xl:grid-cols-3">
                  <div className="xl:col-span-2 space-y-8">
                    {/* Hot Leads Bento Box */}
                    <section className="rounded-3xl border border-slate-200/60 bg-white p-8 shadow-sm">
                      <div className="mb-6 flex items-center justify-between">
                        <h2 className="text-xl font-black text-slate-900">Leads Focados (High Priority)</h2>
                        <button onClick={() => navigateTo('contacts', '/admin/marketing/contacts')} className="text-sm font-bold text-blue-600 hover:text-blue-700">Ver todos</button>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        {(data.hotLeads || []).slice(0,6).map((contact: any) => (
                          <div key={contact.id} className="group relative flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:-translate-y-1 hover:bg-white hover:shadow-lg hover:shadow-slate-200/50 hover:border-slate-200">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-black text-white shadow-sm">
                                {(contact.display_name || 'C')[0]}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">{contact.display_name}</p>
                                <p className="text-xs text-slate-500">{contact.normalized_email || contact.normalized_phone}</p>
                              </div>
                            </div>
                            <ScoreBadge score={contact.lead_score} />

                            <button className="absolute right-4 opacity-0 transition-opacity group-hover:opacity-100 text-slate-400 hover:text-slate-900">
                              <ArrowUpRight className="h-5 w-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  {/* Activity Timeline */}
                  <section className="rounded-3xl border border-slate-200/60 bg-slate-900 p-8 text-white shadow-lg">
                    <h2 className="mb-8 text-xl font-black">Sinais Vitais</h2>
                    <div className="relative space-y-6 before:absolute before:inset-y-0 before:left-[11px] before:w-[2px] before:bg-white/10">
                      {(data.recentEvents || []).map((event: any, i: number) => (
                        <div key={`${event.source_table}-${event.source_id}-${event.event_type}`} className="relative flex items-start gap-4">
                          <div className="relative z-10 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 ring-4 ring-slate-900">
                            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                          </div>
                          <div>
                            <p className="font-bold text-white">{event.title}</p>
                            <p className="mt-1 text-sm text-slate-400">
                              <span className="text-slate-200">{event.contact_name}</span> · {formatDateTime(event.occurred_at)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </motion.div>
            )}

            {/* CONTACTS / CRM */}
            {!loading && view === 'contacts' && data && (
              <motion.div
                key="contacts"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm md:flex-row md:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Procurar leads, emails..." className="w-full rounded-2xl bg-slate-50 py-3 pl-12 pr-4 text-sm font-medium outline-none transition-all focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                  </div>
                  <div className="relative md:w-72">
                    <Filter className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <select value={segment} onChange={(e) => setSegment(e.target.value)} className="w-full appearance-none rounded-2xl bg-slate-50 py-3 pl-12 pr-10 text-sm font-bold text-slate-700 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-blue-500/20">
                      <option value="">Todos os Segmentos</option>
                      {Object.entries(data.segmentCounts || {}).map(([slug, count]) => (
                        <option key={slug} value={slug}>{slug.replace(/-/g, ' ').toUpperCase()} ({String(count)})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <tr>
                        <th className="p-5">Contacto</th>
                        <th className="p-5">Stage</th>
                        <th className="p-5">Score</th>
                        <th className="p-5">Valor</th>
                        <th className="p-5">Próximo Passo</th>
                        <th className="p-5">Atividade</th>
                        <th className="p-5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(data.contacts || []).map((contact: any) => {
                        const initials = (contact.display_name || 'C').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                        return (
                          <tr key={contact.id} className="group transition-colors hover:bg-slate-50">
                            <td className="p-5">
                              <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-black text-white shadow-sm">
                                  {initials}
                                </div>
                                <div>
                                  <p className="text-base font-black text-slate-900 group-hover:text-blue-600 transition-colors">{contact.display_name}</p>
                                  <p className="mt-0.5 text-xs font-medium text-slate-500">{contact.normalized_email || contact.normalized_phone}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-5"><StatusPill label={stageLabel(contact.lifecycle_stage)} tone={contact.lifecycle_stage === 'lead' ? 'blue' : 'slate'} /></td>
                            <td className="p-5"><ScoreBadge score={contact.lead_score} /></td>
                            <td className="p-5 font-black text-slate-900">{formatCurrency(contact.value_total)}</td>
                            <td className="p-5"><span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{contact.recommendation || 'Nenhum'}</span></td>
                            <td className="p-5 text-xs font-medium text-slate-500">{formatDate(contact.latest_activity_at)}</td>
                            <td className="p-5 text-right">
                              <button className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white opacity-0 shadow-sm ring-1 ring-slate-200 transition-all group-hover:opacity-100 hover:bg-slate-900 hover:text-white hover:ring-slate-900">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {(data.contacts || []).length === 0 && (
                    <div className="p-12 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                        <Users className="h-8 w-8 text-slate-300" />
                      </div>
                      <h3 className="mt-4 text-lg font-black text-slate-900">Nenhum contacto encontrado</h3>
                      <p className="mt-2 text-sm text-slate-500">Tenta ajustar os teus filtros de pesquisa.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* FUNNELS / AUTOMATIONS */}
            {!loading && view === 'funnels' && data && (
              <motion.div
                key="funnels"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="grid gap-8 lg:grid-cols-2"
              >
                {(data.funnels || []).map((funnel: any) => (
                  <div key={funnel.id} className="group relative overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-slate-200/40 ring-1 ring-slate-200/50">
                    {/* Header */}
                    <div className="relative p-8">
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-800" />
                      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay" />

                      <div className="relative z-10">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-3">
                              <h3 className="text-2xl font-black text-white tracking-tight">{funnel.name}</h3>
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${funnel.status === 'active' ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50' : 'bg-white/10 text-slate-300 ring-1 ring-white/20'}`}>
                                {funnel.status === 'active' ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> : null}
                                {funnel.status === 'active' ? 'Em execução' : 'Pausado'}
                              </span>
                            </div>
                            <p className="mt-2 text-slate-300 text-sm leading-relaxed max-w-sm">{funnel.description}</p>
                          </div>

                          <button onClick={() => updateFunnel(funnel, funnel.status === 'active' ? 'paused' : 'active')} className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all hover:scale-105 active:scale-95 ${funnel.status === 'active' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/30'}`}>
                            {funnel.status === 'active' ? <PauseCircle className="h-6 w-6" /> : <PlayCircle className="h-6 w-6" />}
                          </button>
                        </div>

                        {/* Stats mini-bento */}
                        <div className="mt-8 grid grid-cols-3 gap-3">
                          <div className="rounded-2xl bg-black/20 p-4 backdrop-blur-sm">
                            <p className="text-3xl font-black text-white">{funnel.enrollment_counts?.active || 0}</p>
                            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">Ativos</p>
                          </div>
                          <div className="rounded-2xl bg-black/20 p-4 backdrop-blur-sm">
                            <p className="text-3xl font-black text-white">{funnel.enrollment_counts?.completed || 0}</p>
                            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">Concluídos</p>
                          </div>
                          <div className="rounded-2xl bg-black/20 p-4 backdrop-blur-sm">
                            <p className="text-3xl font-black text-slate-300">{funnel.enrollment_counts?.paused || 0}</p>
                            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">Em Pausa</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pipeline Steps */}
                    <div className="p-8 pb-4">
                      <h4 className="mb-6 text-xs font-black uppercase tracking-widest text-slate-400">Pipeline Sequence</h4>
                      <div className="relative before:absolute before:inset-y-0 before:left-5 before:w-0.5 before:bg-slate-100">
                        {(funnel.steps || []).map((step: any, idx: number) => (
                          <div key={idx} className="relative mb-8 flex items-start gap-6 last:mb-0">
                            <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-black text-slate-900 shadow-sm ring-1 ring-slate-200">
                              {idx + 1}
                            </div>
                            <div className="min-w-0 flex-1 pt-1">
                              <p className="text-lg font-black text-slate-900">{step.template_key || step.task_type || 'Passo Genérico'}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                                  <Calendar className="h-3.5 w-3.5" /> +{step.delay_hours || 0}h
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                                  {step.channel === 'task' ? <CheckCircle className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                                  {step.channel === 'task' ? 'Tarefa Admin' : 'Email Auto'}
                                </span>
                              </div>
                              {(step.condition || step.stop_if) && (
                                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs font-medium text-slate-600">
                                  {step.condition && <p>If: <span className="text-slate-900">{step.condition}</span></p>}
                                  {step.stop_if && <p className="mt-1">Stop if: <span className="text-slate-900">{step.stop_if.join(', ')}</span></p>}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* SEGMENTS */}
            {!loading && view === 'segments' && data && (
              <motion.div
                key="segments"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="grid gap-6 md:grid-cols-3"
              >
                {(data.segments || []).map((segment: any) => (
                  <Link key={segment.slug} href={`/admin/marketing/contacts?segment=${segment.slug}`} className="group relative overflow-hidden rounded-[2rem] border border-slate-200/60 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/50 hover:border-slate-300">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">{segment.name}</p>
                        <p className="mt-2 text-sm font-medium text-slate-500 leading-relaxed">{segment.description}</p>
                      </div>
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-lg font-black text-white shadow-lg">
                        {segment.count}
                      </div>
                    </div>
                  </Link>
                ))}
              </motion.div>
            )}

            {/* CAMPAIGNS */}
            {!loading && view === 'campaigns' && data && (
              <motion.div
                key="campaigns"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="grid gap-8 lg:grid-cols-[420px_1fr]"
              >
                <section className="rounded-[2rem] border border-slate-200/60 bg-white p-8 shadow-sm h-fit">
                  <h2 className="mb-6 text-2xl font-black text-slate-900 tracking-tight">Nova Campanha</h2>
                  <div className="space-y-5">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Nome Interno</label>
                      <input value={campaignForm.name} onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })} placeholder="Ex: Aviso retiro Quaresma" className="w-full rounded-xl bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 px-4 py-3 text-sm font-medium transition-all outline-none" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Público Alvo</label>
                      <select value={campaignForm.segment_slug} onChange={(e) => setCampaignForm({ ...campaignForm, segment_slug: e.target.value })} className="w-full appearance-none rounded-xl bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 px-4 py-3 text-sm font-bold text-slate-700 transition-all outline-none">
                        <option value="hot-pilgrimage-leads">Hot pilgrimage leads</option>
                        <option value="abandoned-registration">Abandoned registration</option>
                        <option value="waitlist-contacts">Waitlist contacts</option>
                        <option value="donors-not-members">Donors not members</option>
                        <option value="members-without-referrals">Members without referrals</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Template Base</label>
                      <select value={campaignForm.template_key} onChange={(e) => setCampaignForm({ ...campaignForm, template_key: e.target.value })} className="w-full appearance-none rounded-xl bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 px-4 py-3 text-sm font-bold text-slate-700 transition-all outline-none">
                        {campaignTemplateOptions.map((template) => (
                          <option key={template.key} value={template.key}>{template.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Assunto (Overrides template)</label>
                      <input value={campaignForm.subject} onChange={(e) => setCampaignForm({ ...campaignForm, subject: e.target.value })} placeholder="Opcional" className="w-full rounded-xl bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 px-4 py-3 text-sm font-medium transition-all outline-none" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Conteúdo Extra (Merg tags suportadas)</label>
                      <textarea value={campaignForm.body} onChange={(e) => setCampaignForm({ ...campaignForm, body: e.target.value })} placeholder="Opcional: texto extra dentro do template. Pode usar {{name}}, {{recommendation}}, {{app_url}}." rows={5} className="w-full rounded-xl bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 px-4 py-3 text-sm font-medium transition-all outline-none resize-none" />
                    </div>
                    <button onClick={createCampaign} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-black text-white hover:bg-slate-800 transition-transform active:scale-95 shadow-lg shadow-slate-900/20">
                      <Mail className="h-5 w-5" />
                      Criar Campanha e Analisar Público
                    </button>
                  </div>
                </section>
                <div className="space-y-4">
                  {(data.campaigns || []).map((campaign: any) => (
                    <div key={campaign.id} className="group flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-black text-slate-900">{campaign.name}</h3>
                          <StatusPill label={campaign.status} tone={campaign.status === 'draft' ? 'slate' : 'blue'} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                            <Filter className="h-3.5 w-3.5" />
                            {campaign.segment_slug || 'Sem segmento'}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                            <Eye className="h-3.5 w-3.5" />
                            {campaign.template_key || 'template'}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => sendDryRun(campaign.id)} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900">
                        <Send className="h-4 w-4 text-blue-500" />
                        Testar Público
                      </button>
                    </div>
                  ))}
                  {(data.campaigns || []).length === 0 && (
                    <div className="flex h-64 flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-300 bg-slate-50/50">
                      <Send className="h-10 w-10 text-slate-300" />
                      <p className="mt-4 font-bold text-slate-500">Sem campanhas criadas.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* SCHEDULED */}
            {!loading && view === 'scheduled' && data && (
              <motion.div
                key="scheduled"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="grid gap-4 md:grid-cols-5">
                  {[
                    ['ready', 'Prontos', 'emerald'],
                    ['today', 'Hoje', 'blue'],
                    ['upcoming', 'Programados', 'slate'],
                    ['blocked', 'Bloqueados', 'amber'],
                    ['failed', 'Falhados', 'red'],
                  ].map(([key, label, tone]) => (
                    <button
                      key={key}
                      onClick={() => setScheduleBucket(scheduleBucket === key ? 'all' : key)}
                      className={`group relative overflow-hidden rounded-2xl border p-6 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-md ${
                        scheduleBucket === key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200/60 bg-white text-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <p className={`text-xs font-black uppercase tracking-wider ${scheduleBucket === key ? 'text-white/60' : 'text-slate-400'}`}>{label}</p>
                      <p className={`mt-2 text-3xl font-black ${scheduleBucket === key ? 'text-white' : 'text-slate-900'}`}>{data.stats?.[key] || 0}</p>
                      {scheduleBucket !== key && <div className="mt-3"><StatusPill label={label} tone={tone} /></div>}
                      {scheduleBucket === key && (
                         <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/5 blur-2xl"></div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-slate-900">Agenda Operacional</h3>
                    <p className="mt-1 text-sm font-medium text-slate-500">Próximos passos de cada contacto e ações diretas disponíveis.</p>
                  </div>
                  <select value={scheduleBucket} onChange={(e) => setScheduleBucket(e.target.value)} className="appearance-none rounded-xl border-transparent bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20">
                    <option value="all">Todos os buckets</option>
                    <option value="ready">Prontos a enviar</option>
                    <option value="today">Para hoje</option>
                    <option value="upcoming">Programados (futuro)</option>
                    <option value="blocked">Bloqueados/Condições</option>
                    <option value="paused">Pausados manualmente</option>
                    <option value="failed">Falhados/Erro</option>
                  </select>
                </div>

                <div className="space-y-4">
                  {(data.scheduled || []).length === 0 && (
                    <div className="flex h-48 flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-300 bg-slate-50/50">
                      <RefreshCw className="h-10 w-10 text-slate-300" />
                      <p className="mt-4 font-bold text-slate-500">A agenda está vazia.</p>
                    </div>
                  )}
                  {(data.scheduled || []).map((item: any) => (
                    <div key={item.id} className="overflow-hidden rounded-[2rem] border border-slate-200/60 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
                      <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill label={item.evaluation?.label || item.status} tone={item.evaluation?.tone || 'slate'} />
                            <h4 className="text-lg font-black text-slate-900">{item.contact?.display_name || item.contact?.normalized_email || 'Contacto'}</h4>
                            <ScoreBadge score={item.contact?.lead_score || 0} />
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 border border-slate-200">{stageLabel(item.contact?.lifecycle_stage)}</span>
                            <span className="rounded-full bg-blue-50/80 px-2.5 py-1 text-xs font-black text-blue-700 border border-blue-100">{item.contact?.language === 'en' ? 'EN' : 'PT'}</span>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium">
                            <span className="flex items-center gap-1.5 text-slate-600">
                              <PlayCircle className="h-4 w-4 text-slate-400" />
                              {item.funnel?.name} (Passo {(item.current_step || 0) + 1})
                            </span>
                            <span className="flex items-center gap-1.5 text-slate-600">
                              <Eye className="h-4 w-4 text-slate-400" />
                              {item.current_step_detail?.template_key || item.current_step_detail?.task_type || 'follow-up'}
                            </span>
                            <span className="flex items-center gap-1.5 text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded-md">
                              <Calendar className="h-3.5 w-3.5 text-slate-500" />
                              {formatDateTime(item.next_run_at)}
                            </span>
                          </div>

                          <p className="mt-3 text-sm text-slate-500">{item.evaluation?.reason}</p>

                          {(item.current_step_detail?.condition || item.current_step_detail?.stop_if) && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {item.current_step_detail.condition && <span className="inline-flex rounded bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700 border border-amber-100">IF: {item.current_step_detail.condition}</span>}
                              {item.current_step_detail.stop_if && <span className="inline-flex rounded bg-red-50 px-2 py-1 text-xs font-bold text-red-700 border border-red-100">STOP: {item.current_step_detail.stop_if.join(', ')}</span>}
                            </div>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:items-end">
                          <button onClick={() => updateEnrollment(item.id, 'send-now')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition-transform active:scale-95">
                            <Send className="h-4 w-4" />
                            Forçar Envio
                          </button>
                          <div className="flex gap-2">
                            <button onClick={() => rescheduleEnrollment(item.id)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                              Reagendar
                            </button>
                            {item.status === 'paused' || item.status === 'failed' ? (
                              <button onClick={() => updateEnrollment(item.id, 'resume')} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
                                <PlayCircle className="h-4 w-4" />
                                Retomar
                              </button>
                            ) : (
                              <button onClick={() => updateEnrollment(item.id, 'pause')} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                                <PauseCircle className="h-4 w-4" />
                                Pausar
                              </button>
                            )}
                            <button onClick={() => updateEnrollment(item.id, 'cancel')} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-6 border-t border-slate-100 bg-slate-50/50 px-6 py-3 text-xs font-medium text-slate-500">
                        <span><strong className="text-slate-700">Consentimento:</strong> {item.contact?.consent_state || '—'}</span>
                        <span><strong className="text-slate-700">Funil status:</strong> {item.funnel?.status || '—'}</span>
                        <Link href={`/admin/marketing/contacts/${item.contact_id}`} className="ml-auto font-black text-blue-600 hover:text-blue-700 hover:underline">Perfil Completo &rarr;</Link>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* OUTBOX */}
            {!loading && view === 'outbox' && data && (
              <motion.div
                key="outbox"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="grid gap-4 md:grid-cols-5">
                  {[
                    ['sent', 'Enviados', 'emerald'],
                    ['failed', 'Falhados', 'red'],
                    ['skipped', 'Ignorados', 'amber'],
                    ['test', 'Testes', 'blue'],
                    ['queued', 'Fila', 'slate'],
                  ].map(([key, label, tone]) => (
                    <button
                      key={key}
                      onClick={() => setOutboxStatus(outboxStatus === key ? 'all' : key)}
                      className={`group relative overflow-hidden rounded-2xl border p-6 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-md ${
                        outboxStatus === key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200/60 bg-white text-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <p className={`text-xs font-black uppercase tracking-wider ${outboxStatus === key ? 'text-white/60' : 'text-slate-400'}`}>{label}</p>
                      <p className={`mt-2 text-3xl font-black ${outboxStatus === key ? 'text-white' : 'text-slate-900'}`}>{data.stats?.[key] || 0}</p>
                      {outboxStatus !== key && <div className="mt-3"><StatusPill label={label} tone={tone} /></div>}
                      {outboxStatus === key && (
                         <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/5 blur-2xl"></div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm md:flex-row md:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input value={outboxSearch} onChange={(e) => setOutboxSearch(e.target.value)} placeholder="Pesquisar email, assunto, contacto ou template..." className="w-full appearance-none rounded-xl border-transparent bg-slate-50 py-3 pl-12 pr-4 text-sm font-medium outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  <select value={outboxStatus} onChange={(e) => setOutboxStatus(e.target.value)} className="appearance-none rounded-xl border-transparent bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 md:w-64">
                    <option value="all">Todos os estados</option>
                    <option value="sent">Enviados com Sucesso</option>
                    <option value="failed">Falhados</option>
                    <option value="skipped">Ignorados (Regras)</option>
                    <option value="test">Testes Dry-run</option>
                    <option value="queued">Na Fila</option>
                  </select>
                </div>

                <div className="overflow-hidden rounded-[2rem] border border-slate-200/60 bg-white shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50/50 text-xs uppercase tracking-wider text-slate-500 font-bold">
                      <tr>
                        <th className="p-4 pl-6">Email / Assunto</th>
                        <th className="p-4">Contacto</th>
                        <th className="p-4">Origem</th>
                        <th className="p-4">Estado</th>
                        <th className="p-4 pr-6">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(data.messages || []).map((message: any) => (
                        <tr key={message.id} className="group transition-colors hover:bg-slate-50/50">
                          <td className="p-4 pl-6 align-top">
                            <p className="font-black text-slate-900 line-clamp-1">{message.subject || 'Sem assunto'}</p>
                            <div className="mt-1 flex items-center gap-2 text-xs font-medium text-slate-500">
                              <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {message.template_key || 'template'}</span>
                              <span>·</span>
                              <span>{message.to_email}</span>
                            </div>
                            {message.error_message && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 border border-red-100 line-clamp-2">{message.error_message}</p>}
                          </td>
                          <td className="p-4 align-top">
                            <p className="font-bold text-slate-900">{message.contact?.display_name || '—'} <span className="ml-1 inline-flex rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-700 border border-blue-100">{message.contact?.language === 'en' ? 'EN' : 'PT'}</span></p>
                            <p className="mt-1 text-xs text-slate-500">{message.contact?.normalized_email || '—'}</p>
                          </td>
                          <td className="p-4 align-top">
                            <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                              {message.campaign?.name || message.funnel?.name || 'Manual'}
                            </span>
                          </td>
                          <td className="p-4 align-top">
                            <StatusPill
                              label={message.status}
                              tone={message.status === 'sent' ? 'emerald' : message.status === 'failed' ? 'red' : message.status === 'skipped' ? 'amber' : 'slate'}
                            />
                          </td>
                          <td className="p-4 pr-6 align-top text-xs font-medium text-slate-500">
                            {formatDateTime(message.sent_at || message.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(data.messages || []).length === 0 && (
                    <div className="flex h-48 flex-col items-center justify-center bg-slate-50/50">
                      <Mail className="h-10 w-10 text-slate-300" />
                      <p className="mt-4 font-bold text-slate-500">Nenhum email encontrado com estes filtros.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* TEMPLATES */}
            {!loading && view === 'templates' && data && (
              <motion.div
                key="templates"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="grid gap-8 lg:grid-cols-[1fr_500px]"
              >
                <div className="grid gap-6 md:grid-cols-2 h-fit">
                  {(data.templates || []).map((template: any) => (
                    <section key={template.key} className="group flex flex-col rounded-[2rem] border border-slate-200/60 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-slate-300 hover:shadow-md">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <Eye className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-black text-slate-900 line-clamp-1">{template.name}</p>
                            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">{template.category}</span>
                          </div>
                        </div>
                      </div>
                      <p className="mt-4 flex-1 text-sm font-medium text-slate-500">{template.description}</p>

                      <div className="mt-4 rounded-xl bg-slate-50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Assunto Base</p>
                        <p className="mt-0.5 text-sm font-bold text-slate-700 line-clamp-1">{template.defaultSubject}</p>
                      </div>

                      <button onClick={() => previewEmailTemplate(template.key)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white transition-transform hover:bg-slate-800 active:scale-95 shadow-sm">
                        <Eye className="h-4 w-4" />
                        Preview Real
                      </button>
                    </section>
                  ))}
                </div>

                <aside className="sticky top-6 h-fit rounded-[2rem] border border-slate-200/60 bg-white p-6 shadow-xl shadow-slate-200/40">
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-xl font-black text-slate-900">Live Preview</h3>
                      <p className="mt-1 text-sm font-medium text-slate-500">Usa o renderer do backend React Email.</p>
                    </div>
                    <select value={previewLanguage} onChange={(e) => setPreviewLanguage(e.target.value === 'en' ? 'en' : 'pt')} className="appearance-none rounded-xl border-transparent bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20">
                      <option value="pt">Português (PT)</option>
                      <option value="en">English (EN)</option>
                    </select>
                  </div>

                  {previewLoading && (
                    <div className="mt-6 flex h-[600px] flex-col items-center justify-center rounded-2xl bg-slate-50/50">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
                      <p className="mt-4 font-bold text-slate-500">A renderizar HTML...</p>
                    </div>
                  )}

                  {!previewLoading && previewTemplate && (
                    <div className="mt-6 space-y-4">
                      <div className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Assunto Resolvido</p>
                        <p className="mt-1 font-black text-slate-900">{previewTemplate.subject}</p>
                      </div>
                      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm ring-4 ring-slate-50">
                        <iframe title="Email preview" srcDoc={previewTemplate.html} className="h-[600px] w-full bg-white" />
                      </div>
                    </div>
                  )}

                  {!previewLoading && !previewTemplate && (
                    <div className="mt-6 flex h-[600px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50">
                      <Eye className="h-10 w-10 text-slate-300" />
                      <p className="mt-4 text-center text-sm font-medium text-slate-500">
                        Escolhe um template na lista<br/>para ver como o email é enviado.
                      </p>
                    </div>
                  )}
                </aside>
              </motion.div>
            )}

            {/* TASKS */}
            {!loading && view === 'tasks' && data && (
              <motion.div
                key="tasks"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Tarefas Manuais</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">Ações geradas pelos funis que requerem intervenção humana.</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {(data.tasks || []).map((task: any) => (
                    <div key={task.id} className="group flex flex-col rounded-[2rem] border border-slate-200/60 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-slate-300 hover:shadow-md">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                          <CheckCircle className="h-5 w-5" />
                        </div>
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 border border-slate-200">{task.priority}</span>
                      </div>

                      <h3 className="text-lg font-black text-slate-900">{task.title}</h3>
                      {task.description && <p className="mt-2 text-sm font-medium text-slate-500">{task.description}</p>}

                      <div className="mt-6 flex-1 rounded-xl bg-slate-50 p-4 border border-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Contacto Associado</p>
                        <p className="mt-1 font-bold text-slate-900 line-clamp-1">{task.contact?.display_name || task.contact?.normalized_email || 'Contacto Desconhecido'}</p>
                        <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">Origem: {task.source}</p>

                        <Link href={`/admin/marketing/contacts/${task.contact_id}`} className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-blue-600 hover:text-blue-700">
                          Ver Perfil Completo &rarr;
                        </Link>
                      </div>

                      <button onClick={() => updateTask(task.id, 'done')} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition-transform hover:bg-emerald-700 active:scale-95 shadow-sm shadow-emerald-600/20">
                        <CheckCircle className="h-4 w-4" />
                        Marcar como Concluída
                      </button>
                    </div>
                  ))}
                </div>

                {(data.tasks || []).length === 0 && (
                  <div className="flex h-64 flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-300 bg-slate-50/50">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 mb-4">
                      <CheckCircle className="h-8 w-8 text-emerald-500" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900">Tudo em dia!</h3>
                    <p className="mt-2 font-medium text-slate-500">Não existem tarefas manuais pendentes.</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Other views fallback */}
            {!loading && view !== 'overview' && view !== 'analytics' && view !== 'contacts' && view !== 'funnels' && view !== 'segments' && view !== 'campaigns' && view !== 'scheduled' && view !== 'outbox' && view !== 'templates' && view !== 'tasks' && data && (
               <motion.div
                key="other"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
               >
                 <div className="flex h-64 items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50">
                    <div className="text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                        <Layers className="h-8 w-8 text-slate-400" />
                      </div>
                      <h3 className="mt-4 text-xl font-black text-slate-900">Em Desenvolvimento</h3>
                      <p className="mt-2 text-slate-500">A nova interface para este módulo está a ser finalizada.</p>
                    </div>
                 </div>
               </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
