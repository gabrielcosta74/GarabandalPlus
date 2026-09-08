"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileCheck2,
  Package,
  RefreshCw,
  Users,
  Wallet,
  Compass,
  CalendarDays,
  ChevronRight,
  Heart,
  ShoppingBag,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  bookingHref,
  civilDay,
  money,
  sources,
  type FinanceData,
  type Metric,
  type OperationsData,
  type RevenuePoint,
  type Source,
  type TaskGroup,
} from "../../../lib/admin-dashboard/model";
import styles from "./dashboard.module.css";

const groups: {
  key: TaskGroup;
  label: string;
  icon: typeof Package;
  href: string;
}[] = [
  {
    key: "invoices",
    label: "Faturação",
    icon: FileCheck2,
    href: "/admin/faturacao",
  },
  {
    key: "receipts",
    label: "Comprovativos",
    icon: Wallet,
    href: "/admin/transacoes",
  },
  {
    key: "shipping",
    label: "Por enviar",
    icon: Package,
    href: "/admin/encomendas",
  },
  {
    key: "overdue",
    label: "Reservas em atraso",
    icon: Clock3,
    href: "/admin/peregrinacoes",
  },
  {
    key: "members",
    label: "Anuidades vencidas",
    icon: Users,
    href: "/admin/membros",
  },
];
const dateLabel = (
  date: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
) =>
  new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    ...options,
  }).format(new Date(date.length === 10 ? `${date}T12:00:00Z` : date));
const numberLabel = (value: number | null | undefined) =>
  value == null ? "—" : new Intl.NumberFormat("pt-PT").format(value);
const amountLabel = (value: number | null | undefined) =>
  value == null ? "—" : money(value);

