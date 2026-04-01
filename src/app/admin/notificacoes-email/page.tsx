"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { format, formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import AdminLayout from '../../../components/admin/AdminLayout';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import {
  buildEmailActivitySummary,
  formatRecipientList,
  getEmailStatusLabel,
  type EmailActivityStatusKey,
  type EmailCategoryKey,
  type ResendEmailActivityDetail,
  type ResendEmailActivityItem,
} from '../../../lib/resend-email-activity';
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Gavel,
  Gift,
  KeyRound,
  LayoutTemplate,
  Mail,
  Map,
  MousePointerClick,
  RefreshCw,
  Search,
  Send,
  ShoppingCart,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type EmailActivityResponse = {
  emails: ResendEmailActivityItem[];
  summary: ReturnType<typeof buildEmailActivitySummary>;
  hasMore: boolean;
};

type EmailActivityDetailResponse = {
  email: ResendEmailActivityDetail;
};

type PageTab = 'activity' | 'flows';
type CategoryFilter = 'all' | EmailCategoryKey;

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

const STATUS_OPTIONS: Array<{ value: 'all' | EmailActivityStatusKey; label: string }> = [
  { value: 'all', label: 'Todos os estados' },
  { value: 'sent', label: 'Enviado' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'opened', label: 'Aberto' },
  { value: 'clicked', label: 'Clicado' },
  { value: 'failed', label: 'Falhou' },
  { value: 'bounced', label: 'Rejeitado' },
];

const CATEGORY_CONFIG: Record<
  EmailCategoryKey,
  {
    label: string;
    icon: React.ElementType;
    color: string;
    bg: string;
    border: string;
    activeBg: string;
  }
> = {
  pilgrimages: {
    label: 'Peregrinações',
    icon: Map,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    activeBg: 'bg-violet-600',
  },
  members: {
    label: 'Membros',
    icon: Users,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    activeBg: 'bg-blue-600',
  },
  store: {
    label: 'Loja',
    icon: ShoppingCart,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    activeBg: 'bg-amber-500',
  },
  donations: {
    label: 'Doações',
    icon: Gift,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    activeBg: 'bg-rose-600',
  },
  auctions: {
    label: 'Leilão',
    icon: Gavel,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    activeBg: 'bg-orange-600',
  },
  other: {
    label: 'Outros',
    icon: Mail,
    color: 'text-slate-500',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    activeBg: 'bg-slate-700',
  },
};

// ─── Email flows — real data from codebase ────────────────────────────────────

type EmailFlow = {
  name: string;
  trigger: string;
  subject: string;
  isAdmin?: boolean;
  isCron?: boolean;
};

type FlowSection = {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  activeBg: string;
  flows: EmailFlow[];
};

