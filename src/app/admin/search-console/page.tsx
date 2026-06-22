"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Eye,
  MousePointerClick,
  Search,
  Target,
  TrendingUp,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AdminLayout from '../../../components/admin/AdminLayout';
import { supabaseBrowser } from '../../../lib/supabase-browser';

type MetricRow = {
  key: string;
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  clicksDelta?: number;
  impressionsDelta?: number;
  previousClicks?: number;
};

type Opportunity = {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  expectedCtr?: number;
};

type SearchConsoleData = {
  configured: boolean;
  siteUrl?: string;
  serviceAccountEmail?: string | null;
  config?: { missing: string[]; serviceAccountEmail?: string | null };
  setup?: { env: string[]; alternativeEnv: string[] };
  range?: {
    days: number;
    current: { startDate: string; endDate: string };
    previous: { startDate: string; endDate: string };
  };
  totals?: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    clicksDelta: number;
    impressionsDelta: number;
    ctrDelta: number;
    positionDelta: number;
  };
  daily?: MetricRow[];
  pages?: MetricRow[];
  queries?: MetricRow[];
  countries?: MetricRow[];
  devices?: MetricRow[];
  opportunities?: Opportunity[];
  nearPageOne?: Opportunity[];
  decliningPages?: MetricRow[];
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(value || 0);

const formatDecimal = (value: number, digits = 1) =>
  new Intl.NumberFormat('pt-PT', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value || 0);

const formatPercent = (value: number) => `${formatDecimal((value || 0) * 100, 1)}%`;

const formatDelta = (value: number) => `${value > 0 ? '+' : ''}${formatDecimal(value, 1)}%`;

const trimUrl = (url: string) =>
  url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

