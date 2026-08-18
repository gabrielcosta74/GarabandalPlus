import { describe, expect, it } from 'vitest';
import {
  getBookingPaymentSummary,
  parsePaymentPlan,
  reconstructRooms,
  serializeBookingSummary,
} from '../app/api/mobile/_lib/bookings';
import {
  buildInstallmentPlan,
  mapMobileParticipants,
  MobileRegistrationError,
} from '../app/api/mobile/_lib/registration';

describe('mobile pilgrimage booking payments', () => {
  it('uses confirmed payment rows when the booking paid amount is stale', () => {
    const summary = getBookingPaymentSummary({
      totalAmount: 1000,
      paidAmount: 100,
      depositAmount: 200,
      paymentPlan: [],
      payments: [
        { amount: 250, status: 'succeeded' },
        { amount: 500, status: 'pending' },
      ],
      notes: 'Payment Plan: full',
    });

    expect(summary.paidAmount).toBe(250);
    expect(summary.outstandingAmount).toBe(750);
    expect(summary.nextPayment).toMatchObject({ kind: 'balance', amount: 750 });
  });

  it('calculates the unpaid deposit before installments', () => {
    const summary = getBookingPaymentSummary({
      totalAmount: 1200,
      paidAmount: 75,
      depositAmount: 200,
      paymentPlan: [{ date: '2026-09-10', amount: 500 }],
      notes: 'Payment Plan: installments',
    });

    expect(summary.nextPayment).toMatchObject({ kind: 'deposit', amount: 125 });
    expect(summary.canUseCustomAmount).toBe(false);
  });

  it('calculates the next partial installment and allows a bounded custom amount', () => {
    const summary = getBookingPaymentSummary({
      totalAmount: 1200,
      paidAmount: 350,
      depositAmount: 200,
      paymentPlan: [
        { date: '2026-09-10', amount: 300 },
        { date: '2026-10-10', amount: 700 },
      ],
      notes: 'Payment Plan: installments',
    });

    expect(summary.nextPayment).toEqual({
      kind: 'installment',
      amount: 150,
      dueDate: '2026-09-10',
      installmentNumber: 1,
    });
    expect(summary.canUseCustomAmount).toBe(true);
  });

  it('does not allow custom payments while a receipt is being verified', () => {
    const summary = getBookingPaymentSummary({
      totalAmount: 1200,
      paidAmount: 200,
      depositAmount: 200,
      paymentPlan: [{ date: '2026-09-10', amount: 1000 }],
      payments: [{ amount: 1000, status: 'pending_verification' }],
      notes: 'Payment Plan: installments',
    });

    expect(summary.verifyingAmount).toBe(1000);
    expect(summary.canUseCustomAmount).toBe(false);
  });

  it('rejects malformed installment plans without throwing', () => {
    expect(parsePaymentPlan('{bad json')).toEqual([]);
    expect(parsePaymentPlan([{ date: 'invalid', amount: 100 }])).toEqual([]);
  });

  it('flattens totals and returns a normalizable pilgrimage record', () => {
    const booking = serializeBookingSummary({
      id: 'booking-id',
      pilgrimage_id: 'pilgrimage-id',
      status: 'pending',
      total_amount: 1000,
      paid_amount: 200,
      payment_plan: [{ date: '2026-09-10', amount: 800 }],
      notes: 'Payment Plan: installments',
      pilgrims: [{ id: 'p1', birth_date: '1990-01-01' }],
      payments: [],
      pilgrimage: {
        id: 'pilgrimage-id',
        slug: 'garabandal-2027',
        title: 'Garabandal',
        description: 'Peregrinação',
        start_date: '2027-05-01',
        end_date: '2027-05-08',
        status: 'open',
        total_vacancies: 40,
        current_vacancies: 12,
        base_price: 800,
        deposit_value: 200,
        pricing_config: { room_supplements: { double: 0, quadruple: 300 } },
      },
    });

    expect(booking).toMatchObject({
      totalAmount: 1000,
      paidAmount: 200,
      outstandingAmount: 800,
      paymentPlan: 'installments',
      nextPaymentAmount: 800,
      pilgrimage: {
        slug: 'garabandal-2027',
        prices: { base: 800, deposit: 200 },
        pricingConfig: { roomSupplements: { double: 0, family: 300 } },
      },
    });
  });
});

describe('mobile pilgrimage registration mapping', () => {
  const participants = [
    {
      id: 'person-1', fullName: 'Maria Costa', email: 'wrong@example.com', phone: '910000000',
      birthDate: '1990-01-01', sex: 'F', address: 'Rua 1', postalCode: '1000-001', city: 'Lisboa',
      country: 'PT', taxId: '123456789', allergies: 'Não', healthNotes: '', notes: 'Nota',
      flightOption: 'own', flightPolicyAcknowledged: true,
    },
    {
      id: 'person-2', fullName: 'João Costa', email: 'joao@example.com', phone: '920000000',
      birthDate: '1991-01-01', sex: 'M', address: 'Rua 1', postalCode: '1000-001', city: 'Lisboa',
      country: 'PT', taxId: '987654321', allergies: '', healthNotes: '', notes: '',
      flightOption: 'own', flightPolicyAcknowledged: true,
    },
  ];
  const rooms = [{
    id: 'room-1', type: 'family', occupantIds: ['person-1', 'person-2'],
    bedPreference: 'double_bed', sharingMode: 'household', roommateName: '',
  }];

  it('maps camelCase participants, forces session email and preserves room grouping', () => {
    const mapped = mapMobileParticipants({
      participants,
      rooms,
      sessionEmail: 'session@example.com',
      roomSupplements: { quadruple: 300 },
    });

    expect(mapped[0]).toMatchObject({
      full_name: 'Maria Costa',
      email: 'session@example.com',
      room_type: 'quadruple',
      flight_policy_acknowledged: true,
    });
    expect(mapped[0].notes).toContain('[Quarto: room-1]');
    expect(reconstructRooms(mapped.map((participant, index) => ({ ...participant, id: `db-${index}` })))).toEqual([
      expect.objectContaining({
        id: 'room-1',
        type: 'family',
        occupantIds: ['db-0', 'db-1'],
      }),
    ]);
  });

  it('rejects participants assigned more than once', () => {
    expect(() => mapMobileParticipants({
      participants,
      rooms: [...rooms, { ...rooms[0], id: 'room-2' }],
      sessionEmail: 'session@example.com',
      roomSupplements: { quadruple: 300 },
    })).toThrow(MobileRegistrationError);
  });

  it('builds the authoritative balance installments with the existing calculator', () => {
    const plan = buildInstallmentPlan({
      paymentMethod: 'installments',
      totalAmount: 1200,
      depositPerParticipant: 200,
      participants: [{ birth_date: '1990-01-01' }],
      startDate: '2027-06-01',
      installmentDeadline: '2026-12-10',
      installmentCount: 3,
      now: new Date(2026, 7, 1, 12),
    });

    expect(plan).toHaveLength(3);
    expect(plan?.reduce((sum, installment) => sum + installment.amount, 0)).toBe(1000);
  });
});