const EMAIL_FLOW_SECTIONS: FlowSection[] = [
  {
    key: 'auth',
    label: 'Autenticação',
    icon: KeyRound,
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    activeBg: 'bg-slate-700',
    flows: [
      {
        name: 'Magic Link de Acesso',
        trigger: 'Utilizador solicita login sem password',
        subject: 'Link de acesso à sua conta',
      },
      {
        name: 'Recuperação de Password',
        trigger: 'Utilizador clica em "Esqueci a password"',
        subject: 'Recuperação de password da sua conta',
      },
      {
        name: 'Acesso à Inscrição',
        trigger: 'Utilizador solicita link de acesso a uma inscrição',
        subject: 'Acesso à sua inscrição — {peregrinação}',
      },
    ],
  },
  {
    key: 'pilgrimages',
    label: 'Peregrinações',
    icon: Map,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    activeBg: 'bg-violet-600',
    flows: [
      {
        name: 'Confirmação de Inscrição',
        trigger: 'Inscrição criada (antes do pagamento)',
        subject: 'Inscrição recebida: {nome da peregrinação}',
      },
      {
        name: 'Notificação Admin — Nova Inscrição',
        trigger: 'Pagamento da inscrição confirmado via Stripe',
        subject: 'Nova inscrição confirmada: {nome da peregrinação}',
        isAdmin: true,
      },
      {
        name: 'Lembrete de Pagamento (Cron)',
        trigger: 'Cron diário — depósito ou prestação em atraso ou a vencer',
        subject: 'Lembrete de pagamento da peregrinação: {nome}',
        isCron: true,
      },
      {
        name: 'Abandono de Inscrição',
        trigger: 'Inscrição iniciada mas não concluída ao fim de X dias',
        subject: 'Continue a sua inscrição',
      },
      {
        name: 'Envio de Brochura / Roteiro',
        trigger: 'Utilizador pede informação sobre uma peregrinação',
        subject: 'Roteiro solicitado: {nome da peregrinação}',
      },
      {
        name: 'Alerta de Transferência Bancária',
        trigger: 'Inscrição criada com pagamento por transferência bancária',
        subject: '🏦 Nova Transferência Bancária — {cliente} ({peregrinação})',
        isAdmin: true,
      },
    ],
  },
  {
    key: 'members',
    label: 'Membros & Quotas',
    icon: Users,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    activeBg: 'bg-blue-600',
    flows: [
      {
        name: 'Boas-vindas ao Sócio',
        trigger: 'Criação de novo membro pelo admin',
        subject: 'Bem-vindo ao Apostolado de Garabandal',
      },
      {
        name: 'Notificação de Nova Adesão / Renovação',
        trigger: 'Pagamento de quota confirmado via Stripe (novo ou renovação)',
        subject: 'Nova Inscrição / Renovação — {nome do membro}',
        isAdmin: true,
      },
      {
        name: 'Recibo de Quota',
        trigger: 'Pagamento de quota confirmado via Stripe',
        subject: 'Recibo Apostolado — {valor}€',
      },
      {
        name: 'Diploma de Membro',
        trigger: 'Enviado em conjunto com o recibo quando diploma disponível',
        subject: 'O seu diploma de membro',
      },
      {
        name: 'Aviso de Quota Prestes a Vencer',
        trigger: 'Cron — quota vai vencer em breve',
        subject: 'Lembrete: anuidade prestes a vencer',
        isCron: true,
      },
      {
        name: 'Lembrete de Renovação',
        trigger: 'Cron — quota vencida ou em atraso',
        subject: 'Lembrete: renovação da anuidade / Anuidade em atraso',
        isCron: true,
      },
      {
        name: 'Quota em Atraso',
        trigger: 'Cron — quota com atraso prolongado',
        subject: 'Anuidade em atraso',
        isCron: true,
      },
      {
        name: 'Membro Suspenso',
        trigger: 'Cron ou admin — membro revogado por falta de pagamento',
        subject: 'Estado de membro suspenso',
        isCron: true,
      },
    ],
  },
  {
    key: 'store',
    label: 'Loja Online',
    icon: ShoppingCart,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    activeBg: 'bg-amber-500',
    flows: [
      {
        name: 'Nova Encomenda (Admin)',
        trigger: 'Pagamento confirmado via Stripe webhook',
        subject: 'Nova encomenda recebida ({referência})',
        isAdmin: true,
      },
      {
        name: 'Confirmação de Encomenda (Cliente)',
        trigger: 'Pagamento confirmado via Stripe webhook',
        subject: 'Encomenda confirmada ({referência})',
      },
      {
        name: 'Encomenda em Preparação',
        trigger: 'Admin muda estado da encomenda para "em preparação"',
        subject: 'Estamos a preparar a sua encomenda ({referência})',
      },
      {
        name: 'Encomenda Enviada',
        trigger: 'Admin marca encomenda como enviada (com tracking)',
        subject: '📦 Encomenda enviada! — Ref. {referência}',
      },
    ],
  },
  {
    key: 'donations',
    label: 'Doações',
    icon: Gift,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    activeBg: 'bg-rose-600',
    flows: [
      {
        name: 'Recibo de Donativo',
        trigger: 'Pagamento de donativo confirmado via Stripe',
        subject: 'Doação registada com sucesso — {valor}€',
      },
      {
        name: 'Notificação Admin — Nova Doação',
        trigger: 'Pagamento de donativo confirmado via Stripe',
        subject: 'Nova doação registada ({valor}€)',
        isAdmin: true,
      },
    ],
  },
  {
    key: 'auctions',
    label: 'Leilão',
    icon: Gavel,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    activeBg: 'bg-orange-600',
    flows: [
      {
        name: 'Lance Ultrapassado',
        trigger: 'Novo lance mais alto que o lance atual de outro utilizador',
        subject: 'Leilão Solidário: o seu lance foi ultrapassado — "{lote}"',
      },
      {
        name: 'Leilão Ganho',
        trigger: 'Cron de fecho do leilão ou processamento manual pelo admin',
        subject: '🏆 Parabéns! Ganhou o leilão — "{lote}"',
        isCron: true,
      },
      {
        name: 'Notificação Admin — Leilão Fechado',
        trigger: 'Cron de fecho do leilão',
        subject: 'Leilão terminado: "{lote}" — {valor vencedor}€',
        isAdmin: true,
        isCron: true,
      },
      {
        name: 'Pagamento do Leilão Confirmado',
        trigger: 'Pagamento do lote ganho confirmado via Stripe',
        subject: 'Pagamento Confirmado: "{lote}"',
      },
    ],
  },
];

