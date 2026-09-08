import { allRows, type DashboardDatabase } from "./query";
import {
  bookingHref,
  buildFinance,
  isTestPilgrimage,
  type FinanceData,
  type Transaction,
} from "./model";

type Order = {
  id: string;
  total_amount: number;
  created_at: string;
  buyer_name: string;
  order_ref: string;
};
type Donation = {
  id: string;
  amount_cents: number;
  created_at: string;
  donor_name: string;
};
type Payment = {
  id: string;
  amount: number;
  created_at: string;
  booking_id: string;
  booking: {
    pilgrimage_id: string;
    pilgrims: { full_name: string }[];
    pilgrimage: { title: string } | null;
  } | null;
};
type Quota = {
  id: string;
  valor: number;
  data_pagamento: string;
  user_id: string;
};
export async function loadFinance(
  db: DashboardDatabase,
  period: FinanceData["period"],
) {
  const [orders, donations, payments, quotas] = await Promise.all([
    allRows<Order>((a, b) =>
      db
        .from("store_orders")
        .select("id,total_amount,created_at,buyer_name,order_ref")
        .in("status", ["paid", "pago", "succeeded", "delivered"])
        .gte("created_at", period.previousFrom)
        .lt("created_at", period.to)
        .order("id")
        .range(a, b),
    ),
    allRows<Donation>((a, b) =>
      db
        .from("donations")
        .select("id,amount_cents,created_at,donor_name")
        .eq("status", "succeeded")
        .gte("created_at", period.previousFrom)
        .lt("created_at", period.to)
        .order("id")
        .range(a, b),
    ),
    allRows<Payment>((a, b) =>
      db
        .from("pilgrimage_payments")
        .select(
          "id,amount,created_at,booking_id,booking:bookings(pilgrimage_id,pilgrims(full_name),pilgrimage:pilgrimages(title))",
        )
        .in("status", ["succeeded", "verified", "paid", "manual"])
        .gte("created_at", period.previousFrom)
        .lt("created_at", period.to)
        .order("id")
        .range(a, b),
    ),
    allRows<Quota>((a, b) =>
      db
        .from("pagamentos_quotas")
        .select("id,valor,data_pagamento,user_id")
        .in("estado", ["pago", "paid"])
        .gte("data_pagamento", period.previousFrom)
        .lt("data_pagamento", period.to)
        .order("id")
        .range(a, b),
    ),
  ]);
  const memberNames = new Map<string, string>();
  const ids = [...new Set(quotas.map((q) => q.user_id).filter(Boolean))];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db
      .from("membros")
      .select("id,nome")
      .in("id", ids.slice(i, i + 100));
    if (error) throw error;
    for (const member of data || [])
      memberNames.set(member.id, member.nome || "Membro");
  }
  const realPayments = payments.filter(
    (p) => !isTestPilgrimage(p.booking?.pilgrimage?.title),
  );
  const transactions: Transaction[] = [
    ...orders.map((o) => ({
      id: `store:${o.id}`,
      source: "store" as const,
      name: o.buyer_name || "Cliente",
      detail: `Encomenda ${o.order_ref}`,
      amount: Number(o.total_amount),
      date: o.created_at,
      href: `/admin/encomendas?order=${encodeURIComponent(o.order_ref)}`,
    })),
    ...donations.map((d) => ({
      id: `donation:${d.id}`,
      source: "donations" as const,
      name: d.donor_name || "Doador anónimo",
      detail: "Doação confirmada",
      amount: Number(d.amount_cents) / 100,
      date: d.created_at,
      href: "/admin/doacoes",
    })),
    ...realPayments.map((p) => ({
      id: `payment:${p.id}`,
      source: "pilgrimages" as const,
      name: p.booking?.pilgrims?.[0]?.full_name || "Peregrino",
      detail: p.booking?.pilgrimage?.title || "Pagamento de peregrinação",
      amount: Number(p.amount),
      date: p.created_at,
      href: p.booking?.pilgrimage_id
        ? bookingHref(p.booking.pilgrimage_id, p.booking_id)
        : "/admin/transacoes",
    })),
    ...quotas.map((q) => ({
      id: `quota:${q.id}`,
      source: "quotas" as const,
      name: memberNames.get(q.user_id) || "Membro",
      detail: "Anuidade confirmada",
      amount: Number(q.valor),
      date: q.data_pagamento,
      href: q.user_id
        ? `/admin/membros/${encodeURIComponent(q.user_id)}`
        : "/admin/membros",
    })),
  ];
  if (
    transactions.some(
      (t) => !Number.isFinite(t.amount) || !Number.isFinite(Date.parse(t.date)),
    )
  )
    throw new Error("Registos financeiros inválidos.");
  return buildFinance(
    transactions,
    period,
    new Date().toISOString(),
    payments.length - realPayments.length,
  );
}
