import { describe, expect, it, vi } from 'vitest';

import {
  buildFactPtDocument,
  buildFactPtIdentifier,
  buildFactPtClientInput,
  calculateFactPtSnapshotTotal,
  decideFactPtDocument,
  FACTPT_DONATION_COMMENT,
  FactPtClient,
  FactPtError,
  FactPtRateLimiter,
  getFactPtConfig,
  getFactPtSandboxConfig,
  parseFactPtPaymentMethod,
  resolveFactPtPaymentType,
  resolveFactPtTaxId,
  type FactPtConfig,
  type FactPtFiscalSnapshot,
} from '../lib/factpt';
import {
  factPtDocumentNumberFromFilename,
  factPtEmailSourceLabel,
} from '../lib/factpt/processor';

const sandboxEnvironment = {
  FACTPT_SANDBOX_KEY_2026Q: 'quota-key',
  FACTPT_SANDBOX_KEY_2026L: 'store-key',
  FACTPT_SANDBOX_KEY_2026D: 'donation-key',
};

function makeSnapshot(
  overrides: Partial<FactPtFiscalSnapshot> = {},
): FactPtFiscalSnapshot {
  return {
    sourceType: 'store',
    sourceId: 'order-123',
    paidAt: '2026-07-29T12:00:00.000Z',
    total: 12.3,
    currency: 'EUR',
    paymentMethod: 'reduniq_credit_card',
    customer: {
      name: 'Cliente Teste',
      email: 'cliente@example.test',
      nif: '123456789',
      address: 'Rua de Teste, 1',
      postalCode: '1000-001',
      city: 'Lisboa',
      country: 'pt',
    },
    lines: [
      {
        reference: 'TEST-001',
        description: 'Produto de teste',
        type: 'product',
        quantity: 1,
        unitPriceNet: 10,
        taxRate: 23,
        taxId: 'tax-23',
        unitId: 1,
      },
    ],
    ...overrides,
  };
}

function sandboxConfig(timeoutMs = 1_000): FactPtConfig {
  return {
    environment: 'sandbox',
    baseUrl: 'http://api.sandbox.fact.pt',
    apiKey: 'secret-key',
    apiVersion: '1.0.0',
    timeoutMs,
    series: '2026L',
    credentialSlot: 'L',
  };
}

function immediateRateLimiter() {
  return new FactPtRateLimiter({ minimumIntervalMs: 0 });
}

describe('FACT.pt sandbox configuration', () => {
  it('maps each payment origin to its dedicated sandbox key and series', () => {
    const quota = getFactPtSandboxConfig('quota', sandboxEnvironment);
    const store = getFactPtSandboxConfig('store', sandboxEnvironment);
    const donation = getFactPtSandboxConfig('donation', sandboxEnvironment);
    const pilgrimage = getFactPtSandboxConfig('pilgrimage', sandboxEnvironment);

    expect(quota).toMatchObject({ series: '2026Q', apiKey: 'quota-key' });
    expect(store).toMatchObject({ series: '2026L', apiKey: 'store-key' });
    expect(donation).toMatchObject({ series: '2026D', apiKey: 'donation-key' });
    expect(pilgrimage).toMatchObject({ series: '2026D', apiKey: 'donation-key' });
  });

  it('keeps production limited to explicitly enabled pilgrimages', () => {
    expect(() =>
      getFactPtConfig('pilgrimage', 'production', {
        FACTPT_PRODUCTION_KEY_2026D: 'production-donation-key',
      }),
    ).toThrow(/desativad[ao]/i);

    expect(() =>
      getFactPtConfig('store', 'production', {
        FACTPT_PRODUCTION_ENABLED: 'true',
        FACTPT_PRODUCTION_KEY_2026D: 'production-donation-key',
      }),
    ).toThrow(/exclusivamente.*peregrinações/i);

    expect(
      getFactPtConfig('pilgrimage', 'production', {
        FACTPT_PRODUCTION_ENABLED: 'true',
        FACTPT_PRODUCTION_KEY_2026D: 'production-donation-key',
      }),
    ).toMatchObject({
      environment: 'production',
      baseUrl: 'https://api.fact.pt',
      series: '2026D',
      credentialSlot: 'D',
    });

    expect(
      getFactPtConfig('pilgrimage', 'production', {
        FACTPT_PRODUCTION_PILOT_ENABLED: 'true',
        FACTPT_PRODUCTION_KEY_2026D: 'legacy-production-key',
      }).apiKey,
    ).toBe('legacy-production-key');
  });

  it('rejects public API keys', () => {
    expect(() =>
      getFactPtSandboxConfig('store', {
        ...sandboxEnvironment,
        NEXT_PUBLIC_FACTPT_KEY: 'exposed',
      }),
    ).toThrow(/insegura/i);
  });
});

