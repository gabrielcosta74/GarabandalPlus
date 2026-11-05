import { describe, expect, it, vi } from 'vitest';
import { buildFactPtDocument } from '../lib/factpt/builders';
import { FactPtClient, type FactPtRateLimiter } from '../lib/factpt/client';
import type { FactPtConfig } from '../lib/factpt/config';
import { decideFactPtDocument } from '../lib/factpt/rules';
import type { FactPtFiscalSnapshot } from '../lib/factpt/types';

const snapshot = (overrides: Partial<FactPtFiscalSnapshot> = {}): FactPtFiscalSnapshot => ({
  sourceType: 'donation',
  sourceId: 'donation-1',
  paidAt: '2026-11-05T10:00:00.000Z',
  total: 25,
  currency: 'EUR',
  paymentMethod: 'bank_transfer',
  customer: { name: 'Consumidor final', email: '' },
  lines: [{ reference: 'DONATIVO', description: 'Donativo', type: 'other', quantity: 1, unitPriceNet: 25, taxRate: 0, taxId: 'tax-0', unitId: 1 }],
  genericConsumer: true,
  ...overrides,
});

const priced = (total: number) => snapshot({
  total,
  lines: [{ reference: 'DONATIVO', description: 'Donativo', type: 'other', quantity: 1, unitPriceNet: total, taxRate: 0, taxId: 'tax-0', unitId: 1 }],
});

describe('FR to the generic Consumidor final', () => {
  it('needs no email or address up to 100 €', () => {
    expect(decideFactPtDocument(priced(100)).type).toBe('invoice_receipt');
  });

  it('is refused above the legal limit', () => {
    expect(decideFactPtDocument(priced(100.01)).type).toBe('needs_data');
  });

  it('only applies to donations', () => {
    expect(decideFactPtDocument(snapshot({ sourceType: 'pilgrimage' })).type).toBe('needs_data');
  });

  it('leaves every other payment needing an email, as before', () => {
    expect(decideFactPtDocument(snapshot({ genericConsumer: undefined }))).toMatchObject({ type: 'needs_data', reason: 'missing_email' });
  });

  it('goes out as a paid FR for the given client', () => {
    const built = buildFactPtDocument(snapshot(), 9323);
    expect(built.type).toBe('invoice_receipt');
    expect(built.payload).toMatchObject({ client: { id: 9323 }, document: { markPaid: true } });
  });

  it('finds the generic client, never a person or a test profile', async () => {
    const rows = [
      { id: '9954', name: 'TESTE Consumidor Final', address: 'Rua 1', isFinalConsumer: true },
      { id: '9400', name: 'Consumidor final', address: 'Rua 2', email: 'a@b.pt', isFinalConsumer: true },
      { id: '9500', name: 'Consumidor Final', address: null, isFinalConsumer: false },
      { id: '9323', name: 'Consumidor final', address: null, email: '', isFinalConsumer: true },
    ];
    const reply = (data: unknown[]) => vi.fn().mockResolvedValue(new Response(JSON.stringify({ AppStatusMsg: 'OK', AppResponse: { data } }), { status: 200 }));
    const settings = { environment: 'sandbox', baseUrl: 'http://api.sandbox.fact.pt', apiKey: 'k', apiVersion: '1.0.0', timeoutMs: 1000 } as unknown as FactPtConfig;
    const rateLimiter = { run: <T,>(operation: () => Promise<T>) => operation() } as unknown as FactPtRateLimiter;
    await expect(new FactPtClient(settings, { fetch: reply(rows), rateLimiter }).findGenericFinalConsumer()).resolves.toMatchObject({ id: '9323' });
    await expect(new FactPtClient(settings, { fetch: reply(rows.slice(0, 3)), rateLimiter }).findGenericFinalConsumer()).resolves.toBeNull();
  });
});
