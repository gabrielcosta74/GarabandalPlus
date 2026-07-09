"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import {
  CheckCircle,
  Database,
  Eye,
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
  Calendar,
  Layers,
  ChevronRight,
  BarChart2,
  Heart,
  Plane,
  ShoppingBag,
  Share2,
  Sparkles,
  UserPlus
} from 'lucide-react';
import { toast, Toaster } from 'sonner';

type View = 'overview' | 'flow' | 'contacts' | 'newsletter' | 'funnels' | 'scheduled' | 'outbox' | 'templates';

// Metadados das categorias de emails de marketing — ordem por jornada do contacto,
// rótulos em PT-BR, ícone, cor e descrição do fluxo. Usado para agrupar a página de templates.
const CATEGORY_META: Record<string, { label: string; icon: any; color: string; bg: string; flow: string; order: number }> = {
  'Peregrinações': { label: 'Peregrinações', icon: Plane, color: 'text-sky-600', bg: 'bg-sky-50', order: 1, flow: 'Da curiosidade à inscrição: roteiro, testemunhos, dúvidas, recuperação de inscrição e lista de espera.' },
  'Doações': { label: 'Doações', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-50', order: 2, flow: 'Agradecer quem doou e mostrar o impacto real da contribuição.' },
  'Membros': { label: 'Membros', icon: UserPlus, color: 'text-amber-600', bg: 'bg-amber-50', order: 3, flow: 'Convidar leads e doadores a se tornarem membros e renovar quem já é.' },
  'Vida Espiritual': { label: 'Vida Espiritual', icon: Sparkles, color: 'text-violet-600', bg: 'bg-violet-50', order: 4, flow: 'Acompanhar o membro na oração: acolhimento, intenções, novenas e formação.' },
  'Indicações': { label: 'Indicações', icon: Share2, color: 'text-emerald-600', bg: 'bg-emerald-50', order: 5, flow: 'Estimular membros a convidar pessoas — cada indicação confirmada dá saldo aos dois.' },
  'Loja': { label: 'Loja', icon: ShoppingBag, color: 'text-indigo-600', bg: 'bg-indigo-50', order: 6, flow: 'Recomendar livros oficiais para aprofundar a mensagem de Garabandal.' },
};

const getCategoryMeta = (cat: string) =>
  CATEGORY_META[cat] || { label: cat || 'Outros', icon: Mail, color: 'text-slate-600', bg: 'bg-slate-50', order: 99, flow: '' };

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

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 80
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : score >= 50
        ? 'bg-amber-50 text-amber-700 ring-amber-200'
        : 'bg-slate-50 text-slate-600 ring-slate-200';
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${tone}`}>{score}</span>;
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
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1 shadow-sm ${colors[tone] || colors.slate}`}>{label}</span>;
}

const platformNav: Array<{ view: View; label: string; href: string; icon: any }> = [
  { view: 'overview', label: 'Dashboard', href: '/admin/marketing', icon: BarChart2 },
  { view: 'flow', label: 'Fluxo & Previews', href: '/admin/marketing/flow', icon: Activity },
  { view: 'contacts', label: 'Contactos', href: '/admin/marketing/contacts', icon: Users },
  { view: 'newsletter', label: 'Newsletter', href: '/admin/marketing/newsletter', icon: Mail },
  { view: 'funnels', label: 'Automações', href: '/admin/marketing/funnels', icon: Zap },
  { view: 'scheduled', label: 'Próximos Envios', href: '/admin/marketing/scheduled', icon: Calendar },
  { view: 'outbox', label: 'Enviados', href: '/admin/marketing/outbox', icon: Mail },
  { view: 'templates', label: 'Templates', href: '/admin/marketing/templates', icon: Eye },
];

const campaignTemplateOptions = [
  { key: 'brochure_followup_1', label: 'Brochura — follow-up inicial' },
  { key: 'pilgrimage_testimony', label: 'Peregrinação — testemunho' },
  { key: 'pilgrimage_faq_objections', label: 'Peregrinação — dúvidas comuns' },
  { key: 'abandoned_registration_1', label: 'Inscrição abandonada — recuperação' },
  { key: 'abandoned_registration_faq', label: 'Inscrição abandonada — esclarecimento' },
  { key: 'abandoned_registration_final', label: 'Inscrição abandonada — último aviso' },
  { key: 'waitlist_welcome', label: 'Lista de espera — boas-vindas' },
  { key: 'waitlist_open_spot', label: 'Lista de espera — vaga disponível' },
  { key: 'waitlist_garabandal_story', label: 'Lista de espera — conhecer Garabandal' },
  { key: 'waitlist_book_recommendation', label: 'Lista de espera — livros oficiais' },
  { key: 'waitlist_mission_support', label: 'Lista de espera — apoiar a missão' },
  { key: 'waitlist_member_invitation', label: 'Lista de espera — convite para membro' },
  { key: 'payment_support', label: 'Peregrinação — apoio ao pagamento' },
  { key: 'donation_thank_you', label: 'Doação — agradecimento' },
  { key: 'donation_thank_you_story', label: 'Doação — impacto' },
  { key: 'donor_to_member', label: 'Doador para membro' },
  { key: 'member_invitation', label: 'Convite para membro' },
  { key: 'store_book_recommendation', label: 'Loja — livros oficiais' },
  { key: 'membership_renewal', label: 'Renovação de membro' },
  { key: 'member_referral_activation', label: 'Membro — ativar partilha' },
  { key: 'referral_activation', label: 'Convites — ativar partilha' },
  { key: 'share_mission', label: 'Partilhar missão' },
  { key: 'referral_reward_inviter', label: 'Convites — recompensa para quem convidou' },
  { key: 'referral_reward_invitee', label: 'Convites — saldo para novo membro' },
  { key: 'member_welcome', label: 'Membro — acolhimento' },
  { key: 'member_pray_intentions', label: 'Membro — entregar intenções' },
  { key: 'member_novena_invite', label: 'Membro — convite a novena' },
  { key: 'member_learn_garabandal', label: 'Membro — conhecer Garabandal' },
];

