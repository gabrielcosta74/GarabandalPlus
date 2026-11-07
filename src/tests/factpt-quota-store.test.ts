import { describe, expect, it } from 'vitest';

import { buildFactPtDocument } from '../lib/factpt/builders';
import { getFactPtConfig } from '../lib/factpt/config';
import {
  buildInitialFactPtFiscalSnapshot,
  factPtNeedsDataMessage,
  findManualDuplicate,
  quotaExemptTaxId,
} from '../lib/factpt/processor';
import { decideFactPtDocument } from '../lib/factpt/rules';
import { loadFactPtSourceSnapshot } from '../lib/factpt/source-snapshots';
import type {
  FactPtFiscalSnapshot,
  FactPtRemoteClient,
  FactPtRemoteDocument,
} from '../lib/factpt/types';

type Rows = Record<string, Record<string, unknown>[]>;

/** A tiny read-only stand-in for the Supabase query builder. */
function fakeDb(rows: Rows, authEmail: string | null = null) {
  return {
    from(table: string) {
      let result = [...(rows[table] || [])];
      const builder = {
        select() { return builder; },
        eq(column: string, value: unknown) {
          result = result.filter((row) => row[column] === value);
          return builder;
        },
        in(column: string, values: unknown[]) {
          result = result.filter((row) => values.includes(row[column]));
          return builder;
        },
        like(column: string, pattern: string) {
          const prefix = pattern.replace(/%$/, '');
          result = result.filter((row) => String(row[column]).startsWith(prefix));
          return builder;
        },
        gte(column: string, value: string) {
          result = result.filter((row) => String(row[column]) >= value);
          return builder;
        },
        order() { return builder; },
        limit() { return builder; },
        async maybeSingle() {
          return { data: result[0] ?? null, error: null };
        },
        then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
          return Promise.resolve({ data: result, error: null }).then(resolve);
        },
      };
      return builder;
    },
    auth: {
      admin: {
        async getUserById() {
          return { data: { user: authEmail ? { email: authEmail } : null }, error: null };
        },
      },
    },
  };
}

const member = {
  id: 'member-1',
  nome: 'Mark DeLaurentis',
  email: 'mark@example.test',
  nif: null,
  address: '1 Aldbury Court',
  postal_code: '08055',
  city: 'Medford, NJ',
  country: 'Estados Unidos',
  telefone: null,
};

function storeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    order_ref: 'store_1',
    status: 'paid',
    total_amount: 16.5,
    currency: 'EUR',
    payment_provider: 'reduniq',
    payment_method: 'reduniq',
    shipping_cost: 0,
    store_credits_used: 0,
    buyer_name: 'Luisa Marques',
    buyer_email: 'luisa@example.test',
    buyer_nif: null,
    billing_address: 'Rua A, 1',
    billing_postal_code: '4000-001',
    billing_city: 'Porto',
    billing_country: 'PT',
    created_at: '2026-11-07T10:00:00.000Z',
    ...overrides,
  };
}

const book = { product_id: '200000048', sku: '200000048', is_physical: true };
const diary = { product_id: '978-989-33-8094--9', sku: '978-989-33-8094--9', is_physical: false };
const childrenPdf = { product_id: '200000056', sku: '200000056', is_physical: false };

