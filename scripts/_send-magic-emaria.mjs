import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Minimal .env loader (dotenv not installed)
function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}

const env = loadEnv(new URL('../.env', import.meta.url).pathname);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const resendKey = env.RESEND_API_KEY;
const fromAddr = (env.NOTIFY_EMAIL_FROM || 'no-reply@apostoladodegarabandal.com').trim();
const from = `Apostolado de Garabandal <${fromAddr}>`;

const TARGET_EMAIL = 'emariacaldeira@hotmail.com';
const REDIRECT_TO = 'https://apostoladodegarabandal.com/auth-callback?next=/member';

const supabase = createClient(supabaseUrl, serviceKey);
const resend = new Resend(resendKey);

async function main() {
  console.log('Generating magic link for', TARGET_EMAIL, '...');

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: TARGET_EMAIL,
    options: { redirectTo: REDIRECT_TO },
  });

  if (error || !data?.properties?.action_link) {
    console.error('FAILED to generate magic link:', error?.message || error || 'no action_link');
    process.exit(1);
  }

  const magicLink = data.properties.action_link;
  console.log('Magic link generated OK.');

  // Same template/copy as src/lib/email.ts -> sendAuthMagicLinkEmail
  const html = `
      <div style="font-family: Inter, Arial, sans-serif; color: #0f172a; line-height: 1.6;">
        <h2 style="margin: 0 0 12px;">Acesso à sua conta</h2>
        <p style="margin: 0 0 16px;">Clique no botão abaixo para entrar em segurança.</p>
        <p style="margin: 0 0 24px;">
          <a href="${magicLink}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#ca8a04;color:#fff;text-decoration:none;font-weight:700;">
            Entrar na conta
          </a>
        </p>
        <p style="margin: 0; color: #475569; font-size: 13px;">
          Se não solicitou este acesso, pode ignorar este email.
        </p>
      </div>
    `;

  console.log('Sending email via Resend from', from, '...');
  const res = await resend.emails.send({
    from,
    to: [TARGET_EMAIL],
    subject: 'Link de acesso à sua conta',
    html,
  });

  if (res.error) {
    console.error('Resend FAILED:', res.error);
    process.exit(1);
  }
  console.log('SUCCESS. Email sent. Resend id:', res.data?.id);
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
