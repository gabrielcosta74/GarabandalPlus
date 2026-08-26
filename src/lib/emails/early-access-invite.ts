import { APP_URL, resolveAuthPublicUrl } from '../config';

/**
 * Base URL for every link in this email.
 *
 * `APP_URL` legitimately resolves to `http://localhost:3000` in development, but
 * a marketing email that ships a loopback URL is dead on arrival in the
 * recipient's inbox. `resolveAuthPublicUrl` drops local URLs and falls back to
 * the canonical production domain, so a campaign dispatched from a local shell
 * still links to apostoladodegarabandal.com.
 */
const EMAIL_BASE_URL = resolveAuthPublicUrl(APP_URL);

/* -------------------------------------------------------------------------- */
/*                         Early-access invite email                          */
/*                                                                            */
/*  Premium, dark, gold-accented invite that mirrors the /acesso-antecipado   */
/*  landing page. PT copy is PT-BR (audience is majority Brazilian); EN copy   */
/*  mirrors the English landing page.                                          */
/* -------------------------------------------------------------------------- */

export type EarlyAccessInviteLocale = 'pt' | 'en';

export type EarlyAccessInviteInput = {
  /** Language of the email. Defaults to 'pt'. */
  locale?: EarlyAccessInviteLocale;
  /** First name of the invited person (optional). */
  recipientName?: string | null;
  /** CTA destination. Defaults to the early-access landing page for the locale. */
  ctaUrl?: string;
  /** Privacy link shown in the footer. */
  privacyUrl?: string;
  /**
   * Per-recipient unsubscribe link. Required for bulk marketing sends: the
   * footer only renders the opt-out when this is supplied, so a one-off
   * transactional render stays clean while a campaign stays GDPR-compliant.
   */
  unsubscribeUrl?: string;
};

const GOLD = '#d4bc7d';
const GOLD_BRIGHT = '#f0cc70';
const GOLD_SOFT = '#e0c37b';
const BG = '#080808';
const CARD = '#0e0e0e';
const INK = '#f4f1e9';

type InviteCopy = {
  htmlLang: string;
  subject: string;
  preheader: string;
  eyebrow: string;
  greeting: (name: string) => string;
  invitedLine: string;
  stats: Array<{ value: string; label: string }>;
  accessLine: string;
  dateAccess: { value: string; label: string };
  datePublic: { value: string; label: string };
  cta: string;
  scarcity: string;
  missionNote: string;
  privacy: string;
  unsubscribe: string;
  defaultPath: string;
  privacyPath: string;
};

