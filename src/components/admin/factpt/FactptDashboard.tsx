"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileCheck2,
  FileText,
  MailWarning,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';

import { supabaseBrowser } from '../../../lib/supabase-browser';
import FactptDocumentDrawer from './FactptDocumentDrawer';
import styles from './factpt-dashboard.module.css';
import {
  normalizeFactptOverview,
  type FactptDocument,
  type FactptEnvironment,
  type FactptOverview,
  type FactptSourceType,
  type FactptStatus,
} from './types';

type Period = 'month' | '30d' | 'all';

type Filters = {
  search: string;
  status: FactptStatus | 'all';
  source: FactptSourceType | 'all';
};

const EMPTY_FILTERS: Filters = {
  search: '',
  status: 'all',
  source: 'all',
};

const SOURCE_LABELS: Record<FactptSourceType, string> = {
  pilgrimage: 'Peregrinações',
  donation: 'Donativos',
  quota: 'Quotas',
  store: 'Loja',
};

const STATUS_META: Record<FactptStatus, { label: string; tone: string; icon: typeof Clock3 }> = {
  awaiting_approval: { label: 'Por aprovar', tone: styles.toneWarning, icon: Clock3 },
  pending: { label: 'Na fila', tone: styles.toneNeutral, icon: Clock3 },
  needs_data: { label: 'Requer dados', tone: styles.toneWarning, icon: CircleAlert },
  processing: { label: 'A processar', tone: styles.toneInfo, icon: RefreshCw },
  issued: { label: 'Emitida', tone: styles.toneSuccess, icon: CheckCircle2 },
  failed: { label: 'Erro na emissão', tone: styles.toneDanger, icon: AlertTriangle },
  email_failed: { label: 'Email por enviar', tone: styles.toneDanger, icon: MailWarning },
};

const currencyFormatter = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
});

