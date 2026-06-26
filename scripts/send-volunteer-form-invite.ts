/**
 * One-off blast: convidar TODOS os membros a entrar na área de membro (auto-login)
 * e preencher o formulário de voluntariado de apoio ao peregrino em Garabandal.
 *
 * O link do email aponta para /api/auth/campaign-login (estável, assinado HMAC) que,
 * ao ser clicado, gera um magic link Supabase fresco e redireciona automaticamente
 * para /member — onde o popup obrigatório do formulário aparece.
 *
 * Uso:
 *   DRY_RUN=1 npx tsx scripts/send-volunteer-form-invite.ts   # não envia; escreve preview
 *   npx tsx scripts/send-volunteer-form-invite.ts             # envio real
 *
 * Opcional:
 *   ONLY_EMAIL=alguem@dominio.com npx tsx scripts/...          # teste de envio a 1 só
 */
import * as fs from 'fs';
import * as path from 'path';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const ONLY_EMAIL = (process.env.ONLY_EMAIL || '').trim().toLowerCase();
const APP_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://apostoladodegarabandal.com').replace(/\/+$/, '');

const SUBJECTS: Record<'pt' | 'en', string> = {
  pt: '🤝 Servir em Garabandal — um convite aos membros',
  en: '🤝 Serve in Garabandal — an invitation to members',
};

