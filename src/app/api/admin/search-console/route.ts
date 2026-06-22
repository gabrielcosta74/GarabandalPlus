import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../lib/admin-auth';
import {
  getMetricTotals,
  getSearchConsoleConfigStatus,
  querySearchConsole,
  SearchConsoleMetricRow,
} from '../../../../lib/google-search-console';

export const dynamic = 'force-dynamic';

const toDateString = (date: Date) => date.toISOString().slice(0, 10);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const clampDays = (value: string | null) => {
  const parsed = Number(value || 28);
  if (!Number.isFinite(parsed)) return 28;
  return Math.min(90, Math.max(7, Math.round(parsed)));
};

const calculateDelta = (current: number, previous: number) => {
  if (!previous && !current) return 0;
  if (!previous) return 100;
  return ((current - previous) / previous) * 100;
};

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

const metricFromRows = (rows: SearchConsoleMetricRow[], keyIndex = 0) =>
  rows.map((row) => ({
    key: row.keys?.[keyIndex] || '',
    keys: row.keys || [],
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }));

const buildPreviousMap = (rows: SearchConsoleMetricRow[]) => {
  const map = new Map<string, SearchConsoleMetricRow>();
  for (const row of rows) {
    const key = row.keys?.[0];
    if (key) map.set(key, row);
  }
  return map;
};

const expectedCtrForPosition = (position: number) => {
  if (position <= 3) return 0.08;
  if (position <= 10) return 0.025;
  if (position <= 20) return 0.012;
  return 0.008;
};

export async function GET(req: Request) {
  const { authorized, error: authError } = await verifyAdmin(req);
  if (!authorized) {
    const status = authError === 'Forbidden: Not an Admin' ? 403 : 401;
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status });
  }

  const config = getSearchConsoleConfigStatus();
  if (!config.configured) {
    return NextResponse.json({
      configured: false,
      config,
      setup: {
        env: [
          'GOOGLE_SEARCH_CONSOLE_SITE_URL',
          'GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL',
          'GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY',
        ],
        alternativeEnv: ['GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON'],
      },
    });
  }

  try {
    const { searchParams } = new URL(req.url);
    const days = clampDays(searchParams.get('days'));

    // Search Console final data commonly lags behind today's date. Query finalized
    // data ending three days ago so the dashboard is stable.
    const end = addDays(new Date(), -3);
    const start = addDays(end, -(days - 1));
    const previousEnd = addDays(start, -1);
    const previousStart = addDays(previousEnd, -(days - 1));

    const currentRange = {
      startDate: toDateString(start),
      endDate: toDateString(end),
    };
    const previousRange = {
      startDate: toDateString(previousStart),
      endDate: toDateString(previousEnd),
    };

    const [
      totalRows,
      previousTotalRows,
      dailyRows,
      pageRows,
      previousPageRows,
      queryRows,
      queryPageRows,
      countryRows,
      deviceRows,
    ] = await Promise.all([
      querySearchConsole({ ...currentRange, rowLimit: 1 }),
      querySearchConsole({ ...previousRange, rowLimit: 1 }),
      querySearchConsole({ ...currentRange, dimensions: ['date'], rowLimit: days }),
      querySearchConsole({ ...currentRange, dimensions: ['page'], rowLimit: 20 }),
      querySearchConsole({ ...previousRange, dimensions: ['page'], rowLimit: 100 }),
      querySearchConsole({ ...currentRange, dimensions: ['query'], rowLimit: 25 }),
      querySearchConsole({ ...currentRange, dimensions: ['query', 'page'], rowLimit: 250 }),
      querySearchConsole({ ...currentRange, dimensions: ['country'], rowLimit: 10 }),
      querySearchConsole({ ...currentRange, dimensions: ['device'], rowLimit: 5 }),
    ]);

    const totals = getMetricTotals(totalRows);
    const previousTotals = getMetricTotals(previousTotalRows);
    const previousPageMap = buildPreviousMap(previousPageRows);

    const pages = metricFromRows(pageRows).map((page) => {
      const previous = previousPageMap.get(page.key);
      const previousClicks = previous?.clicks || 0;
      const previousImpressions = previous?.impressions || 0;

      return {
        ...page,
        clicksDelta: calculateDelta(page.clicks, previousClicks),
        impressionsDelta: calculateDelta(page.impressions, previousImpressions),
        previousClicks,
        previousImpressions,
      };
    });

    const opportunities = metricFromRows(queryPageRows)
      .map((row) => ({
        query: row.keys[0] || '',
        page: row.keys[1] || '',
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        expectedCtr: expectedCtrForPosition(row.position),
      }))
      .filter((row) => row.impressions >= 30 && row.ctr < row.expectedCtr)
      .sort((a, b) => {
        const aGap = (a.expectedCtr - a.ctr) * a.impressions;
        const bGap = (b.expectedCtr - b.ctr) * b.impressions;
        return bGap - aGap;
      })
      .slice(0, 12);

    const nearPageOne = metricFromRows(queryPageRows)
      .map((row) => ({
        query: row.keys[0] || '',
        page: row.keys[1] || '',
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      }))
      .filter((row) => row.impressions >= 20 && row.position > 4 && row.position <= 20)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 12);

    const decliningPages = pages
      .filter((page) => page.previousClicks >= 3 && page.clicksDelta < -15)
      .sort((a, b) => a.clicksDelta - b.clicksDelta)
      .slice(0, 8);

    return NextResponse.json({
      configured: true,
      siteUrl: config.siteUrl,
      serviceAccountEmail: config.serviceAccountEmail,
      range: {
        days,
        current: currentRange,
        previous: previousRange,
      },
      totals: {
        ...totals,
        clicksDelta: calculateDelta(totals.clicks, previousTotals.clicks),
        impressionsDelta: calculateDelta(totals.impressions, previousTotals.impressions),
        ctrDelta: calculateDelta(totals.ctr, previousTotals.ctr),
        positionDelta: calculateDelta(previousTotals.position, totals.position),
      },
      previousTotals,
      daily: metricFromRows(dailyRows),
      pages,
      queries: metricFromRows(queryRows),
      countries: metricFromRows(countryRows),
      devices: metricFromRows(deviceRows),
      opportunities,
      nearPageOne,
      decliningPages,
    });
  } catch (err: unknown) {
    console.error('Search Console API error:', err);
    return NextResponse.json(
      { configured: true, message: getErrorMessage(err, 'Search Console API error') },
      { status: 500 },
    );
  }
}
