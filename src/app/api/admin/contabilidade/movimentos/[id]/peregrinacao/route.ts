import { logAdminAudit } from '../../../../../../../lib/admin-audit';
import { learnCounterparty } from '../../../../../../../lib/ledger/aliases';
import { assessInvoice } from '../../../../../../../lib/ledger/invoice-assessment';
import { db, requireAdmin } from '../../../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const { id } = await context.params;
  const body = await req.json().catch(() => null) as {
    bookingId?: string; paymentId?: string | null; acknowledgeNearby?: boolean;
  } | null;
  if (!UUID.test(id) || !body?.bookingId || !UUID.test(body.bookingId)
      || (body.paymentId && !UUID.test(body.paymentId))) {
    return Response.json({ error: 'Escolha uma reserva e um pagamento válidos.' }, { status: 400 });
  }

  const { data: movement, error: movementError } = await db().from('bank_transactions')
    .select('id, amount, booking_date, counterparty_name, status')
    .eq('id', id).maybeSingle();
  if (movementError) return Response.json({ error: movementError.message }, { status: 500 });
  if (!movement || Number(movement.amount) <= 0 || !['unreviewed', 'suggested'].includes(movement.status)) {
    return Response.json({ error: 'Movimento indisponível para associar.' }, { status: 409 });
  }

  const { data: existingLink, error: linkError } = await db().from('bank_transaction_links')
    .select('target_id').eq('bank_transaction_id', id)
    .eq('target_type', 'pilgrimage_payment').maybeSingle();
  if (linkError) return Response.json({ error: linkError.message }, { status: 500 });
  if (existingLink?.target_id) {
    const { data: existingPayment, error: paymentError } = await db().from('pilgrimage_payments')
      .select('booking_id').eq('id', existingLink.target_id).maybeSingle();
    if (paymentError) return Response.json({ error: paymentError.message }, { status: 500 });
    if (existingPayment?.booking_id === body.bookingId
        && (!body.paymentId || body.paymentId === existingLink.target_id)) {
      return Response.json({ ok: true, paymentId: existingLink.target_id, alreadyRegistered: true });
    }
    return Response.json({ error: 'Este movimento já foi associado a outra reserva ou pagamento.' }, { status: 409 });
  }

  // Linking to a payment already registered on the pilgrimage page (FR issued
  // there) creates nothing: it only records which bank movement paid it.
  let linkingExisting = false;
  if (body.paymentId) {
    const { data: chosen, error: chosenError } = await db().from('pilgrimage_payments')
      .select('status, booking_id').eq('id', body.paymentId).maybeSingle();
    if (chosenError) return Response.json({ error: chosenError.message }, { status: 500 });
    linkingExisting = !!chosen && chosen.booking_id === body.bookingId
      && ['verified', 'manual', 'succeeded', 'paid'].includes(chosen.status);
  }

  const { data: settings, error: settingsError } = await db().from('factpt_settings')
    .select('auto_enabled, production_pilgrimages_only, pilot_private_only, go_live_at')
    .eq('environment', 'production').maybeSingle();
  if (settingsError) return Response.json({ error: settingsError.message }, { status: 500 });
  if (!linkingExisting && (!settings?.auto_enabled || !settings.production_pilgrimages_only
      || settings.pilot_private_only || !settings.go_live_at
      || Date.parse(settings.go_live_at) > Date.now())) {
    return Response.json({ error: 'A emissão automática FACT.pt de peregrinações não está ativa. Não foi criado nenhum pagamento.' }, { status: 409 });
  }

  const assessment = await assessInvoice(movement, 'peregrinacao');
  const issuedForOther = !!assessment.issued && assessment.issued.sourceId !== body.paymentId;
  if (linkingExisting ? issuedForOther || assessment.ambiguous : (assessment.issued || assessment.ambiguous
      || assessment.pending?.type === 'factpt_document'
      || assessment.pending && assessment.pending.id !== body.paymentId)) {
    return Response.json({ error: 'Há um pagamento ou uma FR possível para esta transferência. Reveja a associação antes de criar ou verificar outro pagamento.' }, { status: 409 });
  }
  if (!linkingExisting && assessment.nearbyIssuedCount && !body.acknowledgeNearby) {
    return Response.json({ error: 'Há uma FR da app com o mesmo valor e data próxima. Confirme que não pertence a esta transferência.' }, { status: 409 });
  }

  const { data: paymentId, error } = await db().rpc('ledger_register_pilgrimage_transfer', {
    p_transaction_id: id,
    p_booking_id: body.bookingId,
    p_payment_id: body.paymentId || null,
    p_admin_user_id: admin.userId,
    p_actor: admin.email,
  });
  if (error) {
    const message = error.code === '23505'
      ? 'Este pagamento já está ligado a outro movimento do banco.'
      : error.message;
    return Response.json({ error: message }, { status: error.code === 'P0001' || error.code === '23505' ? 409 : 500 });
  }
  try {
    await logAdminAudit({ adminEmail: admin.email, action: 'ledger.register_pilgrimage_transfer', details: { bank_transaction_id: id, booking_id: body.bookingId, payment_id: paymentId } });
  } catch (auditError) {
    console.error('Pagamento registado, mas falhou o log administrativo da contabilidade:', auditError);
  }
  await learnCounterparty(movement.counterparty_name, 'peregrinacao')
    .catch(learnError => console.error('Contabilidade: falhou a aprendizagem', learnError));
  return Response.json({ ok: true, paymentId, invoiceStatus: linkingExisting ? 'issued' : 'pending', linkedExisting: linkingExisting });
}