describe('FACT.pt quota and store snapshots', () => {
  it('invoices a quota with the hand-issued AAG-001 article, exempt at 0 %', async () => {
    const db = fakeDb({
      pagamentos_quotas: [{
        id: 'quota-1',
        user_id: 'member-1',
        valor: 25,
        estado: 'pago',
        metodo_pagamento: 'reduniq_card',
        data_pagamento: '2026-09-08',
        external_reference: 'Q-REF-1',
        notes: '[locale:en]',
      }],
      membros: [member],
    });

    const source = await loadFactPtSourceSnapshot(db as never, 'quota', 'quota-1');
    expect(source).toMatchObject({
      sourceType: 'quota',
      seriesCode: '2026Q',
      credentialAlias: 'Q',
      amount: 25,
      language: 'en',
      emailSourceLabel: 'Quota anual de membro 2026',
      items: [{ reference: 'AAG-001', price: 25, taxRate: 0 }],
    });
    expect(source.comments).toContain('ano de 2026');

    const fiscal = buildInitialFactPtFiscalSnapshot(source, 1);
    expect(fiscal.customer.country).toBe('us');
    expect(fiscal.comments).toContain('Membership Payment 2026');
    expect(decideFactPtDocument({
      ...fiscal,
      lines: fiscal.lines.map((line) => ({ ...line, taxId: 'isento-9' })),
    })).toEqual({ type: 'invoice_receipt', reason: 'quota_final_consumer' });
  });

  it('keeps the quota-as-donation path on the 2026D donation article', async () => {
    const db = fakeDb({
      pagamentos_quotas: [{
        id: 'quota-2',
        user_id: 'member-1',
        valor: 40,
        estado: 'pago',
        metodo_pagamento: 'transfer',
        data_pagamento: '2026-09-08',
        notes: '[TYPE:DONATION]',
      }],
      membros: [member],
    });

    const source = await loadFactPtSourceSnapshot(db as never, 'quota', 'quota-2');
    expect(source).toMatchObject({
      sourceType: 'donation',
      seriesCode: '2026D',
      comments: 'Doação sem contrapartidas',
      items: [{ reference: 'AAG-003' }],
    });
  });

  it('maps store products to their FACT.pt article and VAT rate', async () => {
    const db = fakeDb({
      store_orders: [storeOrder({ total_amount: 36.49 })],
      store_order_items: [
        { order_ref: 'store_1', product_id: '200000048', name: 'Livro', qty: 1, unit_price: 16.5 },
        { order_ref: 'store_1', product_id: '978-989-33-8094--9', name: 'Diário', qty: 1, unit_price: 19.99 },
      ],
      store_products: [book, diary],
    });

    const source = await loadFactPtSourceSnapshot(db as never, 'store', 'order-1');
    expect(source.blockingReason).toBeUndefined();
    expect(source.items).toMatchObject([
      { reference: 'AAG-004', taxRate: 6, price: 16.5 },
      { reference: 'AAG-005', taxRate: 23, price: 19.99 },
    ]);
  });

  it('stops an order with a product that has no FACT.pt article', async () => {
    const db = fakeDb({
      store_orders: [storeOrder({ total_amount: 5.99 })],
      store_order_items: [
        { order_ref: 'store_1', product_id: '200000056', name: 'PDF', qty: 1, unit_price: 5.99 },
      ],
      store_products: [childrenPdf],
    });

    const source = await loadFactPtSourceSnapshot(db as never, 'store', 'order-1');
    expect(source.blockingReason).toBe('unmapped_store_product');
    const fiscal = buildInitialFactPtFiscalSnapshot(source, 1);
    const decision = decideFactPtDocument(fiscal);
    expect(decision).toMatchObject({ type: 'needs_data', reason: 'unmapped_store_product' });
    expect(factPtNeedsDataMessage(decision)).toContain('200000056');
  });

  it('stops orders paid with store credits', async () => {
    const db = fakeDb({
      store_orders: [storeOrder({ store_credits_used: 5, total_amount: 11.5 })],
      store_order_items: [
        { order_ref: 'store_1', product_id: '200000048', name: 'Livro', qty: 1, unit_price: 16.5 },
      ],
      store_products: [book],
    });

    const source = await loadFactPtSourceSnapshot(db as never, 'store', 'order-1');
    expect(source.blockingReason).toBe('store_credits_policy_unconfirmed');
  });

  it('charges shipping at the rate of the goods, and stops when rates differ', async () => {
    const single = fakeDb({
      store_orders: [storeOrder({ shipping_cost: 4, total_amount: 20.5 })],
      store_order_items: [
        { order_ref: 'store_1', product_id: '200000048', name: 'Livro', qty: 1, unit_price: 16.5 },
      ],
      store_products: [book],
    });
    const singleSource = await loadFactPtSourceSnapshot(single as never, 'store', 'order-1');
    expect(singleSource.blockingReason).toBeUndefined();
    expect(singleSource.items[1]).toMatchObject({ reference: 'PORTES', taxRate: 6, price: 4 });

    const mixed = fakeDb({
      store_orders: [storeOrder({ shipping_cost: 4, total_amount: 40.49 })],
      store_order_items: [
        { order_ref: 'store_1', product_id: '200000048', name: 'Livro', qty: 1, unit_price: 16.5 },
        { order_ref: 'store_1', product_id: '978-989-33-8094--9', name: 'Diário', qty: 1, unit_price: 19.99 },
      ],
      store_products: [book, diary],
    });
    const mixedSource = await loadFactPtSourceSnapshot(mixed as never, 'store', 'order-1');
    expect(mixedSource.blockingReason).toBe('ambiguous_shipping_tax');
  });
});

