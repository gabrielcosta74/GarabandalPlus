const rawBaseUrl =
  process.env.CRON_TARGET_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  process.env.RAILWAY_PUBLIC_DOMAIN ||
  '';

const cronSecret = process.env.CRON_SECRET || '';
const cronPath = process.env.CRON_PATH || process.argv[2] || '';
const cronQuery = process.env.CRON_QUERY || '';
const dryRun = process.env.CRON_DRY_RUN === '1';

function normalizeBaseUrl(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

function sanitizeBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;

  const details = Array.isArray(body.details) ? body.details : null;
  return {
    ok: body.ok,
    success: body.success,
    skipped: body.skipped,
    reason: body.reason,
    dryRun: body.dryRun,
    asOf: body.asOf,
    processed: body.processed,
    activeFunnels: body.activeFunnels,
    enrolled: body.enrolled,
    sentLast24h: body.sentLast24h,
    remainingDailyCapacity: body.remainingDailyCapacity,
    dueEnrollments: body.dueEnrollments,
    wouldProcess: body.wouldProcess,
    summary: body.summary,
    detailsCount: details?.length,
    failedDetails: details
      ?.filter((entry) => entry && entry.success === false)
      .map((entry) => ({
        action: entry.action,
        success: entry.success,
        bookingId: entry.bookingId,
        userId: entry.userId,
      })),
    message: body.message,
    error: body.error,
  };
}

const baseUrl = normalizeBaseUrl(rawBaseUrl);

if (!baseUrl) {
  console.error('[railway-cron] Missing CRON_TARGET_URL, NEXT_PUBLIC_APP_URL, APP_URL, or RAILWAY_PUBLIC_DOMAIN.');
  process.exit(1);
}

if (!cronSecret) {
  console.error('[railway-cron] Missing CRON_SECRET.');
  process.exit(1);
}

if (!cronPath) {
  console.error('[railway-cron] Missing CRON_PATH or argv path.');
  process.exit(1);
}

const url = new URL(cronPath, baseUrl);
if (cronQuery) {
  const params = new URLSearchParams(cronQuery);
  params.forEach((value, key) => url.searchParams.set(key, value));
}
if (dryRun) {
  url.searchParams.set('dryRun', '1');
}

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

console.log('[railway-cron]', JSON.stringify({
  job: process.env.CRON_JOB_NAME || cronPath,
  ok: response.ok,
  status: response.status,
  durationMs: Date.now() - startedAt,
  body: sanitizeBody(body),
}));

if (!response.ok) {
  process.exit(1);
}
