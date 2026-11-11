import { previewPilgrimageCustomer } from '../../../../../lib/factpt/source-snapshots';
import { normalizeForMatch } from '../../../../../lib/ledger/classify';
import { db, requireAdmin } from '../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';

const BOOKING_SELECT = 'id, status, user_id, pilgrimage_id, total_amount, paid_amount, pilgrims(id, full_name), pilgrimage_payments(id, amount, method, status, created_at, deleted, billing_name)';

type BookingRow = {
  id: string; status: string; user_id: string | null; pilgrimage_id?: string | null; total_amount: unknown; paid_amount: unknown;
  pilgrims: { id: string; full_name: string }[] | null;
  pilgrimage_payments: { id: string; amount: unknown; method: string; status: string; created_at: string; deleted: boolean; billing_name: string | null }[] | null;
};

/** Bookings as the transfer form needs them, with which equal payments already have a bank movement. */
async function describeBookings(rows: BookingRow[], amount: number) {
  const ids = [...new Set(rows.map(row => row.user_id).filter(Boolean))] as string[];
  const { data: members, error: memberError } = ids.length
    ? await db().from('membros').select('id, nome').in('id', ids)
    : { data: [], error: null };
  if (memberError) throw memberError;
  const names = new Map((members || []).map(row => [row.id, row.nome]));
  const matchingPaymentIds = rows.flatMap(row => row.pilgrimage_payments || [])
    .filter(payment => !payment.deleted && Math.round(Number(payment.amount) * 100) === Math.round(amount * 100))
    .map(payment => payment.id);
  const batches = Array.from({ length: Math.ceil(matchingPaymentIds.length / 100) }, (_, index) =>
    matchingPaymentIds.slice(index * 100, (index + 1) * 100));
  const linkResults = await Promise.all(batches.map(batch => db().from('bank_transaction_links')
    .select('target_id').eq('target_type', 'pilgrimage_payment').in('target_id', batch)));
  const linkError = linkResults.find(result => result.error)?.error;
  if (linkError) throw linkError;
  const linkedPaymentIds = new Set(linkResults.flatMap(result => (result.data || []).map(link => link.target_id)));
  return rows.map(row => ({
    id: row.id,
    status: row.status,
    pilgrimageId: row.pilgrimage_id ?? null,
    holderName: names.get(row.user_id) || null,
    totalAmount: Number(row.total_amount),
    paidAmount: Number(row.paid_amount),
    pilgrims: row.pilgrims || [],
    payments: (row.pilgrimage_payments || []).map(payment => ({
      id: payment.id, amount: Number(payment.amount), method: payment.method,
      status: payment.status, createdAt: payment.created_at, deleted: payment.deleted,
      billingName: payment.billing_name, linkedToBankMovement: linkedPaymentIds.has(payment.id),
    })),
  }));
}

const errorResponse = (error: unknown, status = 500) =>
  Response.json({ error: error instanceof Error ? error.message : (error as { message?: string })?.message || 'Falha ao ler reservas.' }, { status });

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;

  const params = new URL(req.url).searchParams;
  const holderBookingId = params.get('titular');
  if (holderBookingId !== null) return holderPreview(holderBookingId, params.get('paymentId'));
  const search = params.get('procurar');
  if (search !== null) return searchBookings(search);

  const pilgrimageId = params.get('pilgrimageId');
  const bookingId = params.get('reserva');
  if (!pilgrimageId && !bookingId) {
    const { data, error } = await db().from('pilgrimages')
      .select('id, title, start_date')
      .order('start_date', { ascending: false })
      .limit(200);
    return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json({ pilgrimages: data || [] });
  }
  if (pilgrimageId && !UUID.test(pilgrimageId)) return Response.json({ error: 'Peregrinação inválida.' }, { status: 400 });
  if (bookingId && !UUID.test(bookingId)) return Response.json({ error: 'Reserva inválida.' }, { status: 400 });
  const amountParam = params.get('amount');
  const amount = amountParam === null ? NaN : Number(amountParam);
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: 'Valor do movimento inválido.' }, { status: 400 });
  }

  const query = db().from('bookings').select(BOOKING_SELECT);
  const { data, error } = await (bookingId ? query.eq('id', bookingId) : query.eq('pilgrimage_id', pilgrimageId as string))
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  try {
    return Response.json({ bookings: await describeBookings((data || []) as BookingRow[], amount) });
  } catch (cause) {
    return errorResponse(cause);
  }
}

/**
 * Read only: bookings of any pilgrimage whose pilgrim or account holder has
 * this name. Accents are matched loosely ("Conceicao" finds "Conceição").
 */