describe('FACT.pt quota and store documents', () => {
  const quotaFiscal: FactPtFiscalSnapshot = {
    sourceType: 'quota',
    sourceId: 'quota-1',
    paidAt: '2026-11-07',
    total: 25,
    currency: 'EUR',
    paymentMethod: 'reduniq_other',
    customer: {
      name: 'Mark DeLaurentis',
      email: 'mark@example.test',
      nif: null,
      address: '1 Aldbury Court',
      postalCode: '08055',
      city: 'Medford, NJ',
      country: 'us',
    },
    lines: [{
      reference: 'AAG-001',
      description: 'Quota',
      type: 'service',
      quantity: 1,
      unitPriceNet: 25,
      taxRate: 0,
      taxId: 'isento-9',
      unitId: 1,
    }],
    comments: 'Pagamento da quota relativo ao ano de 2026',
  };

  it('prints the quota observation on the FR', () => {
    const built = buildFactPtDocument(quotaFiscal, 'client-1');
    expect(built.type).toBe('invoice_receipt');
    expect(built.series).toBe('2026Q');
    expect(built.payload.document.comments).toBe(
      'Pagamento da quota relativo ao ano de 2026',
    );
  });

  it('never falls back to a Fatura Simplificada when the city is missing', () => {
    expect(decideFactPtDocument({
      ...quotaFiscal,
      customer: { ...quotaFiscal.customer, city: null },
    })).toMatchObject({
      type: 'needs_data',
      reason: 'missing_quota_billing_data',
      missingFields: ['customer.city'],
    });
  });

  it('picks the art. 9.º exemption (M07) among the 0 % taxes', () => {
    const taxes = [
      { id: 727, value: '6.00', name: '6%' },
      { id: 729, value: '0.00', name: 'Is.IVA M05' },
      { id: 730, value: '0.00', name: 'Is.IVA M07' },
    ];
    expect(quotaExemptTaxId(taxes)).toBe(730);
    expect(quotaExemptTaxId(taxes.slice(0, 2))).toBeUndefined();
    expect(quotaExemptTaxId([...taxes, { id: 731, value: '0', name: 'M07 bis' }]))
      .toBeUndefined();
  });

  it('uses each series production key once the server allows production', () => {
    expect(() => getFactPtConfig('quota', 'production', {
      FACTPT_PRODUCTION_KEY_2026Q: 'q',
    })).toThrow(/desativad/);
    expect(() => getFactPtConfig('quota', 'production', {
      FACTPT_PRODUCTION_ENABLED: 'true',
      FACTPT_PRODUCTION_KEY_2026D: 'd',
    })).toThrow(/FACTPT_PRODUCTION_KEY_2026Q/);
  });
});

