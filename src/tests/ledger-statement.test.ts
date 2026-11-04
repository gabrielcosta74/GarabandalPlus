import { describe, expect, it } from 'vitest';

import { classifyMovement, extractCounterparty } from '../lib/ledger/classify';
import {
  checkBalanceChain,
  fingerprintRows,
  parseAmount,
  parseDate,
  parseStatementGrid,
  type StatementCell,
} from '../lib/ledger/montepio-statement';

// Anonymised rows shaped like the Montepio export in the 2026 workbook.
const HEADER: StatementCell[] = [null, null, 'DATA MOV.', 'DATA VALOR', 'DESCRIÇÃO', 'IMPORTÂNCIA', 'SALDO CONTABILÍSTICO'];
const grid = (rows: StatementCell[][]): StatementCell[][] => [
  ['Extrato de conta'],
  [],
  HEADER,
  ...rows,
  [null, null, null, null, 'Saldo final', null, null],
];

describe('parseAmount', () => {
  it('reads PT, EN and numeric formats', () => {
    expect(parseAmount('1.000,00')).toBe(1000);
    expect(parseAmount('161.492,08')).toBe(161492.08);
    expect(parseAmount('-0,55')).toBe(-0.55);
    expect(parseAmount('54.34')).toBe(54.34);
    expect(parseAmount(-0.55000000000000004)).toBe(-0.55);
    expect(parseAmount('1 024,00 €')).toBe(1024);
    expect(parseAmount('307,50-')).toBe(-307.5);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('parseDate', () => {
  it('reads Excel serials, PT strings and ISO', () => {
    expect(parseDate(46023)).toBe('2026-01-01');
    expect(parseDate('46024')).toBe('2026-01-02');
    expect(parseDate('02-01-2026')).toBe('2026-01-02');
    expect(parseDate('02/11/2026 08:00:23')).toBe('2026-11-02');
    expect(parseDate('2026-03-15')).toBe('2026-03-15');
    expect(parseDate(new Date(Date.UTC(2026, 5, 23)))).toBe('2026-06-23');
    expect(parseDate('23/06/20206')).toBeNull();
    expect(parseDate('31-02-2026')).toBeNull();
  });
});

describe('parseStatementGrid', () => {
  it('finds the header, reads movements and checks the balance chain', () => {
    const parsed = parseStatementGrid(grid([
      [null, null, 46023, 46023, 'TR-IPS-Ana Teste Exemplo', 54.34, '1.054,34'],
      [null, null, 46024, 46024, 'COMISS.TPA        01641285 034', -0.55, '1.053,79'],
      [null, null, 46024, 46024, 'TR-UNICRE S.A.', 9.84, '1.063,63'],
    ]));
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows[0]).toMatchObject({
      bookingDate: '2026-01-01',
      valueDate: '2026-01-01',
      description: 'TR-IPS-Ana Teste Exemplo',
      amount: 54.34,
      balanceAfter: 1054.34,
    });
    expect(parsed.periodFrom).toBe('2026-01-01');
    expect(parsed.periodTo).toBe('2026-01-02');
    expect(parsed.balanceOk).toBe(true);
    expect(parsed.warnings).toEqual([]);
  });

  it('flags a missing row as a balance gap', () => {
    const parsed = parseStatementGrid(grid([
      [null, null, 46023, 46023, 'TR-IPS-Ana Teste Exemplo', 54.34, '1.054,34'],
      // a 100 € movement is missing here
      [null, null, 46025, 46025, 'TR-Bruno Exemplo', 25, '1.179,34'],
    ]));
    expect(parsed.balanceOk).toBe(false);
    expect(parsed.warnings[0]).toMatchObject({ code: 'balance_gap' });
  });

  it('accepts newest-first exports', () => {
    const rows = parseStatementGrid(grid([
      [null, null, 46024, 46024, 'TR-UNICRE S.A.', 9.84, '1.063,63'],
      [null, null, 46023, 46023, 'TR-IPS-Ana Teste Exemplo', 54.34, '1.053,79'],
    ]));
    expect(checkBalanceChain(rows.rows).ok).toBe(true);
  });

  it('supports separate debit / credit columns', () => {
    const parsed = parseStatementGrid([
      ['Data Mov.', 'Data Valor', 'Descrição', 'Débito', 'Crédito', 'Saldo'],
      ['02-01-2026', '02-01-2026', 'COMPRA RAILWAY', '5,00', '', '995,00'],
      ['03-01-2026', '03-01-2026', 'TRF.CRED  JOANA EXEMPLO', '', '100,00', '1.095,00'],
    ]);
    expect(parsed.rows.map(r => r.amount)).toEqual([-5, 100]);
    expect(parsed.balanceOk).toBe(true);
  });

  it('throws a readable error without a header', () => {
    expect(() => parseStatementGrid([['foo', 'bar']])).toThrow(/cabeçalho/);
  });
});

describe('fingerprintRows', () => {
  it('is stable and separates identical lines on the same day', () => {
    const rows = parseStatementGrid(grid([
      [null, null, 46027, 46027, 'TR-UNICRE S.A.', 103.38, '1.103,38'],
      [null, null, 46027, 46027, 'TR-UNICRE S.A.', 103.38, '1.206,76'],
    ])).rows;
    expect(rows).toHaveLength(2);
    const first = fingerprintRows('acc', rows);
    const again = fingerprintRows('acc', rows);
    expect(first).toEqual(again);
    expect(new Set(first).size).toBe(2);
    expect(fingerprintRows('other', rows)[0]).not.toBe(first[0]);
  });

  it('ignores accents, spacing and balance so CSV and XLSX agree', () => {
    const base = { sourceRow: 1, bookingDate: '2026-01-02', valueDate: null, amount: 7.5 };
    const xlsx = fingerprintRows('acc', [{ ...base, description: 'SOLUÇÃO E.MPRESÁRIO', balanceAfter: 10 }]);
    const csv = fingerprintRows('acc', [{ ...base, description: 'SOLUCAO  E.MPRESARIO', balanceAfter: null }]);
    expect(csv).toEqual(xlsx);
  });

  it('skips hand-typed lines without a balance', () => {
    const parsed = parseStatementGrid(grid([
      [null, null, 46023, 46023, 'TR-IPS-Ana Teste Exemplo', 54.34, '1.054,34'],
      [null, null, null, 46024, 'Linha colada à mão - PIX', 25, null],
    ]));
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.warnings[0]).toMatchObject({ code: 'missing_balance' });
  });
});

describe('classifyMovement', () => {
  const cases: Array<[string, number, string, string | null, string | null]> = [
    // description, amount, kind, category (confident), suggested
    ['TR-IPS-Ana Teste Exemplo', 54.34, 'incoming_transfer', null, 'doacao'],
    ['TRF.CRED  JOANA EXEMPLO', 100, 'incoming_transfer', null, 'doacao'],
    ['TR-Bruno Exemplo ( Carla Exemplo)', 455, 'incoming_transfer', null, 'doacao'],
    ['TR-UNICRE S.A.', 413.66, 'reduniq_payout', 'liquidacao_reduniq', 'liquidacao_reduniq'],
    ['DD-UNICRE S.A.', -12.3, 'gateway_fee', 'comissao_reduniq', 'comissao_reduniq'],
    ['FECHO TPA         01641285 034', 100, 'tpa_close', null, 'doacao'],
    ['FECHO P.SERV.  202601201-43591', 550, 'tpa_close', null, 'doacao'],
    ['COMISS.TPA        01641285 034', -0.55, 'gateway_fee', 'comissao_reduniq', 'comissao_reduniq'],
    ['COMIS P.SERV.  202601201-43591', -2.1, 'gateway_fee', 'comissao_reduniq', 'comissao_reduniq'],
    ['I.SELO OP.BANC.', -0.04, 'stamp_duty', 'imposto_selo', 'imposto_selo'],
    ['I.S. COM. MAN. CTA PACOTE', -0.3, 'stamp_duty', 'imposto_selo', 'imposto_selo'],
    ['COM SERV ESTR 0001', -0.9, 'bank_fee', 'comissao_bancaria', 'comissao_bancaria'],
    ['SOLUÇÃO E.MPRESÁRIO', -7.5, 'bank_fee', 'comissao_bancaria', 'comissao_bancaria'],
    ['COMPRA RAILWAY', -5, 'card_purchase', 'software', 'software'],
    ['COMPRA RESEND', -20, 'card_purchase', 'software', 'software'],
    ['COMPRA SUPABASE', -25, 'card_purchase', 'software', 'software'],
    ['COMPRA E.S.VEC RIOS', -60, 'card_purchase', null, 'viagem'],
    ['COMPRA A25 PORTAGEM', -3.2, 'card_purchase', null, 'viagem'],
    ['COMPRA CP ESPINHO', -4.5, 'card_purchase', null, 'viagem'],
    ['DD-VODAFONE PORTUGAL-COM. PE', -30, 'direct_debit', 'comunicacoes', 'comunicacoes'],
    ['TRF.IPS P/ FACTOR M   CONSULT', -307.5, 'outgoing_transfer', 'contabilidade', 'contabilidade'],
    ['ORD.PAG. SEPA 0001 HOTEL EXEMPLO', -800, 'outgoing_transfer', null, 'alojamento'],
    ['ORD.PAG. SEPA 0002', -150, 'outgoing_transfer', null, 'outra_despesa'],
    ['DEVOL. CP ESPINHO', 4.5, 'refund', null, 'devolucao'],
    // Bank API format: trailing reference numbers
    ['TRF.IPS P/ FATOR M   CONSULTO  742008097893010', -307.5, 'outgoing_transfer', 'contabilidade', 'contabilidade'],
    ['TR-IPS-Marilde Mafra 0221463232', 757.76, 'incoming_transfer', null, 'doacao'],
    ['TR-ESTR-FATIMA NELSIZEUMA SOMB 2465319189455', 1000, 'incoming_transfer', null, 'doacao'],
    ['TR-UNICRE S.A. 0221495653', 996.49, 'reduniq_payout', 'liquidacao_reduniq', 'liquidacao_reduniq'],
    ['COMISS.TPA 01683607 091 T0E009000648682', -0.35, 'gateway_fee', 'comissao_reduniq', 'comissao_reduniq'],
    ['PAGSERV 10126 659952921 230002342831741', -585.95, 'direct_debit', null, 'outra_despesa'],
    ['COMPRA ACE HOTEL 230002335158030', -84.9, 'card_purchase', null, 'alojamento'],
    // Rules added from the first real bank sync (Nov 2026)
    ['IMP SELO OPE TGIS 17 2 4', -1.2, 'stamp_duty', 'imposto_selo', 'imposto_selo'],
    ['PAG. NET24 DUC 230002341111111', -315.37, 'direct_debit', 'impostos', 'impostos'],
    ['PAGAMENTO TSU - TRANSFERENCIA', -610.54, 'direct_debit', 'impostos', 'impostos'],
    ['COMPRA STREAMYARD.COM 230002300000000', -380.44, 'card_purchase', 'software', 'software'],
    ['COMPRA MOBBIN.COM 230002348062982', -20.2, 'card_purchase', 'software', 'software'],
    ['COMPRA CTT - CORREIOS 230002300000001', -7, 'card_purchase', null, 'fornecedores'],
    ['COMPRA HOSTARIA GARABANDAL 230002300000002', -7566, 'card_purchase', null, 'alojamento'],
    ['TRF.IPS P/ TRANSVIAGENS T EM 742008097000000', -13500, 'outgoing_transfer', null, 'viagem'],
    ['TRF.IPS P/ OMNITUR AGENCIA DE 742008097000001', -1728, 'outgoing_transfer', null, 'viagem'],
  ];

  it.each(cases)('%s (%d) → %s', (description, amount, kind, category, suggested) => {
    const result = classifyMovement(description, amount);
    expect(result.kind).toBe(kind);
    expect(result.categoryCode).toBe(category);
    expect(result.suggestedCategoryCode).toBe(suggested);
  });

  it('asks for a document on expenses that need one', () => {
    expect(classifyMovement('COMPRA RAILWAY', -5).needsDocument).toBe(true);
    expect(classifyMovement('I.SELO OP.BANC.', -0.04).needsDocument).toBe(false);
  });

  it('lets admin rules override the built-in ones', () => {
    const result = classifyMovement('TR-IPS-Ana Teste Exemplo', 25, [
      { pattern: 'ana teste', matchType: 'contains', direction: 'in', categoryCode: 'quota', priority: 1 },
    ]);
    expect(result.categoryCode).toBe('quota');
    expect(result.kind).toBe('incoming_transfer');
    expect(result.counterpartyName).toBe('Ana Teste Exemplo');
    // too-short patterns are ignored so a rule like "TR" can't swallow everything
    expect(classifyMovement('COMPRA RAILWAY', -5, [
      { pattern: 'co', matchType: 'contains', direction: null, categoryCode: 'outra_despesa', priority: 1 },
    ]).categoryCode).toBe('software');
  });
});

describe('extractCounterparty', () => {
  it('pulls the name out of transfer descriptions', () => {
    expect(extractCounterparty('TR-IPS-Ana Teste Exemplo')).toBe('Ana Teste Exemplo');
    expect(extractCounterparty('TRF.CRED  JOANA EXEMPLO')).toBe('Joana Exemplo');
    expect(extractCounterparty('TR-Bruno Exemplo ( Carla Exemplo)')).toBe('Bruno Exemplo');
    expect(extractCounterparty('TRF. VIRGILIO DE EXEMPLO S')).toBe('Virgilio de Exemplo S');
    expect(extractCounterparty('TR-UNICRE S.A.')).toBeNull();
    expect(extractCounterparty('TR-IPS-Marilde Mafra 0221463232')).toBe('Marilde Mafra');
    expect(extractCounterparty('TR-ESTR-FATIMA NELSIZEUMA SOMB 2465319189455')).toBe('Fatima Nelsizeuma Somb');
    expect(extractCounterparty('TR-SAINTE GENEVIEVE 0105319295875')).toBe('Sainte Genevieve');
    expect(extractCounterparty('COMPRA RAILWAY')).toBeNull();
  });
});