// Friendly Portuguese names for funnel step display (avoids showing raw keys like "member_welcome").
const templateLabelByKey: Record<string, string> = Object.fromEntries(
  campaignTemplateOptions.map((t) => [t.key, t.label]),
);

const marketingFlowPlan = [
  {
    title: 'Lista de espera e vagas reais',
    audience: 'Pessoas em waitlist de uma peregrinação específica',
    goal: 'Criar urgência quando abre uma vaga sem prometer disponibilidade falsa.',
    cadence: 'Boas-vindas ao entrar na lista; vaga aberta só quando há disponibilidade real.',
    conditions: ['Contacto subscrito', 'Peregrinação com vagas abertas', 'Sem reserva confirmada', 'Deduplicado por contacto e peregrinação'],
    conflict: 'Não concorre com recuperação de inscrição enquanto não houver vaga; respeita sempre 24h desde o último email.',
    templates: ['waitlist_welcome', 'waitlist_open_spot', 'waitlist_garabandal_story', 'waitlist_book_recommendation', 'waitlist_mission_support', 'waitlist_member_invitation'],
  },
  {
    title: 'Recuperação de peregrinação',
    audience: 'Leads que pediram informação ou começaram inscrição e não reservaram',
    goal: 'Responder a dúvidas, recuperar intenção e levar à reserva enquanto existem lugares.',
    cadence: 'Sequência espaçada: convite inicial, testemunho/FAQ, último lembrete.',
    conditions: ['Contacto com interesse em peregrinação', 'Ainda sem reserva', 'has_availability', 'Lead score prioriza a fila'],
    conflict: 'Se a pessoa entrar em waitlist sem vagas, sai da copy de “garanta a vaga”.',
    templates: ['brochure_followup_1', 'pilgrimage_testimony', 'pilgrimage_faq_objections', 'abandoned_registration_1', 'abandoned_registration_faq', 'abandoned_registration_final'],
  },
  {
    title: 'Doações e Casa de Acolhimento',
    audience: 'Doadores e apoiantes com histórico de contribuição',
    goal: 'Agradecer, mostrar impacto concreto da Casa e incentivar nova ajuda ou partilha.',
    cadence: 'Agradecimento próximo da doação; história de impacto depois de conteúdo/valor.',
    conditions: ['Contacto marketable', 'Doação registada ou alto envolvimento', 'Sem pedido repetido logo a seguir a outro pedido'],
    conflict: 'Não coloca dois pedidos seguidos; intercala impacto, gratidão e partilha familiar.',
    templates: ['donation_thank_you', 'donation_thank_you_story'],
  },
  {
    title: 'Membros',
    audience: 'Doadores, apoiantes e membros novos/pendentes',
    goal: 'Explicar benefícios, estabilizar apoio mensal/anual e acolher novos membros.',
    cadence: 'Convite contextual; depois onboarding e formação espiritual para membros.',
    conditions: ['Não é membro ativo ou acabou de aderir', 'Tom público usa sempre membro/membros', 'Sem insistência após adesão'],
    conflict: 'Se já é membro, recebe acolhimento/conteúdo em vez de convite para aderir.',
    templates: ['donor_to_member', 'member_invitation', 'member_welcome', 'member_pray_intentions', 'member_novena_invite', 'member_learn_garabandal', 'membership_renewal'],
  },
  {
    title: 'Loja e livros oficiais',
    audience: 'Pessoas interessadas em Garabandal, membros, peregrinos e leads frios',
    goal: 'Vender livros certos sem parecer publicidade genérica.',
    cadence: 'Entra como conteúdo útil entre pedidos comerciais ou depois de interesse demonstrado.',
    conditions: ['Produtos ativos', 'Imagem oficial do produto', 'Sem “membro” quando o objetivo é livro'],
    conflict: 'Funciona como email de valor entre doação/membro/peregrinação para reduzir sensação de spam.',
    templates: ['store_book_recommendation'],
  },
  {
    title: 'Comunidade e convites',
    audience: 'Membros e apoiantes com potencial de partilhar a missão',
    goal: 'Trazer familiares e amigos para a comunidade por convite responsável.',
    cadence: 'Depois de relação criada; nunca como primeiro contacto frio.',
    conditions: ['Membro ou apoiador envolvido', 'Tem link/contexto de partilha', 'Mensagem focada em missão, não pressão'],
    conflict: 'Não substitui emails transacionais nem emails de pagamento.',
    templates: ['member_referral_activation', 'referral_activation', 'share_mission'],
  },
];

