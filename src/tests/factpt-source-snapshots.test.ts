import { describe, expect, it } from 'vitest';

import { loadFactPtSourceSnapshot } from '../lib/factpt/source-snapshots';

describe('FACT.pt pilgrimage ownership', () => {
  it('maps an explicitly confirmed manual PIX note to FACT.pt Outros', async () => {
    const rows: Record<string, unknown> = {
      pilgrimage_payments: {
        id: 'payment-manual-pix',
        booking_id: 'booking-manual-pix',
        amount: 500,
        status: 'verified',
        method: 'bank_transfer',
        notes: 'Por Pix',
        verified_at: '2026-07-29T10:00:00.000Z',
      },
      bookings: {
        id: 'booking-manual-pix',
        user_id: 'holder-manual-pix',
        notes: '',
        pilgrimages: {
          title: 'Peregrinação',
          start_date: '2027-04-05',
        },
      },
      membros: {
        id: 'holder-manual-pix',
        nome: 'Titular',
        email: 'titular@example.test',
        nif: '123456789',
        address: 'Rua do Titular',
        postal_code: '1000-001',
        city: 'Lisboa',
        country: 'PT',
      },
      pilgrims: [],
    };
    const db = {
      from(table: string) {
        const builder = {
          select() { return builder; },
          eq() { return builder; },
          async maybeSingle() {
            return { data: rows[table] ?? null, error: null };
          },
          async order() {
            return { data: rows[table] ?? [], error: null };
          },
        };
        return builder;
      },
      auth: {
        admin: {
          async getUserById() {
            return {
              data: { user: { email: 'titular@example.test' } },
              error: null,
            };
          },
        },
      },
    };

    const snapshot = await loadFactPtSourceSnapshot(
      db as never,
      'pilgrimage',
      'payment-manual-pix',
    );

    expect(snapshot.paymentMethod).toBe('pix');
  });

  it('uses the legacy Reduniq charged total from notes when numeric columns lost the fee', async () => {
    const rows: Record<string, unknown> = {
      pilgrimage_payments: {
        id: 'payment-legacy-fee',
        booking_id: 'booking-legacy-fee',
        amount: 500,
        processing_fee_amount: 0,
        charged_amount: 500,
        status: 'verified',
        method: 'reduniq',
        notes: 'Valor base: 500.00€ | Taxa Reduniq: 9.50€ | Total cobrado: 509.50€ | Tipo: deposit',
        verified_at: '2026-07-29T10:00:00.000Z',
      },
      bookings: {
        id: 'booking-legacy-fee',
        user_id: 'holder-legacy-fee',
        notes: '',
        pilgrimages: {
          title: 'Peregrinação',
          start_date: '2027-04-05',
        },
      },
      membros: {
        id: 'holder-legacy-fee',
        nome: 'Titular',
        email: 'titular@example.test',
        nif: '123456789',
        address: 'Rua do Titular',
        postal_code: '1000-001',
        city: 'Lisboa',
        country: 'PT',
      },
      pilgrims: [],
    };
    const db = {
      from(table: string) {
        const builder = {
          select() { return builder; },
          eq() { return builder; },
          async maybeSingle() {
            return { data: rows[table] ?? null, error: null };
          },
          async order() {
            return { data: rows[table] ?? [], error: null };
          },
        };
        return builder;
      },
      auth: {
        admin: {
          async getUserById() {
            return {
              data: { user: { email: 'titular@example.test' } },
              error: null,
            };
          },
        },
      },
    };

    const snapshot = await loadFactPtSourceSnapshot(
      db as never,
      'pilgrimage',
      'payment-legacy-fee',
    );

    expect(snapshot.amount).toBe(509.5);
    expect(snapshot.items[0].price).toBe(509.5);
  });

  it('always invoices the booking account holder in a shared reservation', async () => {
    const rows: Record<string, unknown> = {
      pilgrimage_payments: {
        id: 'payment-1',
        booking_id: 'booking-1',
        amount: 75,
        processing_fee_amount: 1.43,
        charged_amount: 76.43,
        status: 'paid',
        method: 'reduniq_multibanco',
        notes: '[Tipo:installment]',
        verified_at: '2026-07-29T10:00:00.000Z',
      },
      bookings: {
        id: 'booking-1',
        user_id: 'account-holder-1',
        pilgrimage_id: 'trip-1',
        notes: '',
        pilgrimages: {
          title: 'Peregrinação de novembro',
          start_date: '2026-11-01',
        },
      },
      membros: {
        id: 'account-holder-1',
        nome: 'Titular da conta',
        email: 'titular@example.test',
        nif: '123456789',
        address: 'Rua do Titular, 1',
        postal_code: '1000-001',
        country: 'PT',
        telefone: '910000000',
      },
      pilgrims: [
        {
          full_name: 'Outro peregrino',
          email: 'outro@example.test',
          phone: '920000000',
          cpf_nif: '987654321',
          address: 'Rua de Outra Pessoa',
          postal_code: '2000-002',
          city: 'Porto',
          country: 'PT',
          created_at: '2026-01-01T00:00:00.000Z',
        },
        {
          full_name: 'Titular da conta',
          email: 'titular@example.test',
          phone: '910000000',
          cpf_nif: '123456789',
          address: 'Rua do Titular, 1',
          postal_code: '1000-001',
          city: 'Lisboa',
          country: 'PT',
          created_at: '2026-01-02T00:00:00.000Z',
        },
      ],
    };

    const fakeSupabase = {
      from(table: string) {
        const builder = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          async maybeSingle() {
            return { data: rows[table] ?? null, error: null };
          },
          async order() {
            return { data: rows[table] ?? [], error: null };
          },
        };
        return builder;
      },
      auth: {
        admin: {
          async getUserById() {
            return {
              data: { user: { email: 'titular@example.test' } },
              error: null,
            };
          },
        },
      },
    };

    const snapshot = await loadFactPtSourceSnapshot(
      fakeSupabase as never,
      'pilgrimage',
      'payment-1',
    );

    expect(snapshot.customer).toMatchObject({
      userId: 'account-holder-1',
      name: 'Titular da conta',
      email: 'titular@example.test',
      nif: '123456789',
      address: 'Rua do Titular, 1',
      city: 'Lisboa',
    });
    expect(snapshot.customer.email).not.toBe('outro@example.test');
    expect(snapshot.seriesCode).toBe('2026D');
    expect(snapshot.amount).toBe(76.43);
    expect(snapshot.items[0].price).toBe(76.43);
    expect(snapshot.comments).toBe('Doação sem contrapartidas');
    expect(snapshot.items[0]).toMatchObject({
      reference: 'AAG-003',
      description: 'Doação - Associação do Apostolado de Garabandal',
    });
    expect(snapshot.emailSourceLabel).toBe(
      'Peregrinação de novembro — Prestação',
    );
    expect(snapshot.paymentMethod).toBe('reduniq_multibanco');
  });

  it('never borrows fiscal data from another pilgrim', async () => {
    const tableRows: Record<string, unknown> = {
      pilgrimage_payments: {
        id: 'payment-2',
        booking_id: 'booking-2',
        amount: 50,
        method: 'reduniq_card',
        verified_at: '2026-07-29T10:00:00.000Z',
      },
      bookings: {
        id: 'booking-2',
        user_id: 'holder-2',
        notes: '',
        pilgrimages: { title: 'Peregrinação', start_date: '2026-11-01' },
      },
      membros: {
        id: 'holder-2',
        nome: 'Titular sem dados fiscais',
        email: 'holder@example.test',
        nif: null,
        address: null,
        postal_code: null,
        country: null,
        telefone: null,
      },
      pilgrims: [{
        full_name: 'Participante diferente',
        email: 'participant@example.test',
        cpf_nif: '999999999',
        address: 'Morada do participante',
        postal_code: '9999-999',
        city: 'Porto',
        country: 'PT',
        created_at: '2026-01-01T00:00:00.000Z',
      }],
    };
    const db = {
      from(table: string) {
        const builder = {
          select() { return builder; },
          eq() { return builder; },
          async maybeSingle() {
            return { data: tableRows[table] ?? null, error: null };
          },
          async order() {
            return { data: tableRows[table] ?? [], error: null };
          },
        };
        return builder;
      },
      auth: {
        admin: {
          async getUserById() {
            return {
              data: { user: { email: 'holder@example.test' } },
              error: null,
            };
          },
        },
      },
    };

    const snapshot = await loadFactPtSourceSnapshot(
      db as never,
      'pilgrimage',
      'payment-2',
    );

    expect(snapshot.customer.email).toBe('holder@example.test');
    expect(snapshot.customer.nif).toBeNull();
    expect(snapshot.customer.address).toBeNull();
    expect(snapshot.customer.name).toBe('Titular sem dados fiscais');
  });

  it('prefers the immutable payment billing snapshot and honours Final Consumer', async () => {
    const tableRows: Record<string, unknown> = {
      pilgrimage_payments: {
        id: 'payment-snapshot',
        booking_id: 'booking-snapshot',
        amount: 10,
        method: 'reduniq_card',
        verified_at: '2026-07-30T10:00:00.000Z',
        billing_name: 'Titular Congelado',
        billing_email: 'snapshot@example.test',
        billing_address: 'Rua Snapshot, 10',
        billing_postal_code: '4000-010',
        billing_city: 'Porto',
        billing_country: 'PT',
        billing_nif: null,
        billing_tax_id_requested: false,
      },
      bookings: {
        id: 'booking-snapshot',
        user_id: 'holder-snapshot',
        notes: '',
        pilgrimages: { title: 'Peregrinação', start_date: '2026-11-01' },
      },
      membros: {
        id: 'holder-snapshot',
        nome: 'Nome Atual Alterado',
        email: 'current@example.test',
        nif: '256396078',
        address: 'Morada Atual',
        postal_code: '1000-001',
        city: 'Lisboa',
        country: 'PT',
        telefone: null,
      },
      pilgrims: [],
    };
    const db = {
      from(table: string) {
        const builder = {
          select() { return builder; },
          eq() { return builder; },
          async maybeSingle() {
            return { data: tableRows[table] ?? null, error: null };
          },
          async order() {
            return { data: tableRows[table] ?? [], error: null };
          },
        };
        return builder;
      },
      auth: {
        admin: {
          async getUserById() {
            return {
              data: { user: { email: 'current@example.test' } },
              error: null,
            };
          },
        },
      },
    };

    const snapshot = await loadFactPtSourceSnapshot(
      db as never,
      'pilgrimage',
      'payment-snapshot',
    );

    expect(snapshot.customer).toMatchObject({
      name: 'Titular Congelado',
      email: 'snapshot@example.test',
      nif: null,
      address: 'Rua Snapshot, 10',
      zip: '4000-010',
      city: 'Porto',
      country: 'PT',
    });
  });

  it('removes the private pilot marker from the fiscal description', async () => {
    const rows: Record<string, unknown> = {
      pilgrimage_payments: {
        id: 'payment-private',
        booking_id: 'booking-private',
        amount: 0.5,
        processing_fee_amount: 0.01,
        charged_amount: 0.51,
        method: 'reduniq_card',
        status: 'verified',
        notes: 'Tipo: deposit',
        verified_at: '2026-07-29T18:04:07.771Z',
      },
      bookings: {
        id: 'booking-private',
        user_id: 'holder-private',
        notes: '[FACTPT:PRODUCTION_PILOT]',
        pilgrimages: {
          title: '[TESTE PRIVADO FACT.pt] Peregrinação 2026D',
          start_date: '2026-11-01',
        },
      },
      membros: {
        id: 'holder-private',
        nome: 'Gabriel Costa',
        email: 'gabriel@example.test',
        nif: '256396078',
        address: 'Rua entre carreiras',
        postal_code: '4535-313',
        city: 'Paços de Brandão',
        country: 'PT',
      },
      pilgrims: [],
    };
    const db = {
      from(table: string) {
        const builder = {
          select() { return builder; },
          eq() { return builder; },
          async maybeSingle() {
            return { data: rows[table] ?? null, error: null };
          },
          async order() {
            return { data: rows[table] ?? [], error: null };
          },
        };
        return builder;
      },
      auth: {
        admin: {
          async getUserById() {
            return {
              data: { user: { email: 'gabriel@example.test' } },
              error: null,
            };
          },
        },
      },
    };

    const snapshot = await loadFactPtSourceSnapshot(
      db as never,
      'pilgrimage',
      'payment-private',
    );

    expect(snapshot.items[0]).toMatchObject({
      reference: 'AAG-003',
      description: 'Doação - Associação do Apostolado de Garabandal',
    });
    expect(snapshot.items[0].description).not.toContain('TESTE PRIVADO');
    expect(snapshot.emailSourceLabel).toBe(
      'Peregrinação 2026D — Sinal',
    );
  });
});

