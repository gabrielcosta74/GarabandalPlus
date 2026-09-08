import { normalizeQuotaStatus } from "../membership-status";
import { isPaymentAwaitingReceiptValidation } from "../pilgrimage-payments";
import {
  resolveOutstandingPaymentObligation,
  type ReminderBooking,
} from "../pilgrimage-payment-reminders";
import { allRows, type DashboardDatabase } from "./query";
import {
  bookingHref,
  civilDay,
  isTestPilgrimage,
  type AttentionItem,
  type OperationsData,
  type TaskGroup,
  type UpcomingPilgrimage,
} from "./model";

type Booking = ReminderBooking & { pilgrimage_id: string };
type Order = {
  id: string;
  order_ref: string;
  buyer_name: string;
  created_at: string;
  has_physical: boolean;
  shipping_status: string;
  invoice_sent_at: string | null;
  status: string;
  total_amount: number;
};
type Member = {
  id: string;
  nome: string;
  estado_quota: string;
  proxima_quota: string | null;
  is_membro: boolean;
  numero_socio: number;
};
type Trip = {
  id: string;
  title: string;
  start_date: string;
  status: string;
  total_vacancies: number;
  confirmed_pax: number;
  pending_pax: number;
  effective_vacancies: number;
  current_vacancies: number;
};
type Document = {
  id: string;
  status: string;
  created_at: string;
  source_reference: string | null;
};