describe('FACT.pt manual duplicate guard', () => {
  const fiscal = {
    sourceType: 'quota',
    sourceId: 'quota-1',
    paidAt: '2026-11-05',
    total: 25,
    currency: 'EUR',
    paymentMethod: 'reduniq_other',
    customer: {
      name: 'Pedro Henrique de Miranda Mota',
      email: 'pedro@example.test',
      nif: null,
    },
    lines: [],
  } as FactPtFiscalSnapshot;
  const job = { source_type: 'quota' as const, series_code: '2026Q' as const };

  function liveClient(
    pages: FactPtRemoteDocument[][],
    clients: Record<string, FactPtRemoteClient> = {},
  ) {
    const calls: number[] = [];
    return {
      calls,
      async listDocuments(page: number) {
        calls.push(page);
        return { data: pages[page - 1] || [], totalPages: pages.length };
      },
      async getClient(id: string) {
        return clients[id] || { id };
      },
    };
  }

  it('finds an FR issued by hand in the daily copy of FACT.pt', async () => {
    const db = fakeDb({
      factpt_remote_documents: [{
        number: '2026Q/160',
        doc_type: 'invoicereceipt',
        doc_date: '2026-11-06',
        gross: 25,
        payment_status: 'paid',
        client_name: 'Pedro Henrique de Miranda Mota',
        client_snapshot: { email: 'pedro@example.test' },
        identifier_id: null,
      }],
    });
    const client = liveClient([[]]);
    await expect(findManualDuplicate(db as never, job, fiscal, client)).resolves.toBe('2026Q/160');
    expect(client.calls).toEqual([]);
  });

  it('ignores app documents, credit notes, other amounts and other people', async () => {
    const base = {
      doc_type: 'invoicereceipt',
      doc_date: '2026-11-06',
      gross: 25,
      payment_status: 'paid',
      client_name: 'Pedro Henrique de Miranda Mota',
      client_snapshot: {},
      identifier_id: null,
    };
    const db = fakeDb({
      factpt_remote_documents: [
        { ...base, number: '2026Q/161', identifier_id: 'gp:quota:abc' },
        { ...base, number: '2026Q/162', doc_type: 'credit' },
        { ...base, number: '2026Q/163', gross: 50 },
        { ...base, number: '2026Q/164', client_name: 'Outra Pessoa' },
        { ...base, number: '2026Q/165', payment_status: 'cancelled' },
        { ...base, number: '2026Q/100', doc_date: '2026-10-01' },
        { ...base, number: '2026D/900' },
      ],
    });
    const client = liveClient([[]]);
    await expect(findManualDuplicate(db as never, job, fiscal, client)).resolves.toBeNull();
  });

  it('reads the newest documents live, whichever end of the listing they are at', async () => {
    const old = { id: 1, number: '2026D/1', date: '2026-01-01', gross: 10, type: 'invoicereceipt' };
    const manual = {
      id: 9,
      number: '2026Q/170',
      date: '2026-11-07',
      gross: '25.00',
      type: 'invoicereceipt',
      clientId: 'c-1',
      identifierId: null,
    };
    const clients = { 'c-1': { id: 'c-1', name: 'Pedro Henrique de Miranda Mota' } };

    const oldestFirst = liveClient([[old], [old], [manual]], clients);
    await expect(findManualDuplicate(fakeDb({}) as never, job, fiscal, oldestFirst))
      .resolves.toBe('2026Q/170');

    const newestFirst = liveClient([[manual], [old], [old]], clients);
    await expect(findManualDuplicate(fakeDb({}) as never, job, fiscal, newestFirst))
      .resolves.toBe('2026Q/170');

    const someoneElse = liveClient([[old], [manual]], { 'c-1': { id: 'c-1', name: 'Maria Silva' } });
    await expect(findManualDuplicate(fakeDb({}) as never, job, fiscal, someoneElse))
      .resolves.toBeNull();
  });

  it('does not run for donations and pilgrimages', async () => {
    const client = liveClient([[]]);
    await expect(findManualDuplicate(
      fakeDb({}) as never,
      { source_type: 'donation', series_code: '2026D' },
      fiscal,
      client,
    )).resolves.toBeNull();
    expect(client.calls).toEqual([]);
  });
});
