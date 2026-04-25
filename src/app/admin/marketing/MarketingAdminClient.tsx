"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
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

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="mt-3 text-2xl font-black text-slate-900">{value}</div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : score >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200';
  return <span className={`rounded-full border px-2 py-1 text-xs font-bold ${color}`}>{score}</span>;
}

function StatusPill({ label, tone = 'slate' }: { label: string; tone?: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  };
  return <span className={`rounded-full px-2 py-1 text-xs font-black ring-1 ${colors[tone] || colors.slate}`}>{label}</span>;
}

const platformNav: Array<{ view: View; label: string; href: string; icon: any }> = [
  { view: 'overview', label: 'Centro', href: '/admin/marketing', icon: Target },
  { view: 'contacts', label: 'Contactos', href: '/admin/marketing/contacts', icon: Users },
  { view: 'funnels', label: 'Funis', href: '/admin/marketing/funnels', icon: PlayCircle },
  { view: 'scheduled', label: 'Agenda', href: '/admin/marketing/scheduled', icon: RefreshCw },
  { view: 'outbox', label: 'Outbox', href: '/admin/marketing/outbox', icon: Mail },
  { view: 'templates', label: 'Templates', href: '/admin/marketing/templates', icon: Eye },
  { view: 'campaigns', label: 'Campanhas', href: '/admin/marketing/campaigns', icon: Send },
  { view: 'tasks', label: 'Tarefas', href: '/admin/marketing/tasks', icon: CheckCircle },
  { view: 'analytics', label: 'Analytics', href: '/admin/marketing/analytics', icon: ArrowUpRight },
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

export default function MarketingAdminClient({ view }: MarketingAdminClientProps) {
  const [loading, setLoading] = useState(true);
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

  const title = useMemo(() => {
    const labels: Record<View, string> = {
      overview: 'Marketing Overview',
      contacts: 'Contactos CRM',
      segments: 'Segmentos',
      campaigns: 'Campanhas',
      funnels: 'Funis de Marketing',
      scheduled: 'Agenda de Follow-up',
      outbox: 'Outbox de Marketing',
      templates: 'Templates de Email',
      tasks: 'Tarefas de Follow-up',
      analytics: 'Marketing Analytics',
    };
    return labels[view];
  }, [view]);

  const load = async () => {
    setLoading(true);
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
      setData(await api(endpoint));
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar marketing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'contacts' && typeof window !== 'undefined') {
      setSegment(new URLSearchParams(window.location.search).get('segment') || '');
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    if (view !== 'contacts') return;
    const timer = setTimeout(() => load(), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, segment]);

  useEffect(() => {
    if (view !== 'scheduled') return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleBucket]);

  useEffect(() => {
    if (view !== 'outbox') return;
    const timer = setTimeout(() => load(), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outboxStatus, outboxSearch]);

  useEffect(() => {
    if (view !== 'templates' || !previewTemplate?.key) return;
    previewEmailTemplate(previewTemplate.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewLanguage]);

  const syncContacts = async () => {
    try {
      const result = await api('/api/admin/marketing/sync-contacts', { method: 'POST', body: '{}' });
      toast.success(`Sincronizados ${result.persistedContacts} contactos.`);
      await load();
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
      toast.success('Campanha criada.');
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao criar campanha.');
    }
  };

  const updateTask = async (id: string, status: string) => {
    try {
      await api('/api/admin/marketing/tasks', {
        method: 'PATCH',
        body: JSON.stringify({ id, status }),
      });
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao atualizar tarefa.');
    }
  };

  const updateFunnel = async (funnel: any, status: string) => {
    try {
      const result = await api('/api/admin/marketing/funnels', {
        method: 'PATCH',
        body: JSON.stringify({
          id: funnel.id,
          name: funnel.name,
          description: funnel.description,
          trigger_type: funnel.trigger_type,
          segment_slug: funnel.segment_slug,
          steps: funnel.steps,
          status,
        }),
      });
      if (status === 'active') {
        const prep = result.preparation;
        toast.success(`Funil ativo. ${prep?.enrolled || 0} novos follow-ups agendados, ${prep?.skippedExisting || 0} já existentes.`);
      } else {
        toast.success('Funil pausado.');
      }
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao atualizar funil.');
    }
  };

  const prepareAutomations = async (funnelId?: string) => {
    try {
      const result = await api('/api/admin/marketing/automations/prepare', {
        method: 'POST',
        body: JSON.stringify(funnelId ? { funnel_id: funnelId } : {}),
      });
      toast.success(`${result.totals?.enrolled || 0} follow-ups preparados em ${result.activeFunnels || 0} funis ativos.`);
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao preparar agenda.');
    }
  };

  const updateEnrollment = async (id: string, action: 'pause' | 'cancel' | 'resume' | 'send-now') => {
    try {
      await api(`/api/admin/marketing/enrollments/${id}/${action}`, { method: 'POST', body: '{}' });
      const labels: Record<string, string> = {
        pause: 'Follow-up pausado.',
        cancel: 'Follow-up cancelado.',
        resume: 'Follow-up retomado.',
        'send-now': 'Passo processado agora.',
      };
      toast.success(labels[action]);
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao atualizar follow-up.');
    }
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
      await load();
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
    <AdminLayout title={title} isLoading={false}>
      <Toaster richColors position="bottom-right" />
      <div className="space-y-6">
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Marketing & Growth Platform</p>
            <p className="mt-1 text-sm font-medium text-slate-500">CRM, funis, agenda inteligente e emails de follow-up baseados nos dados reais de leads, peregrinações, membros, doações e loja.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={syncContacts} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <Database className="h-4 w-4" />
              Sincronizar
            </button>
            <button onClick={load} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800">
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
            {(view === 'funnels' || view === 'scheduled') && (
              <button onClick={() => prepareAutomations()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-800">
                <PlayCircle className="h-4 w-4" />
                Preparar agenda
              </button>
            )}
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          {platformNav.map((item) => {
            const Icon = item.icon;
            const active = item.view === view;
            return (
              <Link
                key={item.view}
                href={item.href}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-black transition ${
                  active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {loading && <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm font-medium text-slate-500">A carregar...</div>}

        {!loading && (view === 'overview' || view === 'analytics') && data && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard label="Contactos" value={data.stats.total_contacts} icon={Users} />
              <StatCard label="Marketable" value={data.stats.marketable_contacts} icon={Mail} />
              <StatCard label="Hot Leads" value={data.stats.hot_pilgrimage_leads} icon={Target} />
              <StatCard label="Valor Total" value={formatCurrency(data.stats.total_value)} icon={ArrowUpRight} />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-black text-slate-900">Leads prioritários</h2>
                <div className="space-y-3">
                  {(data.hotLeads || []).map((contact: any) => (
                    <Link key={contact.id} href={`/admin/marketing/contacts/${contact.id}`} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50">
                      <div>
                        <p className="font-bold text-slate-900">{contact.display_name}</p>
                        <p className="text-sm text-slate-500">{contact.normalized_email || contact.normalized_phone}</p>
                      </div>
                      <ScoreBadge score={contact.lead_score} />
                    </Link>
                  ))}
                </div>
              </section>
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-black text-slate-900">Atividade recente</h2>
                <div className="space-y-3">
                  {(data.recentEvents || []).map((event: any) => (
                    <div key={`${event.source_table}-${event.source_id}-${event.event_type}`} className="rounded-lg border border-slate-100 p-3">
                      <p className="font-bold text-slate-900">{event.title}</p>
                      <p className="text-sm text-slate-500">{event.contact_name} · {formatDate(event.occurred_at)}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-black text-slate-900">Segmentos</h2>
              <div className="grid gap-3 md:grid-cols-3">
                {Object.entries(data.segmentCounts || {}).map(([slug, count]) => (
                  <Link key={slug} href={`/admin/marketing/contacts?segment=${slug}`} className="rounded-lg border border-slate-100 p-3 hover:bg-slate-50">
                    <p className="text-sm font-bold text-slate-900">{slug.replace(/-/g, ' ')}</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{String(count)}</p>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        )}

        {!loading && view === 'contacts' && data && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar nome, email, telefone..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400" />
              </div>
              <div className="relative md:w-72">
                <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select value={segment} onChange={(e) => setSegment(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400">
                  <option value="">Todos os segmentos</option>
                  {(data.segmentCounts || []).map((item: any) => (
                    <option key={item.slug} value={item.slug}>{item.name} ({item.count})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-3">Contacto</th>
                    <th className="p-3">Stage</th>
                    <th className="p-3">Score</th>
                    <th className="p-3">Valor</th>
                    <th className="p-3">Recomendação</th>
                    <th className="p-3">Última atividade</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {(data.contacts || []).map((contact: any) => (
                    <tr key={contact.id} className="border-t border-slate-100">
                      <td className="p-3">
                        <p className="font-bold text-slate-900">{contact.display_name}</p>
                    <p className="text-xs text-slate-500">{contact.normalized_email || contact.normalized_phone || '—'} · {contact.language?.toUpperCase?.() || 'PT'}</p>
                      </td>
                      <td className="p-3">{stageLabel(contact.lifecycle_stage)}</td>
                      <td className="p-3"><ScoreBadge score={contact.lead_score} /></td>
                      <td className="p-3 font-bold">{formatCurrency(contact.value_total)}</td>
                      <td className="p-3 text-slate-600">{contact.recommendation}</td>
                      <td className="p-3 text-slate-500">{formatDate(contact.latest_activity_at)}</td>
                      <td className="p-3 text-right">
                        <Link href={`/admin/marketing/contacts/${contact.id}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 font-bold hover:bg-slate-50">
                          <Eye className="h-3 w-3" />
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && view === 'segments' && data && (
          <div className="grid gap-4 md:grid-cols-3">
            {(data.segments || []).map((segment: any) => (
              <Link key={segment.slug} href={`/admin/marketing/contacts?segment=${segment.slug}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-900">{segment.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{segment.description}</p>
                  </div>
                  <span className="rounded-full bg-slate-900 px-2 py-1 text-xs font-bold text-white">{segment.count}</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && view === 'campaigns' && data && (
          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-black text-slate-900">Nova campanha</h2>
              <div className="space-y-3">
                <input value={campaignForm.name} onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })} placeholder="Nome interno" className="w-full rounded-lg border border-slate-200 p-2 text-sm" />
                <select value={campaignForm.segment_slug} onChange={(e) => setCampaignForm({ ...campaignForm, segment_slug: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2 text-sm">
                  <option value="hot-pilgrimage-leads">Hot pilgrimage leads</option>
                  <option value="abandoned-registration">Abandoned registration</option>
                  <option value="waitlist-contacts">Waitlist contacts</option>
                  <option value="donors-not-members">Donors not members</option>
                  <option value="members-without-referrals">Members without referrals</option>
                </select>
                <select value={campaignForm.template_key} onChange={(e) => setCampaignForm({ ...campaignForm, template_key: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2 text-sm">
                  {campaignTemplateOptions.map((template) => (
                    <option key={template.key} value={template.key}>{template.label}</option>
                  ))}
                </select>
                <input value={campaignForm.subject} onChange={(e) => setCampaignForm({ ...campaignForm, subject: e.target.value })} placeholder="Assunto do email" className="w-full rounded-lg border border-slate-200 p-2 text-sm" />
                <textarea value={campaignForm.body} onChange={(e) => setCampaignForm({ ...campaignForm, body: e.target.value })} placeholder="Opcional: texto extra dentro do template. Pode usar {{name}}, {{recommendation}}, {{app_url}}." rows={7} className="w-full rounded-lg border border-slate-200 p-2 text-sm" />
                <button onClick={createCampaign} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white">
                  <Mail className="h-4 w-4" />
                  Criar campanha
                </button>
              </div>
            </section>
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              {(data.campaigns || []).map((campaign: any) => (
                <div key={campaign.id} className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
                  <div>
                    <p className="font-black text-slate-900">{campaign.name}</p>
                    <p className="text-sm text-slate-500">{campaign.segment_slug || 'Sem segmento'} · {campaign.template_key || 'template'} · {campaign.status}</p>
                  </div>
                  <button onClick={() => sendDryRun(campaign.id)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold hover:bg-slate-50">
                    <Send className="h-4 w-4" />
                    Testar público
                  </button>
                </div>
              ))}
            </section>
          </div>
        )}

        {!loading && view === 'funnels' && data && (
          <div className="grid gap-4 lg:grid-cols-2">
            {(data.funnels || []).map((funnel: any) => (
              <section key={funnel.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black">{funnel.name}</p>
                        <span className={`rounded-full px-2 py-1 text-xs font-black ${funnel.status === 'active' ? 'bg-emerald-400/20 text-emerald-100 ring-1 ring-emerald-300/30' : funnel.status === 'paused' ? 'bg-amber-400/20 text-amber-100 ring-1 ring-amber-300/30' : 'bg-white/10 text-slate-200 ring-1 ring-white/15'}`}>
                          {funnel.status === 'active' ? 'Ativo' : funnel.status === 'paused' ? 'Pausado' : 'Rascunho'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-300">{funnel.description}</p>
                      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">{funnel.trigger_type} · {funnel.segment_slug || 'sem segmento'}</p>
                    </div>
                    <button onClick={() => updateFunnel(funnel, funnel.status === 'active' ? 'paused' : 'active')} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-bold text-white ring-1 ring-white/15 hover:bg-white/15">
                      {funnel.status === 'active' ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                      {funnel.status === 'active' ? 'Pausar' : 'Ativar + preparar'}
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-white/10 p-2"><p className="font-black text-lg">{funnel.enrollment_counts?.active || 0}</p><p className="text-slate-300">ativos</p></div>
                    <div className="rounded-lg bg-white/10 p-2"><p className="font-black text-lg">{funnel.enrollment_counts?.completed || 0}</p><p className="text-slate-300">completos</p></div>
                    <div className="rounded-lg bg-white/10 p-2"><p className="font-black text-lg">{funnel.enrollment_counts?.paused || 0}</p><p className="text-slate-300">pausados</p></div>
                  </div>
                </div>
                <div className="space-y-3 p-5">
                  {(funnel.steps || []).map((step: any, index: number) => (
                    <div key={`${funnel.id}-${index}`} className="relative rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black text-slate-900">{step.channel === 'task' ? 'Tarefa admin' : 'Email automático'}</span>
                            <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">+{step.delay_hours || 0}h</span>
                            <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">{step.template_key || step.task_type || 'passo'}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">
                            {step.condition ? `Condição: ${step.condition}. ` : ''}
                            {step.stop_if ? `Para se: ${step.stop_if.join(', ')}.` : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-white p-4">
                  <Link href={`/admin/marketing/scheduled`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    Ver agenda deste funil
                  </Link>
                  <Link href={`/admin/marketing/outbox`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    Ver emails enviados
                  </Link>
                  {funnel.status === 'active' && (
                    <button onClick={() => prepareAutomations(funnel.id)} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-800">
                      Preparar este funil
                    </button>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}

        {!loading && view === 'scheduled' && data && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-5">
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
                  className={`rounded-xl border p-4 text-left shadow-sm transition ${
                    scheduleBucket === key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <p className={`text-xs font-black uppercase tracking-wide ${scheduleBucket === key ? 'text-white/60' : 'text-slate-400'}`}>{label}</p>
                  <p className="mt-2 text-2xl font-black">{data.stats?.[key] || 0}</p>
                  {scheduleBucket !== key && <div className="mt-2"><StatusPill label={label} tone={tone} /></div>}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-black text-slate-900">Agenda operacional</p>
                  <p className="mt-1 text-sm text-slate-500">Mostra o próximo passo de cada contacto, o motivo do estado e ações diretas para o admin.</p>
                </div>
                <select value={scheduleBucket} onChange={(e) => setScheduleBucket(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
                  <option value="all">Todos</option>
                  <option value="ready">Prontos</option>
                  <option value="today">Hoje</option>
                  <option value="upcoming">Programados</option>
                  <option value="blocked">Bloqueados</option>
                  <option value="paused">Pausados</option>
                  <option value="failed">Falhados</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {(data.scheduled || []).length === 0 && <div className="p-6 text-sm font-medium text-slate-500">Não existem follow-ups automáticos agendados.</div>}
              {(data.scheduled || []).map((item: any) => (
                <div key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill label={item.evaluation?.label || item.status} tone={item.evaluation?.tone || 'slate'} />
                        <p className="font-black text-slate-900">{item.contact?.display_name || item.contact?.normalized_email || 'Contacto'}</p>
                        <ScoreBadge score={item.contact?.lead_score || 0} />
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{stageLabel(item.contact?.lifecycle_stage)}</span>
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">{item.contact?.language === 'en' ? 'EN' : 'PT'}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">{item.funnel?.name} · passo {(item.current_step || 0) + 1} · {item.current_step_detail?.template_key || item.current_step_detail?.task_type || 'follow-up'}</p>
                      <p className="mt-1 text-sm font-black text-slate-800">Próximo envio: {formatDateTime(item.next_run_at)}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.evaluation?.reason}</p>
                      {(item.current_step_detail?.condition || item.current_step_detail?.stop_if) && (
                        <p className="mt-2 text-xs text-slate-500">
                          {item.current_step_detail.condition ? `Condição: ${item.current_step_detail.condition}. ` : ''}
                          {item.current_step_detail.stop_if ? `Para se: ${item.current_step_detail.stop_if.join(', ')}.` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button onClick={() => updateEnrollment(item.id, 'send-now')} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800">
                        <Send className="h-4 w-4" />
                        Enviar agora
                      </button>
                      <button onClick={() => rescheduleEnrollment(item.id)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                        Reagendar
                      </button>
                      {item.status === 'paused' || item.status === 'failed' ? (
                        <button onClick={() => updateEnrollment(item.id, 'resume')} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
                          <PlayCircle className="h-4 w-4" />
                          Retomar
                        </button>
                      ) : (
                        <button onClick={() => updateEnrollment(item.id, 'pause')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                          <PauseCircle className="h-4 w-4" />
                          Pausar
                        </button>
                      )}
                      <button onClick={() => updateEnrollment(item.id, 'cancel')} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50">
                        Cancelar
                      </button>
                    </div>
                  </div>
                  <div className="grid border-t border-slate-100 bg-slate-50 text-xs text-slate-500 md:grid-cols-4">
                    <div className="p-3"><span className="font-bold text-slate-700">Consentimento:</span> {item.contact?.consent_state || '—'}</div>
                    <div className="p-3"><span className="font-bold text-slate-700">Funil:</span> {item.funnel?.status || '—'}</div>
                    <div className="p-3"><span className="font-bold text-slate-700">Email:</span> {item.contact?.normalized_email || '—'}</div>
                    <div className="p-3"><Link href={`/admin/marketing/contacts/${item.contact_id}`} className="font-black text-slate-900 hover:underline">Ver contacto</Link></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && view === 'outbox' && data && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-5">
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
                  className={`rounded-xl border p-4 text-left shadow-sm transition ${
                    outboxStatus === key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <p className={`text-xs font-black uppercase tracking-wide ${outboxStatus === key ? 'text-white/60' : 'text-slate-400'}`}>{label}</p>
                  <p className="mt-2 text-2xl font-black">{data.stats?.[key] || 0}</p>
                  {outboxStatus !== key && <div className="mt-2"><StatusPill label={label} tone={tone} /></div>}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={outboxSearch} onChange={(e) => setOutboxSearch(e.target.value)} placeholder="Pesquisar email, assunto ou template..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400" />
              </div>
              <select value={outboxStatus} onChange={(e) => setOutboxStatus(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 md:w-56">
                <option value="all">Todos os estados</option>
                <option value="sent">Enviados</option>
                <option value="failed">Falhados</option>
                <option value="skipped">Ignorados</option>
                <option value="test">Testes</option>
                <option value="queued">Fila</option>
              </select>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-3">Email</th>
                    <th className="p-3">Contacto</th>
                    <th className="p-3">Origem</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.messages || []).map((message: any) => (
                    <tr key={message.id} className="border-t border-slate-100 align-top hover:bg-slate-50/60">
                      <td className="p-3">
                        <p className="font-bold text-slate-900">{message.subject || 'Sem assunto'}</p>
                        <p className="text-xs text-slate-500">{message.template_key || 'template'} · {message.to_email}</p>
                        {message.error_message && <p className="mt-1 rounded bg-red-50 px-2 py-1 text-xs font-bold text-red-700">{message.error_message}</p>}
                      </td>
                      <td className="p-3">
                        <p className="font-medium text-slate-900">{message.contact?.display_name || '—'} <span className="text-xs font-black text-blue-700">{message.contact?.language === 'en' ? 'EN' : 'PT'}</span></p>
                        <p className="text-xs text-slate-500">{message.contact?.normalized_email || '—'}</p>
                      </td>
                      <td className="p-3 text-slate-600">{message.campaign?.name || message.funnel?.name || 'Manual'}</td>
                      <td className="p-3">
                        <StatusPill
                          label={message.status}
                          tone={message.status === 'sent' ? 'emerald' : message.status === 'failed' ? 'red' : message.status === 'skipped' ? 'amber' : 'slate'}
                        />
                      </td>
                      <td className="p-3 text-slate-500">{formatDateTime(message.sent_at || message.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data.messages || []).length === 0 && <div className="p-6 text-sm font-medium text-slate-500">Ainda não existem envios registados.</div>}
            </div>
          </div>
        )}

        {!loading && view === 'templates' && data && (
          <div className="grid gap-6 lg:grid-cols-[1fr_460px]">
            <div className="grid gap-4 md:grid-cols-2">
              {(data.templates || []).map((template: any) => (
                <section key={template.key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-900">{template.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{template.description}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{template.category}</span>
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-700">{template.defaultSubject}</p>
                  <button onClick={() => previewEmailTemplate(template.key)} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    <Eye className="h-4 w-4" />
                    Preview
                  </button>
                </section>
              ))}
            </div>
            <aside className="sticky top-4 h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-900">Preview do template</p>
                  <p className="mt-1 text-sm text-slate-500">Usa o mesmo renderer visual dos emails existentes.</p>
                </div>
                <select value={previewLanguage} onChange={(e) => setPreviewLanguage(e.target.value === 'en' ? 'en' : 'pt')} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-black text-slate-700">
                  <option value="pt">PT</option>
                  <option value="en">EN</option>
                </select>
              </div>
              {previewLoading && <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">A gerar preview...</div>}
              {!previewLoading && previewTemplate && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Assunto</p>
                    <p className="font-bold text-slate-900">{previewTemplate.subject}</p>
                  </div>
                  <iframe title="Email preview" srcDoc={previewTemplate.html} className="h-[620px] w-full rounded-lg border border-slate-200 bg-white" />
                </div>
              )}
              {!previewLoading && !previewTemplate && <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Escolhe um template para ver o email final.</div>}
            </aside>
          </div>
        )}

        {!loading && view === 'tasks' && data && (
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            {(data.tasks || []).map((task: any) => (
              <div key={task.id} className="flex items-center justify-between gap-4 border-b border-slate-100 p-4">
                <div>
                  <p className="font-black text-slate-900">{task.title}</p>
                  <p className="text-sm text-slate-500">{task.contact?.display_name || task.contact?.normalized_email || 'Contacto'} · {task.priority} · {task.source}</p>
                  {task.description && <p className="mt-1 text-sm text-slate-600">{task.description}</p>}
                </div>
                <button onClick={() => updateTask(task.id, 'done')} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
                  <CheckCircle className="h-4 w-4" />
                  Concluir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