// ─── Fetcher ──────────────────────────────────────────────────────────────────

const fetcher = async (url: string) => {
  const { data: { session } } = await supabaseBrowser.auth.getSession();
  if (!session) throw new Error('Sessão inválida.');

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(String(payload?.error || 'Falha ao carregar dados.'));
  return payload;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getStatusTone = (status: EmailActivityStatusKey) => {
  switch (status) {
    case 'opened':
    case 'clicked':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'delivered':
    case 'sent':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'failed':
    case 'bounced':
    case 'complained':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'delivery_delayed':
    case 'suppressed':
    case 'canceled':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

const getStatusIcon = (status: EmailActivityStatusKey) => {
  switch (status) {
    case 'opened': return Eye;
    case 'clicked': return MousePointerClick;
    case 'delivered': return BadgeCheck;
    case 'sent': return Send;
    case 'failed':
    case 'bounced':
    case 'complained': return XCircle;
    default: return CheckCircle2;
  }
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Sem data';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return format(d, "d MMM yyyy, HH:mm", { locale: pt });
};

const formatRelative = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { locale: pt, addSuffix: true });
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminEmailActivityPage() {
  const [pageTab, setPageTab] = useState<PageTab>('activity');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | EmailActivityStatusKey>('all');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerEmailId, setDrawerEmailId] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR<EmailActivityResponse>(
    '/api/admin/email-activity?limit=100',
    fetcher,
    { revalidateOnFocus: false },
  );

  const emails = data?.emails || [];

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<EmailCategoryKey, number>> = {};
    for (const email of emails) {
      counts[email.category] = (counts[email.category] || 0) + 1;
    }
    return counts;
  }, [emails]);

  const filteredEmails = useMemo(() => {
    const query = search.trim().toLowerCase();
    return emails.filter((email) => {
      if (status !== 'all' && email.lastEvent !== status) return false;
      if (category !== 'all' && email.category !== category) return false;
      if (!query) return true;
      const haystack = [email.subject, email.from, email.categoryLabel, ...email.to]
        .join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [category, emails, search, status]);

  const summary = useMemo(() => buildEmailActivitySummary(filteredEmails), [filteredEmails]);

  const totalPages = Math.max(1, Math.ceil(filteredEmails.length / PAGE_SIZE));
  const pagedEmails = filteredEmails.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => { setCurrentPage(1); }, [search, status, category]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerEmailId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerEmailId]);

  const deliveryRate = summary.total > 0
    ? Math.round(((summary.delivered + summary.opened + summary.clicked) / summary.total) * 100)
    : 0;
  const openRate = summary.total > 0
    ? Math.round(((summary.opened + summary.clicked) / summary.total) * 100)
    : 0;

  return (
    <AdminLayout title="Notificações de Email">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                <Zap className="w-3 h-3" />
                Resend em tempo real
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Notificações de Email</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Atividade de emails enviados e mapa dos fluxos automáticos do sistema.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => mutate()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </button>
            <Link
              href="/admin/emails"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors shadow-sm"
            >
              <LayoutTemplate className="w-4 h-4" />
              Templates
            </Link>
          </div>
        </div>

        {/* Page tabs */}
        <div className="flex gap-1 rounded-2xl bg-slate-100 p-1 w-fit">
          {([
            { id: 'activity', label: 'Atividade', icon: Mail },
            { id: 'flows', label: 'Fluxos Automáticos', icon: Zap },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setPageTab(id)}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold transition-all ${
                pageTab === id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════ TAB: ACTIVITY ═══════════════════════ */}
        {pageTab === 'activity' && (
          <div className="space-y-5">

            {/* Category tabs */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategory('all')}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all shadow-sm ${
                  category === 'all'
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                Todos
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${
                  category === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>{emails.length}</span>
              </button>

              {(Object.keys(CATEGORY_CONFIG) as EmailCategoryKey[]).map((key) => {
                const cfg = CATEGORY_CONFIG[key];
                const Icon = cfg.icon;
                const isActive = category === key;
                return (
                  <button
                    key={key}
                    onClick={() => setCategory(key)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all shadow-sm ${
                      isActive
                        ? `${cfg.activeBg} border-transparent text-white`
                        : `bg-white ${cfg.border} ${cfg.color} hover:${cfg.bg}`
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {cfg.label}
                    <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>{categoryCounts[key] || 0}</span>
                  </button>
                );
              })}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
              <div className="col-span-2 sm:col-span-1 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Total</p>
                <p className="mt-1.5 text-3xl font-bold text-slate-900">{summary.total}</p>
                <p className="text-xs mt-1 text-slate-400">emails no filtro</p>
              </div>
              <StatCard label="Entregues" value={summary.delivered} sub={`${deliveryRate}% entrega`} tone="blue" />
              <StatCard label="Abertos" value={summary.opened} sub={`${openRate}% abertura`} tone="emerald" />
              <StatCard label="Clicados" value={summary.clicked} tone="emerald" />
              <StatCard label="Falhados" value={summary.failed} tone="rose" />
              <StatCard label="Rejeitados" value={summary.bounced} tone="amber" />
            </div>

            {/* Search + Status filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <label className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar por destinatário, assunto..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-10 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-300 shadow-sm"
                />
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'all' | EmailActivityStatusKey)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-300 shadow-sm"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Email list */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {/* List header */}
              <div className="border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">Emails enviados</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {filteredEmails.length === 0
                      ? 'Sem resultados'
                      : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filteredEmails.length)} de ${filteredEmails.length} emails`}
                  </p>
                </div>
                {data?.hasMore && (
                  <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                    A mostrar os mais recentes
                  </span>
                )}
              </div>

              {/* List body */}
              {error ? (
                <div className="m-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {String(error.message || 'Erro ao carregar emails.')}
                </div>
              ) : isLoading ? (
                <EmailListSkeleton />
              ) : filteredEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Mail className="w-8 h-8 mb-3 opacity-30" />
                  <p className="text-sm font-medium">Sem emails com estes filtros</p>
                </div>
              ) : (
                <>
                  {/* Table header */}
                  <div className="hidden sm:grid grid-cols-[1fr_160px_130px_100px] gap-4 border-b border-slate-100 px-5 py-2.5 bg-slate-50">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Assunto / Destinatário</p>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Categoria</p>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Estado</p>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400 text-right">Data</p>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {pagedEmails.map((email) => {
                      const cfg = CATEGORY_CONFIG[email.category];
                      const CatIcon = cfg.icon;
                      return (
                        <button
                          key={email.id}
                          onClick={() => setDrawerEmailId(email.id)}
                          className="w-full text-left px-5 py-3.5 hover:bg-blue-50/50 transition-colors group"
                        >
                          <div className="sm:grid sm:grid-cols-[1fr_160px_130px_100px] sm:gap-4 sm:items-center flex flex-col gap-2">
                            {/* Subject + recipient */}
                            <div className="min-w-0 space-y-0.5">
                              <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                                {email.subject}
                              </p>
                              <p className="text-xs text-slate-400 truncate">
                                {formatRecipientList(email.to)}
                              </p>
                            </div>

                            {/* Category */}
                            <div className="flex items-center gap-1.5">
                              <div className={`rounded-lg p-1 ${cfg.bg}`}>
                                <CatIcon className={`w-3 h-3 ${cfg.color}`} />
                              </div>
                              <span className="text-xs font-medium text-slate-600">{cfg.label}</span>
                            </div>

                            {/* Status */}
                            <div>
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStatusTone(email.lastEvent)}`}>
                                {getEmailStatusLabel(email.lastEvent)}
                              </span>
                            </div>

                            {/* Date */}
                            <div className="sm:text-right">
                              <p className="text-xs text-slate-500 font-medium">{formatRelative(email.createdAt)}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Anterior
                      </button>
                      <span className="text-sm text-slate-500">
                        Página <strong className="text-slate-800">{currentPage}</strong> de <strong className="text-slate-800">{totalPages}</strong>
                      </span>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Próxima
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════ TAB: FLOWS ═══════════════════════ */}
        {pageTab === 'flows' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 flex items-start gap-3">
              <Zap className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-blue-900">Mapa completo de fluxos automáticos</p>
                <p className="text-sm text-blue-700 mt-0.5">
                  Todos os emails que o sistema envia, retirados do código real. Emails de admin <AdminBadge /> são enviados internamente. Emails com <CronBadge /> são disparados por cron jobs automáticos.
                </p>
              </div>
            </div>

            {/* Flow count summary */}
            <div className="flex flex-wrap gap-3">
              {EMAIL_FLOW_SECTIONS.map((section) => {
                const Icon = section.icon;
                return (
                  <div
                    key={section.key}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold ${section.bg} ${section.border} ${section.color}`}
                  >
                    <Icon className="w-4 h-4" />
                    {section.label}
                    <span className="rounded-full bg-white/80 border border-current/20 px-1.5 py-0.5 text-[11px] font-bold leading-none">
                      {section.flows.length}
                    </span>
                  </div>
                );
              })}
              <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm">
                Total: {EMAIL_FLOW_SECTIONS.reduce((acc, s) => acc + s.flows.length, 0)} fluxos
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {EMAIL_FLOW_SECTIONS.map((section) => {
                const SectionIcon = section.icon;
                return (
                  <div
                    key={section.key}
                    className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
                  >
                    {/* Section header */}
                    <div className={`px-5 py-4 flex items-center gap-3 border-b border-slate-100 ${section.bg}`}>
                      <div className={`rounded-xl p-2.5 ${section.activeBg}`}>
                        <SectionIcon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-900">{section.label}</p>
                        <p className="text-xs text-slate-500">{section.flows.length} fluxos configurados</p>
                      </div>
                    </div>

                    {/* Flows */}
                    <div className="divide-y divide-slate-100">
                      {section.flows.map((flow, i) => (
                        <div key={i} className="px-5 py-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 shrink-0">
                              <div className={`w-2 h-2 rounded-full mt-1.5 ${section.activeBg}`} />
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5">
                              {/* Name + badges */}
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900">{flow.name}</p>
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  Ativo
                                </span>
                                {flow.isAdmin && <AdminBadge />}
                                {flow.isCron && <CronBadge />}
                              </div>

                              {/* Trigger */}
                              <p className="text-xs text-slate-500 leading-relaxed">
                                <span className="font-semibold text-slate-600">Trigger:</span>{' '}
                                {flow.trigger}
                              </p>

                              {/* Subject */}
                              <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5">
                                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                <p className="text-xs text-slate-600 italic">"{flow.subject}"</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500">
                Este mapa é extraído do código real do sistema. Para ver os emails efetivamente enviados com datas e estados de entrega, consulta o separador <strong>Atividade</strong>.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════ EMAIL DETAIL DRAWER ═══════════════════════ */}
      <EmailDetailDrawer
        emailId={drawerEmailId}
        onClose={() => setDrawerEmailId(null)}
      />
    </AdminLayout>
  );
}

// ─── Email Detail Drawer ──────────────────────────────────────────────────────

function EmailDetailDrawer({
  emailId,
  onClose,
}: {
  emailId: string | null;
  onClose: () => void;
}) {
  const { data, error, isLoading } = useSWR<EmailActivityDetailResponse>(
    emailId ? `/api/admin/email-activity/${emailId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const email = data?.email || null;
  const isOpen = Boolean(emailId);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
          <div>
            <p className="text-base font-bold text-slate-900">Detalhe do email</p>
            <p className="text-xs text-slate-400 mt-0.5">Preview real devolvido pela Resend</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto">
          {!emailId ? null : error ? (
            <div className="m-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {String(error.message || 'Erro ao carregar detalhe.')}
            </div>
          ) : isLoading || !email ? (
            <DrawerSkeleton />
          ) : (
            <div className="flex flex-col h-full">
              {/* Meta section */}
              <div className="px-6 py-5 space-y-4 border-b border-slate-100">
                {/* Status + category badges */}
                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const Icon = getStatusIcon(email.lastEvent);
                    return (
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${getStatusTone(email.lastEvent)}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {getEmailStatusLabel(email.lastEvent)}
                      </span>
                    );
                  })()}
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${CATEGORY_CONFIG[email.category].bg} ${CATEGORY_CONFIG[email.category].border} ${CATEGORY_CONFIG[email.category].color}`}>
                    {(() => {
                      const Icon = CATEGORY_CONFIG[email.category].icon;
                      return <Icon className="w-3.5 h-3.5" />;
                    })()}
                    {CATEGORY_CONFIG[email.category].label}
                  </span>
                </div>

                {/* Subject */}
                <h2 className="text-lg font-bold text-slate-900 leading-snug break-words">
                  {email.subject}
                </h2>

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <MetaItem label="Para" value={email.to.join(', ') || '—'} />
                  <MetaItem label="De" value={email.from || '—'} />
                  <MetaItem label="Enviado em" value={formatDateTime(email.createdAt)} />
                  <MetaItem label="ID Resend" value={email.id} mono />
                </div>
              </div>

              {/* Email preview */}
              <div className="flex-1 bg-slate-50 p-5" style={{ minHeight: '480px' }}>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Preview</p>
                {email.html ? (
                  <div className="h-full rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm" style={{ minHeight: '440px' }}>
                    <iframe
                      srcDoc={email.html}
                      title="Preview do email"
                      className="w-full border-none"
                      style={{ height: '100%', minHeight: '440px' }}
                    />
                  </div>
                ) : email.text ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans">{email.text}</pre>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-8 text-sm text-slate-400 flex items-center justify-center text-center">
                    A Resend não devolveu conteúdo para este email.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub?: string;
  tone: 'slate' | 'blue' | 'emerald' | 'rose' | 'amber';
}) {
  const tones = {
    slate: 'bg-white border-slate-200 text-slate-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    rose: 'bg-rose-50 border-rose-200 text-rose-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
  };
  const subTones = {
    slate: 'text-slate-400',
    blue: 'text-blue-500',
    emerald: 'text-emerald-600',
    rose: 'text-rose-500',
    amber: 'text-amber-500',
  };
  return (
    <div className={`rounded-2xl border px-4 py-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-60">{label}</p>
      <p className="mt-1.5 text-3xl font-bold">{value}</p>
      {sub && <p className={`text-xs mt-1 font-medium ${subTones[tone]}`}>{sub}</p>}
    </div>
  );
}

function MetaItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xs text-slate-700 break-all leading-relaxed ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function AdminBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-300 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
      Admin
    </span>
  );
}

function CronBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-1.5 py-0.5 text-[10px] font-bold text-violet-600">
      <Zap className="w-2.5 h-2.5" />
      Cron
    </span>
  );
}

function EmailListSkeleton() {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-slate-100 rounded w-3/5" />
            <div className="h-3 bg-slate-100 rounded w-2/5" />
          </div>
          <div className="h-3 bg-slate-100 rounded w-20 shrink-0" />
          <div className="h-6 bg-slate-100 rounded-full w-16 shrink-0" />
          <div className="h-3 bg-slate-100 rounded w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function DrawerSkeleton() {
  return (
    <div className="px-6 py-5 space-y-4 animate-pulse">
      <div className="flex gap-2">
        <div className="h-7 bg-slate-100 rounded-full w-20" />
        <div className="h-7 bg-slate-100 rounded-full w-28" />
      </div>
      <div className="h-6 bg-slate-100 rounded w-4/5" />
      <div className="h-4 bg-slate-100 rounded w-3/5" />
      <div className="grid grid-cols-2 gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 bg-slate-100 rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-slate-100 rounded-xl mt-4" />
    </div>
  );
}