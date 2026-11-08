import { describe, expect, it } from 'vitest';

import {
  chooseBankMovement,
  dkimDomainsFromHeaderLines,
  parseAmountPaid,
  parseDebitFrom,
  parsePaidOn,
  recognizeInvoiceMail,
  type IncomingMail,
} from '../lib/ledger/mail-invoices-parse';

const pdf = (label: string) => Buffer.from(`%PDF-1.4\n${label}`);
const admins = new Set(['admin@example.com']);

const railwayMail = (overrides: Partial<IncomingMail> = {}): IncomingMail => ({
  from: 'invoice+statements+acct_1HNrvlCJoPsRzQsd@stripe.com',
  subject: 'Your receipt from Railway Corporation #2651-3346',
  text: 'Receipt from Railway Corporation $17.02 Paid on October 14, 2026 with - 0483 ... Total $17.02 Amount paid $17.02 Download receipt',
  date: new Date('2026-10-14T12:08:29Z'),
  dkimDomains: ['stripe.com'],
  attachments: [
    { filename: 'Invoice-YWICSTFQ-0008.pdf', contentType: 'application/pdf', content: pdf('invoice') },
    { filename: 'Receipt-2651-3346.pdf', contentType: 'application/pdf', content: pdf('receipt') },
  ],
  ...overrides,
});

describe('recognizeInvoiceMail', () => {
  it('reads a Railway receipt sent by Stripe', () => {
    const result = recognizeInvoiceMail(railwayMail(), admins);
    expect(result).toMatchObject({ supplier: 'railway', docNumber: 'YWICSTFQ-0008', paidOn: '2026-10-14', amount: 17.02, currency: 'USD', forwarded: false });
    expect(result?.files.map(file => [file.kind, file.number])).toEqual([['invoice', 'YWICSTFQ-0008'], ['receipt', '2651-3346']]);
  });

  it('ignores another Stripe merchant on the same domain', () => {
    expect(recognizeInvoiceMail(railwayMail({
      from: 'invoice+statements+acct_1MXstwJTv8nuoFyi@stripe.com',
      subject: 'Your receipt from Opusclip Inc. #2832-8498',
    }), admins)).toBeNull();
  });

  it('refuses a lookalike without the supplier DKIM signature', () => {
    expect(recognizeInvoiceMail(railwayMail({ dkimDomains: ['evil.example'] }), admins)).toBeNull();
  });

  it('refuses attachments that are not real PDFs', () => {
    expect(recognizeInvoiceMail(railwayMail({
      attachments: [{ filename: 'Invoice-YWICSTFQ-0008.pdf', contentType: 'application/pdf', content: Buffer.from('MZ fake') }],
    }), admins)).toBeNull();
  });

  it('accepts a Supabase receipt forwarded by an admin, dated by the payment', () => {
    const result = recognizeInvoiceMail({
      from: 'admin@example.com',
      subject: 'Fwd: Payment received for Supabase Pte. Ltd. invoice (#GJENKO-00014)',
      text: 'De: Supabase Pte. Ltd. <invoice+statements@supabase.com>\nYour invoice has been paid. $25.00 has been charged to your payment method.\nInvoice No. GJENKO-00014\n$25.00\nPaid on Jun 14, 2026',
      date: new Date('2026-06-15T14:50:29Z'),
      dkimDomains: ['example.com'],
      attachments: [
        { filename: 'Invoice-GJENKO-00014.pdf', contentType: 'application/pdf', content: pdf('i') },
        { filename: 'Receipt-GJENKO-00014.pdf', contentType: 'application/pdf', content: pdf('r') },
      ],
    }, admins);
    expect(result).toMatchObject({ supplier: 'supabase', docNumber: 'GJENKO-00014', paidOn: '2026-06-14', amount: 25, currency: 'USD', forwarded: true });
  });

  it('reads a Gmail forward with quoted, wrapped lines and invisible padding', () => {
    const result = recognizeInvoiceMail({
      from: 'admin@example.com',
      subject: 'Fwd: Your receipt from Resend #2083-3355',
      text: 'Resend <invoice+statements@invoicing.resend.com> escreveu (quarta,\n20/05/2026 à(s) 19:17):\n\n>\n> Your receipt  ͏  ͏\n> ­ ­\n> Receipt from Resend $20.00 Paid on May\n> 20, 2026 with - 0483\n> Amount paid\n> $20.00',
      date: new Date('2026-09-10T10:00:00Z'),
      dkimDomains: ['example.com'],
      attachments: [{ filename: 'Invoice-HIUDAMVI-0004.pdf', contentType: 'application/pdf', content: pdf('i') }],
    }, admins);
    expect(result).toMatchObject({ supplier: 'resend', paidOn: '2026-05-20', amount: 20, currency: 'USD', forwarded: true });
  });

  it('falls back to the original date in the forward header, never the forward date', () => {
    const base = {
      from: 'admin@example.com',
      subject: 'Fwd: Your receipt from Railway Corporation #2102-8476',
      date: new Date('2026-06-15T10:00:00Z'),
      dkimDomains: ['example.com'],
      attachments: [{ filename: 'Invoice-YWICSTFQ-0002.pdf', contentType: 'application/pdf', content: pdf('i') }],
    };
    expect(recognizeInvoiceMail({ ...base, text: 'De: Railway Corporation <invoice+statements+acct_1HNrvlCJoPsRzQsd@stripe.com\n>\nDate: terça, 14/04/2026 à(s) 13:10' }, admins)?.paidOn).toBe('2026-04-14');
    expect(recognizeInvoiceMail({ ...base, text: 'De: <invoice+statements+acct_1HNrvlCJoPsRzQsd@stripe.com>' }, admins)?.paidOn).toBeNull();
  });

  it('ignores forwards from someone who is not an admin', () => {
    expect(recognizeInvoiceMail({
      ...railwayMail(),
      from: 'stranger@example.com',
      subject: 'Fwd: Your receipt from Railway Corporation #1',
      text: 'invoice+statements+acct_1HNrvlCJoPsRzQsd@stripe.com Paid on October 14, 2026',
      dkimDomains: ['example.com'],
    }, admins)).toBeNull();
  });

  it('skips the unpaid "New invoice" Supabase email', () => {
    expect(recognizeInvoiceMail({
      from: 'invoice+statements@supabase.com',
      subject: 'New invoice from Supabase Pte. Ltd. (#GJENKO-00015)',
      text: '',
      date: new Date(),
      dkimDomains: ['supabase.com'],
      attachments: [{ filename: 'Invoice-GJENKO-00015.pdf', contentType: 'application/pdf', content: pdf('i') }],
    }, admins)).toBeNull();
  });
});

