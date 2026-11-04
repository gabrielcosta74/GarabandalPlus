/**
 * Enable Banking redirect target (Banco Montepio, Account Information).
 *
 * After the admin authorises access in the bank, Enable Banking sends the
 * browser here with `?code=…&state=…`. This route only SHOWS the code so it can
 * be pasted into `scripts/enable-banking.ts connect`, which exchanges it locally
 * with the application's private key. Nothing is stored and no secret is used
 * here: the code is single-use and worthless without that private key.
 *
 * It is a route handler (not a page) on purpose: pages load AuthLandingGuard,
 * which treats any `?code=` as a Supabase login and redirects it away.
 */

export const dynamic = 'force-dynamic';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');
  const fullUrl = escapeHtml(url.toString());

  const body = error
    ? `<h1>O banco não autorizou</h1><p>${escapeHtml(error)}${errorDescription ? ` — ${escapeHtml(errorDescription)}` : ''}</p><p>Pode fechar esta página e tentar de novo.</p>`
    : code
      ? `<h1>Autorização recebida</h1>
         <p>Copie o endereço abaixo e cole-o no terminal onde está a correr o script de ligação.</p>
         <textarea readonly rows="4" onclick="this.select()">${fullUrl}</textarea>
         <button type="button" onclick="navigator.clipboard.writeText(document.querySelector('textarea').value);this.textContent='Copiado'">Copiar endereço</button>
         <p class="note">O código só pode ser usado uma vez e expira em poucos minutos.</p>`
      : '<h1>Nada para mostrar</h1><p>Esta página só é usada na ligação ao banco.</p>';

  const html = `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Ligação ao Montepio</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background: #f6f7f9; color: #18181b; margin: 0; padding: 48px 20px; }
  main { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 20px; padding: 32px; box-shadow: 0 1px 2px rgba(16,24,40,.06); border: 1px solid #eceef1; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { color: #52525b; line-height: 1.5; font-size: 15px; }
  textarea { width: 100%; box-sizing: border-box; font: 13px ui-monospace, monospace; padding: 12px; border-radius: 12px; border: 1px solid #e4e4e7; background: #fafafa; resize: none; }
  button { margin-top: 12px; height: 40px; padding: 0 16px; border: 0; border-radius: 12px; background: #059669; color: #fff; font-weight: 600; font-size: 14px; cursor: pointer; }
  button:hover { background: #10b981; }
  .note { font-size: 13px; color: #a1a1aa; }
</style>
</head>
<body><main>${body}</main></body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
