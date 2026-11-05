import { describe, expect, it, vi } from 'vitest';
import { FactPtClient, type FactPtRateLimiter } from '../lib/factpt/client';
import type { FactPtConfig } from '../lib/factpt/config';
import { afterConfirmation, afterUndo, aliasKey, isLearned } from '../lib/ledger/alias-rules';
import {
  invoiceRefFor, isAppDocument, matchManualInvoice, missingDonorFields, pagesNewestFirst,
  toMirrorRow, usableManualInvoice, type ManualInvoice,
} from '../lib/ledger/factpt-mirror-rules';
import { checkPaymentsAgainstBank } from '../lib/ledger/reverse-check';

describe('learning from confirmations', () => {
  it('normalises the bank name', () => {
    expect(aliasKey('José  Conceição-Silva')).toBe('JOSE CONCEICAO SILVA');
    expect(aliasKey('  ')).toBeNull();
    expect(aliasKey(null)).toBeNull();
  });

  it('suggests only after repeated identical answers', () => {
    const once = afterConfirmation(null, 'doacao');
    expect(isLearned(once)).toBe(false);
    expect(isLearned(afterConfirmation(once, 'doacao'))).toBe(true);
  });

  it('a different answer restarts the count', () => {
    const twice = afterConfirmation(afterConfirmation(null, 'doacao'), 'doacao');
    expect(afterConfirmation(twice, 'quota')).toEqual({ default_category_code: 'quota', times_confirmed: 1 });
  });

  it('an undo removes the confirmation', () => {
    const twice = afterConfirmation(afterConfirmation(null, 'doacao'), 'doacao');
    expect(isLearned(afterUndo(twice, 'doacao'))).toBe(false);
    expect(afterUndo(twice, 'quota')).toEqual(twice);
  });
});

describe('payments with no money in the bank', () => {
  const movement = (id: string, amount: number, bookingDate: string) => ({ id, amount, bookingDate });
  const payment = (id: string, amount: number, paidOn: string, linked = false) => ({ id, amount, paidOn, linked });

  it('accepts a payment with its movement', () => {
    const states = checkPaymentsAgainstBank([payment('p', 450, '2026-10-10')], [movement('m', 450, '2026-10-09')], '2026-11-01');
    expect(states.get('p')).toBe('candidate');
  });

  it('one movement cannot justify two payments', () => {
    const states = checkPaymentsAgainstBank(
      [payment('a', 450, '2026-10-10'), payment('b', 450, '2026-10-11')],
      [movement('m', 450, '2026-10-09')],
      '2026-11-01',
    );
    expect(states.get('a')).toBe('candidate');
    expect(states.get('b')).toBe('missing');
  });

  it('gives the bank time before raising the alarm', () => {
    const states = checkPaymentsAgainstBank([payment('p', 450, '2026-10-28')], [], '2026-11-01');
    expect(states.get('p')).toBe('waiting');
  });

  it('counts age from the last bank read, so a stale read stays quiet', () => {
    const states = checkPaymentsAgainstBank([payment('p', 450, '2026-10-28')], [], '2026-10-29');
    expect(states.get('p')).toBe('waiting');
  });

  it('ignores movements far from the payment date', () => {
    const states = checkPaymentsAgainstBank([payment('p', 450, '2026-10-10')], [movement('m', 450, '2026-08-01')], '2026-11-01');
    expect(states.get('p')).toBe('missing');
  });

  it('a linked payment needs nothing else', () => {
    const states = checkPaymentsAgainstBank([payment('p', 450, '2026-10-10', true)], [], '2026-11-01');
    expect(states.get('p')).toBe('linked');
  });
});