const COPY: Record<EarlyAccessInviteLocale, InviteCopy> = {
  pt: {
    htmlLang: 'pt',
    subject: 'Seu convite VIP — Caminho Mariano 2027',
    preheader:
      'A lista privada recebe acesso às inscrições a 13 de outubro — 48h antes da abertura pública.',
    eyebrow: 'Acesso VIP · por convite',
    greeting: (name) => (name ? `Olá, ${name}.` : 'Olá.'),
    invitedLine: `<strong style="color:${INK};font-weight:600;">O Apostolado de Garabandal</strong> convidou você para a lista privada do`,
    stats: [
      { value: '14', label: 'dias' },
      { value: '3', label: 'países' },
      { value: '13', label: 'santuários' },
    ],
    accessLine: `A lista privada recebe acesso às inscrições a <strong style="color:${INK};font-weight:600;">13 de outubro</strong> — <strong style="color:${GOLD_SOFT};font-weight:600;">48 horas antes</strong> da abertura pública, a 15 de outubro.`,
    dateAccess: { value: '13 Out', label: 'Seu acesso' },
    datePublic: { value: '15 Out', label: 'Abertura pública' },
    cta: 'Garantir o meu acesso',
    scarcity: 'Vagas limitadas · altamente procurado',
    missionNote:
      'O Apostolado de Garabandal é uma Associação sem fins lucrativos. As doações desta peregrinação revertem para as obras da Casa do Apostolado.',
    privacy: 'Privacidade',
    unsubscribe: 'Cancelar subscrição',
    defaultPath: '/acesso-antecipado',
    privacyPath: '/privacidade',
  },
  en: {
    htmlLang: 'en',
    subject: 'Your VIP invitation — Marian Way 2027',
    preheader:
      'The private list gets access to registration on 13 October — 48h before the public opening.',
    eyebrow: 'VIP access · by invitation',
    greeting: (name) => (name ? `Hello, ${name}.` : 'Hello.'),
    invitedLine: `<strong style="color:${INK};font-weight:600;">The Apostolate of Garabandal</strong> has invited you to the private list of the`,
    stats: [
      { value: '14', label: 'days' },
      { value: '3', label: 'countries' },
      { value: '13', label: 'sanctuaries' },
    ],
    accessLine: `The private list gets access to registration on <strong style="color:${INK};font-weight:600;">13 October</strong> — <strong style="color:${GOLD_SOFT};font-weight:600;">48 hours before</strong> the public opening, on 15 October.`,
    dateAccess: { value: '13 Oct', label: 'Your access' },
    datePublic: { value: '15 Oct', label: 'Public opening' },
    cta: 'Secure my access',
    scarcity: 'Limited places · highly sought after',
    missionNote:
      'The Apostolate of Garabandal is a non-profit association. Donations from this pilgrimage support the works of the House of the Apostolate.',
    privacy: 'Privacy',
    unsubscribe: 'Unsubscribe',
    defaultPath: '/en/early-access',
    privacyPath: '/en/privacy',
  },
};