describe('FACT.pt official document number', () => {
  it('reads the certified number from the PDF download filename', () => {
    expect(
      factPtDocumentNumberFromFilename('ASSOCI_FR_20260729_2026D_812'),
    ).toBe('FR 2026D/812');
    expect(
      factPtDocumentNumberFromFilename('ASSOCI_FS_20260729_2026L_42.pdf'),
    ).toBe('FS 2026L/42');
    expect(factPtDocumentNumberFromFilename('document.pdf')).toBeNull();
  });
});

describe('FACT.pt fiscal rules and builders', () => {
  it('builds deterministic, valid and collision-resistant identifiers', () => {
    expect(buildFactPtIdentifier('store', 'order-123')).toBe(
      'gp:store:order-123',
    );

    const first = buildFactPtIdentifier(
      'pilgrimage',
      `booking-${'a'.repeat(80)}-1`,
    );
    const second = buildFactPtIdentifier(
      'pilgrimage',
      `booking-${'a'.repeat(80)}-2`,
    );

    expect(first).toHaveLength(50);
    expect(second).toHaveLength(50);
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[a-zA-Z0-9:{}-]+$/);
    expect(
      buildFactPtIdentifier(
        'pilgrimage',
        '12345678-1234-1234-1234-123456789abc',
      ),
    ).toBe('gp:pilgrimage:12345678-1234-1234-1234-123456789abc');
  });

  it('uses FACT.pt "Outros" for every Reduniq payment', () => {
    expect(resolveFactPtPaymentType('reduniq_other')).toBe(9);
    expect(resolveFactPtPaymentType('reduniq_debit_card')).toBe(9);
    expect(resolveFactPtPaymentType('reduniq_credit_card')).toBe(9);
    expect(resolveFactPtPaymentType('reduniq_multibanco')).toBe(9);
    expect(resolveFactPtPaymentType('reduniq_mbway')).toBe(9);
    expect(resolveFactPtPaymentType('reduniq_pix')).toBe(9);
    expect(resolveFactPtPaymentType('bank_transfer')).toBe(11);
    expect(parseFactPtPaymentMethod('card')).toBe('reduniq_other');
    expect(parseFactPtPaymentMethod('multibanco')).toBe('reduniq_other');
    expect(parseFactPtPaymentMethod('reduniq')).toBe('reduniq_other');
    expect(parseFactPtPaymentMethod('reduniq_card')).toBe('reduniq_other');
  });

  it('uses Fatura-Recibo only with complete billing data and a remote client', () => {
    const snapshot = makeSnapshot();
    expect(decideFactPtDocument(snapshot).type).toBe('invoice_receipt');
    expect(buildFactPtClientInput(snapshot.customer)).toMatchObject({
      name: 'Cliente Teste',
      tin: '123456789',
      country: 'pt',
      email: 'cliente@example.test',
      finalConsumer: false,
    });

    expect(() => buildFactPtDocument(snapshot)).toThrow(/ID do cliente/i);
    const document = buildFactPtDocument(snapshot, 'client-59');

    expect(document.type).toBe('invoice_receipt');
    expect(document.series).toBe('2026L');
    if (document.type === 'invoice_receipt') {
      expect(document.payload.client).toEqual({ id: 'client-59' });
      expect(document.payload.document).toMatchObject({
        date: '2026-07-29',
        duePayment: '2026-07-29',
        paymentType: 9,
        markPaid: true,
      });
    }
  });

  it('identifies the pilgrimage and payment phase in the fiscal email', () => {
    expect(
      factPtEmailSourceLabel(makeSnapshot({
        sourceType: 'pilgrimage',
        emailSourceLabel: 'Peregrinação 2026D — Sinal',
        lines: [{
          reference: 'PEREGRINACAO',
          description: 'Donativo para angariação de fundos',
          type: 'other',
          quantity: 1,
          unitPriceNet: 0.51,
          taxRate: 0,
          taxId: 'tax-isento',
          unitId: 1,
        }],
      })),
    ).toBe('Peregrinação 2026D — Sinal');
  });

  it('always uses a named Fatura-Recibo for pilgrimage holders without NIF', () => {
    const snapshot = makeSnapshot({
      sourceType: 'pilgrimage',
      sourceId: 'pilgrimage-payment-1',
      total: 50,
      customer: {
        name: 'Titular sem NIF',
        email: 'titular@example.test',
        address: 'Rua da Reserva, 1',
        postalCode: '1000-001',
        city: 'Lisboa',
        country: 'pt',
      },
      lines: [
        {
          reference: 'PEREGRINACAO',
          description: 'Donativo — Peregrinação — Prestação',
          type: 'other',
          quantity: 1,
          unitPriceNet: 50,
          taxRate: 0,
          taxId: 'tax-0',
          unitId: 1,
        },
      ],
    });

    expect(decideFactPtDocument(snapshot)).toEqual({
      type: 'invoice_receipt',
      reason: 'pilgrimage_final_consumer',
    });
    expect(buildFactPtClientInput(snapshot.customer)).toEqual({
      name: 'Titular sem NIF',
      address: 'Rua da Reserva, 1',
      zip: '1000-001',
      city: 'Lisboa',
      country: 'pt',
      email: 'titular@example.test',
      finalConsumer: true,
    });
    const document = buildFactPtDocument(snapshot, 'client-final-1');
    expect(document.type).toBe('invoice_receipt');
    if (document.type === 'invoice_receipt') {
      expect(document.payload.client.id).toBe('client-final-1');
    }
  });

  it('holds a pilgrimage invoice when the account holder address is incomplete', () => {
    const snapshot = makeSnapshot({
      sourceType: 'pilgrimage',
      sourceId: 'pilgrimage-payment-2',
      total: 50,
      customer: {
        name: 'Titular incompleto',
        email: 'titular@example.test',
      },
      lines: [
        {
          reference: 'PEREGRINACAO',
          description: 'Donativo — Peregrinação — Prestação',
          type: 'other',
          quantity: 1,
          unitPriceNet: 50,
          taxRate: 0,
          taxId: 'tax-0',
          unitId: 1,
        },
      ],
    });

    expect(decideFactPtDocument(snapshot)).toMatchObject({
      type: 'needs_data',
      reason: 'missing_pilgrimage_holder_data',
      missingFields: expect.arrayContaining([
        'customer.address',
        'customer.postalCode',
        'customer.city',
        'customer.country',
      ]),
    });
  });

  it('uses Consumidor Final without a client block within FS limits', () => {
    const snapshot = makeSnapshot({
      total: 123,
      customer: {
        name: 'Cliente Teste',
        email: 'cliente@example.test',
      },
      lines: [
        {
          reference: 'TEST-001',
          description: 'Produto de teste',
          type: 'product',
          quantity: 1,
          unitPriceNet: 100,
          taxRate: 23,
          taxId: 'tax-23',
          unitId: 1,
        },
      ],
    });

    expect(decideFactPtDocument(snapshot).type).toBe('simplified_invoice');
    const document = buildFactPtDocument(snapshot);
    expect(document.type).toBe('simplified_invoice');
    if (document.type === 'simplified_invoice') {
      expect(document.payload).not.toHaveProperty('client');
      expect(document.payload.document.paymentTerm).toBe(0);
      expect(document.payload.document).not.toHaveProperty('dueDate');
    }
  });

  it('blocks service/other FS above €100 and product FS above €1,000', () => {
    const donation = makeSnapshot({
      sourceType: 'donation',
      sourceId: 'donation-1',
      total: 100.01,
      customer: { name: 'Doador', email: 'doador@example.test' },
      lines: [
        {
          reference: 'DONATIVO',
          description: 'Donativo',
          type: 'other',
          quantity: 1,
          unitPriceNet: 100.01,
          taxRate: 0,
          taxId: 'tax-0',
          unitId: 1,
        },
      ],
    });
    const product = makeSnapshot({
      total: 1_000.01,
      customer: { name: 'Comprador', email: 'comprador@example.test' },
      lines: [
        {
          reference: 'TEST-001',
          description: 'Produto',
          type: 'product',
          quantity: 1,
          unitPriceNet: 1_000.01,
          taxRate: 0,
          taxId: 'tax-0',
          unitId: 1,
        },
      ],
    });

    expect(decideFactPtDocument(donation)).toMatchObject({
      type: 'needs_data',
      reason: 'missing_billing_data_above_simplified_limit',
    });
    expect(decideFactPtDocument(product)).toMatchObject({
      type: 'needs_data',
      reason: 'missing_billing_data_above_simplified_limit',
    });
  });

  it('uses the €1,000 store limit when an order also has a shipping line', () => {
    const storeOrder = makeSnapshot({
      total: 504.99,
      customer: { name: 'Consumidor Final', email: 'buyer@example.test' },
      lines: [
        {
          reference: 'BOOK',
          description: 'Livro',
          type: 'product',
          quantity: 1,
          unitPriceNet: 471.69811321,
          taxRate: 6,
          taxId: 'tax-6',
          unitId: 1,
        },
        {
          reference: 'PORTES',
          description: 'Portes',
          type: 'service',
          quantity: 1,
          unitPriceNet: 4.70754717,
          taxRate: 6,
          taxId: 'tax-6',
          unitId: 1,
        },
      ],
    });

    expect(decideFactPtDocument(storeOrder).type).toBe('simplified_invoice');
  });

  it('always adds the exact donation observation to donations and pilgrimages', () => {
    for (const sourceType of ['donation', 'pilgrimage'] as const) {
      const snapshot = makeSnapshot({
        sourceType,
        sourceId: `${sourceType}-1`,
        total: 50,
        lines: [
          {
            reference: sourceType === 'donation' ? 'DONATIVO' : 'PEREGRINACAO',
            description:
              sourceType === 'donation'
                ? 'Donativo'
                : 'Prestação de peregrinação',
            type: 'other',
            quantity: 1,
            unitPriceNet: 50,
            taxRate: 0,
            taxId: 'tax-0',
            unitId: 1,
          },
        ],
      });
      const document = buildFactPtDocument(snapshot, 'client-59');
      expect(document.series).toBe('2026D');
      expect(document.payload.document.comments).toBe(
        FACTPT_DONATION_COMMENT,
      );
    }
  });

  it('includes FACT item discounts and reconciles the discounted gross total', () => {
    const snapshot = makeSnapshot({
      total: 11.07,
      lines: [
        {
          reference: 'TEST-001',
          productId: 'product-121',
          description: 'Produto com desconto',
          type: 'product',
          quantity: 1,
          unitPriceNet: 10,
          discount: 10,
          taxRate: 23,
          taxId: 'tax-23',
          unitId: 1,
        },
      ],
    });

    expect(calculateFactPtSnapshotTotal(snapshot)).toBe(11.07);
    const document = buildFactPtDocument(snapshot, 'client-59');
    expect(document.payload.items[0].discount).toBe(10);
    expect(document.payload.items[0].id).toBe('product-121');
  });

  it('rejects a snapshot whose lines do not match the recorded total', () => {
    const decision = decideFactPtDocument(makeSnapshot({ total: 99 }));
    expect(decision).toMatchObject({
      type: 'needs_data',
      reason: 'invalid_snapshot',
    });
    if (decision.type === 'needs_data') {
      expect(decision.missingFields).toContain('totalMismatch');
    }
  });

  it('resolves tax IDs from the active series response instead of hardcoding them', () => {
    expect(
      resolveFactPtTaxId(
        [
          { id: 'isento', value: '0.00' },
          { id: 'normal', value: '23.00' },
        ],
        23,
      ),
    ).toBe('normal');
    expect(() =>
      resolveFactPtTaxId([{ id: 'normal', value: '23.00' }], 6),
    ).toThrow(/não existe/i);
    const zeroTaxes = [
      { id: 729, value: '0.00', name: 'M05' },
      { id: 730, value: '0.00', name: 'M07' },
    ];
    expect(() => resolveFactPtTaxId(zeroTaxes, 0)).toThrow(
      /vários impostos/i,
    );
    expect(resolveFactPtTaxId(zeroTaxes, 0, 730)).toBe(730);
  });
});