describe('FACT.pt documents issued by hand', () => {
  it('tells app documents from manual ones', () => {
    expect(isAppDocument('gp:donation:abc')).toBe(true);
    expect(isAppDocument('')).toBe(false);
    expect(isAppDocument(null)).toBe(false);
  });

  it('writes the number the way the admin does', () => {
    expect(invoiceRefFor('invoicereceipt', '2026D/1243')).toBe('FR 2026D/1243');
    expect(invoiceRefFor('invoicereceipt', 'FR 2026D/0012')).toBe('FR 2026D/12');
    expect(invoiceRefFor('simpleinvoice', '2026D/1243')).toBeNull();
    expect(invoiceRefFor('invoicereceipt', 'nonsense')).toBeNull();
  });

  it('reads the list as FACT.pt returns it', () => {
    expect(toMirrorRow({ id: 2, clientId: '1', number: '2026D/1', type: 'invoicereceipt', date: '2026-03-23', paymentStatus: 'paid', gross: '12.30' }))
      .toMatchObject({ remote_id: '2', client_id: '1', gross: 12.3, doc_date: '2026-03-23' });
    expect(toMirrorRow({ id: 2, number: '2026D/1', type: 'invoicereceipt', date: 'x', gross: '12.30' })).toBeNull();
  });

  it('walks from the newest end, whichever end that is', () => {
    expect(pagesNewestFirst(3, '2026-01-01', '2026-07-29')).toEqual([3, 2, 1]);
    expect(pagesNewestFirst(3, '2026-07-29', '2026-01-01')).toEqual([1, 2, 3]);
  });

  it('never treats an app or cancelled document as a manual invoice', () => {
    const row = { doc_type: 'invoicereceipt', number: '2026D/9', gross: '25.00', doc_date: '2026-10-10', payment_status: 'paid', identifier_id: null, client_name: 'Ana Costa' };
    expect(usableManualInvoice(row)?.number).toBe('FR 2026D/9');
    expect(usableManualInvoice({ ...row, identifier_id: 'gp:donation:1' })).toBeNull();
    expect(usableManualInvoice({ ...row, payment_status: 'canceled' })).toBeNull();
  });

  const invoice = (number: string, customer: string | null, date = '2026-10-12', amount = 25): ManualInvoice => ({ number, amount, date, customer });
  const movement = { amount: 25, bookingDate: '2026-10-10', counterpartyName: 'Ana Maria Costa' };

  it('is certain only when the amount and the name agree', () => {
    expect(matchManualInvoice(movement, [invoice('FR 2026D/1', 'Ana Costa'), invoice('FR 2026D/2', 'Rui Lopes')]))
      .toEqual({ confidence: 'manual', invoiceRefs: ['FR 2026D/1'] });
  });

  it('a single invoice from another name is only likely', () => {
    expect(matchManualInvoice(movement, [invoice('FR 2026D/2', 'Rui Lopes')]))
      .toEqual({ confidence: 'manual_likely', invoiceRefs: ['FR 2026D/2'] });
  });

  it('several possibilities are left to the admin', () => {
    expect(matchManualInvoice(movement, [invoice('FR 2026D/1', 'Rui Lopes'), invoice('FR 2026D/2', null)])?.confidence).toBe('ambiguous');
    expect(matchManualInvoice(movement, [invoice('FR 2026D/1', 'Ana Costa'), invoice('FR 2026D/2', 'Ana Maria Costa')])?.confidence).toBe('ambiguous');
  });

  it('ignores other amounts and dates', () => {
    expect(matchManualInvoice(movement, [invoice('FR 2026D/1', 'Ana Costa', '2026-10-12', 26)])).toBeNull();
    expect(matchManualInvoice(movement, [invoice('FR 2026D/1', 'Ana Costa', '2026-12-30')])).toBeNull();
  });

  it('lists what FACT.pt would refuse', () => {
    expect(missingDonorFields({ name: 'Ana', email: 'ana@example.com', address: 'Rua 1', zip: '1000-001', city: 'Lisboa', country: 'PT' })).toEqual([]);
    expect(missingDonorFields({ name: 'Ana' })).toEqual(['email', 'morada', 'código postal', 'cidade', 'país']);
    expect(missingDonorFields({ name: 'Ana', email: 'x', address: 'R', zip: '1', city: 'L', country: 'Portugal' })).toEqual(['email válido', 'país com 2 letras']);
  });
});

describe('reading FACT.pt', () => {
  const config = { environment: 'sandbox', baseUrl: 'http://api.sandbox.fact.pt', apiKey: 'k', apiVersion: '1.0.0', timeoutMs: 1000 } as unknown as FactPtConfig;
  const rateLimiter = { run: <T,>(operation: () => Promise<T>) => operation() } as unknown as FactPtRateLimiter;
  const reply = (AppResponse: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify({ AppStatusMsg: 'OK', AppResponse }), { status: 200 }));

  it('reads a client from inside data, as the API sends it', async () => {
    const fetchMock = reply({ data: { id: '15', name: 'Ana Costa', tin: '500000000' } });
    const client = new FactPtClient(config, { fetch: fetchMock, rateLimiter });
    await expect(client.getClient('15')).resolves.toMatchObject({ name: 'Ana Costa' });
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.sandbox.fact.pt/clients/15');
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  });

  it('lists documents with a GET and never sends a body', async () => {
    const fetchMock = reply({ data: [], totalPages: 1 });
    const client = new FactPtClient(config, { fetch: fetchMock, rateLimiter });
    await client.listDocuments(3);
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.sandbox.fact.pt/documents?page=3');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET', body: undefined });
  });
});
