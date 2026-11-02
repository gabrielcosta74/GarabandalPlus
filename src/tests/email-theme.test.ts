import { describe, expect, it } from 'vitest';
import { EMAIL_THEME } from '../lib/email/theme';
import {
  MARKETING_EMAIL_TEMPLATES,
  renderAuthMagicLinkEmail,
  renderMarketingTemplateEmail,
  renderMemberReceiptEmail,
  renderQuotaReminderEmail,
} from '../lib/email-renderer';

// Cores do tema antigo (dourado/âmbar) que não podem voltar aos emails.
const OLD_GOLD = /#d4af37|#ca8a04|#c49a2a|#fefce8|#1a1407/i;

const templates = Object.values(MARKETING_EMAIL_TEMPLATES) as Array<{ key: string }>;

describe('email theme (blue brand)', () => {
  it('mirrors the site brand blue', () => {
    expect(EMAIL_THEME.brand).toBe('#3563e9');
  });

  it.each(['pt', 'en'] as const)('renders every marketing template in %s with the brand blue and no old gold', (language) => {
    for (const template of templates) {
      const { html } = renderMarketingTemplateEmail({ templateKey: template.key as any, name: 'Maria', language, unsubscribeUrl: 'https://x.pt/u' } as any);
      expect(html, `${template.key}/${language}`).not.toMatch(OLD_GOLD);
      expect(html, `${template.key}/${language}`).toContain(EMAIL_THEME.brand);
    }
  });

  it('keeps transactional emails on the blue brand too', () => {
    const emails = [
      renderQuotaReminderEmail({ toEmail: 'a@b.pt', memberName: 'Maria', nextQuotaDate: '2027-01-31', daysUntilDue: 7, locale: 'pt' } as any),
      renderMemberReceiptEmail({ toEmail: 'a@b.pt', memberName: 'Maria', amount: 25, currency: 'EUR', locale: 'pt' } as any),
      renderAuthMagicLinkEmail({ magicLink: 'https://x.pt/m', locale: 'pt' }),
    ];
    for (const { html } of emails) {
      expect(html).not.toMatch(OLD_GOLD);
      expect(html).toContain(EMAIL_THEME.brand);
    }
  });

  it('lays out info rows as tables, not flex (Outlook ignores display:flex)', () => {
    const { html } = renderQuotaReminderEmail({ toEmail: 'a@b.pt', memberName: 'Maria', nextQuotaDate: '2027-01-31', daysUntilDue: 7, locale: 'pt' } as any);
    expect(html).not.toContain('display:flex');
  });

  it('uses a clean header (no hero photo) unless an image is given', () => {
    const { html } = renderMarketingTemplateEmail({ templateKey: 'member_welcome', name: 'Maria', language: 'pt' } as any);
    expect(html).not.toContain('nossasenhoragarabandal.jpg');
  });
});