const waitlistNurtureSteps = [
  {
    delay: 'Dia 0',
    title: 'Boas-vindas',
    templateKey: 'waitlist_welcome',
    purpose: 'Confirmar a entrada na lista de espera e explicar o que acontece a seguir.',
    guardrail: 'Sem promessa de vaga; expectativa honesta de espera.',
  },
  {
    delay: 'Dia 3',
    title: 'Valor espiritual',
    templateKey: 'waitlist_garabandal_story',
    purpose: 'Preparar o coração e aprofundar a história de Garabandal sem pedir compra/doação.',
    guardrail: 'Sem urgência falsa; não fala em vaga disponível.',
  },
  {
    delay: 'Dia 7',
    title: 'Livros oficiais',
    templateKey: 'waitlist_book_recommendation',
    purpose: 'Recomendar livros e guias como preparação natural enquanto a pessoa aguarda vaga.',
    guardrail: 'Não mistura convite para membro nem doação no email de loja.',
  },
  {
    delay: 'Dia 14',
    title: 'Missão e Casa de Acolhimento',
    templateKey: 'waitlist_mission_support',
    purpose: 'Mostrar o impacto concreto do Apostolado e abrir uma doação suave.',
    guardrail: 'Pedido simples, sem culpa; deixa claro que continuar em espera é suficiente.',
  },
  {
    delay: 'Dia 24',
    title: 'Convite para membro',
    templateKey: 'waitlist_member_invitation',
    purpose: 'Convidar a pessoa a pertencer ao Apostolado antes mesmo da peregrinação.',
    guardrail: 'Só se ainda não reservou e ainda não é membro.',
  },
];

