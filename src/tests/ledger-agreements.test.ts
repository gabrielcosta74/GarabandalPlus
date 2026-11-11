import { describe, expect, it } from 'vitest';
import { agreementState, isRoundShare, rankAgreements, type AgreementSummary } from '../lib/ledger/agreement-rules';

const agreement = (over: Partial<AgreementSummary> = {}): AgreementSummary => ({
  id: 'meridiana',
  pilgrimageId: 'italia-2027',
  pilgrimageTitle: 'Itália e Medjugorje 2027',
  pilgrimageStart: '2027-04-05',
  supplier: 'La Meridiana Bleisure Hotel',
  description: null,
  logisticsLabel: 'La Meridiana Bleisure Hotel · Perugia / Assis',
  logisticsKey: 'stay:665cfb02',
  total: 13000,
  paidOutsideBank: 0,
  paidByBank: 0,
  paid: 0,
  remaining: 13000,
  payments: 0,
  hasProforma: true,
  hasFinalInvoice: false,
  status: 'open',
  ...over,
});

describe('isRoundShare', () => {
  it('recognises the deposits of the La Meridiana proforma', () => {
    expect(isRoundShare(-3900, 13000)).toBe(true); // 30 %
    expect(isRoundShare(-6500, 13000)).toBe(true); // 50 %
    expect(isRoundShare(-2600, 13000)).toBe(true); // 20 %
  });

  it('ignores amounts that are not a whole 5 % step or the whole total', () => {
    expect(isRoundShare(-3851.57, 13000)).toBe(false);
    expect(isRoundShare(-130, 13000)).toBe(false); // 1 %
    expect(isRoundShare(-13000, 13000)).toBe(false);
    expect(isRoundShare(-100, 0)).toBe(false);
  });
});

describe('rankAgreements', () => {
  it('suggests the hotel for a SEPA order that only carries a reference', () => {
    const ranked = rankAgreements({ text: 'ORD.PAG. SEPA 7425312148994 7425312148994', amount: -3900 }, [agreement()]);
    expect(ranked.map(a => a.id)).toEqual(['meridiana']);
  });

  it('puts a name match ahead of an amount-only match', () => {
    const leone = agreement({ id: 'leone', supplier: 'Hotel Leone', logisticsLabel: 'Hotel Leone · Medjugorje', total: 7800, remaining: 7800 });
    const ranked = rankAgreements({ text: 'TRF HOTEL LEONE MEDJUGORJE', amount: -3900 }, [agreement(), leone]);
    expect(ranked.map(a => a.id)).toEqual(['leone', 'meridiana']);
  });

  it('leaves out an agreement the payment would overpay, and cancelled ones', () => {
    expect(rankAgreements({ text: 'ORD.PAG. SEPA 1', amount: -3900 }, [agreement({ remaining: 2600, paid: 10400 })])).toEqual([]);
    expect(rankAgreements({ text: 'LA MERIDIANA', amount: -3900 }, [agreement({ status: 'cancelled' })])).toEqual([]);
  });

  it('still suggests the balance once the deposits are linked', () => {
    const ranked = rankAgreements({ text: 'ORD.PAG. SEPA 9', amount: -2600 }, [agreement({ paidByBank: 10400, paid: 10400, remaining: 2600 })]);
    expect(ranked.map(a => a.id)).toEqual(['meridiana']);
  });
});

describe('agreementState', () => {
  it('waits for the final invoice once everything is paid', () => {
    expect(agreementState({ total: 13000, paid: 13000, hasFinalInvoice: false, status: 'open' })).toBe('paid_waiting_invoice');
    expect(agreementState({ total: 13000, paid: 3900, hasFinalInvoice: false, status: 'open' })).toBe('paying');
  });
});
