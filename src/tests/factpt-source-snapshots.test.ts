import { describe, expect, it } from 'vitest';

import { loadFactPtSourceSnapshot } from '../lib/factpt/source-snapshots';

describe('FACT.pt pilgrimage ownership', () => {
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
    expect(snapshot.items[0].description).toBe(
      'Donativo para angariação de fundos',
    );
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

    expect(snapshot.items[0].description).toBe(
      'Donativo para angariação de fundos',
    );
    expect(snapshot.items[0].description).not.toContain('TESTE PRIVADO');
    expect(snapshot.emailSourceLabel).toBe(
      'Peregrinação 2026D — Sinal',
    );
  });
});
