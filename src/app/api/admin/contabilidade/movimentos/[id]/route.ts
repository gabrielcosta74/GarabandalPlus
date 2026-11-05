import { logAdminAudit } from '../../../../../../lib/admin-audit';
import { forgetConfirmation, learnCounterparty } from '../../../../../../lib/ledger/aliases';
import { LEDGER_CATEGORIES, requiresInvoice } from '../../../../../../lib/ledger/categories';
import { findMirrorAmount } from '../../../../../../lib/ledger/factpt-mirror';
import { assessInvoice } from '../../../../../../lib/ledger/invoice-assessment';
import { normalizeInvoiceRef, validateInvoiceRef } from '../../../../../../lib/ledger/invoice-safety';
import { db, requireAdmin } from '../../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Body =
  | { action: 'approve'; categoryCode: string; invoiceRef?: string | null; acknowledgeNearby?: boolean }
  | { action: 'ignore'; reason: string }
  | { action: 'reopen' }
  | { action: 'paper_document'; value: boolean }
  | { action: 'note'; notes: string };

const VALID_CATEGORIES = new Set(LEDGER_CATEGORIES.map(category => category.code as string));
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: 'Movimento inválido.' }, { status: 400 });
  const { data: movement, error } = await db().from('bank_transactions')
    .select('id, amount, booking_date, counterparty_name, category_code, raw')
    .eq('id', id).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!movement) return Response.json({ error: 'Movimento não encontrado.' }, { status: 404 });
  const category = new URL(req.url).searchParams.get('category') || movement.category_code || movement.raw?.suggested_category;
  if (!category || !VALID_CATEGORIES.has(category)) return Response.json({ issued: null, pending: null, ambiguous: false, nearbyIssuedCount: 0 });
  try {
    return Response.json(await assessInvoice(movement, category));
  } catch (assessmentError) {
    return Response.json({ error: assessmentError instanceof Error ? assessmentError.message : 'Falha ao verificar a faturação.' }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;

  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: 'Movimento inválido.' }, { status: 400 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Pedido inválido.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || typeof body.action !== 'string') {
    return Response.json({ error: 'Pedido inválido.' }, { status: 400 });
  }
  if (body.action === 'approve' && body.invoiceRef != null && typeof body.invoiceRef !== 'string')
    return Response.json({ error: 'FR inválida.' }, { status: 400 });
  if (body.action === 'ignore' && typeof body.reason !== 'string')
    return Response.json({ error: 'Indique um motivo válido.' }, { status: 400 });
  if (body.action === 'note' && typeof body.notes !== 'string')
    return Response.json({ error: 'Nota inválida.' }, { status: 400 });
  if (body.action === 'paper_document' && typeof body.value !== 'boolean')
    return Response.json({ error: 'Valor inválido.' }, { status: 400 });

  const { data: movement, error: loadError } = await db()
    .from('bank_transactions')
    .select('id, amount, booking_date, counterparty_name, status, category_code, needs_document, paper_document')
    .eq('id', id)
    .maybeSingle();
  if (loadError) return Response.json({ error: loadError.message }, { status: 500 });
  if (!movement) return Response.json({ error: 'Movimento não encontrado.' }, { status: 404 });

  const stamp = { reviewed_by: admin.email, reviewed_at: new Date().toISOString() };
  let update: Record<string, unknown>;

  switch (body.action) {
    case 'approve': {
      if (movement.status === 'reconciled' || movement.status === 'ignored') {
        return Response.json({ error: 'Este movimento já foi tratado. Reabra-o antes de alterar.' }, { status: 409 });
      }
      if (!VALID_CATEGORIES.has(body.categoryCode)) {
        return Response.json({ error: 'Categoria inválida.' }, { status: 400 });
      }
      const needsInvoice = Number(movement.amount) > 0 && requiresInvoice(body.categoryCode);
      if (body.invoiceRef && !needsInvoice) {
        return Response.json({ error: 'Esta categoria não aceita uma FR individual.' }, { status: 400 });
      }
      const assessment = needsInvoice ? await assessInvoice(movement, body.categoryCode) : null;
      if (assessment?.pending) {
        return Response.json({ error: assessment.pending.type === 'factpt_document'
          ? 'A app já está a tratar a FR deste pagamento. Reveja o documento em Faturação antes de fechar este movimento.'
          : 'Existe um pagamento pendente no site com este valor e pagador. Confirme-o no fluxo de pagamentos do site para emitir a FR uma só vez.' }, { status: 409 });
      }
      if (assessment?.ambiguous) {
        return Response.json({ error: 'Há vários pagamentos ou documentos possíveis para este movimento. Confirme a associação antes de registar uma FR.' }, { status: 409 });
      }
      const typedRef = body.invoiceRef?.trim();
      const invoiceRef = typedRef
        ? validateInvoiceRef(typedRef, body.categoryCode, movement.booking_date)
        : assessment?.issued?.number ? normalizeInvoiceRef(assessment.issued.number) : null;
      if (needsInvoice && !invoiceRef) {
        return Response.json({ error: 'Indique uma FR da série correta para esta categoria e ano, ou associe a FR já emitida pela app.' }, { status: 400 });
      }
      if (invoiceRef) {
        // A typed number is checked against what FACT.pt really issued.
        const issuedAmount = await findMirrorAmount(invoiceRef);
        if (issuedAmount !== null && Math.round(issuedAmount * 100) !== Math.round(Number(movement.amount) * 100)) {
          return Response.json({ error: `A ${invoiceRef} é de ${issuedAmount.toFixed(2).replace('.', ',')} € na FACT.pt, não deste valor.` }, { status: 409 });
        }
        const { data: existingAppDocuments, error: lookupError } = await db().from('factpt_documents')
          .select('id, amount, source_table, status')
          .eq('environment', 'production')
          .eq('factpt_number', invoiceRef);
        if (lookupError) return Response.json({ error: lookupError.message }, { status: 500 });
        if (existingAppDocuments?.length && !existingAppDocuments.some(document => document.id === assessment?.issued?.id)) {
          return Response.json({ error: `A ${invoiceRef} já pertence a outro pagamento emitido pela app. Verifique a associação.` }, { status: 409 });
        }
        if (assessment?.issued && invoiceRef !== normalizeInvoiceRef(assessment.issued.number || '')) {
          return Response.json({ error: `Este movimento corresponde à ${assessment.issued.number} emitida pela app. Use essa FR.` }, { status: 409 });
        }
        if (!assessment?.issued && assessment?.nearbyIssuedCount && !body.acknowledgeNearby) {
          return Response.json({ error: 'Há uma FR da app com o mesmo valor e data próxima. Confirme que não é deste pagamento antes de continuar.' }, { status: 409 });
        }
      }
      const { error: approveError } = await db().rpc('ledger_approve_movement', {
        p_transaction_id: id,
        p_category_code: body.categoryCode,
        p_invoice_ref: invoiceRef,
        p_invoice_method: assessment?.issued ? 'rule' : 'manual',
        p_actor: admin.email,
      });
      if (approveError) {
        const duplicate = approveError.code === '23505';
        return Response.json({ error: duplicate ? `A ${invoiceRef} já está ligada a outro movimento.` : approveError.message },
          { status: duplicate || approveError.code === 'P0001' ? 409 : 500 });
      }
      await logAdminAudit({ adminEmail: admin.email, action: 'ledger.approve', details: { bank_transaction_id: id, categoryCode: body.categoryCode, invoiceRef } });
      await learnCounterparty(movement.counterparty_name, body.categoryCode)
        .catch(learnError => console.error('Contabilidade: falhou a aprendizagem', learnError));
      return Response.json({ ok: true });
    }
    case 'ignore': {
      if (movement.status === 'reconciled' || movement.status === 'ignored') {
        return Response.json({ error: 'Este movimento já foi tratado. Reabra-o antes de alterar.' }, { status: 409 });
      }
      if (!body.reason?.trim()) return Response.json({ error: 'Indique o motivo.' }, { status: 400 });
      const { data: linked, error: linkedError } = await db().from('bank_transaction_links')
        .select('id').eq('bank_transaction_id', id).limit(1);
      if (linkedError) return Response.json({ error: linkedError.message }, { status: 500 });
      if (linked?.length) return Response.json({ error: 'Este movimento já está ligado a um pagamento. Não pode ser ignorado.' }, { status: 409 });
      update = { ...stamp, status: 'ignored', ignore_reason: body.reason.trim().slice(0, 500) };
      break;
    }
    case 'reopen': {
      // The link and movement status change atomically; FACT.pt is untouched.
      const { error: reopenError } = await db().rpc('ledger_reopen_movement', {
        p_transaction_id: id,
        p_actor: admin.email,
      });
      if (reopenError) return Response.json({ error: reopenError.message }, { status: reopenError.code === 'P0001' ? 409 : 500 });
      if (movement.status === 'reconciled') {
        await forgetConfirmation(movement.counterparty_name, movement.category_code)
          .catch(learnError => console.error('Contabilidade: falhou a aprendizagem', learnError));
      }
      await logAdminAudit({ adminEmail: admin.email, action: 'ledger.reopen', details: { bank_transaction_id: id } });
      return Response.json({ ok: true });
    }
    case 'paper_document':
      update = { ...stamp, paper_document: !!body.value };
      break;
    case 'note':
      update = { ...stamp, notes: String(body.notes || '').slice(0, 2000) || null };
      break;
    default:
      return Response.json({ error: 'Ação desconhecida.' }, { status: 400 });
  }

  const { data: updated, error } = await db().from('bank_transactions')
    .update(update).eq('id', id).eq('status', movement.status).select('id').maybeSingle();
  if (error || !updated) {
    return Response.json({ error: error?.message || 'O movimento foi alterado por outra pessoa. Atualize a página.' }, { status: error?.code === 'P0001' || !updated ? 409 : 500 });
  }

  await logAdminAudit({ adminEmail: admin.email, action: `ledger.${body.action}`, details: { bank_transaction_id: id, ...body } });
  return Response.json({ ok: true });
}
