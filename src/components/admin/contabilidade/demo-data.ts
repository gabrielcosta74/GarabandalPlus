import { classifyMovement } from '../../../lib/ledger/classify';
import type { LedgerMovement } from './types';

/*
 * Example data for the Contabilidade page while the bank connection and the
 * ledger tables are not live. Every name and amount is invented. Shapes follow
 * the real Montepio descriptions seen in the 2026 workbook, so the classifier
 * runs on them exactly as it will on real lines.
 */

type Seed = {
  day: number;
  description: string;
  amount: number;
  /** Final state, as if the admin had already worked on it. */
  done?: { category?: LedgerMovement['categoryCode']; invoice?: string; document?: boolean; paper?: boolean; ignored?: string };
  /** What the cross-check with FACT.pt or past confirmations would have found. */
  suggestion?: LedgerMovement['suggestion'];
};

const NOVEMBER: Seed[] = [
  { day: 2, description: 'TR-IPS-Marta Sofia Rodrigues', amount: 50, done: { category: 'doacao', invoice: 'FR 2026D/1251' } },
  { day: 2, description: 'TR-UNICRE S.A.', amount: 412.37, done: { category: 'liquidacao_reduniq' } },
  { day: 2, description: 'COMISS.TPA        01641285 034', amount: -1.85, done: { category: 'comissao_reduniq' } },
  { day: 3, description: 'COMPRA RAILWAY', amount: -18.42, done: { category: 'software', document: true } },
  { day: 3, description: 'COM SERV ESTR 0001', amount: -0.46, done: { category: 'comissao_bancaria' } },
  { day: 3, description: 'I.SELO OP.BANC.', amount: -0.02, done: { category: 'imposto_selo' } },
  { day: 3, description: 'TR-IPS-JOAO PEDRO MARQUES', amount: 25, done: { category: 'quota', invoice: 'FR 2026Q/131' } },
  { day: 4, description: 'TR-IPS-Ana Beatriz Fontes', amount: 54.34, suggestion: { confidence: 'manual', reason: 'FR emitida à mão na FACT.pt com o mesmo valor e o nome do pagador', invoiceRef: 'FR 2026D/1254', invoiceRefs: [] } },
  { day: 4, description: 'TRF.CRED  HELENA CARVALHO NUNES', amount: 200, suggestion: { confidence: 'learned', reason: 'Confirmado 3 vezes como Doação', invoiceRef: null, invoiceRefs: [] } },
  { day: 4, description: 'TR-UNICRE S.A.', amount: 1285.9 },
  { day: 4, description: 'COMISS.TPA        01641285 034', amount: -3.12 },
  { day: 5, description: 'COMPRA RESEND', amount: -19.37 },
  { day: 5, description: 'COM SERV ESTR 0002', amount: -0.48 },
  { day: 5, description: 'I.SELO OP.BANC.', amount: -0.02 },
  { day: 5, description: 'TR-IPS-Rui Miguel Teixeira', amount: 25 },
  { day: 6, description: 'TR-Paula Cristina Lopes', amount: 100 },
  { day: 6, description: 'FECHO TPA         01641285 035', amount: 60 },
  { day: 6, description: 'DD-VODAFONE PORTUGAL-COM. PE', amount: -32.99 },
  { day: 7, description: 'TRF.IPS P/ FACTOR M   CONSULT', amount: -307.5 },
  { day: 7, description: 'TR-IPS-Francisco Almeida Costa', amount: 1000 },
  { day: 9, description: 'COMPRA E.S.VEC RIOS', amount: -71.6 },
  { day: 9, description: 'COMPRA A25 PORTAGEM', amount: -8.45 },
  { day: 10, description: 'ORD.PAG. SEPA 0001 HOTEL SANTA MARIA', amount: -1450 },
  { day: 10, description: 'TR-STRIPE', amount: 87.2 },
  { day: 11, description: 'TR-IPS-Isabel Moreira Santos', amount: 75 },
  { day: 11, description: 'TRF. ANTONIO JOSE PEREIRA S', amount: 300 },
  { day: 12, description: 'ORD.PAG. SEPA 0002', amount: -500 },
  { day: 12, description: 'SOLUÇÃO E.MPRESÁRIO', amount: -7.5 },
  { day: 12, description: 'I.S. COM. MAN. CTA PACOTE', amount: -0.3 },
  { day: 13, description: 'COMPRA SUPABASE', amount: -23.9 },
  { day: 13, description: 'TR-IPS-Teresa Lima', amount: 25, done: { ignored: 'Devolvido à pessoa — transferência em duplicado' } },
  { day: 3, description: 'TR-IPS-Fatima Gomes Silva', amount: 650, done: { category: 'peregrinacao', invoice: 'FR 2026D/1253' } },
  { day: 4, description: 'TRF.CRED  JOSE MANUEL OLIVEIRA', amount: 1300, done: { category: 'peregrinacao', invoice: 'FR 2026D/1255' } },
  { day: 5, description: 'TR-IPS-Cecilia Moura', amount: 25, done: { category: 'quota', invoice: 'FR 2026Q/132' } },
  { day: 6, description: 'TR-IPS-Mariana Couto', amount: 19.99, done: { category: 'loja', invoice: 'FR 2026L/31' } },
  { day: 8, description: 'TR-UNICRE S.A.', amount: 963.4, done: { category: 'liquidacao_reduniq' } },
];

