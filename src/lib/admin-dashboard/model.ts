export const sources = [
  { key: "pilgrimages", label: "Peregrinações", color: "#b58a37" },
  { key: "store", label: "Loja", color: "#5275a1" },
  { key: "donations", label: "Doações", color: "#438975" },
  { key: "quotas", label: "Anuidades", color: "#8c75a7" },
] as const;
export type Source = (typeof sources)[number]["key"];
export type Metric = { value: number; previous: number; trend: number | null };
export type RevenuePoint = { date: string } & Record<Source, number>;
export type Transaction = {
  id: string;
  source: Source;
  name: string;
  detail: string;
  amount: number;
  date: string;
  href: string;
};
export type FinanceData = {
  revenue: Metric;
  orders: Metric;
  donations: Metric;
  averageOrder: Metric;
  distribution: Record<Source, number>;
  series: RevenuePoint[];
  transactions: Transaction[];
  period: {
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
  };
  updatedAt: string;
  excludedTests: number;
};
export type TaskGroup =
  | "receipts"
  | "shipping"
  | "invoices"
  | "overdue"
  | "members";
export type AttentionItem = {
  id: string;
  group: TaskGroup;
  title: string;
  detail: string;
  href: string;
  action: string;
  since: string;
  amount?: number;
};
export type UpcomingPilgrimage = {
  id: string;
  title: string;
  startDate: string;
  status: string;
  capacity: number;
  confirmed: number;
  reserved: number;
  available: number;
  received: number | null;
  outstanding: number | null;
  pendingReceipts: number | null;
  overdueBookings: number | null;
};
export type OperationsData = {
  tasks: AttentionItem[];
  counts: Record<TaskGroup, number | null>;
  upcoming: UpcomingPilgrimage[];
  activeMembers: number | null;
  outstanding: number | null;
  confirmedBookings: number | null;
  lowStock: { id: string; name: string; stock: number }[] | null;
  errors: string[];
  updatedAt: string;
};
export const money = (value: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(
    value,
  );
export const civilDay = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export const isTestPilgrimage = (title?: string | null) =>
  /^\s*\[TESTE PRIVADO FACT\.pt\]/i.test(title || "");
export const metric = (value: number, previous: number): Metric => ({
  value,
  previous,
  trend:
    previous === 0
      ? value === 0
        ? 0
        : null
      : ((value - previous) / previous) * 100,
});
export const bookingHref = (pilgrimageId: string, bookingId?: string) =>
  `/admin/peregrinacoes/${encodeURIComponent(pilgrimageId)}?tab=bookings${bookingId ? `&booking=${encodeURIComponent(bookingId)}` : ""}`;

// Convert a Lisbon calendar day to an instant, including summer time.
export function lisbonMidnight(day: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Data inválida.");
  const target = new Date(`${day}T00:00:00Z`);
  if (
    !Number.isFinite(target.getTime()) ||
    target.toISOString().slice(0, 10) !== day
  )
    throw new Error("Data inválida.");
  let result = target.getTime();
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(
      formatter.formatToParts(new Date(result)).map((v) => [v.type, v.value]),
    );
    const represented = Date.UTC(
      +p.year,
      +p.month - 1,
      +p.day,
      +p.hour,
      +p.minute,
      +p.second,
    );
    result += target.getTime() - represented;
  }
  return new Date(result);
}
export function shiftDay(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function resolvePeriod(params: URLSearchParams, now = new Date()) {
  const range = params.get("range") || "30";
  const today = civilDay(now);
  let from: Date;
  let to = now;
  if (range === "custom") {
    from = lisbonMidnight(params.get("from") || "");
    const lastDay = params.get("to") || "";
    lisbonMidnight(lastDay);
    to = new Date(
      Math.min(lisbonMidnight(shiftDay(lastDay, 1)).getTime(), now.getTime()),
    );
  } else {
    const day =
      range === "month"
        ? `${today.slice(0, 7)}-01`
        : range === "year"
          ? `${today.slice(0, 4)}-01-01`
          : ["7", "30", "90"].includes(range)
            ? shiftDay(today, -(Number(range) - 1))
            : null;
    if (!day) throw new Error("Período inválido.");
    from = lisbonMidnight(day);
  }
  const duration = to.getTime() - from.getTime();
  if (duration <= 0 || duration > 366 * 86400000)
    throw new Error("Escolha um período válido de até 366 dias.");
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    previousFrom: new Date(from.getTime() - duration).toISOString(),
    previousTo: from.toISOString(),
  };
}
export function buildFinance(
  transactions: Transaction[],
  period: FinanceData["period"],
  updatedAt: string,
  excludedTests = 0,
): FinanceData {
  const distribution: Record<Source, number> = {
    store: 0,
    donations: 0,
    pilgrimages: 0,
    quotas: 0,
  };
  const previous = { ...distribution };
  let orders = 0,
    previousOrders = 0;
  const current: Transaction[] = [];
  const daily = new Map<string, RevenuePoint>();
  for (
    let day = civilDay(new Date(period.from));
    day <= civilDay(new Date(new Date(period.to).getTime() - 1));
    day = shiftDay(day, 1)
  ) {
    daily.set(day, {
      date: day,
      store: 0,
      donations: 0,
      pilgrimages: 0,
      quotas: 0,
    });
  }
  for (const tx of transactions) {
    const time = new Date(tx.date).getTime();
    if (time >= Date.parse(period.from) && time < Date.parse(period.to)) {
      distribution[tx.source] += tx.amount;
      if (tx.source === "store") orders++;
      const point = daily.get(civilDay(new Date(tx.date)));
      if (point) point[tx.source] += tx.amount;
      current.push(tx);
    } else if (
      time >= Date.parse(period.previousFrom) &&
      time < Date.parse(period.previousTo)
    ) {
      previous[tx.source] += tx.amount;
      if (tx.source === "store") previousOrders++;
    }
  }
  return {
    revenue: metric(
      Object.values(distribution).reduce((a, b) => a + b, 0),
      Object.values(previous).reduce((a, b) => a + b, 0),
    ),
    orders: metric(orders, previousOrders),
    donations: metric(distribution.donations, previous.donations),
    averageOrder: metric(
      orders ? distribution.store / orders : 0,
      previousOrders ? previous.store / previousOrders : 0,
    ),
    distribution,
    series: [...daily.values()],
    transactions: current
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
      .slice(0, 12),
    period,
    updatedAt,
    excludedTests,
  };
}