export async function loadOperations(
  db: DashboardDatabase,
  now = new Date(),
): Promise<OperationsData> {
  const errors: string[] = [];
  async function section<T>(
    label: string,
    query: Promise<T>,
  ): Promise<T | null> {
    try {
      return await query;
    } catch (error) {
      console.error(`Dashboard ${label}`, error);
      errors.push(label);
      return null;
    }
  }
  const [orders, bookings, trips, members, documents, lowStock] =
    await Promise.all([
      section(
        "Encomendas",
        allRows<Order>((a, b) =>
          db
            .from("store_orders")
            .select(
              "id,order_ref,buyer_name,created_at,has_physical,shipping_status,invoice_sent_at,status,total_amount",
            )
            .in("status", ["paid", "pago", "succeeded", "delivered"])
            .order("id")
            .range(a, b),
        ),
      ),
      section(
        "Reservas e pagamentos",
        allRows<Booking>((a, b) =>
          db
            .from("bookings")
            .select(
              "id,pilgrimage_id,created_at,total_amount,paid_amount,status,payment_plan,pilgrimage:pilgrimages(title,deposit_value,start_date,end_date),pilgrims(full_name,birth_date),payments:pilgrimage_payments(id,amount,status,method,created_at,receipt_url)",
            )
            .order("id")
            .range(a, b),
        ),
      ),
      section(
        "Peregrinações",
        allRows<Trip>((a, b) =>
          db
            .from("v_pilgrimages_with_occupancy")
            .select(
              "id,title,start_date,status,total_vacancies,confirmed_pax,pending_pax,effective_vacancies,current_vacancies",
            )
            .gte("start_date", civilDay(now))
            .order("start_date")
            .order("id")
            .range(a, b),
        ),
      ),
      section(
        "Membros",
        allRows<Member>((a, b) =>
          db
            .from("membros")
            .select("id,nome,estado_quota,proxima_quota,is_membro,numero_socio")
            .not("numero_socio", "is", null)
            .order("id")
            .range(a, b),
        ),
      ),
      section(
        "Faturação",
        allRows<Document>((a, b) =>
          db
            .from("factpt_documents")
            .select("id,status,created_at,source_reference")
            .eq("environment", "production")
            .in("status", [
              "awaiting_approval",
              "needs_data",
              "failed",
              "email_failed",
            ])
            .order("id")
            .range(a, b),
        ),
      ),
      section(
        "Stock",
        allRows<{ id: string; name: string; stock: number }>((a, b) =>
          db
            .from("store_products")
            .select("id,name,stock")
            .lt("stock", 10)
            .order("stock")
            .order("id")
            .range(a, b),
        ),
      ),
    ]);
  const tasks: AttentionItem[] = [];
  const counts: OperationsData["counts"] = {
    receipts: bookings ? 0 : null,
    overdue: bookings ? 0 : null,
    shipping: orders ? 0 : null,
    invoices: documents ? 0 : null,
    members: members ? 0 : null,
  };
  function add(item: AttentionItem) {
    tasks.push(item);
    counts[item.group] = (counts[item.group] || 0) + 1;
  }
  for (const order of orders || []) {
    if (
      order.has_physical &&
      !["enviado", "shipped", "delivered"].includes(
        (order.shipping_status || "").toLowerCase(),
      ) &&
      order.status !== "delivered"
    ) {
      add({
        id: `ship:${order.id}`,
        group: "shipping",
        title: order.buyer_name || "Encomenda por enviar",
        detail: `Encomenda ${order.order_ref} · Paga, por enviar`,
        href: `/admin/encomendas?order=${encodeURIComponent(order.order_ref)}`,
        action: "Abrir encomenda",
        since: order.created_at,
        amount: Number(order.total_amount),
      });
    }
  }
  // Fiscal exceptions come from the invoicing workflow, not a duplicate order counter.
  const labels: Record<string, string> = {
    awaiting_approval: "Aguarda aprovação",
    needs_data: "Dados em falta",
    failed: "Emissão falhou",
    email_failed: "Entrega por email falhou",
  };
  for (const doc of documents || [])
    add({
      id: `invoice:${doc.id}`,
      group: "invoices",
      title: labels[doc.status] || "Documento a rever",
      detail: doc.source_reference || "Documento de faturação",
      href: "/admin/faturacao",
      action: "Rever faturação",
      since: doc.created_at,
    });
  const realBookings =
    bookings?.filter(
      (b) =>
        !["cancelled", "canceled", "cancelado"].includes(
          String(b.status).toLowerCase(),
        ) && !isTestPilgrimage(b.pilgrimage?.title),
    ) ?? null;
  const byTrip = new Map<
    string,
    { received: number; outstanding: number; receipts: number; overdue: number }
  >();
  for (const booking of realBookings || []) {
    const totals = byTrip.get(booking.pilgrimage_id) || {
      received: 0,
      outstanding: 0,
      receipts: 0,
      overdue: 0,
    };
    totals.received += Number(booking.paid_amount || 0);
    totals.outstanding += Math.max(
      0,
      Number(booking.total_amount || 0) - Number(booking.paid_amount || 0),
    );
    const name = booking.pilgrims?.[0]?.full_name || "Reserva";
    for (const payment of booking.payments || []) {
      if (!isPaymentAwaitingReceiptValidation(payment)) continue;
      totals.receipts++;
      add({
        id: `receipt:${payment.id}`,
        group: "receipts",
        title: name,
        detail: `${booking.pilgrimage?.title || "Peregrinação"} · Comprovativo por validar`,
        href: bookingHref(booking.pilgrimage_id, booking.id),
        action: "Rever pagamento",
        since: payment.created_at || booking.created_at || now.toISOString(),
        amount: Number(payment.amount),
      });
    }
    const obligation = resolveOutstandingPaymentObligation(booking, { now });
    if (obligation && civilDay(new Date(obligation.dueDate)) < civilDay(now)) {
      totals.overdue++;
      add({
        id: `overdue:${booking.id}`,
        group: "overdue",
        title: name,
        detail: `${booking.pilgrimage?.title || "Peregrinação"} · ${obligation.obligationLabel} em atraso`,
        href: bookingHref(booking.pilgrimage_id, booking.id),
        action: "Abrir reserva",
        since: obligation.dueDate,
        amount: obligation.remainingAmount,
      });
    }
    byTrip.set(booking.pilgrimage_id, totals);
  }
  const actualMembers =
    members?.filter(
      (m) => m.is_membro || normalizeQuotaStatus(m.estado_quota) !== "pendente",
    ) ?? null;
  for (const member of actualMembers || []) {
    if (normalizeQuotaStatus(member.estado_quota) !== "expirado") continue;
    add({
      id: `member:${member.id}`,
      group: "members",
      title: member.nome || `Sócio ${member.numero_socio}`,
      detail: "Anuidade vencida",
      href: `/admin/membros/${encodeURIComponent(member.id)}`,
      action: "Consultar membro",
      since: member.proxima_quota || "",
    });
  }
  const upcoming: UpcomingPilgrimage[] = (trips || [])
    .filter((t) => !isTestPilgrimage(t.title))
    .slice(0, 4)
    .map((t) => {
      const finance = byTrip.get(t.id);
      return {
        id: t.id,
        title: t.title,
        startDate: t.start_date,
        status: t.status,
        capacity: Math.max(0, Number(t.total_vacancies || 0)),
        confirmed: Math.max(0, Number(t.confirmed_pax || 0)),
        reserved: Math.max(0, Number(t.pending_pax || 0)),
        available: Math.max(
          0,
          Number(t.effective_vacancies ?? t.current_vacancies ?? 0),
        ),
        received: bookings ? finance?.received || 0 : null,
        outstanding: bookings ? finance?.outstanding || 0 : null,
        pendingReceipts: bookings ? finance?.receipts || 0 : null,
        overdueBookings: bookings ? finance?.overdue || 0 : null,
      };
    });
  const priority: Record<TaskGroup, number> = {
    invoices: 0,
    receipts: 1,
    shipping: 2,
    overdue: 3,
    members: 4,
  };
  tasks.sort(
    (a, b) =>
      priority[a.group] - priority[b.group] ||
      (Date.parse(a.since) || Infinity) - (Date.parse(b.since) || Infinity),
  );
  // Keep a useful sample from every group; the counts always represent all rows.
  const shown = new Map<TaskGroup, number>();
  const sample = tasks.filter((t) => {
    const count = shown.get(t.group) || 0;
    shown.set(t.group, count + 1);
    return count < 20;
  });
  return {
    tasks: sample,
    counts,
    upcoming,
    activeMembers: actualMembers
      ? actualMembers.filter(
          (m) => normalizeQuotaStatus(m.estado_quota) === "pago",
        ).length
      : null,
    outstanding: realBookings
      ? realBookings.reduce(
          (sum, b) =>
            sum +
            Math.max(
              0,
              Number(b.total_amount || 0) - Number(b.paid_amount || 0),
            ),
          0,
        )
      : null,
    confirmedBookings: realBookings
      ? realBookings.filter((b) => b.status === "confirmed").length
      : null,
    lowStock: lowStock?.slice(0, 6) ?? null,
    errors,
    updatedAt: now.toISOString(),
  };
}
