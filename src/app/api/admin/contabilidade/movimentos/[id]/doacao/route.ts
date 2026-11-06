import { logAdminAudit } from '../../../../../../../lib/admin-audit';
import { learnCounterparty } from '../../../../../../../lib/ledger/aliases';
import { clientConflict, donationGate, donorPrefill, genericClientExists } from '../../../../../../../lib/ledger/donation-issue';
import { syncFactptMirror } from '../../../../../../../lib/ledger/factpt-mirror';
import { closeWhenInvoiced } from '../../../../../../../lib/ledger/finish-confirmed';
import { missingDonorFields, type DonorIdentity } from '../../../../../../../lib/ledger/factpt-mirror-rules';
import { FACTPT_GENERIC_CONSUMER_LIMIT } from '../../../../../../../lib/factpt/rules';
import { db, requireAdmin } from '../../../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID = /^[0-9a-f-]{36}$/i;
const DONOR_FIELDS = ['name', 'email', 'nif', 'address', 'zip', 'city', 'country'] as const;

/** Only short text reaches the database, whatever the request carried. */
function cleanDonor(value: unknown): Partial<DonorIdentity> {
  const input = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const donor: Record<string, string> = {};
  for (const field of DONOR_FIELDS) {
    const text = input[field];
    if (typeof text === 'string') donor[field] = text.trim().slice(0, 200);
  }
  return donor;
}

async function loadMovement(id: string) {
  const { data, error } = await db().from('bank_transactions')
    .select('id, amount, booking_date, counterparty_name, status, account_id').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? { ...data, amount: Number(data.amount) } : null;
}

/** Read only: may the app issue this FR, and what do we already know about the donor? */
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const { id } = await context.params;
  if (!UUID.test(id)) return Response.json({ error: 'Movimento inválido.' }, { status: 400 });
  try {
    const movement = await loadMovement(id);
    if (!movement || movement.amount <= 0) return Response.json({ error: 'Movimento indisponível.' }, { status: 404 });
    const gate = await donationGate(movement);
    const prefill = gate.available ? await donorPrefill(movement.counterparty_name) : null;
    const genericAllowed = gate.available && movement.amount <= FACTPT_GENERIC_CONSUMER_LIMIT;
    return Response.json({ ...gate, prefill, genericAllowed }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Falha ao verificar a emissão.' }, { status: 500 });
  }
}

/** Registers the donation; the paid-payment trigger then issues and emails the FR. */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const { id } = await context.params;
  const body = await req.json().catch(() => null) as { donor?: unknown; generic?: boolean; acknowledgeManual?: boolean } | null;
  const generic = body?.generic === true;
  if (!UUID.test(id) || (!generic && !body?.donor)) return Response.json({ error: 'Pedido inválido.' }, { status: 400 });

  const donor = cleanDonor(body?.donor);
  const missing = generic ? [] : missingDonorFields(donor);
  if (missing.length) return Response.json({ error: `Falta: ${missing.join(', ')}.` }, { status: 400 });

  try {
    const movement = await loadMovement(id);
    if (!movement || movement.amount <= 0 || !['unreviewed', 'suggested'].includes(movement.status)) {
      return Response.json({ error: 'Movimento indisponível para registar como doação.' }, { status: 409 });
    }
    if (generic && movement.amount > FACTPT_GENERIC_CONSUMER_LIMIT) {
      return Response.json({ error: 'Acima de 100 € a lei exige nome e morada. Preencha os dados da pessoa.' }, { status: 409 });
    }
    // The copy may be hours old, and an FR issued by hand this morning must count.
    // If FACT.pt cannot be read right now, nothing is issued.
    try {
      await syncFactptMirror({ maxPages: 2, maxClients: 5 });
    } catch (readError) {
      console.error('Contabilidade: leitura da FACT.pt antes de emitir falhou', readError);
      return Response.json({ error: 'Não foi possível confirmar na FACT.pt que esta FR não existe. Nada foi emitido; tente daqui a pouco.' }, { status: 503 });
    }
    const gate = await donationGate(movement);
    if (!gate.available) return Response.json({ error: gate.blockedReason || 'A emissão pela app não está ativa.' }, { status: 409 });
    if (gate.nearbyManual.length && !body?.acknowledgeManual) {
      return Response.json({ error: 'Há FRs manuais com este valor e data próxima. Confirme que não pertencem a esta transferência.' }, { status: 409 });
    }

    if (generic && !await genericClientExists()) {
      return Response.json({ error: 'O cliente «Consumidor final» não foi encontrado na FACT.pt. Nada foi emitido.' }, { status: 409 });
    }
    const conflict = generic ? null : await clientConflict(donor);
    if (conflict) {
      return Response.json({ error: 'Já existe um cliente com este nome na FACT.pt, com outros dados. Use os dados dele para a FR não falhar.', conflict }, { status: 409 });
    }

    const { data: donationId, error } = generic
      ? await db().rpc('ledger_register_generic_donation_transfer', {
          p_transaction_id: id,
          p_admin_user_id: admin.userId,
          p_actor: admin.email,
        })
      : await db().rpc('ledger_register_donation_transfer', {
          p_transaction_id: id,
          p_donor_name: donor.name,
          p_donor_email: donor.email,
          p_donor_nif: donor.nif || null,
          p_donor_address: donor.address,
          p_donor_zip: donor.zip,
          p_donor_city: donor.city,
          p_donor_country: donor.country,
          p_admin_user_id: admin.userId,
          p_actor: admin.email,
        });
    if (error) {
      const known = error.code === 'P0001' || error.code === '23505';
      return Response.json({ error: error.code === '23505' ? 'Já existe uma doação para este movimento.' : error.message }, { status: known ? 409 : 500 });
    }
    try {
      await logAdminAudit({ adminEmail: admin.email, action: 'ledger.register_donation_transfer', details: { bank_transaction_id: id, donation_id: donationId, generic } });
    } catch (auditError) {
      console.error('Doação registada, mas falhou o log administrativo da contabilidade:', auditError);
    }
    await closeWhenInvoiced(id).catch(closeError => console.error('Contabilidade: falhou a marca de fecho', closeError));
    await learnCounterparty(movement.counterparty_name, 'doacao')
      .catch(learnError => console.error('Contabilidade: falhou a aprendizagem', learnError));
    return Response.json({ ok: true, donationId });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível registar a doação.' }, { status: 500 });
  }
}
