import { describe, expect, it } from 'vitest';

import { rankDonorCandidates, candidateFromRemoteClient } from '../lib/ledger/factpt-mirror-rules';
import { payerNameMatch } from '../lib/ledger/invoice-safety';

const donation = (name: string, email: string, created: string) => ({
  donor_name: name, donor_email: email, donor_nif: null, donor_address: 'Rua 1', donor_zip: '1000-001',
  donor_city: 'Lisboa', donor_country: 'PT', created_at: created,
});

describe('payerNameMatch', () => {
  it('accepts the bank cutting the last word', () => {
    expect(payerNameMatch('Mafalda Zaidan de Oliv', 'Mafalda Zaidan de Oliveira')).toBe('exact');
  });
  it('treats two shared first names as a different person', () => {
    expect(payerNameMatch('Maria Helena Francisca', 'Maria Helena Vitor Schmidt')).toBe('partial');
    expect(payerNameMatch('Maria Helena Francisca', 'Maria Helena Francisca Silvestre')).toBe('exact');
    expect(payerNameMatch('Maria Helena Francisca', 'Joana Helena Costa')).toBeNull();
  });
});

describe('rankDonorCandidates', () => {
  const mirror = [
    { number: '2026D/1248', doc_date: '2026-11-03', client_id: 5646342, client_name: 'Maria Helena Vitor Schmidt',
      client_snapshot: { name: 'Maria Helena Vitor Schmidt', email: 'vitor@example.com', nif: null, address: 'Rua A', zip: '14025-610', city: 'Ribeirão Preto', country: 'BR' } },
    { number: '2026D/1232', doc_date: '2026-10-26', client_id: 6603276, client_name: 'Maria Helena Francisca Silvestre',
      client_snapshot: { name: 'Maria Helena Francisca Silvestre', email: 'silvestre@example.com', nif: '190087811', address: 'Largo 26', zip: '4690-300', city: 'Gralheira', country: 'PT' } },
  ];
  const donations = [
    donation('Maria Helena Vitor Schmidt', 'vitor@example.com', '2026-11-03T10:00:00Z'),
    donation('Maria Helena Silvestre', 'other@example.com', '2026-10-18T10:00:00Z'),
    donation('Maria Helena Francisca', 'other@example.com', '2026-10-17T10:00:00Z'),
  ];

  it('suggests the one FACT.pt client with the full bank name, never the newest look-alike', () => {
    const { candidates, suggestedKey } = rankDonorCandidates('Maria Helena Francisca', { donations, mirror });
    expect(suggestedKey).toBe('factpt:6603276');
    expect(candidates[0]).toMatchObject({ name: 'Maria Helena Francisca Silvestre', nif: '190087811', lastInvoice: 'FR 2026D/1232', match: 'exact' });
    const schmidt = candidates.find(candidate => candidate.name === 'Maria Helena Vitor Schmidt');
    expect(schmidt?.match).toBe('partial');
    // The site donation by the same email as the FACT.pt client is not listed twice.
    expect(candidates.filter(candidate => candidate.name === 'Maria Helena Vitor Schmidt')).toHaveLength(1);
  });

  it('chooses nobody when only look-alikes exist', () => {
    const { suggestedKey, candidates } = rankDonorCandidates('Maria Helena Rocha', { donations, mirror });
    expect(suggestedKey).toBeNull();
    expect(candidates.every(candidate => candidate.match === 'partial')).toBe(true);
  });

  it('chooses nobody when two FACT.pt clients carry the full name', () => {
    const twin = { ...mirror[1], client_id: 1, number: '2026D/1' };
    expect(rankDonorCandidates('Maria Helena Francisca', { donations: [], mirror: [mirror[1], twin] }).suggestedKey).toBeNull();
  });

  it('keeps no tax number for a final consumer from FACT.pt search', () => {
    expect(candidateFromRemoteClient({ id: 9, name: 'Ana', tin: '999999990', isFinalConsumer: true }).nif).toBeNull();
    expect(candidateFromRemoteClient({ id: 9, name: 'Ana', tin: '190087811' }).nif).toBe('190087811');
  });
});