const segmentOptions = [
  { slug: 'hot-pilgrimage-leads', label: 'Leads quentes de peregrinação' },
  { slug: 'abandoned-registration', label: 'Inscrição abandonada' },
  { slug: 'brochure-requested-not-booked', label: 'Pediu brochura mas não reservou' },
  { slug: 'waitlist-contacts', label: 'Lista de espera' },
  { slug: 'past-pilgrims', label: 'Já peregrinaram' },
  { slug: 'donors-not-members', label: 'Doadores que não são membros' },
  { slug: 'new-members', label: 'Novos membros' },
  { slug: 'members-without-referrals', label: 'Membros sem convites' },
  { slug: 'expired-members', label: 'Membros expirados (renovação)' },
  { slug: 'high-value-supporters', label: 'Apoiantes de alto valor' },
  { slug: 'newsletter-subscribers', label: 'Newsletter — todos' },
  { slug: 'newsletter-pt', label: 'Newsletter — Português' },
  { slug: 'newsletter-en', label: 'Newsletter — Inglês' },
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
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [previewLanguage, setPreviewLanguage] = useState<'pt' | 'en'>('pt');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [templateCategory, setTemplateCategory] = useState<string>('all');
  const availableTemplateKeys = useMemo(
    () => new Set<string>((data?.templates || []).map((template: any) => String(template.key))),
    [data],
  );

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
        view === 'overview'
          ? '/api/admin/marketing/overview'
          : view === 'contacts'
            ? `/api/admin/marketing/contacts?${new URLSearchParams({ ...(search ? { search } : {}), ...(segment ? { segment } : {}) }).toString()}`
            : view === 'scheduled'
              ? `/api/admin/marketing/scheduled?${new URLSearchParams({ ...(scheduleBucket !== 'all' ? { bucket: scheduleBucket } : {}) }).toString()}`
              : view === 'outbox'
                ? `/api/admin/marketing/outbox?${new URLSearchParams({ ...(outboxStatus !== 'all' ? { status: outboxStatus } : {}), ...(outboxSearch ? { q: outboxSearch } : {}) }).toString()}`
                : view === 'templates' || view === 'flow'
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

  const previewEmailTemplate = async (key: string, language: 'pt' | 'en' = previewLanguage) => {
    setPreviewLanguage(language);
    setPreviewLoading(true);
    try {
      const result = await api(`/api/admin/marketing/templates/${key}/preview`, { method: 'POST', body: JSON.stringify({ language }) });
      setPreviewTemplate({ key, ...result.preview });
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao gerar preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const renderPreviewPanel = (emptyCopy = 'Escolha um modelo na lista para ver como o email é enviado.') => (
    <aside className="sticky top-6 h-fit rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Prévia do Email</h3>
          <p className="mt-1 text-sm font-medium text-slate-500">Exatamente como o contacto vai receber, com dados de exemplo.</p>
        </div>
        <select
          value={previewLanguage}
          onChange={(e) => {
            const nextLanguage = e.target.value === 'en' ? 'en' : 'pt';
            setPreviewLanguage(nextLanguage);
            if (previewTemplate?.key) void previewEmailTemplate(previewTemplate.key, nextLanguage);
          }}
          className="appearance-none rounded-xl border-transparent bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="pt">Português (PT)</option>
          <option value="en">English (EN)</option>
        </select>
      </div>

      {previewLoading && (
        <div className="mt-6 flex h-[600px] flex-col items-center justify-center rounded-lg bg-slate-50/50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
          <p className="mt-4 font-bold text-slate-500">A gerar prévia...</p>
        </div>
      )}

      {!previewLoading && previewTemplate && (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Assunto do Email</p>
            <p className="mt-1 font-semibold text-slate-900">{previewTemplate.subject}</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm ring-4 ring-slate-50">
            <iframe title="Email preview" srcDoc={previewTemplate.html} className="h-[600px] w-full bg-white" />
          </div>
        </div>
      )}

      {!previewLoading && !previewTemplate && (
        <div className="mt-6 flex h-[600px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/50 px-8">
          <Eye className="h-10 w-10 text-slate-300" />
          <p className="mt-4 text-center text-sm font-medium text-slate-500">{emptyCopy}</p>
        </div>
      )}
    </aside>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Toaster richColors position="top-center" />

      {/* Topbar simples: título, navegação por separadores e duas ações */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <a href="/admin/dashboard" className="flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
                <ChevronRight className="h-4 w-4 rotate-180" />
                Admin
              </a>
              <span className="text-slate-300">/</span>
              <h1 className="text-lg font-semibold tracking-tight">Marketing</h1>
              {isFetching && !loading && <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />}
            </div>

            <div className="flex items-center gap-2">
              {(view === 'funnels' || view === 'scheduled') && (
                <button
                  onClick={() => prepareAutomations()}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
                >
                  <PlayCircle className="h-4 w-4" />
                  Processar fila
                </button>
              )}
              <button onClick={syncContacts} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                <Database className="h-4 w-4" />
                Sincronizar
              </button>
              <button onClick={() => load(false)} title="Atualizar" className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <nav className="mt-3 flex gap-1 overflow-x-auto">
            {platformNav.map((item) => {
              const active = item.view === view;
              return (
                <button
                  key={item.view}
                  onClick={() => navigateTo(item.view, item.href)}
                  className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
          <>
            {loading && (
              <div key="loading" className="flex h-64 items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
                  <p className="text-sm text-slate-500">A carregar…</p>
                </div>
              </div>
            )}

            {/* OVERVIEW */}
            {!loading && view === 'overview' && data && (
              <div key="overview" className="space-y-6">
                {/* Números essenciais, sem decoração */}
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  {[
                    ['Contactos', data.stats.total_contacts],
                    ['Contactáveis', data.stats.marketable_contacts],
                    ['Newsletter', data.segmentCounts?.['newsletter-subscribers'] || 0],
                    ['Automações ativas', (data.funnels || []).filter((f: any) => f.status === 'active').length],
                    ['Valor total', formatCurrency(data.stats.total_value)],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-5">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>

                {(data.failedMessages || []).length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-semibold text-red-800">
                      {(data.failedMessages || []).length} email(s) falharam recentemente.
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-red-700">
                      {(data.failedMessages || []).slice(0, 3).map((message: any) => (
                        <li key={message.id} className="truncate">
                          {message.to_email} — {message.error_message || 'erro desconhecido'}
                        </li>
                      ))}
                    </ul>
                    <button onClick={() => navigateTo('outbox', '/admin/marketing/outbox')} className="mt-2 text-xs font-semibold text-red-800 underline">
                      Ver enviados
                    </button>
                  </div>
                )}

                <div className="grid gap-6 lg:grid-cols-3">
                  {/* Próximos envios — a fila real do cron, mostrada antes de acontecer */}
                  <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-semibold text-slate-900">Próximos envios</h2>
                        <p className="mt-0.5 text-sm text-slate-500">Quem recebe o quê e quando.</p>
                      </div>
                      <button onClick={() => navigateTo('scheduled', '/admin/marketing/scheduled')} className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
                        Ver tudo →
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {(data.upcoming || []).slice(0, 8).map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between gap-4 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">{item.contact_name || item.contact_email || 'Contacto'}</p>
                            <p className="truncate text-xs text-slate-500">
                              {item.funnel_name} · passo {item.step_number}/{item.total_steps}
                              {item.template_key ? ` · ${templateLabelByKey[item.template_key] || item.template_key}` : ''}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-medium text-slate-500">{formatDateTime(item.next_run_at)}</span>
                        </div>
                      ))}
                      {(data.upcoming || []).length === 0 && (
                        <p className="py-8 text-center text-sm text-slate-500">Nenhum envio automático na fila.</p>
                      )}
                    </div>
                  </section>

                  {/* Atividade recente, em lista simples */}
                  <section className="rounded-xl border border-slate-200 bg-white p-6">
                    <h2 className="mb-4 text-base font-semibold text-slate-900">Atividade recente</h2>
                    <div className="space-y-3">
                      {(data.recentEvents || []).slice(0, 8).map((event: any) => (
                        <div key={`${event.source_table}-${event.source_id}-${event.event_type}`}>
                          <p className="text-sm font-medium text-slate-900">{event.title}</p>
                          <p className="text-xs text-slate-500">{event.contact_name} · {formatDateTime(event.occurred_at)}</p>
                        </div>
                      ))}
                      {(data.recentEvents || []).length === 0 && (
                        <p className="py-4 text-center text-sm text-slate-500">Sem atividade recente.</p>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            )}

            {/* CONTACTS / CRM */}
            {!loading && view === 'contacts' && data && (
              <div
                key="contacts"
                className="space-y-6"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Procurar nome ou email…" className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-slate-400" />
                  </div>
                  <select value={segment} onChange={(e) => setSegment(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-slate-400 md:w-72">
                    <option value="">Todos os segmentos</option>
                    {(segmentOptions).map((option) => {
                      // A API de contactos devolve segmentCounts como array [{slug,count}]
                      const counts = Array.isArray(data.segmentCounts)
                        ? data.segmentCounts.find((row: any) => row.slug === option.slug)?.count
                        : data.segmentCounts?.[option.slug];
                      return (
                        <option key={option.slug} value={option.slug}>
                          {option.label} ({typeof counts === 'number' ? counts : 0})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50/50 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="p-4">Contacto</th>
                        <th className="p-4">Fase</th>
                        <th className="p-4">Score</th>
                        <th className="p-4">Valor</th>
                        <th className="p-4">Recomendação</th>
                        <th className="p-4">Atividade</th>
                        <th className="p-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(data.contacts || []).map((contact: any) => {
                        const initials = (contact.display_name || 'C').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                        return (
                          <tr key={contact.id} className="group transition-colors hover:bg-slate-50">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                                  {initials}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{contact.display_name}</p>
                                  <p className="mt-0.5 text-xs text-slate-500">{contact.normalized_email || contact.normalized_phone}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4"><StatusPill label={stageLabel(contact.lifecycle_stage)} tone={contact.lifecycle_stage === 'lead' ? 'blue' : 'slate'} /></td>
                            <td className="p-4"><ScoreBadge score={contact.lead_score} /></td>
                            <td className="p-4 text-sm font-medium text-slate-900">{formatCurrency(contact.value_total)}</td>
                            <td className="p-4 text-xs text-slate-500">{contact.recommendation || '—'}</td>
                            <td className="p-4 text-xs text-slate-500">{formatDate(contact.latest_activity_at)}</td>
                            <td className="p-4 text-right">
                              <Link href={`/admin/marketing/contacts/${contact.id}`} className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
                                Ver
                              </Link>
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
                      <h3 className="mt-4 text-lg font-semibold text-slate-900">Nenhum contacto encontrado</h3>
                      <p className="mt-2 text-sm text-slate-500">Tenta ajustar os teus filtros de pesquisa.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FUNNELS / AUTOMATIONS */}
            {!loading && view === 'funnels' && data && (
              <div
                key="funnels"
                className="grid gap-8 lg:grid-cols-2"
              >
                {(data.funnels || []).map((funnel: any) => (
                  <div key={funnel.id} className="rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-100 p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-900">{funnel.name}</h3>
                            <StatusPill
                              label={funnel.status === 'active' ? 'Ativo' : funnel.status === 'draft' ? 'Rascunho' : 'Pausado'}
                              tone={funnel.status === 'active' ? 'emerald' : 'slate'}
                            />
                          </div>
                          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{funnel.description}</p>
                        </div>
                        <button
                          onClick={() => updateFunnel(funnel, funnel.status === 'active' ? 'paused' : 'active')}
                          title={funnel.status === 'active' ? 'Pausar' : 'Ativar'}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                          {funnel.status === 'active' ? <PauseCircle className="h-5 w-5" /> : <PlayCircle className="h-5 w-5" />}
                        </button>
                      </div>

                      <div className="mt-4 flex gap-6 text-sm">
                        <span className="text-slate-500"><strong className="font-semibold text-slate-900">{funnel.enrollment_counts?.active || 0}</strong> ativos</span>
                        <span className="text-slate-500"><strong className="font-semibold text-slate-900">{funnel.enrollment_counts?.completed || 0}</strong> concluídos</span>
                        <span className="text-slate-500"><strong className="font-semibold text-slate-900">{funnel.enrollment_counts?.paused || 0}</strong> em pausa</span>
                      </div>
                    </div>

                    <div className="p-6">
                      <ol className="space-y-3">
                        {(funnel.steps || []).map((step: any, idx: number) => (
                          <li key={idx} className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900">{templateLabelByKey[step.template_key] || step.template_key || 'Passo'}</p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                +{step.delay_hours || 0}h
                                {step.condition ? ` · se: ${step.condition}` : ''}
                                {step.stop_if ? ` · pára se: ${step.stop_if.join(', ')}` : ''}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SCHEDULED */}
            {!loading && view === 'scheduled' && data && (
              <div
                key="scheduled"
                className="space-y-6"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    ['all', 'Todos'],
                    ['ready', 'Prontos'],
                    ['today', 'Hoje'],
                    ['upcoming', 'Programados'],
                    ['blocked', 'Bloqueados'],
                    ['paused', 'Pausados'],
                    ['failed', 'Falhados'],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setScheduleBucket(key)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                        scheduleBucket === key
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                      }`}
                    >
                      {label}
                      {key !== 'all' && typeof data.stats?.[key] === 'number' ? ` · ${data.stats[key]}` : ''}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  {(data.scheduled || []).length === 0 && (
                    <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50">
                      <RefreshCw className="h-10 w-10 text-slate-300" />
                      <p className="mt-4 font-bold text-slate-500">A agenda está vazia.</p>
                    </div>
                  )}
                  {(data.scheduled || []).map((item: any) => (
                    <div key={item.id} className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
                      <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill label={item.evaluation?.label || item.status} tone={item.evaluation?.tone || 'slate'} />
                            <h4 className="text-lg font-semibold text-slate-900">{item.contact?.display_name || item.contact?.normalized_email || 'Contacto'}</h4>
                            <ScoreBadge score={item.contact?.lead_score || 0} />
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 border border-slate-200">{stageLabel(item.contact?.lifecycle_stage)}</span>
                            <span className="rounded-full bg-blue-50/80 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-100">{item.contact?.language === 'en' ? 'EN' : 'PT'}</span>
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
                          <button onClick={() => updateEnrollment(item.id, 'send-now')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition-colors">
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
                        <Link href={`/admin/marketing/contacts/${item.contact_id}`} className="ml-auto font-semibold text-blue-600 hover:text-blue-700 hover:underline">Perfil Completo &rarr;</Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* OUTBOX */}
            {!loading && view === 'outbox' && data && (
              <div
                key="outbox"
                className="space-y-6"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    ['all', 'Todos'],
                    ['sent', 'Enviados'],
                    ['failed', 'Falhados'],
                    ['skipped', 'Ignorados'],
                    ['test', 'Testes'],
                    ['queued', 'Fila'],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setOutboxStatus(key)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                        outboxStatus === key
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                      }`}
                    >
                      {label}
                      {key !== 'all' && typeof data.stats?.[key] === 'number' ? ` · ${data.stats[key]}` : ''}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={outboxSearch} onChange={(e) => setOutboxSearch(e.target.value)} placeholder="Pesquisar email, assunto, contacto ou template…" className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-slate-400" />
                </div>

                {typeof data.stats?.sent === 'number' && data.stats.sent > 0 && (
                  <p className="text-xs font-medium text-slate-500">
                    Últimos 7 dias: {data.stats.sent} enviados
                    {' · '}<span className="font-bold text-blue-700">{data.stats.opened || 0} abertos ({Math.round(((data.stats.opened || 0) / data.stats.sent) * 100)}%)</span>
                    {' · '}<span className="font-bold text-emerald-700">{data.stats.clicked || 0} clicados</span>
                    {typeof data.stats.bounced === 'number' && data.stats.bounced > 0 ? <>{' · '}<span className="font-bold text-red-700">{data.stats.bounced} devolvidos/spam</span></> : null}
                    {' — '}dados de abertura começam a contar a partir da ativação do webhook do Resend.
                  </p>
                )}

                <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm">
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
                            <p className="font-semibold text-slate-900 line-clamp-1">{message.subject || 'Sem assunto'}</p>
                            <div className="mt-1 flex items-center gap-2 text-xs font-medium text-slate-500">
                              <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {message.template_key || 'template'}</span>
                              <span>·</span>
                              <span>{message.to_email}</span>
                            </div>
                            {message.error_message && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 border border-red-100 line-clamp-2">{message.error_message}</p>}
                          </td>
                          <td className="p-4 align-top">
                            <p className="font-bold text-slate-900">{message.contact?.display_name || '—'} <span className="ml-1 inline-flex rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-100">{message.contact?.language === 'en' ? 'EN' : 'PT'}</span></p>
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
                            {(() => {
                              const meta = message.metadata || {};
                              const badge = meta.complained_at
                                ? { label: 'Spam ⚠', cls: 'bg-red-50 text-red-700 border-red-200', at: meta.complained_at }
                                : meta.bounced_at
                                  ? { label: 'Devolvido', cls: 'bg-red-50 text-red-700 border-red-200', at: meta.bounced_at }
                                  : meta.clicked_at
                                    ? { label: `Clicado${Number(meta.click_count) > 1 ? ` ×${meta.click_count}` : ''}`, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', at: meta.clicked_at }
                                    : meta.opened_at
                                      ? { label: `Aberto${Number(meta.open_count) > 1 ? ` ×${meta.open_count}` : ''}`, cls: 'bg-blue-50 text-blue-700 border-blue-200', at: meta.opened_at }
                                      : null;
                              return badge ? (
                                <span title={formatDateTime(badge.at)} className={`mt-1.5 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>
                                  {badge.label}
                                </span>
                              ) : null;
                            })()}
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
              </div>
            )}

            {/* FLOW & PREVIEWS */}
            {!loading && view === 'flow' && data && (
              <div
                key="flow"
                className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_500px]"
              >
                <div className="space-y-6">
                  <section className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Mapa operacional</p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Ordem dos emails, condições e previews</h3>
                        <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500">
                          Esta página mostra o que cada pessoa pode receber, porquê, e que conflitos são travados antes do envio.
                          Os botões PT/EN usam o mesmo renderer que envia os emails reais.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link href="/admin/emails" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800">
                          <Mail className="h-4 w-4" />
                          Todos os emails
                        </Link>
                        <Link href="/admin/marketing/templates" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
                          <Eye className="h-4 w-4" />
                          Só marketing
                        </Link>
                      </div>
                    </div>
                  </section>

                  <div className="grid gap-4 md:grid-cols-3">
                    <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                      <div className="flex items-center gap-2 text-emerald-700">
                        <CheckCircle className="h-5 w-5" />
                        <span className="text-xs font-semibold uppercase tracking-wide">Anti-spam</span>
                      </div>
                      <p className="mt-3 text-2xl font-semibold text-emerald-950">Máx. 1/dia</p>
                      <p className="mt-1 text-sm font-semibold leading-5 text-emerald-800">24h mínimas entre emails por contacto; teto semanal de 7.</p>
                    </section>
                    <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                      <div className="flex items-center gap-2 text-amber-700">
                        <Target className="h-5 w-5" />
                        <span className="text-xs font-semibold uppercase tracking-wide">Relevância</span>
                      </div>
                      <p className="mt-3 text-2xl font-semibold text-amber-950">Score primeiro</p>
                      <p className="mt-1 text-sm font-semibold leading-5 text-amber-800">A fila prioriza contactos com maior valor/intenção quando há limite de lote.</p>
                    </section>
                    <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                      <div className="flex items-center gap-2 text-blue-700">
                        <PauseCircle className="h-5 w-5" />
                        <span className="text-xs font-semibold uppercase tracking-wide">Conflitos</span>
                      </div>
                      <p className="mt-3 text-2xl font-semibold text-blue-950">Sem pressão dupla</p>
                      <p className="mt-1 text-sm font-semibold leading-5 text-blue-800">Pedidos são espaçados e emails de valor entram entre convites comerciais.</p>
                    </section>
                  </div>

                  <div className="space-y-4">
                    <section className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
                      <div className="border-b border-amber-100 bg-amber-50 p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Funil em aprovação</p>
                            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Lista de espera: nurture até abrir vaga</h3>
                            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                              Sequência pensada para pessoas que estão em lista de espera: primeiro valor espiritual, depois livros,
                              depois missão/doação e só no fim convite para membro. O funil fica em <strong>draft</strong> até aprovação.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <StatusPill label="draft" tone="amber" />
                            <StatusPill label="waitlist-contacts" tone="blue" />
                          </div>
                        </div>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {waitlistNurtureSteps.map((step, index) => {
                          const canPreview = availableTemplateKeys.has(step.templateKey);
                          return (
                            <div key={step.templateKey} className="grid gap-4 p-5 lg:grid-cols-[88px_minmax(0,1fr)_180px] lg:items-center">
                              <div className="flex items-center gap-3 lg:block">
                                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white">
                                  {index + 1}
                                </div>
                                <p className="mt-0 text-xs font-semibold uppercase tracking-wide text-slate-400 lg:mt-2">{step.delay}</p>
                              </div>
                              <div>
                                <h4 className="text-lg font-semibold text-slate-900">{step.title}</h4>
                                <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{step.purpose}</p>
                                <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                                  Guardrail: {step.guardrail}
                                </p>
                                <code className="mt-2 inline-flex rounded bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">
                                  {step.templateKey}
                                </code>
                              </div>
                              <div className="flex gap-2 lg:justify-end">
                                {canPreview ? (
                                  <>
                                    <button
                                      onClick={() => previewEmailTemplate(step.templateKey, 'pt')}
                                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      PT-BR
                                    </button>
                                    <button
                                      onClick={() => previewEmailTemplate(step.templateKey, 'en')}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      EN
                                    </button>
                                  </>
                                ) : (
                                  <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500">Tarefa interna</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    {marketingFlowPlan.map((flow, index) => (
                      <section key={flow.title} className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm">
                        <div className="flex flex-wrap items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white">
                            {String(index + 1).padStart(2, '0')}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h3 className="text-xl font-semibold tracking-tight text-slate-900">{flow.title}</h3>
                                <p className="mt-1 text-sm font-bold text-slate-500">{flow.audience}</p>
                              </div>
                              <StatusPill label={index === 0 ? 'crítico' : index === 4 ? 'valor' : 'planeado'} tone={index === 0 ? 'amber' : index === 4 ? 'emerald' : 'blue'} />
                            </div>

                            <div className="mt-5 grid gap-4 lg:grid-cols-3">
                              <div className="rounded-lg bg-slate-50 p-4">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Objetivo</p>
                                <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{flow.goal}</p>
                              </div>
                              <div className="rounded-lg bg-slate-50 p-4">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Cadência</p>
                                <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{flow.cadence}</p>
                              </div>
                              <div className="rounded-lg bg-slate-50 p-4">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Conflitos tratados</p>
                                <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{flow.conflict}</p>
                              </div>
                            </div>

                            <div className="mt-5">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Condições antes de enviar</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {flow.conditions.map((condition) => (
                                  <span key={condition} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                                    {condition}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="mt-5 overflow-hidden rounded-lg border border-slate-100">
                              {flow.templates.map((templateKey) => {
                                const exists = availableTemplateKeys.has(templateKey);
                                return (
                                  <div key={templateKey} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white p-3 last:border-b-0">
                                    <div className="min-w-0">
                                      <p className="font-semibold text-slate-900">{templateLabelByKey[templateKey] || templateKey.replace(/_/g, ' ')}</p>
                                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400">
                                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{templateKey}</code>
                                        <span>{exists ? 'template ativo' : 'a confirmar no backend'}</span>
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => previewEmailTemplate(templateKey, 'pt')}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                        PT
                                      </button>
                                      <button
                                        onClick={() => previewEmailTemplate(templateKey, 'en')}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                        EN
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </section>
                    ))}
                  </div>
                </div>

                {renderPreviewPanel('Escolha um email no fluxo para ver o texto, imagens e botão em PT ou EN.')}
              </div>
            )}

            {/* TEMPLATES */}
            {!loading && view === 'templates' && data && (
              <div
                key="templates"
                className="grid gap-8 lg:grid-cols-[1fr_500px]"
              >
                <div className="h-fit">
                  {(() => {
                    const allTemplates = data.templates || [];
                    // Categorias presentes, ordenadas pela jornada do contacto
                    const cats: string[] = (Array.from(new Set(allTemplates.map((t: any) => String(t.category || '')).filter(Boolean))) as string[])
                      .sort((a, b) => getCategoryMeta(a).order - getCategoryMeta(b).order);
                    const activeCatCount = templateCategory === 'all'
                      ? allTemplates.length
                      : allTemplates.filter((t: any) => t.category === templateCategory).length;

                    return (
                      <>
                        {/* Cabeçalho + filtros de categoria */}
                        <div className="mb-6">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Modelos de Email</h2>
                            <span className="text-sm font-bold text-slate-400">{activeCatCount} {activeCatCount === 1 ? 'modelo' : 'modelos'}</span>
                          </div>
                          <p className="mt-1 text-sm font-medium text-slate-500">Todos os emails automáticos, organizados pela jornada do contacto. Clique em qualquer um para ver a prévia real.</p>

                          <div className="mt-5 flex flex-wrap gap-2">
                            <button
                              onClick={() => setTemplateCategory('all')}
                              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${templateCategory === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                              <Layers className="h-3.5 w-3.5" /> Todos ({allTemplates.length})
                            </button>
                            {cats.map((cat) => {
                              const meta = getCategoryMeta(cat);
                              const Icon = meta.icon;
                              const isActive = templateCategory === cat;
                              const count = allTemplates.filter((t: any) => t.category === cat).length;
                              return (
                                <button
                                  key={cat}
                                  onClick={() => setTemplateCategory(cat)}
                                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-white' : meta.color}`} /> {meta.label} ({count})
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Secções por categoria */}
                        <div className="space-y-10">
                          {cats
                            .filter((cat) => templateCategory === 'all' || templateCategory === cat)
                            .map((cat) => {
                              const meta = getCategoryMeta(cat);
                              const Icon = meta.icon;
                              const items = allTemplates.filter((t: any) => t.category === cat);
                              if (!items.length) return null;
                              return (
                                <section key={cat}>
                                  <div className="mb-4 flex items-start gap-3">
                                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${meta.bg} ${meta.color}`}>
                                      <Icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-semibold text-slate-900">{meta.label}</h3>
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{items.length}</span>
                                      </div>
                                      {meta.flow && <p className="mt-0.5 max-w-xl text-xs font-medium text-slate-400">{meta.flow}</p>}
                                    </div>
                                  </div>

                                  <div className="grid gap-4 md:grid-cols-2">
                                    {items.map((template: any) => {
                                      const isSelected = previewTemplate?.key === template.key;
                                      return (
                                        <button
                                          key={template.key}
                                          onClick={() => previewEmailTemplate(template.key)}
                                          className={`group flex flex-col rounded-lg border bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${isSelected ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200/70 hover:border-slate-300'}`}
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <p className="font-semibold leading-tight text-slate-900">{template.name}</p>
                                            <span className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${isSelected ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600'}`}>
                                              <Eye className="h-3.5 w-3.5" /> Prévia
                                            </span>
                                          </div>
                                          {template.description && <p className="mt-2 line-clamp-2 text-xs font-medium text-slate-500">{template.description}</p>}
                                          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Assunto</p>
                                            <p className="mt-0.5 line-clamp-1 text-xs font-bold text-slate-700">{template.defaultSubject}</p>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </section>
                              );
                            })}
                        </div>
                      </>
                    );
                  })()}
                </div>

                {renderPreviewPanel('Escolha um modelo na lista para ver como o email é enviado.')}
              </div>
            )}

            {/* NEWSLETTER */}
            {!loading && view === 'newsletter' && data && (
              <div key="newsletter" className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  {[
                    ['Subscritores', data.stats?.total ?? 0],
                    ['Português', data.stats?.pt ?? 0],
                    ['Inglês', data.stats?.en ?? 0],
                    ['Espanhol (sem envios)', data.stats?.es ?? 0],
                    ['Suprimidos', data.stats?.suppressed ?? 0],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-5">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>

                <section className="rounded-xl border border-slate-200 bg-white p-6">
                  <h2 className="text-base font-semibold text-slate-900">Como funciona a newsletter</h2>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    <li>• <strong className="font-semibold text-slate-900">Audiência:</strong> só quem fez opt-in na newsletter (PT + EN). Contactos só-do-site ficam de fora dos envios de artigos.</li>
                    <li>• <strong className="font-semibold text-slate-900">Cadência:</strong> mensal — 3-4 artigos do site + 1 destaque (livro, peregrinação ou missão).</li>
                    <li>• <strong className="font-semibold text-slate-900">Aprovação:</strong> nada é enviado sem o teu OK; a edição é proposta e revês a preview primeiro.</li>
                    <li>• <strong className="font-semibold text-slate-900">Espanhol:</strong> os {data.stats?.es ?? 0} contactos ES estão guardados mas não recebem nada até existir copy em espanhol.</li>
                    <li>• <strong className="font-semibold text-slate-900">Proteções:</strong> máx. 1 email de marketing por pessoa por dia; unsubscribe individual em todos os envios.</li>
                  </ul>
                  <button
                    onClick={() => { setSegment('newsletter-subscribers'); navigateTo('contacts', '/admin/marketing/contacts'); }}
                    className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Ver subscritores em Contactos →
                  </button>
                </section>

                <div className="grid gap-6 lg:grid-cols-2">
                  <section className="rounded-xl border border-slate-200 bg-white p-6">
                    <h2 className="mb-4 text-base font-semibold text-slate-900">Campanhas enviadas</h2>
                    <div className="divide-y divide-slate-100">
                      {(data.campaigns || []).map((campaign: any) => (
                        <div key={campaign.id} className="py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="min-w-0 truncate text-sm font-medium text-slate-900">{campaign.name}</p>
                            <StatusPill
                              label={campaign.status === 'sent' ? 'Enviada' : campaign.status === 'sending' ? 'A enviar' : campaign.status}
                              tone={campaign.status === 'sent' ? 'emerald' : campaign.status === 'sending' ? 'blue' : 'slate'}
                            />
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDateTime(campaign.created_at)}
                            {campaign.metrics?.sent != null ? ` · ${campaign.metrics.sent} enviados` : campaign.metrics?.planned != null ? ` · ${campaign.metrics.planned} planeados` : ''}
                            {campaign.metrics?.failed ? ` · ${campaign.metrics.failed} falhados` : ''}
                          </p>
                        </div>
                      ))}
                      {(data.campaigns || []).length === 0 && (
                        <p className="py-8 text-center text-sm text-slate-500">Ainda não foi enviada nenhuma campanha.</p>
                      )}
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-6">
                    <h2 className="mb-4 text-base font-semibold text-slate-900">Últimos subscritores</h2>
                    <div className="divide-y divide-slate-100">
                      {(data.recentSubscribers || []).map((subscriber: any) => (
                        <div key={subscriber.id} className="flex items-center justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">{subscriber.display_name || subscriber.normalized_email}</p>
                            <p className="truncate text-xs text-slate-500">{subscriber.normalized_email}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-600">
                            {subscriber.language || 'pt'}
                          </span>
                        </div>
                      ))}
                      {(data.recentSubscribers || []).length === 0 && (
                        <p className="py-8 text-center text-sm text-slate-500">Sem subscritores.</p>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            )}

            {/* Other views fallback */}
            {!loading && view !== 'overview' && view !== 'newsletter' && view !== 'flow' && view !== 'contacts' && view !== 'funnels' && view !== 'scheduled' && view !== 'outbox' && view !== 'templates' && data && (
               <div
                key="other"
               >
                 <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
                    <div className="text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                        <Layers className="h-8 w-8 text-slate-400" />
                      </div>
                      <h3 className="mt-4 text-xl font-semibold text-slate-900">Em Desenvolvimento</h3>
                      <p className="mt-2 text-slate-500">A nova interface para este módulo está a ser finalizada.</p>
                    </div>
                 </div>
               </div>
            )}

          </>
      </main>
    </div>
  );
}