function DeltaBadge({ value, inverse = false }: { value: number; inverse?: boolean }) {
  const positive = inverse ? value < 0 : value > 0;
  const neutral = Math.abs(value) < 0.05;
  const Icon = positive ? ArrowUp : ArrowDown;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
        neutral
          ? 'bg-slate-100 text-slate-500'
          : positive
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-red-50 text-red-700'
      }`}
    >
      {!neutral && <Icon className="h-3 w-3" />}
      {formatDelta(value)}
    </span>
  );
}

function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  helper,
  inverseDelta,
}: {
  label: string;
  value: string;
  delta: number;
  icon: typeof MousePointerClick;
  helper: string;
  inverseDelta?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-garabandal-dark">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <DeltaBadge value={delta} inverse={inverseDelta} />
        <span className="text-xs text-slate-500">{helper}</span>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function MetricTable({
  title,
  rows,
  firstColumn,
}: {
  title: string;
  rows: MetricRow[];
  firstColumn: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-slate-950">{title}</h2>
      {rows.length === 0 ? (
        <EmptyState text="Sem dados para este período." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-3 font-bold">{firstColumn}</th>
                <th className="pb-3 text-right font-bold">Cliques</th>
                <th className="pb-3 text-right font-bold">Impressões</th>
                <th className="pb-3 text-right font-bold">CTR</th>
                <th className="pb-3 text-right font-bold">Posição</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-slate-50 last:border-0">
                  <td className="max-w-[420px] py-3 pr-4 font-medium text-slate-800">
                    <span className="line-clamp-1">{row.key}</span>
                  </td>
                  <td className="py-3 text-right font-semibold text-slate-950">{formatNumber(row.clicks)}</td>
                  <td className="py-3 text-right text-slate-600">{formatNumber(row.impressions)}</td>
                  <td className="py-3 text-right text-slate-600">{formatPercent(row.ctr)}</td>
                  <td className="py-3 text-right text-slate-600">{formatDecimal(row.position, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OpportunityTable({
  title,
  rows,
  mode,
}: {
  title: string;
  rows: Opportunity[];
  mode: 'ctr' | 'position';
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-slate-950">{title}</h2>
      {rows.length === 0 ? (
        <EmptyState text="Ainda não há oportunidades suficientes neste período." />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={`${row.query}-${row.page}`} className="rounded-xl border border-slate-100 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-950">{row.query || '(sem query)'}</p>
                  <a
                    href={row.page}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex max-w-full items-center gap-1 text-xs font-medium text-slate-500 hover:text-garabandal-dark"
                  >
                    <span className="truncate">{trimUrl(row.page)}</span>
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                </div>
                <div className="grid grid-cols-4 gap-3 text-right text-xs">
                  <div>
                    <p className="text-slate-400">Imp.</p>
                    <p className="font-bold text-slate-900">{formatNumber(row.impressions)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Cliques</p>
                    <p className="font-bold text-slate-900">{formatNumber(row.clicks)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">CTR</p>
                    <p className="font-bold text-slate-900">{formatPercent(row.ctr)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Pos.</p>
                    <p className="font-bold text-slate-900">{formatDecimal(row.position, 1)}</p>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {mode === 'ctr'
                  ? 'Melhorar title/meta description e alinhar o conteúdo com a intenção da pesquisa.'
                  : 'Reforçar conteúdo, links internos e subtítulos para tentar entrar nas primeiras posições.'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchConsolePage() {
  const [days, setDays] = useState(28);
  const [data, setData] = useState<SearchConsoleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!supabaseBrowser) throw new Error('Supabase nao configurado no browser.');
        const { data: sessionData } = await supabaseBrowser.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('Sessao invalida. Faz login novamente.');

        const res = await fetch(`/api/admin/search-console?days=${days}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.message || payload?.error || 'Erro ao carregar Search Console.');
        if (!cancelled) setData(payload);
      } catch (err: unknown) {
        if (!cancelled) setError(getErrorMessage(err, 'Erro ao carregar Search Console.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [days]);

  const chartData = useMemo(
    () =>
      (data?.daily || []).map((row) => ({
        date: row.key,
        clicks: row.clicks,
        impressions: row.impressions,
      })),
    [data?.daily],
  );

  return (
    <AdminLayout title="Google Search Console" isLoading={loading && !data}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-garabandal-dark">
              <Search className="h-4 w-4" />
              Search performance
            </div>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">Tráfego orgânico e oportunidades SEO</h1>
            {data?.range && (
              <p className="mt-1 text-sm text-slate-500">
                Dados finalizados de {data.range.current.startDate} a {data.range.current.endDate}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {[7, 28, 90].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDays(option)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  days === option
                    ? 'bg-garabandal-dark text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {option} dias
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {data && !data.configured && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <h2 className="text-lg font-bold">Falta configurar a ligação ao Search Console</h2>
                <p className="mt-2 text-sm">
                  Cria uma service account no Google Cloud, ativa a Search Console API, adiciona o email da service account como utilizador da propriedade no Search Console e define estas env vars:
                </p>
                <pre className="mt-4 overflow-x-auto rounded-xl bg-white/70 p-4 text-xs text-amber-950">
{`GOOGLE_SEARCH_CONSOLE_SITE_URL=sc-domain:teudominio.com
GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL=...
GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"`}
                </pre>
                <p className="mt-3 text-xs">
                  Alternativa: guardar o JSON completo em <code>GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON</code>.
                </p>
              </div>
            </div>
          </div>
        )}

        {data?.configured && data.totals && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Cliques"
                value={formatNumber(data.totals.clicks)}
                delta={data.totals.clicksDelta}
                icon={MousePointerClick}
                helper="vs período anterior"
              />
              <KpiCard
                label="Impressões"
                value={formatNumber(data.totals.impressions)}
                delta={data.totals.impressionsDelta}
                icon={Eye}
                helper="visibilidade"
              />
              <KpiCard
                label="CTR"
                value={formatPercent(data.totals.ctr)}
                delta={data.totals.ctrDelta}
                icon={Target}
                helper="taxa de clique"
              />
              <KpiCard
                label="Posição média"
                value={formatDecimal(data.totals.position, 1)}
                delta={data.totals.positionDelta}
                icon={TrendingUp}
                helper="menor é melhor"
              />
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-950">Evolução diária</h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis yAxisId="clicks" tick={{ fontSize: 12 }} stroke="#64748b" />
                    <YAxis yAxisId="impressions" orientation="right" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip
                      formatter={(value, name) => [
                        formatNumber(Number(value || 0)),
                        name === 'clicks' ? 'Cliques' : 'Impressões',
                      ]}
                      labelClassName="font-semibold"
                    />
                    <Line yAxisId="clicks" type="monotone" dataKey="clicks" stroke="#0f172a" strokeWidth={2} dot={false} />
                    <Line yAxisId="impressions" type="monotone" dataKey="impressions" stroke="#c9a227" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <OpportunityTable title="CTR abaixo do potencial" rows={data.opportunities || []} mode="ctr" />
              <OpportunityTable title="Perto da primeira página" rows={data.nearPageOne || []} mode="position" />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <MetricTable title="Top páginas" rows={data.pages || []} firstColumn="Página" />
              <MetricTable title="Top pesquisas" rows={data.queries || []} firstColumn="Pesquisa" />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <MetricTable title="Páginas em queda" rows={data.decliningPages || []} firstColumn="Página" />
              <MetricTable title="Dispositivos" rows={data.devices || []} firstColumn="Dispositivo" />
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
