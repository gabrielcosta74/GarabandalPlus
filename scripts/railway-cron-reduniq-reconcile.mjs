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
if (process.env.REDUNIQ_RECONCILE_WINDOW_DAYS) {
  url.searchParams.set('windowDays', process.env.REDUNIQ_RECONCILE_WINDOW_DAYS);
}
url.searchParams.set('minAgeMinutes', process.env.REDUNIQ_RECONCILE_MIN_AGE_MINUTES || '30');

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [15_000, 45_000];

const wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

async function runAttempt(attempt) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(90_000),
    });

    const bodyText = await response.text();
    let body = bodyText;
    try {
      body = JSON.parse(bodyText);
    } catch {
      // Keep raw body text.
    }

    console.log('[railway-cron-reduniq-reconcile]', JSON.stringify({
      attempt,
      ok: response.ok,
      status: response.status,
      durationMs: Date.now() - startedAt,
      body,
    }));

    return {
      ok: response.ok,
      retryable: RETRYABLE_STATUSES.has(response.status),
    };
  } catch (error) {
    console.error('[railway-cron-reduniq-reconcile]', JSON.stringify({
      attempt,
      ok: false,
      status: 'network_error',
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    }));
    return { ok: false, retryable: true };
  }
}

let succeeded = false;
for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt += 1) {
  const result = await runAttempt(attempt);
  if (result.ok) {
    succeeded = true;
    break;
  }
  if (!result.retryable || attempt > RETRY_DELAYS_MS.length) break;
  await wait(RETRY_DELAYS_MS[attempt - 1]);
}

if (!succeeded) process.exit(1);