async function searchBookings(term: string) {
  const wanted = normalizeForMatch(term).replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (wanted.length < 3) return Response.json({ results: [] });
  // Letters that may carry an accent become single-character wildcards; the
  // exact comparison happens below, without accents.
  const pattern = `%${wanted.toLowerCase().replace(/[aeiouc]/g, '_').replace(/ /g, '%')}%`;
  const matches = (value: string | null | undefined) => {
    const words = wanted.split(' ');
    const name = normalizeForMatch(value || '');
    return words.every(word => name.includes(word));
  };
  try {
    // As typed first (precise), then loosely for missing accents.
    const typed = `%${term.trim().replace(/[%_,()\\]/g, ' ').replace(/\s+/g, '%')}%`;
    const found = await Promise.all([typed, pattern].flatMap(like => [
      db().from('pilgrims').select('booking_id, full_name').ilike('full_name', like).limit(300),
      db().from('membros').select('id, nome').ilike('nome', like).limit(300),
    ]));
    const failed = found.find(result => result.error)?.error;
    if (failed) throw failed;
    const pilgrims = [...(found[0].data || []), ...(found[2].data || [])] as { booking_id: string; full_name: string }[];
    const members = [...(found[1].data || []), ...(found[3].data || [])] as { id: string; nome: string | null }[];
    const bookingIds = [...new Set((pilgrims || []).filter(row => matches(row.full_name)).map(row => row.booking_id).filter(Boolean))];
    const memberIds = (members || []).filter(row => matches(row.nome)).map(row => row.id);
    const select = 'id, status, user_id, pilgrimage_id, total_amount, paid_amount, created_at, pilgrims(id, full_name), pilgrimages(title, start_date)';
    const [byPilgrim, byMember] = await Promise.all([
      bookingIds.length ? db().from('bookings').select(select).in('id', bookingIds.slice(0, 100)) : { data: [], error: null },
      memberIds.length ? db().from('bookings').select(select).in('user_id', memberIds.slice(0, 100)) : { data: [], error: null },
    ]);
    if (byPilgrim.error) throw byPilgrim.error;
    if (byMember.error) throw byMember.error;
    const rows = new Map<string, Record<string, unknown>>();
    for (const row of [...(byPilgrim.data || []), ...(byMember.data || [])] as Record<string, unknown>[]) rows.set(String(row.id), row);
    const holderIds = [...new Set([...rows.values()].map(row => row.user_id).filter(Boolean))] as string[];
    const { data: holders, error: holderError } = holderIds.length
      ? await db().from('membros').select('id, nome').in('id', holderIds)
      : { data: [], error: null };
    if (holderError) throw holderError;
    const names = new Map((holders || []).map(row => [row.id, row.nome]));
    const results = [...rows.values()].map(row => {
      const trip = (Array.isArray(row.pilgrimages) ? row.pilgrimages[0] : row.pilgrimages) as { title?: string; start_date?: string | null } | null;
      return {
        id: String(row.id),
        status: String(row.status || ''),
        pilgrimageId: row.pilgrimage_id as string,
        pilgrimageTitle: trip?.title || 'Peregrinação',
        startDate: trip?.start_date || null,
        holderName: (names.get(row.user_id as string) as string | undefined) || null,
        pilgrims: ((row.pilgrims || []) as { full_name: string }[]).map(person => person.full_name),
        totalAmount: Number(row.total_amount),
        paidAmount: Number(row.paid_amount),
      };
    })
      // Active bookings and the newest trips first.
      .sort((a, b) => Number(['canceled', 'cancelled'].includes(a.status.toLowerCase())) - Number(['canceled', 'cancelled'].includes(b.status.toLowerCase()))
        || String(b.startDate || '').localeCompare(String(a.startDate || '')))
      .slice(0, 15);
    return Response.json({ results }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (cause) {
    return errorResponse(cause);
  }
}

const UUID = /^[0-9a-f-]{36}$/i;
const digits = (value: unknown) => String(value ?? '').replace(/\D/g, '');

/**
 * Read only: the fiscal customer the FR of this booking will carry — same
 * rules as the FR itself — next to the customer of its last FR, so the admin
 * sees who is invoiced before anything is created.
 */
async function holderPreview(bookingId: string, paymentId: string | null) {
  if (!UUID.test(bookingId) || (paymentId && !UUID.test(paymentId))) {
    return Response.json({ error: 'Reserva inválida.' }, { status: 400 });
  }
  try {
    const [preview, { data: payments, error: paymentsError }] = await Promise.all([
      previewPilgrimageCustomer(db(), bookingId, paymentId),
      db().from('pilgrimage_payments').select('id').eq('booking_id', bookingId),
    ]);
    if (paymentsError) throw paymentsError;
    const ids = (payments || []).map(row => row.id);
    const { data: documents, error: documentsError } = ids.length
      ? await db().from('factpt_documents')
        .select('factpt_number, issued_at, fiscal_snapshot')
        .eq('environment', 'production').eq('source_table', 'pilgrimage_payments').eq('status', 'issued')
        .in('source_id', ids).order('issued_at', { ascending: false }).limit(1)
      : { data: [], error: null };
    if (documentsError) throw documentsError;
    const last = documents?.[0];
    const lastCustomer = (last?.fiscal_snapshot as { customer?: { name?: string; nif?: string | null } } | null)?.customer;
    const lastInvoice = last && lastCustomer ? {
      number: last.factpt_number as string | null, issuedAt: last.issued_at as string | null,
      name: lastCustomer.name || null, nif: digits(lastCustomer.nif) || null,
    } : null;
    const customer = preview.customer;
    const sameAsLast = !lastInvoice || !customer ? null
      : (lastInvoice.nif && customer.nif ? lastInvoice.nif === digits(customer.nif)
        : normalizeForMatch(lastInvoice.name || '') === normalizeForMatch(customer.name || ''));
    return Response.json({
      holder: customer && {
        name: customer.name, email: customer.email, nif: customer.nif, address: customer.address,
        zip: customer.zip, city: customer.city, country: customer.country,
      },
      basis: preview.basis, problem: preview.problem, lastInvoice, sameAsLast,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Falha ao ler o titular da reserva.' }, { status: 500 });
  }
}
