import { describe, expect, it } from 'vitest';

import { rankDonorCandidates, candidateFromRemoteClient } from '../lib/ledger/factpt-mirror-rules';
import { payerNameMatch } from '../lib/ledger/invoice-safety';

const donation = (name: string, email: string, created: string) => ({
  donor_name: name, donor_email: email, donor_nif: null, donor_address: 'Rua 1', donor_zip: '1000-001',
  donor_city: 'Lisboa', donor_country: 'PT', created_at: created,
});

describe('payerNameMatch', () => {
  it('accepts the bank cutting the last word', () => {
    expect(payerNameMatch('Joana Marques de Alm', 'Joana Marques de Almeida')).toBe('exact');
  });
  it('treats two shared first names as a different person', () => {
    expect(payerNameMatch('Ana Lucia Ferreira', 'Ana Lucia Pinto Rocha')).toBe('partial');
    expect(payerNameMatch('Ana Lucia Ferreira', 'Ana Lucia Ferreira Costa')).toBe('exact');
    expect(payerNameMatch('Ana Lucia Ferreira', 'Rita Lucia Mendes')).toBeNull();
  });
});

describe('rankDonorCandidates', () => {
  const mirror = [
    { number: '2026D/901', doc_date: '2026-11-03', client_id: 1001, client_name: 'Ana Lucia Pinto Rocha',
      client_snapshot: { name: 'Ana Lucia Pinto Rocha', email: 'rocha@example.com', nif: null, address: 'Rua A', zip: '1000-001', city: 'Lisboa', country: 'PT' } },
    { number: '2026D/900', doc_date: '2026-10-26', client_id: 1002, client_name: 'Ana Lucia Ferreira Costa',
      client_snapshot: { name: 'Ana Lucia Ferreira Costa', email: 'costa@example.com', nif: '123456789', address: 'Largo 26', zip: '4000-001', city: 'Porto', country: 'PT' } },
  ];
  const donations = [
    donation('Ana Lucia Pinto Rocha', 'rocha@example.com', '2026-11-03T10:00:00Z'),
    donation('Ana Lucia Costa', 'other@example.com', '2026-10-18T10:00:00Z'),
    donation('Ana Lucia Ferreira', 'other@example.com', '2026-10-17T10:00:00Z'),
  ];

  it('suggests the one FACT.pt client with the full bank name, never the newest look-alike', () => {
    const { candidates, suggestedKey } = rankDonorCandidates('Ana Lucia Ferreira', { donations, mirror });
    expect(suggestedKey).toBe('factpt:1002');
    expect(candidates[0]).toMatchObject({ name: 'Ana Lucia Ferreira Costa', nif: '123456789', lastInvoice: 'FR 2026D/900', match: 'exact' });
    const schmidt = candidates.find(candidate => candidate.name === 'Ana Lucia Pinto Rocha');
    expect(schmidt?.match).toBe('partial');
    // The site donation by the same email as the FACT.pt client is not listed twice.
    expect(candidates.filter(candidate => candidate.name === 'Ana Lucia Pinto Rocha')).toHaveLength(1);
  });

  it('chooses nobody when only look-alikes exist', () => {
    const { suggestedKey, candidates } = rankDonorCandidates('Ana Lucia Duarte', { donations, mirror });
    expect(suggestedKey).toBeNull();
    expect(candidates.every(candidate => candidate.match === 'partial')).toBe(true);
  });

  it('chooses nobody when two FACT.pt clients carry the full name', () => {
    const twin = { ...mirror[1], client_id: 1, number: '2026D/1' };
    expect(rankDonorCandidates('Ana Lucia Ferreira', { donations: [], mirror: [mirror[1], twin] }).suggestedKey).toBeNull();
  });

  it('keeps no tax number for a final consumer from FACT.pt search', () => {
    expect(candidateFromRemoteClient({ id: 9, name: 'Ana', tin: '999999990', isFinalConsumer: true }).nif).toBeNull();
    expect(candidateFromRemoteClient({ id: 9, name: 'Ana', tin: '123456789' }).nif).toBe('123456789');
  });
});