describe('other subscriptions', () => {
  it('reads a Mobbin receipt (another Stripe merchant)', () => {
    const result = recognizeInvoiceMail({
      from: 'invoice+statements+acct_1C0qvSFJtgAcXTXh@stripe.com',
      subject: 'Your receipt from Mobbin #2832-8498',
      text: 'Receipt from Mobbin $22.50 Paid on November 1, 2026 with - 0483 Amount paid $22.50',
      date: new Date('2026-10-31T23:00:00Z'),
      dkimDomains: ['stripe.com', 'amazonses.com'],
      attachments: [
        { filename: 'Invoice-SB2BSLUZ-0001.pdf', contentType: 'application/pdf', content: pdf('i') },
        { filename: 'Receipt-2832-8498.pdf', contentType: 'application/pdf', content: pdf('r') },
      ],
    }, admins);
    expect(result).toMatchObject({ supplier: 'mobbin', docNumber: 'SB2BSLUZ-0001', paidOn: '2026-11-01', amount: 22.5 });
    expect(chooseBankMovement({ supplier: 'mobbin', paidOn: '2026-11-01', amount: 22.5, currency: 'USD' },
      [{ id: 'm', bookingDate: '2026-11-03', amount: -20.2, description: 'COMPRA MOBBIN.COM 230002348062982' }], new Set()))
      .toEqual({ kind: 'match', transactionId: 'm' });
  });

  it('reads a Vodafone invoice forwarded from Outlook, dated by the direct debit', () => {
    const result = recognizeInvoiceMail({
      from: 'admin@example.com',
      subject: 'Fw: Faturação Vodafone de 01-07-2026 a 31-07-2026 - Conta: 314842006',
      text: 'From: apoiocliente@vodafone.pt <apoiocliente@vodafone.pt>\nSent: Friday, 07 August 2026\nPeríodo de faturação 01-07-2026 a 31-07-2026 Débito a partir de 21-08-2026',
      date: new Date('2026-08-21T08:00:00Z'),
      dkimDomains: ['example.com'],
      attachments: [
        { filename: 'cid_chart_img_0.png', contentType: 'image/png', content: Buffer.from('png') },
        { filename: 'fatura_20260801.pdf', contentType: 'application/pdf', content: pdf('i') },
        { filename: 'detalhe_fatura_20260801.pdf', contentType: 'application/pdf', content: pdf('d') },
      ],
    }, admins);
    expect(result).toMatchObject({ supplier: 'vodafone', docNumber: '20260801', paidOn: '2026-08-21', amount: null, forwarded: true });
    expect(result?.files.map(file => file.kind)).toEqual(['invoice', 'detail']);
    expect(chooseBankMovement({ supplier: 'vodafone', paidOn: '2026-08-21', amount: null, currency: null },
      [{ id: 'v', bookingDate: '2026-08-21', amount: -21.39, description: 'DD-VODAFONE PORTUGAL-COM. PESS DD2608200023699' }], new Set()))
      .toEqual({ kind: 'match', transactionId: 'v' });
  });

  it('estimates the Vodafone debit when an older email does not say it', () => {
    const result = recognizeInvoiceMail({
      from: 'apoiocliente@vodafone.pt',
      subject: 'Faturação Vodafone de 01-06-2026 a 30-06-2026 - Conta: 314842006',
      text: 'Enviamos, em anexo, o(s) seu(s) documento(s) de faturação de 01-06-2026 a 30-06-2026.',
      date: new Date('2026-07-05T16:31:56Z'),
      dkimDomains: ['vodafone.pt'],
      attachments: [{ filename: 'fatura_20260701.pdf', contentType: 'application/pdf', content: pdf('i') }],
    }, admins);
    expect(result?.paidOn).toBe('2026-07-21');
  });

  it('takes only the Tranquilidade fatura-recibo, not the policy documents', () => {
    const base = { from: 'clienteverde@seguros.tranquilidade.pt', text: '', date: new Date('2026-11-02T09:00:00Z'), dkimDomains: ['seguros.tranquilidade.pt'] };
    expect(recognizeInvoiceMail({
      ...base,
      subject: 'Enviamos os documentos do seu novo seguro Acidentes de Trabalho',
      attachments: [{ filename: 'Aviso_Debito_0011464940_20261030.pdf', contentType: 'application/pdf', content: pdf('a') }],
    }, admins)).toBeNull();
    expect(recognizeInvoiceMail({
      ...base,
      subject: 'Enviamos a fatura-recibo do seu seguro Acidentes de Trabalho',
      attachments: [{ filename: 'Fatura_Recibo_0011464940_20261102.pdf', contentType: 'application/pdf', content: pdf('f') }],
    }, admins)).toMatchObject({ supplier: 'tranquilidade', docNumber: '0011464940_20261102', paidOn: '2026-11-02' });
  });

  it('gives slow direct debits a longer window', () => {
    const debit = [{ id: 't', bookingDate: '2026-11-25', amount: -80, description: 'DD-COMPANHIA DE SEGUROS TRANQUILIDADE' }];
    expect(chooseBankMovement({ supplier: 'tranquilidade', paidOn: '2026-11-02', amount: null, currency: null }, debit, new Set()).kind).toBe('match');
    expect(chooseBankMovement({ supplier: 'railway', paidOn: '2026-11-02', amount: null, currency: null },
      [{ ...debit[0], description: 'COMPRA RAILWAY 1' }], new Set()).kind).toBe('wait');
  });
});