export function DashboardRefresh({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <button className={styles.button} onClick={onRefresh} disabled={refreshing}>
      <RefreshCw size={15} className={refreshing ? styles.spin : ""} />
      {refreshing ? "A atualizar…" : "Atualizar"}
    </button>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className={styles.empty}>{children}</div>;
}
function Trend({ metric }: { metric: Metric }) {
  if (metric.trend === null)
    return <span className={styles.muted}>Sem base de comparação</span>;
  const value = metric.trend;
  return (
    <span className={styles.comparison}>
      <span
        className={
          value > 0
            ? styles.positive
            : value < 0
              ? styles.negative
              : styles.neutral
        }
      >
        {value > 0 ? (
          <ArrowUpRight size={13} />
        ) : value < 0 ? (
          <ArrowDownRight size={13} />
        ) : null}
        {Math.abs(value).toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%
      </span>
      <span>vs período anterior</span>
    </span>
  );
}
function Stat({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Wallet;
}) {
  return (
    <article className={styles.stat}>
      <div className={styles.statLabel}>
        {label}
        <Icon size={17} />
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}
export type DashboardViewProps = {
  operations?: OperationsData;
  finance?: FinanceData;
  operationsError?: string;
  financeError?: string;
  refreshing: boolean;
  onRefresh: () => void;
  range: string;
  onRange: (value: string) => void;
  customFrom: string;
  customTo: string;
  onCustom: (from: string, to: string) => void;
};

export default function DashboardView({
  operations,
  finance,
  operationsError,
  financeError,
  refreshing,
  onRefresh,
  range,
  onRange,
  customFrom,
  customTo,
  onCustom,
}: DashboardViewProps) {
  const [group, setGroup] = useState<TaskGroup | "all">("all");
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [source, setSource] = useState<Source | "all">("all");
  const [bucket, setBucket] = useState<"day" | "week" | "month">("day");
  const [draftFrom, setDraftFrom] = useState(customFrom);
  const [draftTo, setDraftTo] = useState(customTo);
  const [dateError, setDateError] = useState("");
  const counts = operations?.counts;
  const total =
    counts && Object.values(counts).some((n) => n !== null)
      ? Object.values(counts).reduce<number>((sum, n) => sum + (n || 0), 0)
      : null;
  const partial = Boolean(operations?.errors.length || operationsError);
  const tasks =
    operations?.tasks.filter((t) => group === "all" || t.group === group) || [];
  const shownTasks = tasks.slice(0, showAllTasks ? 100 : 3);
  const selectedTotal = group === "all" ? total : counts?.[group];
  const series = useMemo(() => {
    const result = new Map<string, RevenuePoint>();
    for (const point of finance?.series || []) {
      const date = new Date(`${point.date}T12:00:00Z`);
      if (bucket === "week")
        date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
      const key =
        bucket === "month"
          ? `${point.date.slice(0, 7)}-01`
          : date.toISOString().slice(0, 10);
      const entry = result.get(key) || {
        date: key,
        pilgrimages: 0,
        store: 0,
        donations: 0,
        quotas: 0,
      };
      for (const s of sources) entry[s.key] += point[s.key];
      result.set(key, entry);
    }
    return [...result.values()];
  }, [finance?.series, bucket]);
  const updatedAt = operations?.updatedAt;
  const failed = operationsError || financeError;
  const selectedSources =
    source === "all" ? sources : sources.filter((s) => s.key === source);
  return (
    <div className={styles.dashboard}>
      <div className={styles.intro}>
        <span className={styles.updated}>
          <span className={partial ? styles.dotWarning : styles.dot} />
          {updatedAt
            ? `Situação atual · ${dateLabel(updatedAt, { hour: "2-digit", minute: "2-digit" })}`
            : "A carregar situação atual…"}
        </span>
      </div>
      {failed && (
        <div className={styles.error} role="alert">
          <CircleAlert size={18} />
          <div>
            <strong>Alguns dados não estão disponíveis</strong>
            <p>
              {operationsError || financeError}
              {operations && operationsError
                ? " A situação abaixo corresponde à última atualização bem-sucedida."
                : ""}
            </p>
          </div>
          <button onClick={onRefresh} disabled={refreshing}>
            Tentar novamente
          </button>
        </div>
      )}
      {operations?.errors.length ? (
        <div className={styles.error} role="status">
          <CircleAlert size={18} />
          <p>
            Não foi possível consultar: {operations.errors.join(", ")}. Os
            indicadores afetados aparecem como indisponíveis.
          </p>
          <button onClick={onRefresh} disabled={refreshing}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      <section
        className={`${styles.panel} ${styles.attention}`}
        aria-labelledby="attention-title"
        aria-busy={!operations && !operationsError}
      >
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.headingLine}>
              <h2 id="attention-title">A tratar</h2>
              <span className={styles.countBadge}>
                {numberLabel(total)}
                {partial && total !== null ? "+" : ""}
              </span>
            </div>
            <p>Pendências atuais, por ordem de prioridade.</p>
          </div>
          <span className={styles.currentBadge}>
            <Clock3 size={13} /> Situação atual
          </span>
        </div>
        <div
          className={styles.taskFilters}
          role="group"
          aria-label="Filtrar pendências"
        >
          <button
            onClick={() => {
              setGroup("all");
              setShowAllTasks(false);
            }}
            aria-pressed={group === "all"}
            className={group === "all" ? styles.selectedFilter : ""}
          >
            Todas <span>{numberLabel(total)}</span>
          </button>
          {groups.map((g) => (
            <button
              key={g.key}
              aria-pressed={group === g.key}
              onClick={() => {
                setGroup(g.key);
                setShowAllTasks(false);
              }}
              className={group === g.key ? styles.selectedFilter : ""}
            >
              <g.icon size={15} />
              {g.label}
              <span>{numberLabel(counts?.[g.key])}</span>
            </button>
          ))}
        </div>
        {!operations ? (
          <Empty>
            {operationsError
              ? "Pendências indisponíveis. Tente atualizar."
              : "A consultar pagamentos, envios e anuidades…"}
          </Empty>
        ) : shownTasks.length ? (
          <div className={styles.taskList}>
            {shownTasks.map((task) => {
              const category = groups.find((g) => g.key === task.group)!;
              return (
                <Link href={task.href} key={task.id} className={styles.taskRow}>
                  <span
                    className={`${styles.taskIcon} ${task.group === "invoices" || task.group === "overdue" ? styles.urgentIcon : ""}`}
                  >
                    <category.icon size={18} />
                  </span>
                  <div className={styles.taskText}>
                    <strong>{task.title}</strong>
                    <p>{task.detail}</p>
                  </div>
                  <div className={styles.taskMeta}>
                    {task.amount != null && (
                      <strong>{money(task.amount)}</strong>
                    )}
                    <span>
                      {task.since
                        ? `Desde ${dateLabel(task.since)}`
                        : "Data não disponível"}
                    </span>
                  </div>
                  <span className={styles.taskAction}>
                    {task.action}
                    <ChevronRight size={15} />
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <Empty>
            {partial ? (
              <>
                <CircleAlert size={20} /> Não há pendências nas fontes
                disponíveis. Há dados por consultar.
              </>
            ) : (
              <>
                <CheckCircle2 size={23} />
                <strong>
                  {group === "all"
                    ? "Tudo em dia"
                    : "Sem pendências nesta área"}
                </strong>
                <span>Não há ações por resolver nos registos consultados.</span>
              </>
            )}
          </Empty>
        )}
        {(tasks.length > 3 || (selectedTotal || 0) > tasks.length) && (
          <div className={styles.panelFooter}>
            <span>
              {Math.min(shownTasks.length, tasks.length)} de{" "}
              {numberLabel(selectedTotal)} pendências
              {partial ? " conhecidas" : ""}
            </span>
            {tasks.length > 3 && (
              <button onClick={() => setShowAllTasks(!showAllTasks)}>
                {showAllTasks ? "Mostrar menos" : "Mostrar mais"}
                <ArrowRight size={14} />
              </button>
            )}
            {(selectedTotal || 0) > tasks.length && group !== "all" && (
              <Link href={groups.find((g) => g.key === group)!.href}>
                Ver todas na gestão <ArrowRight size={14} />
              </Link>
            )}
          </div>
        )}
      </section>

      <div className={styles.sectionHeading}>
        <h2>Em acompanhamento</h2>
        <span>Situação atual</span>
      </div>
      <section className={styles.stats} aria-label="Indicadores atuais">
        <Stat
          label="Por receber · Peregrinações"
          value={amountLabel(operations?.outstanding)}
          detail="Saldo das reservas não canceladas"
          icon={Wallet}
        />
        <Stat
          label="Reservas confirmadas"
          value={numberLabel(operations?.confirmedBookings)}
          detail="Reservas com estado confirmado"
          icon={Compass}
        />
        <Stat
          label="Membros ativos"
          value={numberLabel(operations?.activeMembers)}
          detail="Sócios com a anuidade em dia"
          icon={Users}
        />
      </section>

      <section className={styles.panel} aria-labelledby="trips-title">
        <div className={styles.panelHeader}>
          <div>
            <h2 id="trips-title">Próximas peregrinações</h2>
            <p>Partidas, ocupação e pagamentos para acompanhar.</p>
          </div>
          <Link className={styles.textLink} href="/admin/peregrinacoes">
            Ver todas <ArrowRight size={15} />
          </Link>
        </div>
        {!operations ? (
          <Empty>A carregar peregrinações…</Empty>
        ) : operations.errors.includes("Peregrinações") ? (
          <Empty>Peregrinações indisponíveis. Tente atualizar.</Empty>
        ) : !operations.upcoming.length ? (
          <Empty>Nenhuma partida futura registada.</Empty>
        ) : (
          <div className={styles.trips}>
            {operations.upcoming.slice(0, 2).map((trip) => {
              const days = Math.round(
                (Date.parse(`${trip.startDate.slice(0, 10)}T12:00:00Z`) -
                  Date.parse(
                    `${civilDay(new Date(operations.updatedAt))}T12:00:00Z`,
                  )) /
                  86400000,
              );
              const occupied = Math.max(0, trip.capacity - trip.available);
              return (
                <article key={trip.id} className={styles.trip}>
                  <div className={styles.tripTop}>
                    <span className={styles.dateTile}>
                      <span>
                        {dateLabel(trip.startDate, { month: "short" }).replace(
                          ".",
                          "",
                        )}
                      </span>
                      <strong>
                        {dateLabel(trip.startDate, { day: "2-digit" })}
                      </strong>
                    </span>
                    <div>
                      <span className={styles.tripCountdown}>
                        {days === 0
                          ? "Partida hoje"
                          : `Partida em ${days} dias`}{" "}
                        · {dateLabel(trip.startDate, { year: "numeric" })}
                      </span>
                      <h3>
                        <Link href={`/admin/peregrinacoes/${trip.id}`}>
                          {trip.title}
                        </Link>
                      </h3>
                    </div>
                  </div>
                  <div className={styles.occupancyLabel}>
                    <span>
                      {occupied} de {trip.capacity} lugares ocupados
                    </span>
                    <strong>{trip.available} livres</strong>
                  </div>
                  <div
                    className={styles.progress}
                    role="progressbar"
                    aria-label={`Ocupação de ${trip.title}`}
                    aria-valuenow={Math.min(occupied, trip.capacity)}
                    aria-valuemin={0}
                    aria-valuemax={trip.capacity || 1}
                  >
                    <span
                      style={{
                        width: `${trip.capacity ? Math.min(100, (occupied / trip.capacity) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <p className={styles.occupancyDetail}>
                    {trip.confirmed} participantes confirmados · {trip.reserved}{" "}
                    sem pagamento
                  </p>
                  <div className={styles.tripAmounts}>
                    <div>
                      <span>Recebido</span>
                      <strong>{amountLabel(trip.received)}</strong>
                    </div>
                    <div>
                      <span>Por receber</span>
                      <strong>{amountLabel(trip.outstanding)}</strong>
                    </div>
                  </div>
                  <div className={styles.tripBottom}>
                    <span
                      className={
                        trip.pendingReceipts || trip.overdueBookings
                          ? styles.warningText
                          : styles.muted
                      }
                    >
                      {trip.pendingReceipts === null
                        ? "Pagamentos indisponíveis"
                        : trip.pendingReceipts || trip.overdueBookings
                          ? [
                              trip.pendingReceipts
                                ? `${trip.pendingReceipts} comprovativo${trip.pendingReceipts === 1 ? "" : "s"} por validar`
                                : "",
                              trip.overdueBookings
                                ? `${trip.overdueBookings} reserva${trip.overdueBookings === 1 ? "" : "s"} em atraso`
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : "Sem pendências de pagamento"}
                    </span>
                    <Link href={bookingHref(trip.id)}>
                      Inscrições <ArrowRight size={14} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section
        className={styles.financial}
        aria-labelledby="finance-title"
        aria-busy={refreshing}
      >
        <div className={styles.financeHeading}>
          <div>
            <h2 id="finance-title">Resumo financeiro</h2>
            <p>Valores brutos confirmados, pela data de registo.</p>
          </div>
          <label className={styles.selectLabel}>
            <CalendarDays size={16} />
            <span className={styles.srOnly}>Período financeiro</span>
            <select
              aria-label="Período financeiro"
              value={range}
              onChange={(e) => {
                onRange(e.target.value);
                setBucket(
                  e.target.value === "year"
                    ? "month"
                    : e.target.value === "90"
                      ? "week"
                      : "day",
                );
              }}
            >
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="month">Este mês</option>
              <option value="90">Últimos 90 dias</option>
              <option value="year">Este ano</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>
        </div>
        {range === "custom" && (
          <form
            className={styles.customDates}
            onSubmit={(e) => {
              e.preventDefault();
              if (!draftFrom || !draftTo || draftFrom > draftTo) {
                setDateError(
                  "Escolha datas válidas, com início anterior ao fim.",
                );
                return;
              }
              setDateError("");
              onCustom(draftFrom, draftTo);
            }}
          >
            <label>
              De
              <input
                type="date"
                required
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value)}
              />
            </label>
            <label>
              Até
              <input
                type="date"
                required
                value={draftTo}
                onChange={(e) => setDraftTo(e.target.value)}
              />
            </label>
            <button type="submit" className={styles.button}>
              Aplicar período
            </button>
            {dateError && <span role="alert">{dateError}</span>}
          </form>
        )}
        {financeError && (
          <p className={styles.warningText} role="status">
            {finance
              ? "A atualização falhou. Os valores abaixo correspondem ao período indicado e à última consulta bem-sucedida."
              : "Resumo indisponível. Não foram apresentados valores a zero."}
          </p>
        )}
        {!finance ? (
          <Empty>
            {financeError
              ? "Não foi possível consultar os dados financeiros."
              : "A preparar o resumo financeiro…"}
          </Empty>
        ) : (
          <>
            <div className={styles.periodNote}>
              {dateLabel(finance.period.from, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}{" "}
              —{" "}
              {dateLabel(
                new Date(Date.parse(finance.period.to) - 1).toISOString(),
                { day: "numeric", month: "short", year: "numeric" },
              )}
              <span>
                Comparação com o período anterior de igual duração · Atualizado
                às{" "}
                {dateLabel(finance.updatedAt, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className={styles.financeSummary}>
              <div>
                <span>Volume confirmado</span>
                <strong>{money(finance.revenue.value)}</strong>
                <Trend metric={finance.revenue} />
              </div>
              <details className={styles.storeDetail}>
                <summary>Detalhe da loja</summary>
                <dl>
                  <div>
                    <dt>Encomendas pagas</dt>
                    <dd>{numberLabel(finance.orders.value)}</dd>
                  </div>
                  <div>
                    <dt>Valor médio por encomenda</dt>
                    <dd>{money(finance.averageOrder.value)}</dd>
                  </div>
                  <div>
                    <dt>Volume da loja</dt>
                    <dd>{money(finance.distribution.store)}</dd>
                  </div>
                </dl>
              </details>
            </div>
            <div className={styles.chartGrid}>
              <div className={styles.chartPanel}>
                <div className={styles.chartHeading}>
                  <h3>Evolução das receitas</h3>
                  <div className={styles.chartControls}>
                    <select
                      aria-label="Origem das receitas"
                      value={source}
                      onChange={(e) =>
                        setSource(e.target.value as Source | "all")
                      }
                    >
                      <option value="all">Todas as origens</option>
                      {sources.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Agrupar receitas"
                      value={bucket}
                      onChange={(e) =>
                        setBucket(e.target.value as typeof bucket)
                      }
                    >
                      <option value="day">Por dia</option>
                      <option value="week">Por semana</option>
                      <option value="month">Por mês</option>
                    </select>
                  </div>
                </div>
                <div
                  className={styles.chart}
                  role="img"
                  aria-label={`Evolução das receitas: ${source === "all" ? "todas as origens" : sources.find((s) => s.key === source)?.label}. Valores totais disponíveis em Receita por origem.`}
                >
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    minWidth={0}
                    initialDimension={{ width: 1, height: 265 }}
                  >
                    <BarChart
                      data={series}
                      margin={{ top: 18, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        vertical={false}
                        stroke="#e9edf2"
                        strokeDasharray="3 4"
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) =>
                          dateLabel(
                            v,
                            bucket === "month"
                              ? { month: "short" }
                              : { day: "numeric", month: "short" },
                          )
                        }
                        tick={{ fontSize: 11, fill: "#657185" }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={35}
                      />
                      <YAxis
                        width={70}
                        tickFormatter={(v) =>
                          new Intl.NumberFormat("pt-PT", {
                            notation: "compact",
                            maximumFractionDigits: 1,
                          }).format(v) + " €"
                        }
                        tick={{ fontSize: 11, fill: "#657185" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "#f2f4f7" }}
                        labelFormatter={(v) =>
                          dateLabel(String(v), {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        }
                        formatter={(v, name) => [money(Number(v)), name]}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #e3e8ef",
                          fontSize: 13,
                        }}
                      />
                      {selectedSources.map((s) => (
                        <Bar
                          key={s.key}
                          dataKey={s.key}
                          name={s.label}
                          fill={s.color}
                          stackId="revenue"
                          maxBarSize={26}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className={styles.legend}>
                  {selectedSources.map((s) => (
                    <span key={s.key}>
                      <i style={{ background: s.color }} />
                      {s.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className={styles.distribution}>
                <h3>Receita por origem</h3>
                <p>Distribuição no período</p>
                {sources.map((s) => {
                  const value = finance.distribution[s.key];
                  const percentage = finance.revenue.value
                    ? (value / finance.revenue.value) * 100
                    : 0;
                  return (
                    <div className={styles.sourceRow} key={s.key}>
                      <div>
                        <span>
                          <i style={{ background: s.color }} />
                          {s.label}
                        </span>
                        <strong>{money(value)}</strong>
                      </div>
                      <div className={styles.sourceBar}>
                        <span
                          style={{
                            width: `${Math.max(0, Math.min(100, percentage))}%`,
                            background: s.color,
                          }}
                        />
                      </div>
                      <small>
                        {percentage.toLocaleString("pt-PT", {
                          maximumFractionDigits: 1,
                        })}
                        % do total
                      </small>
                    </div>
                  );
                })}
              </div>
            </div>
            <details className={styles.chartDetails}>
              <summary>Consultar valores do gráfico em tabela</summary>
              <div className={styles.tableScroll}>
                <table>
                  <caption>
                    Receitas por{" "}
                    {bucket === "day"
                      ? "dia"
                      : bucket === "week"
                        ? "semana"
                        : "mês"}
                  </caption>
                  <thead>
                    <tr>
                      <th>Data</th>
                      {selectedSources.map((s) => (
                        <th key={s.key}>{s.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {series.map((point) => (
                      <tr key={point.date}>
                        <td>{dateLabel(point.date)}</td>
                        {selectedSources.map((s) => (
                          <td key={s.key}>{money(point[s.key])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            {finance.excludedTests > 0 && (
              <p className={styles.dataNote}>
                Registos identificados como teste privado FACT.pt excluídos
                deste resumo.
              </p>
            )}
          </>
        )}
      </section>

      <div className={styles.bottomGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Últimos recebimentos</h2>
              <p>Pagamentos confirmados no período selecionado.</p>
            </div>
            <Link href="/admin/transacoes" className={styles.textLink}>
              Transações <ArrowRight size={15} />
            </Link>
          </div>
          {!finance ? (
            <Empty>
              {financeError
                ? "Recebimentos indisponíveis."
                : "A carregar recebimentos…"}
            </Empty>
          ) : !finance.transactions.length ? (
            <Empty>Sem recebimentos confirmados neste período.</Empty>
          ) : (
            <div className={styles.activity}>
              {finance.transactions.slice(0, 5).map((tx) => {
                const Icon =
                  tx.source === "store"
                    ? ShoppingBag
                    : tx.source === "donations"
                      ? Heart
                      : tx.source === "quotas"
                        ? Users
                        : Compass;
                return (
                  <Link
                    href={tx.href}
                    key={tx.id}
                    className={styles.activityRow}
                  >
                    <span className={styles.activityIcon}>
                      <Icon size={17} />
                    </span>
                    <div>
                      <strong>{tx.name}</strong>
                      <p>{tx.detail}</p>
                    </div>
                    <span className={styles.activityAmount}>
                      <strong>{money(tx.amount)}</strong>
                      <small>
                        {dateLabel(tx.date, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </span>
                    <ChevronRight size={14} />
                  </Link>
                );
              })}
            </div>
          )}
        </section>
        <aside className={styles.aside}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Loja & stock</h2>
                <p>Situação atual dos produtos.</p>
              </div>
              <Package size={19} />
            </div>
            {operations?.lowStock == null ? (
              <Empty>
                {operations
                  ? "Não foi possível consultar o stock."
                  : "A consultar stock…"}
              </Empty>
            ) : !operations.lowStock.length ? (
              <div className={styles.stockOk}>
                <CheckCircle2 size={20} />
                <div>
                  <strong>Stock acompanhado</strong>
                  <p>Sem produtos abaixo de 10 unidades.</p>
                </div>
              </div>
            ) : (
              <div className={styles.stockList}>
                {operations.lowStock.map((item) => (
                  <Link href="/admin/loja" key={item.id}>
                    <span>{item.name}</span>
                    <strong
                      className={
                        item.stock === 0 ? styles.negative : styles.warningText
                      }
                    >
                      {item.stock === 0 ? "Esgotado" : `${item.stock} un.`}
                    </strong>
                    <ChevronRight size={14} />
                  </Link>
                ))}
              </div>
            )}
            <div className={styles.panelFooter}>
              <Link href="/admin/loja">
                Gerir loja e stock <ArrowRight size={14} />
              </Link>
            </div>
          </section>
        </aside>
      </div>
      <footer className={styles.footer}>
        <span>Horários de Portugal continental · EUR</span>
        <span>Atualização automática a cada minuto</span>
      </footer>
    </div>
  );
}