const OCTOBER: Seed[] = [
  { day: 1, description: 'TR-IPS-Carlos Henrique Dias', amount: 50, done: { category: 'doacao', invoice: 'FR 2026D/1180' } },
  { day: 2, description: 'TR-UNICRE S.A.', amount: 2214.55, done: { category: 'liquidacao_reduniq' } },
  { day: 2, description: 'COMISS.TPA        01641285 031', amount: -5.4, done: { category: 'comissao_reduniq' } },
  { day: 3, description: 'COMPRA RAILWAY', amount: -17.95, done: { category: 'software', document: true } },
  { day: 3, description: 'I.SELO OP.BANC.', amount: -0.02, done: { category: 'imposto_selo' } },
  { day: 6, description: 'TR-IPS-Luisa Fernandes', amount: 25, done: { category: 'quota', invoice: 'FR 2026Q/120' } },
  { day: 8, description: 'DD-VODAFONE PORTUGAL-COM. PE', amount: -32.99, done: { category: 'comunicacoes', document: true } },
  { day: 9, description: 'TRF.IPS P/ FACTOR M   CONSULT', amount: -307.5, done: { category: 'contabilidade', paper: true } },
  { day: 14, description: 'TR-IPS-Manuel Sousa Ribeiro', amount: 150, done: { category: 'doacao', invoice: 'FR 2026D/1197' } },
  { day: 20, description: 'COMPRA E.S.VEC RIOS', amount: -65.3, done: { category: 'viagem' } },
  { day: 27, description: 'TR-IPS-Rita Azevedo', amount: 54.34, done: { category: 'doacao', invoice: 'FR 2026D/1214' } },
  { day: 10, description: 'TR-IPS-Pedro Amaral', amount: 650, done: { category: 'peregrinacao', invoice: 'FR 2026D/1190' } },
  { day: 16, description: 'TR-UNICRE S.A.', amount: 1180.25, done: { category: 'liquidacao_reduniq' } },
  { day: 22, description: 'ORD.PAG. SEPA 0007 HOTEL SANTA MARIA', amount: -900, done: { category: 'alojamento', document: true } },
];

function build(period: string, unsorted: Seed[], openingBalance: number): LedgerMovement[] {
  const seeds = [...unsorted].sort((a, b) => a.day - b.day);
  let balanceCents = Math.round(openingBalance * 100);
  return seeds.map((seed, index) => {
    balanceCents += Math.round(seed.amount * 100);
    const date = `${period}-${String(seed.day).padStart(2, '0')}`;
    const guess = classifyMovement(seed.description, seed.amount);
    const done = seed.done;
    const category = done?.category ?? guess.categoryCode;
    const status: LedgerMovement['status'] = done?.ignored
      ? 'ignored'
      : done?.category
        ? 'reconciled'
        : guess.categoryCode ? 'suggested' : 'unreviewed';
    return {
      id: `demo-${period}-${index}`,
      period,
      bookingDate: date,
      valueDate: date,
      description: seed.description,
      amount: seed.amount,
      balanceAfter: balanceCents / 100,
      kind: guess.kind,
      categoryCode: done?.category ?? guess.categoryCode,
      suggestedCategoryCode: category ?? guess.suggestedCategoryCode,
      counterpartyName: guess.counterpartyName,
      needsDocument: guess.needsDocument,
      paperDocument: !!done?.paper,
      documentCount: done?.document ? 1 : 0,
      invoiceRefs: done?.invoice ? [done.invoice] : [],
      suggestion: seed.suggestion ?? null,
      status,
      ignoreReason: done?.ignored ?? null,
      notes: null,
      reviewedBy: done ? 'secretaria@apostolado.exemplo' : null,
      reviewedAt: done ? `${date}T15:20:00.000Z` : null,
    };
  });
}

export function demoMovements(): LedgerMovement[] {
  const october = build('2026-10', OCTOBER, 312480.12);
  const lastOctober = october[october.length - 1].balanceAfter as number;
  return [...october, ...build('2026-11', NOVEMBER, lastOctober)];
}
