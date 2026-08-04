import { describe, expect, it } from 'vitest';

import { renderFactPtFiscalDocumentEmail } from '../lib/email-renderer';

describe('FACT.pt fiscal document email', () => {
  it('uses the Apostolado template without exposing a FACT.pt link', () => {
    const email = renderFactPtFiscalDocumentEmail({
      sandbox: true,
      recipientName: 'Responsável da reserva',
      documentNumber: 'FR 2026D/3',
      documentLabel: 'Fatura-Recibo',
      sourceLabel: 'Peregrinação de novembro — Prestação',
    });

    expect(email.subject).toBe(
      '[SANDBOX] Fatura-Recibo FR 2026D/3 — Peregrinação de novembro — Prestação',
    );
    expect(email.html).toContain('Apostolado de Garabandal');
    expect(email.html).toContain('A sua Fatura-Recibo');
    expect(email.html).toContain('Peregrinação de novembro — Prestação');
    expect(email.html).toContain('O PDF oficial segue em anexo');
    expect(email.html).toContain('SANDBOX — TESTE SEM VALOR FISCAL');
    expect(email.html).not.toContain('Abrir documento na FACT.pt');
    expect(email.html).not.toContain('fact.pt');
  });

  it('renders production without a sandbox label or FACT.pt link', () => {
    const email = renderFactPtFiscalDocumentEmail({
      sandbox: false,
      recipientName: 'Titular da reserva',
      documentNumber: 'FR 2026D/1',
      documentLabel: 'Fatura-Recibo',
      sourceLabel: 'Peregrinação 2026D — Sinal',
    });

    expect(email.subject).toBe(
      'Fatura-Recibo FR 2026D/1 — Peregrinação 2026D — Sinal',
    );
    expect(email.html).toContain('Titular da reserva');
    expect(email.html).toContain('referente a <strong>Peregrinação 2026D — Sinal</strong>');
    expect(email.html).not.toContain('SANDBOX');
    expect(email.html).not.toContain('fact.pt');
  });

  it('renders the email in English while keeping the attached fiscal document independent', () => {
    const email = renderFactPtFiscalDocumentEmail({
      sandbox: false,
      recipientName: 'Cynthia Londo',
      documentNumber: 'FR 2026D/900',
      documentLabel: 'Fatura-Recibo',
      sourceLabel: 'Peregrinação a Itália e Medjugorje - Abril 2027 — Prestação',
      locale: 'en',
    });

    expect(email.subject).toBe(
      'Invoice-Receipt FR 2026D/900 — Pilgrimage to Italy and Medjugorje - April 2027 — Installment',
    );
    expect(email.html).toContain('Hello <strong>Cynthia Londo</strong>');
    expect(email.html).toContain('The official PDF is attached');
    expect(email.html).toContain('No further action is required');
    expect(email.html).not.toContain('O PDF oficial segue em anexo');
  });
});