const resend = new Resend(process.env.RESEND_API_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ---- From address (mesma lógica de src/lib/email.ts) ----
const rawFrom = (process.env.NOTIFY_EMAIL_FROM || '').trim();
const fromAddress = rawFrom.includes('<')
  ? (rawFrom.match(/<([^>]+)>/)?.[1]?.trim() || 'no-reply@apostoladodegarabandal.com')
  : rawFrom || 'no-reply@apostoladodegarabandal.com';
const FROM = `Apostolado de Garabandal <${fromAddress}>`;

// ---- Unsubscribe token (mirror de src/lib/unsubscribe-token.ts) ----
const unsubSecret = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || 'garabandal-unsubscribe';
const unsubscribeUrl = (email: string) => {
  const e = Buffer.from(email.trim().toLowerCase(), 'utf8').toString('base64url');
  const t = createHmac('sha256', unsubSecret).update(email.trim().toLowerCase()).digest('base64url');
  return `${APP_URL}/api/marketing/unsubscribe?e=${e}&t=${t}`;
};

// ---- Auto-login token (mirror de src/lib/campaign-login-token.ts) ----
const loginSecret = process.env.CAMPAIGN_LOGIN_SECRET || process.env.CRON_SECRET || 'garabandal-campaign-login';
const autoLoginUrl = (email: string) => {
  const norm = email.trim().toLowerCase();
  const e = Buffer.from(norm, 'utf8').toString('base64url');
  const t = createHmac('sha256', loginSecret).update(`campaign-login:${norm}`).digest('base64url');
  return `${APP_URL}/api/auth/campaign-login?e=${e}&t=${t}&next=%2Fmember`;
};

const ENGLISH_COUNTRIES = new Set([
  'united states', 'usa', 'us', 'united kingdom', 'uk', 'gb', 'england', 'ireland', 'ie',
  'canada', 'ca', 'australia', 'au', 'new zealand', 'nz', 'south africa',
]);

const langForCountry = (country?: string | null): 'pt' | 'en' =>
  country && ENGLISH_COUNTRIES.has(country.trim().toLowerCase()) ? 'en' : 'pt';

// ---- Email HTML ----
const buildHtml = (lang: 'pt' | 'en', loginUrl: string, unsubUrl: string, name?: string | null) => {
  const firstName = (name || '').trim().split(/\s+/)[0] || '';
  const T = lang === 'pt'
    ? {
        preheader: 'Entre na sua área de membro e responda ao formulário de voluntariado.',
        eyebrow: 'CONVITE AOS MEMBROS',
        h1: 'Sente a missão de servir em Garabandal?',
        hi: firstName ? `Caro(a) ${firstName},` : 'Caro(a) membro,',
        p1: 'Está disponível na sua área de membro um formulário para todos os que sentem o chamamento de servir em Garabandal como <strong>voluntários de apoio ao peregrino</strong>.',
        p2: 'Quem fizer parte deste grupo restrito terá alojamento na casa do Apostolado e ajudará a:',
        bullets: [
          'Acolher os peregrinos que chegam a Garabandal',
          'Contar a história das aparições',
          'Levar as pessoas aos locais das aparições',
          'Apoiar a paróquia de Garabandal',
        ],
        note: 'Antes de servir, haverá uns dias de <strong>formação específica obrigatória</strong>, e durante o serviço usará o <strong>colete identificativo</strong> do Apostolado.',
        cta: 'Entrar e responder',
        autologin: 'Ao clicar, entra automaticamente na sua área de membro — sem precisar de password. O formulário aparece logo no início.',
        closing: 'Que Nossa Senhora do Carmo o acompanhe.',
        signoff: 'Apostolado de Garabandal',
        unsub: 'Cancelar subscrição',
        trouble: 'Se o botão não funcionar, copie este endereço para o navegador:',
      }
    : {
        preheader: 'Sign in to your member area and complete the volunteer form.',
        eyebrow: 'AN INVITATION TO MEMBERS',
        h1: 'Do you feel called to serve in Garabandal?',
        hi: firstName ? `Dear ${firstName},` : 'Dear member,',
        p1: 'A form is now available in your member area for all who feel called to serve in Garabandal as <strong>pilgrim-support volunteers</strong>.',
        p2: 'Those who join this small group will be hosted at the Apostolate\'s house and will help to:',
        bullets: [
          'Welcome the pilgrims arriving in Garabandal',
          'Share the story of the apparitions',
          'Take people to the apparition sites',
          'Support the Garabandal parish',
        ],
        note: 'Before serving, there will be a few days of <strong>mandatory specific training</strong>, and during service you will wear the Apostolate\'s <strong>identifying vest</strong>.',
        cta: 'Sign in and reply',
        autologin: 'Clicking signs you in to your member area automatically — no password needed. The form appears right away.',
        closing: 'May Our Lady of Mount Carmel be with you.',
        signoff: 'Garabandal Apostolate',
        unsub: 'Unsubscribe',
        trouble: 'If the button does not work, copy this address into your browser:',
      };

  const bullets = T.bullets
    .map(
      (b) => `<tr><td style="padding:5px 0;vertical-align:top;width:26px;color:#0f4c81;font-size:16px;line-height:24px;">✦</td><td style="padding:5px 0;color:#334155;font-size:15px;line-height:24px;">${b}</td></tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="${lang === 'pt' ? 'pt-PT' : 'en'}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<title>${T.h1}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${T.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f8;padding:28px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 36px rgba(15,76,129,0.14);">
    <!-- Header -->
    <tr><td style="background:linear-gradient(135deg,#0f4c81,#1d6fb8);padding:34px 34px 30px;">
      <div style="color:#bcd6ef;font-size:12px;letter-spacing:1.5px;font-weight:700;">${T.eyebrow}</div>
      <div style="color:#ffffff;font-size:25px;line-height:1.25;font-weight:800;margin-top:10px;">${T.h1}</div>
    </td></tr>
    <!-- Body -->
    <tr><td style="padding:30px 34px 6px;">
      <p style="margin:0 0 16px;color:#0f172a;font-size:16px;font-weight:700;">${T.hi}</p>
      <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:25px;">${T.p1}</p>
      <p style="margin:0 0 12px;color:#334155;font-size:15px;line-height:25px;">${T.p2}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">${bullets}</table>
      <div style="background:#f1f6fc;border-left:4px solid #0f4c81;border-radius:10px;padding:14px 16px;margin:0 0 26px;">
        <p style="margin:0;color:#1e3a5f;font-size:14px;line-height:23px;">${T.note}</p>
      </div>
    </td></tr>
    <!-- CTA -->
    <tr><td align="center" style="padding:0 34px 10px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="border-radius:14px;background:#0f4c81;">
        <a href="${loginUrl}" style="display:inline-block;padding:16px 38px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:14px;">${T.cta} &rarr;</a>
      </td></tr></table>
      <p style="margin:14px 0 0;color:#64748b;font-size:12.5px;line-height:20px;max-width:420px;">${T.autologin}</p>
    </td></tr>
    <!-- Closing -->
    <tr><td style="padding:24px 34px 8px;">
      <p style="margin:0 0 4px;color:#334155;font-size:15px;line-height:24px;">${T.closing}</p>
      <p style="margin:0;color:#0f4c81;font-size:15px;font-weight:700;">${T.signoff}</p>
    </td></tr>
    <!-- Fallback link -->
    <tr><td style="padding:14px 34px 0;">
      <p style="margin:0;color:#94a3b8;font-size:11.5px;line-height:18px;">${T.trouble}<br/>
      <a href="${loginUrl}" style="color:#0f4c81;word-break:break-all;">${loginUrl}</a></p>
    </td></tr>
    <!-- Footer -->
    <tr><td style="padding:22px 34px 28px;border-top:1px solid #eef2f8;margin-top:12px;">
      <p style="margin:0;color:#9aa7b8;font-size:11.5px;line-height:18px;text-align:center;">
        Apostolado de Garabandal · apostoladodegarabandal.com<br/>
        <a href="${unsubUrl}" style="color:#9aa7b8;text-decoration:underline;">${T.unsub}</a>
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Todos os membros com email real.
  const { data, error } = await supabase
    .from('membros')
    .select('id, email, nome, country, is_membro')
    .not('email', 'is', null);
  if (error) throw error;

  const seen = new Set<string>();
  let recipients = (data || [])
    .map((m) => ({
      id: m.id as string,
      email: (m.email || '').trim().toLowerCase(),
      nome: (m.nome as string | null) || null,
      lang: langForCountry(m.country as string | null),
    }))
    .filter((m) => m.email.includes('@') && !m.email.endsWith('@sem-email.local'))
    .filter((m) => (seen.has(m.email) ? false : (seen.add(m.email), true)));

  if (ONLY_EMAIL) recipients = recipients.filter((r) => r.email === ONLY_EMAIL);

  const ptCount = recipients.filter((r) => r.lang === 'pt').length;
  const enCount = recipients.filter((r) => r.lang === 'en').length;

  console.log(`\n=== Convite voluntariado ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'} ===`);
  console.log(`From: ${FROM}`);
  console.log(`App URL: ${APP_URL}`);
  console.log(`Destinatários: ${recipients.length}  (pt: ${ptCount}, en: ${enCount})`);
  console.log(`Assuntos:\n  pt: ${SUBJECTS.pt}\n  en: ${SUBJECTS.en}\n`);

  if (DRY_RUN) {
    // Email fixo de exemplo — nunca um destinatário real (o preview não deve conter um token de login válido).
    const sampleEmail = 'exemplo@apostoladodegarabandal.com';
    fs.writeFileSync('emails/_preview-volunteer-pt.html', buildHtml('pt', autoLoginUrl(sampleEmail), unsubscribeUrl(sampleEmail), 'Maria'));
    fs.writeFileSync('emails/_preview-volunteer-en.html', buildHtml('en', autoLoginUrl(sampleEmail), unsubscribeUrl(sampleEmail), 'John'));
    console.log('Escrito emails/_preview-volunteer-pt.html e emails/_preview-volunteer-en.html para inspeção.');
    console.log(`Exemplo de link de auto-login: ${autoLoginUrl(sampleEmail)}`);
    return;
  }

  let ok = 0, fail = 0;
  for (const [i, r] of recipients.entries()) {
    const subject = SUBJECTS[r.lang];
    const html = buildHtml(r.lang, autoLoginUrl(r.email), unsubscribeUrl(r.email), r.nome);
    try {
      const { data: sent, error: sendErr } = await resend.emails.send({
        from: FROM,
        to: [r.email],
        subject,
        html,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl(r.email)}>, <mailto:geral@apostoladodegarabandal.com?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      if (sendErr) throw new Error(JSON.stringify(sendErr));
      ok++;
      console.log(`[${i + 1}/${recipients.length}] ✓ ${r.lang} ${r.email}`);
    } catch (e: any) {
      fail++;
      console.error(`[${i + 1}/${recipients.length}] ✗ ${r.email}: ${e.message}`);
    }
    await sleep(550); // ~2/seg, respeita o rate limit do Resend
  }

  console.log(`\n=== Concluído. Enviados: ${ok}, Falhados: ${fail} ===`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