describe('FACT.pt HTTP client', () => {
  it('sends required headers, searches NIF and never sends forceTin', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            HttpStatusCode: 200,
            AppStatusCode: 200,
            AppStatusMsg: 'OK',
            AppResponse: {
              data: [{ id: '59', name: 'Cliente existente' }],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            HttpStatusCode: 200,
            AppStatusCode: 200,
            AppStatusMsg: 'OK',
            AppResponse: { data: { id: '60' } },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    const client = new FactPtClient(sandboxConfig(), {
      fetch: fetchMock,
      rateLimiter: immediateRateLimiter(),
    });

    await client.findClientsByTin('123 456 789');
    await client.createClient({
      name: 'Novo Cliente',
      tin: '987654321',
      address: 'Rua de Teste, 1',
      zip: '1000-001',
      city: 'Lisboa',
      country: 'pt',
      email: 'novo@example.test',
      finalConsumer: false,
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://api.sandbox.fact.pt/clients?searchTin=123456789',
    );
    const firstOptions = fetchMock.mock.calls[0][1] as RequestInit;
    expect(firstOptions.headers).toMatchObject({
      'Content-Type': 'application/json',
      'x-auth-token': 'secret-key',
      'api-version': '1.0.0',
    });

    const createBody = JSON.parse(
      String((fetchMock.mock.calls[1][1] as RequestInit).body),
    );
    expect(createBody.client.finalConsumer).toBe(false);
    expect(createBody.client).not.toHaveProperty('forceTin');
  });

  it('reuses existing clients and reconciles a duplicate NIF without forceTin', async () => {
    const existingFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          AppStatusMsg: 'OK',
          AppResponse: {
            data: [{ id: 'existing-59', name: 'Cliente existente' }],
          },
        }),
        { status: 200 },
      ),
    );
    const existingClient = new FactPtClient(sandboxConfig(), {
      fetch: existingFetch,
      rateLimiter: immediateRateLimiter(),
    });
    const input = {
      name: 'Cliente existente',
      tin: '123456789',
      address: 'Rua de Teste, 1',
      zip: '1000-001',
      city: 'Lisboa',
      country: 'pt',
      email: 'existente@example.test',
      finalConsumer: false,
    };

    await expect(existingClient.findOrCreateClient(input)).resolves.toEqual({
      client: { id: 'existing-59', name: 'Cliente existente' },
      created: false,
      updated: false,
    });
    expect(existingFetch).toHaveBeenCalledTimes(1);

    const duplicateFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            AppStatusMsg: 'OK',
            AppResponse: { data: [] },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            HttpStatusCode: 422,
            AppStatusCode: 405,
            AppStatusMsg: 'ERR',
            AppResponse: {
              errors: { tinUnique: 'The tin already exists.' },
            },
          }),
          { status: 422 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            AppStatusMsg: 'OK',
            AppResponse: {
              data: [{ id: 'reconciled-60', name: 'Cliente concorrente' }],
            },
          }),
          { status: 200 },
        ),
      );
    const duplicateClient = new FactPtClient(sandboxConfig(), {
      fetch: duplicateFetch,
      rateLimiter: immediateRateLimiter(),
    });

    await expect(duplicateClient.findOrCreateClient(input)).resolves.toEqual({
      client: { id: 'reconciled-60', name: 'Cliente concorrente' },
      created: false,
      updated: false,
    });
    const attemptedBody = JSON.parse(
      String((duplicateFetch.mock.calls[1][1] as RequestInit).body),
    );
    expect(attemptedBody.client).not.toHaveProperty('forceTin');
  });

  it('creates and updates named final consumers without tin, ric, retention or forceTin', async () => {
    const input = {
      name: 'Titular sem NIF',
      address: 'Rua Nova, 2',
      zip: '2000-002',
      city: 'Porto',
      country: 'pt',
      email: 'titular@example.test',
      finalConsumer: true,
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            AppStatusMsg: 'OK',
            AppResponse: {
              data: [{
                id: 'final-1',
                name: 'Titular sem NIF',
                address: 'Rua Antiga, 1',
                zip: '1000-001',
                city: 'Lisboa',
                country: 'PT',
                email: 'titular@example.test',
                isFinalConsumer: true,
              }],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            AppStatusMsg: 'OK',
            AppResponse: {
              data: [{
                id: 'final-1',
                name: 'Titular sem NIF',
                country: 'PT',
                isFinalConsumer: true,
              }],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            AppStatusMsg: 'OK',
            AppResponse: { data: { id: 'final-1' } },
          }),
          { status: 200 },
        ),
      );
    const client = new FactPtClient(sandboxConfig(), {
      fetch: fetchMock,
      rateLimiter: immediateRateLimiter(),
    });

    await expect(client.findOrCreateClient(input)).resolves.toMatchObject({
      client: { id: 'final-1', address: 'Rua Nova, 2' },
      created: false,
      updated: true,
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://api.sandbox.fact.pt/clients?search=titular%40example.test',
      'http://api.sandbox.fact.pt/clients?search=Titular%20sem%20NIF',
      'http://api.sandbox.fact.pt/clients/final-1',
    ]);
    const updateBody = JSON.parse(
      String((fetchMock.mock.calls[2][1] as RequestInit).body),
    );
    expect(updateBody.client).not.toHaveProperty('tin');
    expect(updateBody.client).not.toHaveProperty('ric');
    expect(updateBody.client).not.toHaveProperty('retention');
    expect(updateBody.client).not.toHaveProperty('forceTin');

    const createFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          AppStatusMsg: 'OK',
          AppResponse: { data: { id: 'final-2' } },
        }),
        { status: 200 },
      ),
    );
    const createClient = new FactPtClient(sandboxConfig(), {
      fetch: createFetch,
      rateLimiter: immediateRateLimiter(),
    });
    await createClient.createClient(input);
    const createBody = JSON.parse(
      String((createFetch.mock.calls[0][1] as RequestInit).body),
    );
    expect(createBody.client.finalConsumer).toBe(true);
    expect(createBody.client).not.toHaveProperty('tin');
    expect(createBody.client).not.toHaveProperty('ric');
    expect(createBody.client).not.toHaveProperty('retention');
    expect(createBody.client).not.toHaveProperty('forceTin');
  });

  it('uses the correct endpoints for both documents, taxes and PDF', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            AppStatusMsg: 'OK',
            AppResponse: {
              data: [{ id: 'tax-23', value: '23.00' }],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            AppStatusMsg: 'OK',
            AppResponse: {
              data: [
                {
                  id: 'product-121',
                  reference: 'TEST-001',
                  description: 'Produto',
                  price: '10.00',
                  type: 'product',
                },
                {
                  id: 'product-122',
                  reference: 'TEST-001-OLD',
                  description: 'Produto antigo',
                  price: '10.00',
                  type: 'product',
                },
              ],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            AppStatusMsg: 'OK',
            AppResponse: { data: { id: 'doc-1' } },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            AppStatusMsg: 'OK',
            AppResponse: { data: { id: 'doc-2' } },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([37, 80, 68, 70]), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition':
              'attachment; filename="ASSOCI_FR_20260729_2026D_812"',
          },
        }),
      );
    const client = new FactPtClient(sandboxConfig(), {
      fetch: fetchMock,
      rateLimiter: immediateRateLimiter(),
    });
    const invoiceReceipt = buildFactPtDocument(makeSnapshot(), 'client-59');
    const simplified = buildFactPtDocument(
      makeSnapshot({
        customer: { name: 'Final', email: 'final@example.test' },
      }),
    );

    await client.listTaxes();
    await expect(client.findProductsByReference('TEST-001')).resolves.toEqual([
      expect.objectContaining({ id: 'product-121', reference: 'TEST-001' }),
    ]);
    if (invoiceReceipt.type === 'invoice_receipt') {
      await client.createInvoiceReceipt(invoiceReceipt.payload);
    }
    if (simplified.type === 'simplified_invoice') {
      await client.createSimplifiedInvoice(simplified.payload);
    }
    const pdf = await client.downloadDocumentPdf('doc/3');

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://api.sandbox.fact.pt/taxes',
      'http://api.sandbox.fact.pt/products?search=TEST-001',
      'http://api.sandbox.fact.pt/documents/invoicereceipt',
      'http://api.sandbox.fact.pt/documents/simpleinvoice',
      'http://api.sandbox.fact.pt/documents/doc%2F3/download',
    ]);
    expect(Array.from(pdf)).toEqual([37, 80, 68, 70]);
  });

  it('returns the FACT.pt filename together with the PDF bytes', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([37, 80, 68, 70]), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition':
            'attachment; filename="ASSOCI_FR_20260729_2026D_812"',
        },
      }),
    );
    const client = new FactPtClient(sandboxConfig(), {
      fetch: fetchMock,
      rateLimiter: immediateRateLimiter(),
    });

    const resource = await client.downloadDocumentPdfResource('doc-812');

    expect(resource.filename).toBe('ASSOCI_FR_20260729_2026D_812');
    expect(Array.from(resource.bytes)).toEqual([37, 80, 68, 70]);
  });

  it('classifies validation and transient errors for worker retry policy', async () => {
    const validationFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          HttpStatusCode: 422,
          AppStatusCode: 405,
          AppStatusMsg: 'ERR',
          AppResponse: { errors: { tin: 'NIF inválido.' } },
        }),
        { status: 422 },
      ),
    );
    const serverFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          HttpStatusCode: 503,
          AppStatusCode: 503,
          AppStatusMsg: 'ERR',
          AppResponse: { message: 'Unavailable' },
        }),
        { status: 503 },
      ),
    );
    const subscriptionFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          HttpStatusCode: 422,
          AppStatusCode: 406,
          AppStatusMsg: 'ERR',
          AppResponse: { message: 'Service not subscribed.' },
        }),
        { status: 422 },
      ),
    );

    const validationClient = new FactPtClient(sandboxConfig(), {
      fetch: validationFetch,
      rateLimiter: immediateRateLimiter(),
    });
    const serverClient = new FactPtClient(sandboxConfig(), {
      fetch: serverFetch,
      rateLimiter: immediateRateLimiter(),
    });
    const subscriptionClient = new FactPtClient(sandboxConfig(), {
      fetch: subscriptionFetch,
      rateLimiter: immediateRateLimiter(),
    });

    await expect(validationClient.listTaxes()).rejects.toMatchObject({
      kind: 'validation',
      retryable: false,
    } satisfies Partial<FactPtError>);
    await expect(serverClient.listTaxes()).rejects.toMatchObject({
      kind: 'server',
      retryable: true,
    } satisfies Partial<FactPtError>);
    await expect(subscriptionClient.listTaxes()).rejects.toMatchObject({
      kind: 'subscription',
      retryable: false,
    } satisfies Partial<FactPtError>);
  });

  it('aborts timed-out requests and marks them as retryable', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );
    const client = new FactPtClient(sandboxConfig(5), {
      fetch: fetchMock,
      rateLimiter: immediateRateLimiter(),
    });

    await expect(client.listTaxes()).rejects.toMatchObject({
      kind: 'timeout',
      retryable: true,
    } satisfies Partial<FactPtError>);
  });

  it('enforces one globally sequenced request per second', async () => {
    let time = 0;
    const waits: number[] = [];
    const starts: number[] = [];
    const limiter = new FactPtRateLimiter({
      now: () => time,
      sleep: async (milliseconds) => {
        waits.push(milliseconds);
        time += milliseconds;
      },
    });

    await Promise.all([
      limiter.run(async () => starts.push(time)),
      limiter.run(async () => starts.push(time)),
      limiter.run(async () => starts.push(time)),
    ]);

    expect(starts).toEqual([0, 1_000, 2_000]);
    expect(waits).toEqual([1_000, 1_000]);
  });
});