const TITLE = 'Caminho Mariano 2027';
const TITLE_EN = 'Marian Way 2027';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderEarlyAccessInviteEmail(
  input: EarlyAccessInviteInput = {},
): { subject: string; html: string } {
  const locale: EarlyAccessInviteLocale = input.locale === 'en' ? 'en' : 'pt';
  const c = COPY[locale];
  const ctaUrl = input.ctaUrl || `${EMAIL_BASE_URL}${c.defaultPath}`;
  const privacyUrl = input.privacyUrl || `${EMAIL_BASE_URL}${c.privacyPath}`;
  const unsubscribeUrl = input.unsubscribeUrl || '';
  const recipient = (input.recipientName || '').trim();
  const scriptTitle = locale === 'en' ? TITLE_EN : TITLE;

  const greeting = c.greeting(recipient ? esc(recipient) : '');
  const subject = c.subject;

  const statsCells = c.stats
    .map(
      (s) => `
              <td align="center" style="padding:0 14px;">
                <div style="font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:44px;line-height:1;color:${GOLD_BRIGHT};font-weight:600;">${s.value}</div>
                <div style="margin-top:8px;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.42);">${s.label}</div>
              </td>`,
    )
    .join('');

  const goldLine = `
              <table role="presentation" width="64" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                <tr><td height="1" style="height:1px;line-height:1px;font-size:0;background:${GOLD};opacity:0.55;">&nbsp;</td></tr>
              </table>`;

  const html = `<!DOCTYPE html>
<html lang="${c.htmlLang}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${subject}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <link href="https://fonts.googleapis.com/css2?family=Allura&family=Cormorant+Garamond:wght@500;600&display=swap" rel="stylesheet">
  <style>
    :root { color-scheme: dark; supported-color-schemes: dark; }
    html, body { margin:0 !important; padding:0 !important; height:100% !important; width:100% !important; background:${BG} !important; }
    * { -ms-text-size-adjust:100%; -webkit-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt !important; mso-table-rspace:0pt !important; border-collapse:collapse !important; }
    img { -ms-interpolation-mode:bicubic; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
    a { text-decoration:none; }
    .cta:hover { background:${GOLD_BRIGHT} !important; }
    @media only screen and (max-width:620px) {
      .container { width:100% !important; }
      .px { padding-left:24px !important; padding-right:24px !important; }
      .script { font-size:52px !important; line-height:56px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${BG};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${BG};">
    ${c.preheader}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};">
    <tr>
      <td align="center" style="padding:40px 12px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${CARD};border:1px solid rgba(212,188,125,0.14);border-radius:20px;overflow:hidden;">

          <!-- Hero -->
          <tr>
            <td class="px" align="center" style="padding:56px 48px 40px 48px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:5px;text-transform:uppercase;color:${GOLD};">${c.eyebrow}</div>

              <div class="script" style="margin:26px 0 0 0;font-family:'Allura','Snell Roundhand','Brush Script MT',cursive;font-size:66px;line-height:70px;color:${INK};">${scriptTitle}</div>

              <div style="margin:30px auto 0 auto;">${goldLine}</div>

              <p style="margin:28px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:28px;color:rgba(255,255,255,0.62);">
                ${greeting}<br>
                ${c.invitedLine} <span style="color:${GOLD_SOFT};">${scriptTitle}</span>.
              </p>
            </td>
          </tr>

          <!-- Stats -->
          <tr>
            <td class="px" align="center" style="padding:8px 48px 8px 48px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>${statsCells}</tr>
              </table>
            </td>
          </tr>

          <!-- Access explanation -->
          <tr>
            <td class="px" align="center" style="padding:36px 48px 0 48px;">
              ${goldLine}
              <p style="margin:28px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:27px;color:rgba(255,255,255,0.58);">
                ${c.accessLine}
              </p>
            </td>
          </tr>

          <!-- Dates -->
          <tr>
            <td class="px" align="center" style="padding:28px 48px 0 48px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td align="center" style="padding:0 20px;">
                    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:30px;line-height:1;color:${GOLD_BRIGHT};font-weight:600;">${c.dateAccess.value}</div>
                    <div style="margin-top:8px;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(224,195,123,0.7);">${c.dateAccess.label}</div>
                  </td>
                  <td align="center" style="color:rgba(255,255,255,0.2);font-size:18px;">·</td>
                  <td align="center" style="padding:0 20px;">
                    <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:30px;line-height:1;color:rgba(255,255,255,0.5);font-weight:600;">${c.datePublic.value}</div>
                    <div style="margin-top:8px;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.3);">${c.datePublic.label}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td class="px" align="center" style="padding:40px 48px 8px 48px;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${ctaUrl}" style="height:52px;v-text-anchor:middle;width:280px;" arcsize="50%" fillcolor="${GOLD}" stroke="f">
                <w:anchorlock/>
                <center style="color:#1a1306;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:2px;">${c.cta.toUpperCase()}</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-- -->
              <a class="cta" href="${ctaUrl}" style="display:inline-block;background:${GOLD};color:#1a1306;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:17px 40px;border-radius:40px;">${c.cta}</a>
              <!--<![endif]-->
            </td>
          </tr>

          <!-- Scarcity -->
          <tr>
            <td class="px" align="center" style="padding:22px 48px 0 48px;">
              <span style="font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#f4a361;">${c.scarcity}</span>
            </td>
          </tr>

          <!-- Mission note -->
          <tr>
            <td class="px" align="center" style="padding:34px 48px 0 48px;">
              ${goldLine}
              <p style="margin:26px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:22px;color:rgba(255,255,255,0.4);">
                ${c.missionNote}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="px" align="center" style="padding:36px 48px 44px 48px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.32);">Apostolado de Garabandal</div>
              <div style="margin-top:10px;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.28);">
                <a href="${privacyUrl}" style="color:rgba(255,255,255,0.4);text-decoration:underline;">${c.privacy}</a>${
                  unsubscribeUrl
                    ? `<span style="color:rgba(255,255,255,0.2);"> &nbsp;·&nbsp; </span><a href="${unsubscribeUrl}" style="color:rgba(255,255,255,0.4);text-decoration:underline;">${c.unsubscribe}</a>`
                    : ''
                }
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
