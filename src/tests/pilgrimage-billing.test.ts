import { describe, expect, it } from 'vitest';

import {
  loadPilgrimageBillingProfile,
  savePilgrimageBillingProfile,
} from '../lib/pilgrimage-billing';

const createDb = (member: Record<string, unknown> | null) => {
  const updates: Record<string, Record<string, unknown>> = {};

  return {
    updates,
    db: {
      from(table: string) {
        const builder: Record<string, any> = {
          error: null,
          select() {
            return builder;
          },
          update(payload: Record<string, unknown>) {
            updates[table] = payload;
            return builder;
          },
          eq() {
            return builder;
          },
          async maybeSingle() {
            return { data: table === 'membros' ? member : null, error: null };
          },
        };
        return builder;
      },
    },
  };
};

const completeHolder = {
  id: 'holder-pilgrim',
  full_name: 'Titular da Inscrição',
  email: 'titular@example.test',
  address: 'Rua da Inscrição, 10',
  postal_code: '4000-001',
  city: 'Porto',
  country: 'Portugal',
  cpf_nif: '',
  created_at: '2026-08-01T10:00:00.000Z',
};

describe('pilgrimage billing profile', () => {
  it('uses the complete registration as source of truth and respects an empty NIF', async () => {
    const { db } = createDb({
      id: 'member-1',
      nome: 'Nome antigo',
      email: 'titular@example.test',
      address: 'Morada antiga',
      postal_code: '1000-001',
      city: 'Lisboa',
      country: 'PT',
      nif: '256396078',
    });

    const billing = await loadPilgrimageBillingProfile(db as never, {
      id: 'booking-1',
      user_id: 'member-1',
      pilgrims: [completeHolder],
    });

    expect(billing).toEqual({
      name: 'Titular da Inscrição',
      email: 'titular@example.test',
      address: 'Rua da Inscrição, 10',
      postalCode: '4000-001',
      city: 'Porto',
      country: 'PT',
      taxIdRequested: false,
      nif: null,
    });
  });

  it('includes the NIF entered by the account holder in the registration', async () => {
    const { db } = createDb({
      id: 'member-1',
      email: 'titular@example.test',
      nif: '999999999',
    });

    const billing = await loadPilgrimageBillingProfile(db as never, {
      id: 'booking-1',
      user_id: 'member-1',
      pilgrims: [{ ...completeHolder, cpf_nif: '256396078' }],
    });

    expect(billing.taxIdRequested).toBe(true);
    expect(billing.nif).toBe('256396078');
  });

  it('selects the account holder in a shared booking by the member email', async () => {
    const { db } = createDb({
      id: 'member-1',
      email: 'titular@example.test',
    });

    const billing = await loadPilgrimageBillingProfile(db as never, {
      id: 'booking-1',
      user_id: 'member-1',
      pilgrims: [
        {
          ...completeHolder,
          id: 'companion',
          full_name: 'Acompanhante',
          email: 'acompanhante@example.test',
          cpf_nif: '111111111',
        },
        { ...completeHolder, cpf_nif: '256396078' },
      ],
    });

    expect(billing.name).toBe('Titular da Inscrição');
    expect(billing.nif).toBe('256396078');
  });

  it('uses member data as fallback for an incomplete legacy registration', async () => {
    const { db } = createDb({
      id: 'member-1',
      nome: 'Titular antigo',
      email: 'titular@example.test',
      address: 'Rua do Perfil, 2',
      postal_code: '1000-001',
      city: 'Lisboa',
      country: 'PT',
      nif: '256396078',
    });

    const billing = await loadPilgrimageBillingProfile(db as never, {
      id: 'booking-legacy',
      user_id: 'member-1',
      pilgrims: [{
        ...completeHolder,
        address: '',
        postal_code: '',
        city: '',
        country: '',
      }],
    });

    expect(billing.address).toBe('Rua do Perfil, 2');
    expect(billing.city).toBe('Lisboa');
    expect(billing.taxIdRequested).toBe(true);
    expect(billing.nif).toBe('256396078');
  });

  it('clears a previously stored NIF when an explicit edit selects Final Consumer', async () => {
    const { db, updates } = createDb({
      id: 'member-1',
      email: 'titular@example.test',
      nif: '256396078',
    });

    await savePilgrimageBillingProfile(db as never, {
      id: 'booking-1',
      user_id: 'member-1',
      pilgrims: [{ ...completeHolder, cpf_nif: '256396078' }],
    }, {
      name: completeHolder.full_name,
      email: completeHolder.email,
      address: completeHolder.address,
      postalCode: completeHolder.postal_code,
      city: completeHolder.city,
      country: completeHolder.country,
      taxIdRequested: false,
      nif: null,
    });

    expect(updates.membros.nif).toBeNull();
    expect(updates.pilgrims.cpf_nif).toBeNull();
  });
});
