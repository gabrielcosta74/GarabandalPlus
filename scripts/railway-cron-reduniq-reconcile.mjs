const rawBaseUrl =
  process.env.CRON_TARGET_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  process.env.RAILWAY_PUBLIC_DOMAIN ||
  '';

const cronSecret = process.env.CRON_SECRET || '';

function normalizeBaseUrl(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

const baseUrl = normalizeBaseUrl(rawBaseUrl);

if (!baseUrl) {
  console.error('[railway-cron-reduniq-reconcile] Missing CRON_TARGET_URL, NEXT_PUBLIC_APP_URL, APP_URL, or RAILWAY_PUBLIC_DOMAIN.');
  process.exit(1);
}

if (!cronSecret) {
  console.error('[railway-cron-reduniq-reconcile] Missing CRON_SECRET.');
  process.exit(1);
}

const url = new URL('/api/cron/reduniq-reconcile', baseUrl);
url.searchParams.set('windowDays', process.env.REDUNIQ_RECONCILE_WINDOW_DAYS || '7');
url.searchParams.set('minAgeMinutes', process.env.REDUNIQ_RECONCILE_MIN_AGE_MINUTES || '30');

const startedAt = Date.now();
const response = await fetch(url, {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${cronSecret}`,
    Accept: 'application/json',
  },
});

const bodyText = await response.text();
let body = bodyText;
try {
  body = JSON.parse(bodyText);
} catch {
  // Keep raw body text.
}

console.log('[railway-cron-reduniq-reconcile]', JSON.stringify({
  ok: response.ok,
  status: response.status,
  durationMs: Date.now() - startedAt,
  body,
}));

if (!response.ok) {
  process.exit(1);
}
