/**
 * Edge-compatible redirect lookup.
 *
 * The redirects table is small (~30 rows now, may grow to a few hundred with
 * slug renames). We fetch it once per cold start and refresh in-process every
 * 5 minutes. A miss costs ~100ms only on first request after TTL expiry.
 *
 * Reads via Supabase REST + anon key (the redirects table has a public-read
 * RLS policy), so this works on the Edge runtime without service role.
 */

type RedirectEntry = { destination_path: string; status_code: number };

const TTL_MS = 5 * 60 * 1000;

// Module-scope state — persists between requests on the same Vercel/Edge worker.
let cache: Map<string, RedirectEntry> | null = null;
let loadedAt = 0;
let inFlight: Promise<Map<string, RedirectEntry>> | null = null;

async function loadRedirects(): Promise<Map<string, RedirectEntry>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return new Map();

  const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/redirects?select=source_path,destination_path,status_code`;
  const res = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: 'application/json',
    },
    // Avoid Next.js fetch caching — we manage the TTL ourselves.
    cache: 'no-store',
  });
  if (!res.ok) return new Map();
  const rows = (await res.json()) as Array<{ source_path: string; destination_path: string; status_code: number }>;
  const map = new Map<string, RedirectEntry>();
  for (const r of rows) {
    map.set(r.source_path, { destination_path: r.destination_path, status_code: r.status_code });
  }
  return map;
}

async function getMap(): Promise<Map<string, RedirectEntry>> {
  const now = Date.now();
  if (cache && now - loadedAt < TTL_MS) return cache;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const fresh = await loadRedirects();
      cache = fresh;
      loadedAt = Date.now();
      return fresh;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Normalize an incoming pathname for lookup — strip trailing slash. */
function normalize(p: string): string {
  if (!p) return '/';
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1);
  return p;
}

/**
 * Returns the redirect target for `pathname`, or null if no redirect matches.
 * Match is exact-path. Slug-based wildcards aren't needed yet — every redirect
 * we generate is exact. If we ever want patterns, switch to a sorted-by-length
 * prefix scan here.
 */
export async function lookupRedirect(pathname: string): Promise<RedirectEntry | null> {
  const norm = normalize(pathname);
  const map = await getMap();
  return map.get(norm) ?? null;
}
