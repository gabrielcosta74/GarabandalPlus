import { GoogleAuth } from 'google-auth-library';

const SEARCH_CONSOLE_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const SEARCH_CONSOLE_API = 'https://www.googleapis.com/webmasters/v3';

export type SearchConsoleMetricRow = {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchConsoleQuery = {
  startDate: string;
  endDate: string;
  dimensions?: string[];
  rowLimit?: number;
  startRow?: number;
  dimensionFilterGroups?: Array<{
    filters: Array<{
      dimension: string;
      operator?: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'includingRegex' | 'excludingRegex';
      expression: string;
    }>;
  }>;
  dataState?: 'final' | 'all';
};

type SearchConsoleCredentials = {
  client_email: string;
  private_key: string;
};

export const getSearchConsoleSiteUrl = () =>
  process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL ||
  process.env.SEARCH_CONSOLE_SITE_URL ||
  '';

const normalizePrivateKey = (key: string) =>
  key
    .replace(/\\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .trim();

const getCredentialsFromEnv = (): SearchConsoleCredentials | null => {
  const json = process.env.GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const parsed = JSON.parse(json) as SearchConsoleCredentials;
    if (parsed.client_email && parsed.private_key) {
      return {
        client_email: parsed.client_email,
        private_key: normalizePrivateKey(parsed.private_key),
      };
    }
  }

  const clientEmail =
    process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL ||
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey =
    process.env.GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY ||
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!clientEmail || !privateKey) return null;

  return {
    client_email: clientEmail,
    private_key: normalizePrivateKey(privateKey),
  };
};

export const getSearchConsoleConfigStatus = () => {
  const siteUrl = getSearchConsoleSiteUrl();
  const credentials = getCredentialsFromEnv();

  return {
    configured: Boolean(siteUrl && credentials),
    siteUrl,
    serviceAccountEmail: credentials?.client_email || null,
    missing: [
      !siteUrl ? 'GOOGLE_SEARCH_CONSOLE_SITE_URL' : null,
      !credentials ? 'GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL / GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY' : null,
    ].filter(Boolean) as string[],
  };
};

const getAccessToken = async () => {
  const credentials = getCredentialsFromEnv();
  if (!credentials) {
    throw new Error('Google Search Console credentials are not configured.');
  }

  const auth = new GoogleAuth({
    credentials,
    scopes: [SEARCH_CONSOLE_SCOPE],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;

  if (!token) {
    throw new Error('Could not obtain a Google access token.');
  }

  return token;
};

export async function querySearchConsole(
  query: SearchConsoleQuery,
  siteUrl = getSearchConsoleSiteUrl(),
): Promise<SearchConsoleMetricRow[]> {
  if (!siteUrl) {
    throw new Error('GOOGLE_SEARCH_CONSOLE_SITE_URL is not configured.');
  }

  const token = await getAccessToken();
  const res = await fetch(
    `${SEARCH_CONSOLE_API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dataState: 'final',
        rowLimit: 25,
        ...query,
      }),
    },
  );

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.error?.message || `Search Console API returned ${res.status}`;
    throw new Error(message);
  }

  const payload = await res.json();
  return payload.rows || [];
}

export const getMetricTotals = (rows: SearchConsoleMetricRow[]) => {
  const first = rows[0];
  return {
    clicks: first?.clicks || 0,
    impressions: first?.impressions || 0,
    ctr: first?.ctr || 0,
    position: first?.position || 0,
  };
};
