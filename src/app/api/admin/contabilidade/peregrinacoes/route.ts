import { db, requireAdmin } from '../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;

  const pilgrimageId = new URL(req.url).searchParams.get('pilgrimageId');
  if (!pilgrimageId) {
    const { data, error } = await db().from('pilgrimages')
      .select('id, title, start_date')
      .order('start_date', { ascending: false })
      .limit(200);
    return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json({ pilgrimages: data || [] });
  }
  if (!/^[0-9a-f-]{36}$/i.test(pilgrimageId)) return Response.json({ error: 'Peregrinação inválida.' }, { status: 400 });

  const { data, error } = await db().from('bookings')
    .select('id, status, user_id, total_amount, paid_amount, pilgrims(id, full_name), pilgrimage_payments(id, amount, method, status, created_at, deleted, billing_name)')
    .eq('pilgrimage_id', pilgrimageId)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const ids = [...new Set((data || []).map(row => row.user_id).filter(Boolean))];
  const { data: members, error: memberError } = ids.length
    ? await db().from('membros').select('id, nome').in('id', ids)
    : { data: [], error: null };
  if (memberError) return Response.json({ error: memberError.message }, { status: 500 });
  const names = new Map((members || []).map(row => [row.id, row.nome]));
  return Response.json({ bookings: (data || []).map(row => ({
    id: row.id,
    status: row.status,
    holderName: names.get(row.user_id) || (row.pilgrims || [])[0]?.full_name || null,
    totalAmount: Number(row.total_amount),
    paidAmount: Number(row.paid_amount),
    pilgrims: row.pilgrims || [],
    payments: (row.pilgrimage_payments || []).map(payment => ({
      id: payment.id, amount: Number(payment.amount), method: payment.method,
      status: payment.status, createdAt: payment.created_at, deleted: payment.deleted,
      billingName: payment.billing_name,
    })),
  })) });
}