const integerFormatter = new Intl.NumberFormat('pt-PT', {
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('pt-PT', {
  hour: '2-digit',
  minute: '2-digit',
});

function formatMoney(value: number | null | undefined, currency = 'EUR') {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (currency === 'EUR') return currencyFormatter.format(value);
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

function buildPeriodRange(period: Period) {
  if (period === 'month') return {};
  const now = new Date();
  if (period === '30d') {
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return { from: from.toISOString(), to: now.toISOString() };
  }
  return { from: '2000-01-01T00:00:00.000Z', to: now.toISOString() };
}

export default function FactptDashboard() {
  const [environment, setEnvironment] = useState<FactptEnvironment>('production');
  const [period, setPeriod] = useState<Period>('month');
  const [overview, setOverview] = useState<FactptOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  const loadOverview = useCallback(async (quiet = false) => {
    if (!supabaseBrowser) {
      setError('A ligação à área administrativa não está disponível.');
      setLoading(false);
      return;
    }

    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session) throw new Error('A sessão de administrador expirou.');

      const params = new URLSearchParams({ environment });
      const range = buildPeriodRange(period);
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);

      const response = await fetch(`/api/admin/factpt/overview?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || 'Não foi possível carregar a faturação.');
      }

      setOverview(normalizeFactptOverview(body));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar a faturação.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [environment, period]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const documents = useMemo(() => {
    const search = filters.search.trim().toLocaleLowerCase('pt');
    return (overview?.documents || []).filter((document) => {
      if (filters.status !== 'all' && document.status !== filters.status) return false;
      if (filters.source !== 'all' && document.sourceType !== filters.source) return false;
      if (!search) return true;

      const values = [
        document.factptNumber,
        document.sourceReference,
        document.customer.name,
        document.customer.email,
        document.customer.nif,
        document.sourceId,
      ];
      return values.some((value) => value?.toLocaleLowerCase('pt').includes(search));
    });
  }, [filters, overview?.documents]);

  const selectedDocument =
    overview?.documents.find((document) => document.id === selectedDocumentId) || null;

  const openAttentionDocument = (documentId: string | null) => {
    if (documentId) setSelectedDocumentId(documentId);
  };

  const clearFilters = () => setFilters(EMPTY_FILTERS);
  const hasFilters =
    filters.search !== EMPTY_FILTERS.search
    || filters.status !== EMPTY_FILTERS.status
    || filters.source !== EMPTY_FILTERS.source;

  if (loading && !overview) return <DashboardSkeleton />;

  if (error && !overview) {
    return (
      <section className={styles.errorState}>
        <span className={styles.errorIcon}><CircleAlert aria-hidden="true" /></span>
        <h2>Não foi possível abrir a faturação</h2>
        <p>{error}</p>
        <button type="button" className={styles.primaryButton} onClick={() => void loadOverview()}>
          <RefreshCw aria-hidden="true" />
          Tentar novamente
        </button>
      </section>
    );
  }

  const kpis = overview?.kpis;
  const incidents = (kpis?.failures || 0) + (kpis?.emailFailures || 0);
  const awaitingEmission =
    (kpis?.awaitingApproval || 0)
    + (kpis?.pending || 0)
    + (kpis?.processing || 0);

  return (
    <div className={styles.dashboard}>
      <section className={styles.utilityBar} aria-label="Contexto da faturação">
        <div className={styles.environmentSwitch} aria-label="Ambiente FACT.pt">
          <button
            type="button"
            className={environment === 'production' ? styles.environmentActive : ''}
            onClick={() => setEnvironment('production')}
          >
            <span className={styles.productionDot} />
            Produção
          </button>
          <button
            type="button"
            className={environment === 'sandbox' ? styles.environmentActive : ''}
            onClick={() => setEnvironment('sandbox')}
          >
            Sandbox
          </button>
        </div>

        <div className={styles.utilityActions}>
          <select
            aria-label="Período da faturação"
            className={styles.compactSelect}
            value={period}
            onChange={(event) => setPeriod(event.target.value as Period)}
          >
            <option value="month">Este mês</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="all">Todo o histórico</option>
          </select>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => void loadOverview(true)}
            disabled={refreshing}
            aria-label="Atualizar faturação"
          >
            <RefreshCw className={refreshing ? styles.spinning : ''} aria-hidden="true" />
            <span>Atualizar</span>
          </button>
        </div>
      </section>

      {error ? (
        <div className={styles.inlineError} role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className={styles.kpiGrid} aria-label="Resumo da faturação">
        <KpiCard
          label="Emitidas"
          value={integerFormatter.format(kpis?.issued || 0)}
          detail={`${integerFormatter.format(kpis?.emailed || 0)} enviadas por email`}
          icon={FileCheck2}
          tone="green"
        />
        <KpiCard
          label="Por emitir"
          value={integerFormatter.format(awaitingEmission)}
          detail={`${integerFormatter.format(kpis?.awaitingApproval || 0)} aguardam aprovação`}
          icon={Clock3}
          tone={awaitingEmission > 0 ? 'amber' : 'neutral'}
        />
        <KpiCard
          label="Requer dados"
          value={integerFormatter.format(kpis?.needsData || 0)}
          detail="Dados fiscais incompletos"
          icon={CircleAlert}
          tone={(kpis?.needsData || 0) > 0 ? 'amber' : 'neutral'}
        />
        <KpiCard
          label="Incidentes"
          value={integerFormatter.format(incidents)}
          detail="Emissão ou envio por resolver"
          icon={AlertTriangle}
          tone={incidents > 0 ? 'red' : 'green'}
        />
      </section>

      <AttentionCard
        items={overview?.attention || []}
        onOpenDocument={openAttentionDocument}
      />

      <section className={styles.documentsSection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Faturas FACT.pt</p>
            <h2>Documentos</h2>
            <p>Consulta o estado, número oficial e envio de cada fatura.</p>
          </div>
          <span className={styles.resultCount}>
            {integerFormatter.format(documents.length)}
            {documents.length === 1 ? ' documento' : ' documentos'}
          </span>
        </div>

        <div className={styles.filters}>
          <label className={styles.searchField}>
            <Search aria-hidden="true" />
            <span className={styles.srOnly}>Pesquisar documentos</span>
            <input
              type="search"
              placeholder="Número, cliente, email ou NIF"
              value={filters.search}
              onChange={(event) => {
                const search = event.target.value;
                setFilters((current) => ({ ...current, search }));
              }}
            />
          </label>
          <div className={styles.selectGroup}>
            <SlidersHorizontal aria-hidden="true" />
            <select
              aria-label="Filtrar por estado"
              value={filters.status}
              onChange={(event) => {
                const status = event.target.value as Filters['status'];
                setFilters((current) => ({ ...current, status }));
              }}
            >
              <option value="all">Todos os estados</option>
              <option value="awaiting_approval">Por aprovar</option>
              <option value="needs_data">Requer dados</option>
              <option value="pending">Na fila</option>
              <option value="processing">A processar</option>
              <option value="issued">Emitida</option>
              <option value="failed">Erro na emissão</option>
              <option value="email_failed">Email por enviar</option>
            </select>
            <select
              aria-label="Filtrar por origem"
              value={filters.source}
              onChange={(event) => {
                const source = event.target.value as Filters['source'];
                setFilters((current) => ({ ...current, source }));
              }}
            >
              <option value="all">Todas as origens</option>
              <option value="pilgrimage">Peregrinações</option>
              <option value="donation">Donativos</option>
              <option value="quota">Quotas</option>
              <option value="store">Loja</option>
            </select>
          </div>
        </div>

        <DocumentsList
          documents={documents}
          hasFilters={hasFilters}
          onClearFilters={clearFilters}
          onSelect={setSelectedDocumentId}
        />
      </section>

      <p className={styles.updatedAt}>
        {overview?.generatedAt ? (
          <>
            Atualizado às {timeFormatter.format(new Date(overview.generatedAt))}
            {' · '}
          </>
        ) : null}
        Mostra apenas documentos da integração FACT.pt no período selecionado.
      </p>

      <FactptDocumentDrawer
        document={selectedDocument}
        open={Boolean(selectedDocument)}
        onClose={() => setSelectedDocumentId(null)}
        onChanged={() => loadOverview(true)}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className={styles.skeletonPage} aria-label="A carregar faturação" aria-busy="true">
      <div className={styles.skeletonLine} />
      <div className={styles.skeletonGrid}>
        {Array.from({ length: 4 }, (_, index) => (
          <div className={styles.skeletonCard} key={index} />
        ))}
      </div>
      <div className={styles.skeletonPanels}>
        <div className={styles.skeletonPanel} />
        <div className={styles.skeletonPanel} />
      </div>
      <div className={`${styles.skeletonPanel} ${styles.skeletonTable}`} />
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof FileText;
  tone: 'blue' | 'green' | 'amber' | 'red' | 'neutral';
}) {
  return (
    <article className={`${styles.kpiCard} ${styles[`kpi_${tone}`]}`}>
      <div className={styles.kpiTopline}>
        <span>{label}</span>
        <span className={styles.kpiIcon}><Icon aria-hidden="true" /></span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function AttentionCard({
  items,
  onOpenDocument,
}: {
  items: FactptOverview['attention'];
  onOpenDocument: (documentId: string | null) => void;
}) {
  return (
    <article className={styles.attentionCard}>
      <div className={styles.cardHeading}>
        <div>
          <p className={styles.eyebrow}>Trabalho pendente</p>
          <h2>Requer atenção</h2>
        </div>
        {items.length > 0 ? <span className={styles.attentionCount}>{items.length}</span> : null}
      </div>

      {items.length === 0 ? (
        <div className={styles.emptyAttention}>
          <CheckCircle2 aria-hidden="true" />
          <div>
            <strong>Sem pendências</strong>
            <p>Não existem casos que precisem da intervenção do admin.</p>
          </div>
        </div>
      ) : (
        <div className={styles.attentionList}>
          {items.slice(0, 5).map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.attentionItem}
              onClick={() => onOpenDocument(item.documentId)}
              disabled={!item.documentId}
            >
              <span className={`${styles.attentionMarker} ${styles[`severity_${item.severity}`]}`}>
                {item.severity === 'error'
                  ? <AlertTriangle aria-hidden="true" />
                  : <Clock3 aria-hidden="true" />}
              </span>
              <span className={styles.attentionCopy}>
                <strong>{item.title}</strong>
                <small>
                  {[item.customerName, item.description].filter(Boolean).join(' · ')}
                </small>
              </span>
              {item.amount !== null ? (
                <span className={styles.attentionAmount}>{formatMoney(item.amount)}</span>
              ) : null}
              {item.documentId ? <ChevronRight aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function DocumentsList({
  documents,
  hasFilters,
  onClearFilters,
  onSelect,
}: {
  documents: FactptDocument[];
  hasFilters: boolean;
  onClearFilters: () => void;
  onSelect: (id: string) => void;
}) {
  if (documents.length === 0) {
    return (
      <div className={styles.documentsEmpty}>
        <FileText aria-hidden="true" />
        <strong>{hasFilters ? 'Nenhum resultado' : 'Ainda não existem documentos'}</strong>
        <p>
          {hasFilters
            ? 'Experimenta remover os filtros ou pesquisar outra referência.'
            : 'Os documentos fiscais aparecerão aqui quando entrarem no sistema.'}
        </p>
        {hasFilters ? (
          <button type="button" onClick={onClearFilters}>Limpar filtros</button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className={styles.desktopTable}>
        <div className={styles.tableHeader}>
          <span>Documento</span>
          <span>Cliente</span>
          <span>Origem</span>
          <span>Estado</span>
          <span className={styles.alignRight}>Total</span>
          <span aria-hidden="true" />
        </div>
        {documents.map((document) => (
          <button
            type="button"
            className={styles.tableRow}
            key={document.id}
            onClick={() => onSelect(document.id)}
          >
            <span className={styles.documentIdentity}>
              <strong>{document.factptNumber || `${document.seriesCode || 'FACT.pt'} · por numerar`}</strong>
              <small>{formatDate(document.paymentConfirmedAt || document.createdAt)}</small>
            </span>
            <span className={styles.customerCell}>
              <strong>{document.customer.name || 'Cliente por confirmar'}</strong>
              <small>{document.customer.nif || document.customer.email || 'Sem dados fiscais'}</small>
            </span>
            <span>
              <span className={styles.sourceLabel}>{SOURCE_LABELS[document.sourceType]}</span>
            </span>
            <span>
              <StatusBadge status={document.status} />
            </span>
            <span className={`${styles.amountCell} ${styles.alignRight}`}>
              {formatMoney(document.amount, document.currency)}
            </span>
            <ChevronRight className={styles.rowChevron} aria-hidden="true" />
          </button>
        ))}
      </div>

      <div className={styles.mobileList}>
        {documents.map((document) => (
          <button
            type="button"
            className={styles.mobileDocument}
            key={document.id}
            onClick={() => onSelect(document.id)}
          >
            <span className={styles.mobileDocumentTop}>
              <span>
                <strong>{document.factptNumber || `${document.seriesCode || 'FACT.pt'} · por numerar`}</strong>
                <small>{SOURCE_LABELS[document.sourceType]} · {formatDate(document.paymentConfirmedAt || document.createdAt)}</small>
              </span>
              <span className={styles.mobileAmount}>{formatMoney(document.amount, document.currency)}</span>
            </span>
            <span className={styles.mobileDocumentBottom}>
              <span>
                {document.customer.name || document.customer.email || 'Cliente por confirmar'}
              </span>
              <StatusBadge status={document.status} />
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: FactptStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`${styles.statusBadge} ${meta.tone}`}>
      <Icon aria-hidden="true" />
      {meta.label}
    </span>
  );
}