describe('FACT.pt direct donations', () => {
  it('uses the official AAG-003 fiscal line and never the donor message', async () => {
    const donation = {
      id: 'donation-1',
      user_id: null,
      amount_cents: 2500,
      currency: 'EUR',
      method: 'stripe_card',
      status: 'succeeded',
      external_reference: 'reduniq-donation-1',
      description: 'Mensagem livre que não deve entrar na linha fiscal',
      donor_name: 'Doadora Exemplo',
      donor_email: 'doadora@example.test',
      donor_nif: null,
      donor_address: null,
      donor_city: null,
      donor_zip: null,
      donor_country: 'PT',
      metadata: {
        provider: 'reduniq',
        reduniq_method: 'mbway',
        locale: 'pt',
      },
      updated_at: '2026-07-29T20:00:00.000Z',
    };
    const db = {
      from() {
        const builder = {
          select() { return builder; },
          eq() { return builder; },
          async maybeSingle() {
            return { data: donation, error: null };
          },
        };
        return builder;
      },
      auth: { admin: { getUserById: async () => ({ data: null, error: null }) } },
    };

    const snapshot = await loadFactPtSourceSnapshot(
      db as never,
      'donation',
      donation.id,
      'donations',
    );

    expect(snapshot.items).toEqual([{
      reference: 'AAG-003',
      description: 'Doação - Associação do Apostolado de Garabandal',
      price: 25,
      quantity: 1,
      taxRate: 0,
      type: 'other',
    }]);
    expect(snapshot.comments).toBe('Doação sem contrapartidas');
    expect(snapshot.seriesCode).toBe('2026D');
    expect(snapshot.paymentMethod).toBe('mbway');
    expect(snapshot.emailSourceLabel).toBe(
      'Doação - Associação do Apostolado de Garabandal',
    );
  });
});
