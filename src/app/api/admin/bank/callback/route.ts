import { randomBytes } from 'node:crypto';

/** Enable Banking redirects here after the admin approves access at Montepio.
 * The authorization code is only exchanged by the local CLI with the private key.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');
  const nonce = randomBytes(16).toString('base64');

  // Only the parameters needed by the CLI are included in the copyable URL.
  const callbackUrl = new URL('/api/admin/bank/callback', url.origin);
  if (code) callbackUrl.searchParams.set('code', code);
  if (state) callbackUrl.searchParams.set('state', state);

  const content = error
    ? `<h1>O banco não autorizou</h1><p>${escapeHtml(error.slice(0, 200))}${errorDescription ? ` — ${escapeHtml(errorDescription.slice(0, 300))}` : ''}</p><p>Pode fechar esta página e tentar de novo.</p>`
    : code && state && code.length <= 4096 && state.length <= 256
      ? `<h1>Autorização recebida</h1><p>Copie o endereço abaixo e cole-o no terminal onde iniciou a ligação.</p><textarea readonly rows="4" aria-label="Endereço de autorização">${escapeHtml(callbackUrl.toString())}</textarea><p class="note">O código é temporário e só pode ser usado uma vez. Não partilhe este endereço.</p>`
      : '<h1>Ligação indisponível</h1><p>Não foi recebido um código de autorização válido. Inicie uma nova ligação.</p>';

  const html = `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer"><title>Ligação ao Montepio</title><style nonce="${nonce}">body{font-family:system-ui,sans-serif;background:#f6f7f9;color:#18181b;margin:0;padding:48px 20px}main{max-width:560px;margin:auto;background:#fff;border:1px solid #eceef1;border-radius:20px;padding:32px}h1{font-size:20px}p{color:#52525b;line-height:1.5}textarea{width:100%;box-sizing:border-box;overflow-wrap:anywhere;font:13px ui-monospace,monospace;padding:12px;border:1px solid #e4e4e7;border-radius:12px;background:#fafafa}.note{font-size:13px;color:#71717a}</style></head><body><main>${content}</main></body></html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, private',
      'Content-Security-Policy': `default-src 'none'; style-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}
