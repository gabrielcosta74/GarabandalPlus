import 'server-only';

import { addDays, matchingCandidates, samePerson, type InvoiceCandidate } from './invoice-safety';
import { db } from './server';

type Movement = {
  id: string;
  amount: number;
  booking_date: string;
  counterparty_name: string | null;
};

export type InvoiceAssessment = {
  issued: InvoiceCandidate | null;
  pending: { type: 'donation' | 'pilgrimage_payment' | 'quota' | 'factpt_document'; id: string } | null;
  ambiguous: boolean;
  nearbyIssuedCount: number;
  linkedPaymentId?: string | null;
};

const LINKED_SOURCES: Record<string, { linkType: 'pilgrimage_payment' | 'donation'; table: string } | undefined> = {
  peregrinacao: { linkType: 'pilgrimage_payment', table: 'pilgrimage_payments' },
  doacao: { linkType: 'donation', table: 'donations' },
};

const customerName = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null;
  const customer = (value as { customer?: { name?: unknown } }).customer;
  return typeof customer?.name === 'string' ? customer.name : null;
};

/** Read only. A unique amount + date + payer match is required before trusting a site document. */
export async function assessInvoice(movement: Movement, category: string): Promise<InvoiceAssessment> {
  if (movement.amount <= 0 || !['doacao', 'peregrinacao', 'quota', 'loja'].includes(category)) {
    return { issued: null, pending: null, ambiguous: false, nearbyIssuedCount: 0 };
  }

  // A movement already tied to a site payment can only use that payment's FR.
  const linkedSource = LINKED_SOURCES[category];
  if (linkedSource) {
    const { data: link, error: linkError } = await db().from('bank_transaction_links')
      .select('target_id').eq('bank_transaction_id', movement.id)
      .eq('target_type', linkedSource.linkType).maybeSingle();
    if (linkError) throw linkError;
    if (link?.target_id) {
      const { data: document, error: documentError } = await db().from('factpt_documents')
        .select('id, factpt_number, status, amount, payment_confirmed_at, source_table, source_id')
        .eq('environment', 'production').eq('source_table', linkedSource.table)
        .eq('source_id', link.target_id).maybeSingle();
      if (documentError) throw documentError;
      const amountMatches = document && Math.round(Number(document.amount) * 100) === Math.round(movement.amount * 100);
      const issued = amountMatches && document?.factpt_number && ['issued', 'email_failed'].includes(document.status)
        ? { id: document.id, number: document.factpt_number, status: document.status,
          amount: Number(document.amount), paymentDate: document.payment_confirmed_at,
          customerName: null, sourceTable: document.source_table, sourceId: document.source_id }
        : null;
      return { issued: issued || null, pending: issued ? null : { type: document ? 'factpt_document' : linkedSource.linkType, id: document?.id || link.target_id },
        ambiguous: !!document && !amountMatches, nearbyIssuedCount: 0, linkedPaymentId: link.target_id };
    }
  }

  const from = addDays(movement.booking_date, -30);
  const to = addDays(movement.booking_date, 31);
  const { data: documents, error: documentError } = await db()
    .from('factpt_documents')
    .select('id, factpt_number, status, amount, payment_confirmed_at, fiscal_snapshot, source_snapshot, source_type, source_table, source_id')
    .eq('environment', 'production')
    .eq('amount', movement.amount)
    .gte('payment_confirmed_at', from)
    .lt('payment_confirmed_at', to);
  if (documentError) throw documentError;

  const sourceType = category === 'doacao' ? 'donation' : category === 'peregrinacao' ? 'pilgrimage' : category === 'quota' ? 'quota' : 'store';
  const candidates: InvoiceCandidate[] = (documents || [])
    .filter(row => row.source_type === sourceType)
    .map(row => ({
      id: row.id,
      number: row.factpt_number,
      status: row.status,
      amount: Number(row.amount),
      paymentDate: row.payment_confirmed_at,
      customerName: customerName(row.fiscal_snapshot) || customerName(row.source_snapshot),
      sourceTable: row.source_table,
      sourceId: row.source_id,
    }));
  const matched = matchingCandidates(candidates, {
    amount: movement.amount,
    bookingDate: movement.booking_date,
    counterpartyName: movement.counterparty_name,
  });
  const issued = matched.filter(candidate => candidate.number && ['issued', 'email_failed'].includes(candidate.status));
  const queued = matched.filter(candidate => !candidate.number);
  let competingBankMovement = false;
  if (issued.length === 1 && matched.length === 1) {
    const document = issued[0];
    const { data: sameAmountMovements, error: bankError } = await db()
      .from('bank_transactions')
      .select('id, booking_date, counterparty_name')
      .eq('amount', movement.amount)
      .gte('booking_date', addDays(document.paymentDate.slice(0, 10), -30))
      .lte('booking_date', addDays(document.paymentDate.slice(0, 10), 2));
    if (bankError) throw bankError;
    competingBankMovement = (sameAmountMovements || []).some(row =>
      row.id !== movement.id && samePerson(row.counterparty_name, document.customerName),
    );
  }

  const pendingRows: { type: 'donation' | 'pilgrimage_payment' | 'quota'; id: string }[] = [];
  if (category === 'doacao' || category === 'peregrinacao') {
    const { data, error } = await db().from('donations')
      // donations stores the amount in cents.
      .select('id, donor_name, amount_cents, created_at')
      .eq('amount_cents', Math.round(movement.amount * 100))
      .eq('status', 'pending_verification')
      .gte('created_at', from)
      .lt('created_at', to);
    if (error) throw error;
    for (const row of data || []) {
      if (samePerson(movement.counterparty_name, row.donor_name)) pendingRows.push({ type: 'donation', id: row.id });
    }
  }
  if (category === 'doacao' || category === 'peregrinacao') {
    const { data, error } = await db().from('pilgrimage_payments')
      .select('id, user_id, billing_name, amount, created_at')
      .eq('amount', movement.amount)
      .eq('deleted', false)
      .in('status', ['pending', 'pending_verification', 'verifying'])
      .gte('created_at', from)
      .lt('created_at', to);
    if (error) throw error;
    const memberIds = [...new Set((data || []).map(row => row.user_id).filter(Boolean))];
    const { data: members, error: memberError } = memberIds.length
      ? await db().from('membros').select('id, nome').in('id', memberIds)
      : { data: [], error: null };
    if (memberError) throw memberError;
    const names = new Map((members || []).map(member => [member.id, member.nome]));
    for (const row of data || []) {
      if (samePerson(movement.counterparty_name, row.billing_name || names.get(row.user_id) || null)) {
        pendingRows.push({ type: 'pilgrimage_payment', id: row.id });
      }
    }
  }
  if (category === 'quota') {
    const { data, error } = await db().from('pagamentos_quotas')
      .select('id, user_id, billing_name, valor, data_pagamento')
      .eq('valor', movement.amount)
      .eq('estado', 'pendente')
      .in('metodo_pagamento', ['bank_transfer', 'transfer'])
      .gte('data_pagamento', from)
      .lt('data_pagamento', to);
    if (error) throw error;
    const memberIds = [...new Set((data || []).map(row => row.user_id).filter(Boolean))];
    const { data: members, error: memberError } = memberIds.length
      ? await db().from('membros').select('id, nome').in('id', memberIds)
      : { data: [], error: null };
    if (memberError) throw memberError;
    const names = new Map((members || []).map(member => [member.id, member.nome]));
    for (const row of data || []) {
      if (samePerson(movement.counterparty_name, row.billing_name || names.get(row.user_id) || null)) {
        pendingRows.push({ type: 'quota', id: row.id });
      }
    }
  }

  // An FR already tied to another bank movement cannot be this one's: it must not
  // ask the admin to rule it out.
  const nearbyDocs = (documents || []).filter(document => document.factpt_number && ['issued', 'email_failed'].includes(document.status));
  const takenNearby = new Set<string>();
  if (nearbyDocs.length) {
    const { data: taken, error: takenError } = await db().from('bank_transaction_links')
      .select('bank_transaction_id, target_type, target_id')
      .or(`target_id.in.(${nearbyDocs.map(document => document.source_id).join(',')}),target_type.eq.factpt_document`)
      .neq('bank_transaction_id', movement.id);
    if (takenError) throw takenError;
    for (const link of taken || []) {
      if (link.target_type === 'factpt_document') takenNearby.add(String(link.target_id));
      else if (link.target_type === 'donation' || link.target_type === 'pilgrimage_payment') {
        const owner = nearbyDocs.find(document => document.source_id === link.target_id);
        if (owner) takenNearby.add(owner.factpt_number);
      }
    }
  }

  return {
    issued: issued.length === 1 && matched.length === 1 && pendingRows.length === 0 && !competingBankMovement ? issued[0] : null,
    pending: queued.length === 1 && matched.length === 1 && pendingRows.length === 0
      ? { type: 'factpt_document', id: queued[0].id }
      : pendingRows.length === 1 && matched.length === 0 ? pendingRows[0] : null,
    ambiguous: matched.length + pendingRows.length > 1 || competingBankMovement,
    nearbyIssuedCount: nearbyDocs.filter(document =>
      !takenNearby.has(document.factpt_number)
      && (category === 'doacao' || category === 'peregrinacao'
        ? ['donation', 'pilgrimage'].includes(document.source_type)
        : document.source_type === sourceType)
      && document.payment_confirmed_at.slice(0, 10) >= addDays(movement.booking_date, -2)
      && document.payment_confirmed_at.slice(0, 10) <= addDays(movement.booking_date, 10),
    ).length,
  };
}