describe('parsers', () => {
  it('reads payment dates and amounts', () => {
    expect(parsePaidOn('Paid on Sep 20, 2026')).toBe('2026-09-20');
    expect(parsePaidOn('nothing here')).toBeNull();
    expect(parseDebitFrom('Débito a partir de 22-09-2026')).toBe('2026-09-22');
    expect(parseAmountPaid('Amount paid $1,020.50')).toEqual({ amount: 1020.5, currency: 'USD' });
    expect(parseAmountPaid('€20.00 has been charged')).toEqual({ amount: 20, currency: 'EUR' });
  });

  it('reads DKIM domains, including folded headers', () => {
    expect(dkimDomainsFromHeaderLines([
      { key: 'dkim-signature', line: 'DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/simple;\r\n\ts=abc; d=Stripe.com; t=1' },
      { key: 'subject', line: 'Subject: d=nope.com' },
    ])).toEqual(['stripe.com']);
  });
});

describe('chooseBankMovement', () => {
  const invoice = { supplier: 'resend' as const, paidOn: '2026-10-20', amount: 20, currency: 'USD' };
  const tx = (id: string, bookingDate: string, amount: number, description = 'COMPRA RESEND 230002328325101') => ({ id, bookingDate, amount, description });

  it('picks the supplier debit a few days after payment', () => {
    expect(chooseBankMovement(invoice, [
      tx('a', '2026-10-23', -17.89),
      tx('b', '2026-10-23', -15.26, 'COMPRA RAILWAY 1'),
      tx('c', '2026-08-29', 1000, 'TR-IPS-Fernando De Resende Sil'),
    ], new Set())).toEqual({ kind: 'match', transactionId: 'a' });
  });

  it('waits while the debit has not arrived or is already taken', () => {
    expect(chooseBankMovement(invoice, [tx('a', '2026-10-19', -17.89)], new Set()).kind).toBe('wait');
    expect(chooseBankMovement(invoice, [tx('a', '2026-10-23', -17.89)], new Set(['a'])).kind).toBe('wait');
  });

  it('does not attach to a debit whose value is implausible', () => {
    expect(chooseBankMovement(invoice, [tx('a', '2026-10-23', -170)], new Set())).toMatchObject({ kind: 'wait', reason: expect.stringContaining('não bate') });
  });

  it('flags two possible debits on the same day', () => {
    expect(chooseBankMovement(invoice, [tx('a', '2026-10-23', -17.89), tx('b', '2026-10-23', -17.5)], new Set()).kind).toBe('ambiguous');
  });
});
