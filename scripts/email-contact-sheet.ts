/**
 * Folha de contactos dos emails: gera o HTML de todos os templates de marketing (PT/EN) e
 * dos principais emails transacionais, mais um index.html com tudo em grelha, para rever o
 * aspeto no browser antes de qualquer envio. Não envia nada.
 *
 * Uso: npx tsx scripts/email-contact-sheet.ts <pasta-de-saida>
 *      (depois abrir <pasta>/index.html, ou servir a pasta com um servidor estático)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

process.env.APP_URL = (process.env.APP_URL || 'https://apostoladodegarabandal.com').replace(/\/+$/, '');

async function main() {
  const out = resolve(process.argv[2] || 'emails/_contact-sheet');
  mkdirSync(out, { recursive: true });
  const r = await import('../src/lib/email-renderer');
  const APP = process.env.APP_URL!;
  const items: Array<{ id: string; label: string; group: string; html: string; subject: string }> = [];

  const add = (group: string, id: string, label: string, make: () => { subject: string; html: string }) => {
    try {
      const { subject, html } = make();
      items.push({ id, label, group, html, subject });
    } catch (error) {
      console.warn(`  ! ${id}: ${(error as Error).message}`);
    }
  };

  for (const language of ['pt', 'en'] as const) {
    for (const template of Object.values(r.MARKETING_EMAIL_TEMPLATES) as Array<{ key: string; name: string }>) {
      add(`Marketing ${language.toUpperCase()}`, `mk-${template.key}-${language}`, `${template.name} (${template.key})`, () =>
        r.renderMarketingTemplateEmail({
          templateKey: template.key as any,
          name: 'Maria Silva',
          language,
          unsubscribeUrl: `${APP}/cancelar-subscricao?e=x&t=y`,
          pilgrimageName: 'Caminho Mariano 2027',
          pilgrimageUrl: `${APP}/peregrinacoes/peregrinacao-mariana-2027`,
          pilgrimageVacancies: 12,
        } as any),
      );
    }
  }

  const locale = 'pt' as const;
  add('Transacionais', 'tx-quota', 'Lembrete de quota', () => r.renderQuotaReminderEmail({ toEmail: 'a@b.pt', memberName: 'Maria Silva', memberNumber: '123', nextQuotaDate: '2027-01-31', membershipUrl: `${APP}/member/quota`, daysUntilDue: 7, locale } as any));
  add('Transacionais', 'tx-receipt', 'Recibo de membro', () => r.renderMemberReceiptEmail({ toEmail: 'a@b.pt', memberName: 'Maria Silva', memberNumber: '123', amount: 25, currency: 'EUR', hasDiploma: true, locale } as any));
  add('Transacionais', 'tx-donation', 'Recibo de donativo', () => r.renderDonationReceiptEmail({ toEmail: 'a@b.pt', donorName: 'Maria Silva', amount: 50, currency: 'EUR', locale } as any));
  add('Transacionais', 'tx-magic', 'Link de acesso', () => r.renderAuthMagicLinkEmail({ magicLink: `${APP}/auth/x`, locale }));
  add('Transacionais', 'tx-recovery', 'Recuperar palavra-passe', () => r.renderAuthRecoveryEmail({ recoveryLink: `${APP}/auth/r`, codeEntryLink: `${APP}/auth/c`, otpCode: '123456', locale } as any));
  add('Transacionais', 'tx-booking-access', 'Acesso à inscrição', () => r.renderBookingAccessLinkEmail({ accessLink: `${APP}/a`, directAccessLink: `${APP}/b`, pilgrimageName: 'Caminho Mariano 2027', locale }));
  add('Transacionais', 'tx-pay-reminder', 'Lembrete de pagamento (peregrinação)', () => r.renderPilgrimagePaymentReminderEmail({ toEmail: 'a@b.pt', recipientName: 'Maria Silva', pilgrimageName: 'Caminho Mariano 2027', obligationLabel: '1.ª prestação', dueDate: '2026-12-10', amountDue: 450, totalRemaining: 1800, bookingUrl: `${APP}/peregrinacoes/inscricao/1`, stage: 'upcoming_3d', locale } as any));
  add('Transacionais', 'tx-revoked', 'Adesão terminada', () => r.renderMembershipRevokedEmail({ name: 'Maria Silva', payLink: `${APP}/member/quota`, locale }));
  add('Transacionais', 'tx-preparing', 'Pedido em preparação', () => r.renderStorePreparingEmail({ orderRef: 'A123', buyerName: 'Maria Silva' }));
  add('Transacionais', 'tx-welcome', 'Boas-vindas', () => r.renderWelcomeEmail({ name: 'Maria Silva', email: 'a@b.pt' } as any));
  add('Transacionais', 'tx-lead', 'Lead geral', () => r.renderGeneralLeadEmail({ name: 'Maria', email: 'a@b.pt', locale } as any));

  const rows: string[] = [];
  let group = '';
  for (const item of items) {
    writeFileSync(join(out, `${item.id}.html`), item.html);
    if (item.group !== group) {
      group = item.group;
      rows.push(`<h2>${group}</h2>`);
    }
    rows.push(`<figure><figcaption><a href="${item.id}.html" target="_blank">${item.label}</a><br><small>${item.subject.replace(/</g, '&lt;')}</small></figcaption><div class="frame"><iframe src="${item.id}.html" loading="lazy" scrolling="no"></iframe></div></figure>`);
  }
  writeFileSync(
    join(out, 'index.html'),
    `<!doctype html><meta charset="utf-8"><title>Folha de contactos — emails</title><style>
body{font-family:Inter,system-ui,sans-serif;margin:24px;background:#f4f6fa;color:#0f1b33}h2{margin:32px 0 12px}
.grid{display:flex;flex-wrap:wrap;gap:24px}figure{margin:0;width:330px}figcaption{font-size:13px;margin-bottom:6px;line-height:1.35}
.frame{width:330px;height:560px;overflow:hidden;border:1px solid #e2e7f0;border-radius:8px;background:#fff}
iframe{width:660px;height:1120px;border:0;transform:scale(.5);transform-origin:0 0}</style>
<h1>Folha de contactos — ${items.length} emails</h1><div class="grid-wrap">${rows.join('\n').replace(/<h2>/g, '</div><h2>').replace(/<\/h2>/g, '</h2><div class="grid">') + '</div>'}</div>`,
  );
  console.log(`${items.length} emails em ${out}/index.html`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
