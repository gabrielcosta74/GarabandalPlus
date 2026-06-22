import { supabaseServer } from '../supabase';
import { mtUnreviewedAvailable, markMtUnreviewedMissing, isMissingMtColumn } from './schema';

export type CmsLocale = 'pt' | 'en' | 'es' | 'fr' | 'it';
export type CmsStatus = 'draft' | 'scheduled' | 'published' | 'archived';
export type CmsContentType = 'page' | 'post';

export type CmsListItem = {
  id: string;
  slug: string;
  locale: CmsLocale;
  title: string;
  meta_description: string | null;
  status: CmsStatus;
  category?: string | null;
  tags?: string[] | null;
  featured?: boolean;
  cover_image_url?: string | null;
  og_image_url: string | null;
  published_at: string | null;
  updated_at: string;
};

export type CmsListResult = {
  items: CmsListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type CmsListFilters = {
  type: CmsContentType;
  search?: string;
  locale?: CmsLocale | 'all';
  status?: CmsStatus | 'all';
  category?: string;
  page?: number;
  pageSize?: number;
};

export type CmsRecord = {
  id: string;
  slug: string;
  locale: CmsLocale;
  title: string;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  excerpt: string | null;
  content_html: string | null;
  content_json: unknown;
  status: CmsStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  source_url: string | null;
  /** Machine-translated and not yet reviewed by a human. */
  mt_unreviewed?: boolean;
  // page-only
  category?: string | null;
  parent_slug?: string | null;
  // post-only
  cover_image_url?: string | null;
  tags?: string[];
  featured?: boolean;
  sort_order?: number | null;
};

export type CmsCounts = {
  pages: { total: number; draft: number; published: number };
  posts: { total: number; draft: number; published: number };
};

const PAGE_SELECT =
  'id, slug, locale, title, meta_title, meta_description, og_image_url, excerpt, content_html, content_json, category, parent_slug, status, published_at, source_url, sort_order, created_at, updated_at';
const POST_SELECT =
  'id, slug, locale, title, meta_title, meta_description, og_image_url, excerpt, content_html, content_json, cover_image_url, tags, featured, status, published_at, source_url, sort_order, created_at, updated_at';

/** Append mt_unreviewed only when the column is known to exist (post-migration). */
function withMt(base: string): string {
  return mtUnreviewedAvailable() ? `${base}, mt_unreviewed` : base;
}

export async function cmsListContent(filters: CmsListFilters): Promise<CmsListResult> {
  if (!supabaseServer) return { items: [], total: 0, page: 1, pageSize: 25 };

  const table = filters.type === 'page' ? 'wp_pages' : 'posts';
  const cols = filters.type === 'page'
    ? 'id, slug, locale, title, meta_description, status, category, og_image_url, published_at, updated_at'
    : 'id, slug, locale, title, meta_description, status, tags, featured, cover_image_url, og_image_url, published_at, updated_at';

  const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 1), 100);
  const page = Math.max(filters.page ?? 1, 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseServer
    .from(table)
    .select(cols, { count: 'exact' });

  if (filters.locale && filters.locale !== 'all') {
    query = query.eq('locale', filters.locale);
  }
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters.category && filters.type === 'page') {
    query = query.eq('category', filters.category);
  }
  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim();
    // Postgres FTS via search_tsv (gin index); fallback to ilike on title/slug.
    query = query.or(
      `title.ilike.%${term}%,slug.ilike.%${term}%,meta_description.ilike.%${term}%`,
    );
  }

  query = query
    .order('updated_at', { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) {
    console.error('[cms] list', error);
    return { items: [], total: 0, page, pageSize };
  }
  return {
    items: (data ?? []) as unknown as CmsListItem[],
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function cmsGetById(type: CmsContentType, id: string): Promise<CmsRecord | null> {
  if (!supabaseServer) return null;
  const table = type === 'page' ? 'wp_pages' : 'posts';
  const base = type === 'page' ? PAGE_SELECT : POST_SELECT;
  let { data, error } = await supabaseServer
    .from(table)
    .select(withMt(base))
    .eq('id', id)
    .maybeSingle();
  // Pre-migration fallback: retry without the optional mt_unreviewed column.
  if (error && isMissingMtColumn(error)) {
    markMtUnreviewedMissing();
    ({ data, error } = await supabaseServer.from(table).select(base).eq('id', id).maybeSingle());
  }
  if (error) {
    console.error('[cms] getById', error);
    return null;
  }
  return (data as unknown as CmsRecord) ?? null;
}

export async function cmsCounts(): Promise<CmsCounts> {
  if (!supabaseServer) {
    return { pages: { total: 0, draft: 0, published: 0 }, posts: { total: 0, draft: 0, published: 0 } };
  }
  const [pages, pagesDraft, pagesPub, posts, postsDraft, postsPub] = await Promise.all([
    supabaseServer.from('wp_pages').select('id', { count: 'exact', head: true }),
    supabaseServer.from('wp_pages').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    supabaseServer.from('wp_pages').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    supabaseServer.from('posts').select('id', { count: 'exact', head: true }),
    supabaseServer.from('posts').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    supabaseServer.from('posts').select('id', { count: 'exact', head: true }).eq('status', 'published'),
  ]);
  return {
    pages: {
      total: pages.count ?? 0,
      draft: pagesDraft.count ?? 0,
      published: pagesPub.count ?? 0,
    },
    posts: {
      total: posts.count ?? 0,
      draft: postsDraft.count ?? 0,
      published: postsPub.count ?? 0,
    },
  };
}

/**
 * Nav-panel feed: returns every page/post for a given category bucket, split
 * by locale, with the featured + sort fields needed to render the admin
 * /admin/cms/navigation UI.
 *
 * `category` is matched against:
 *   wp_pages.category = key
 *   posts.tags @> [key]   (the classifier prepends the bucket as tags[0])
 */
export type NavItem = {
  id: string;
  type: CmsContentType;
  slug: string;
  locale: CmsLocale;
  title: string;
  status: CmsStatus;
  featured_in_nav: boolean;
  nav_sort_order: number;
  updated_at: string;
  // Optional fields populated by cmsListFeaturedByCategory /
  // cmsListPublishedByCategory for use on public landing pages.
  og_image_url?: string | null;
  cover_image_url?: string | null;
  meta_description?: string | null;
  excerpt?: string | null;
  published_at?: string | null;
};

export async function cmsListByCategory(category: string): Promise<NavItem[]> {
  if (!supabaseServer) return [];
  const [pagesRes, postsRes] = await Promise.all([
    supabaseServer
      .from('wp_pages')
      .select('id, slug, locale, title, status, featured_in_nav, nav_sort_order, updated_at')
      .eq('category', category)
      .order('locale', { ascending: true })
      .order('nav_sort_order', { ascending: true })
      .order('title', { ascending: true }),
    supabaseServer
      .from('posts')
      .select('id, slug, locale, title, status, featured_in_nav, nav_sort_order, updated_at, tags')
      .contains('tags', [category])
      .order('locale', { ascending: true })
      .order('nav_sort_order', { ascending: true })
      .order('title', { ascending: true }),
  ]);
  const out: NavItem[] = [];
  for (const r of (pagesRes.data ?? []) as Array<Omit<NavItem, 'type'>>) {
    out.push({ ...r, type: 'page' });
  }
  for (const r of (postsRes.data ?? []) as Array<Omit<NavItem, 'type'>>) {
    out.push({ ...r, type: 'post' });
  }
  return out;
}

/** Public-facing fetch: featured-only for a category landing page or mega-menu. */
export async function cmsListFeaturedByCategory(
  category: string,
  locale: CmsLocale,
  limit = 6,
): Promise<NavItem[]> {
  if (!supabaseServer) return [];
  const [pagesRes, postsRes] = await Promise.all([
    supabaseServer
      .from('wp_pages')
      .select('id, slug, locale, title, status, featured_in_nav, nav_sort_order, updated_at, og_image_url, meta_description, excerpt')
      .eq('category', category)
      .eq('locale', locale)
      .eq('featured_in_nav', true)
      .order('nav_sort_order', { ascending: true })
      .limit(limit),
    supabaseServer
      .from('posts')
      .select('id, slug, locale, title, status, featured_in_nav, nav_sort_order, updated_at, og_image_url, meta_description, excerpt, cover_image_url, tags')
      .contains('tags', [category])
      .eq('locale', locale)
      .eq('featured_in_nav', true)
      .order('nav_sort_order', { ascending: true })
      .limit(limit),
  ]);
  const out: NavItem[] = [];
  for (const r of (pagesRes.data ?? []) as Array<Omit<NavItem, 'type'>>) {
    out.push({ ...r, type: 'page' });
  }
  for (const r of (postsRes.data ?? []) as Array<Omit<NavItem, 'type'>>) {
    out.push({ ...r, type: 'post' });
  }
  return out
    .sort((a, b) => a.nav_sort_order - b.nav_sort_order)
    .slice(0, limit);
}

/**
 * Highlights for a category — used by the mega-menu and the landing "featured"
 * row. Returns curated (featured_in_nav) items first, then fills up to `limit`
 * with the most-recent items in the category. This means the nav/landings show
 * content out-of-the-box even before anyone curates featured items in
 * /admin/cms/navigation.
 *
 * `statuses` defaults to published-only; pass getPublicStatuses() so admin
 * preview (drafts) sees highlights pre-cutover.
 */
export async function cmsListCategoryHighlights(
  category: string,
  locale: CmsLocale,
  opts: { limit?: number; statuses?: CmsStatus[] } = {},
): Promise<NavItem[]> {
  if (!supabaseServer) return [];
  const limit = opts.limit ?? 6;
  const statuses = opts.statuses ?? ['published'];
  const pageCols =
    'id, slug, locale, title, status, featured_in_nav, nav_sort_order, updated_at, og_image_url, meta_description, excerpt, published_at';
  const postCols = `${pageCols}, cover_image_url, tags`;

  const [pagesRes, postsRes] = await Promise.all([
    supabaseServer
      .from('wp_pages')
      .select(pageCols)
      .eq('category', category)
      .eq('locale', locale)
      .in('status', statuses),
    supabaseServer
      .from('posts')
      .select(postCols)
      .contains('tags', [category])
      .eq('locale', locale)
      .in('status', statuses),
  ]);

  const all: NavItem[] = [
    ...((pagesRes.data ?? []) as Array<Omit<NavItem, 'type'>>).map((r) => ({ ...r, type: 'page' as const })),
    ...((postsRes.data ?? []) as Array<Omit<NavItem, 'type'>>).map((r) => ({ ...r, type: 'post' as const })),
  ];

  const recency = (i: NavItem) => i.published_at ?? i.updated_at;
  const featured = all
    .filter((i) => i.featured_in_nav)
    .sort((a, b) => a.nav_sort_order - b.nav_sort_order || recency(b).localeCompare(recency(a)));
  const rest = all
    .filter((i) => !i.featured_in_nav)
    .sort((a, b) => recency(b).localeCompare(recency(a)));

  return [...featured, ...rest].slice(0, limit);
}

/** Public-facing fetch: every published item in a category, paginated. Used by
 *  the category landing page below the curated featured grid.
 *
 *  `statuses` defaults to published-only; pass the result of getPublicStatuses()
 *  so admins previewing pre-cutover (drafts) also see the list populated. */
export async function cmsListPublishedByCategory(
  category: string,
  locale: CmsLocale,
  page = 1,
  pageSize = 24,
  statuses: CmsStatus[] = ['published'],
): Promise<{ items: NavItem[]; total: number }> {
  if (!supabaseServer) return { items: [], total: 0 };
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const [pagesRes, postsRes] = await Promise.all([
    supabaseServer
      .from('wp_pages')
      .select(
        'id, slug, locale, title, status, featured_in_nav, nav_sort_order, updated_at, og_image_url, meta_description, excerpt, published_at',
        { count: 'exact' },
      )
      .eq('category', category)
      .eq('locale', locale)
      .in('status', statuses)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false }),
    supabaseServer
      .from('posts')
      .select(
        'id, slug, locale, title, status, featured_in_nav, nav_sort_order, updated_at, og_image_url, meta_description, excerpt, cover_image_url, tags, published_at',
        { count: 'exact' },
      )
      .contains('tags', [category])
      .eq('locale', locale)
      .in('status', statuses)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false }),
  ]);
  const merged = [
    ...((pagesRes.data ?? []) as Array<Omit<NavItem, 'type'>>).map((r) => ({ ...r, type: 'page' as const })),
    ...((postsRes.data ?? []) as Array<Omit<NavItem, 'type'>>).map((r) => ({ ...r, type: 'post' as const })),
  ].sort((a, b) => {
    const da = (a as NavItem & { published_at?: string }).published_at ?? a.updated_at;
    const db = (b as NavItem & { published_at?: string }).published_at ?? b.updated_at;
    return db.localeCompare(da);
  });
  return {
    items: merged.slice(from, to + 1),
    total: (pagesRes.count ?? 0) + (postsRes.count ?? 0),
  };
}

export async function cmsRecentlyEdited(limit = 8): Promise<Array<CmsListItem & { type: CmsContentType }>> {
  if (!supabaseServer) return [];
  const [{ data: pages }, { data: posts }] = await Promise.all([
    supabaseServer
      .from('wp_pages')
      .select('id, slug, locale, title, status, updated_at, og_image_url, meta_description')
      .order('updated_at', { ascending: false })
      .limit(limit),
    supabaseServer
      .from('posts')
      .select('id, slug, locale, title, status, updated_at, og_image_url, meta_description, cover_image_url')
      .order('updated_at', { ascending: false })
      .limit(limit),
  ]);
  const all = [
    ...((pages ?? []) as any[]).map((p) => ({ ...p, type: 'page' as const })),
    ...((posts ?? []) as any[]).map((p) => ({ ...p, type: 'post' as const })),
  ];
  return all
    .sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1))
    .slice(0, limit) as Array<CmsListItem & { type: CmsContentType }>;
}

export type CmsMediaItem = {
  id: string;
  filename: string;
  public_url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
};

export async function cmsListMedia(opts: {
  search?: string;
  filter?: 'all' | 'no-alt' | 'with-alt';
  cursor?: string | null;
  limit?: number;
}): Promise<{ items: CmsMediaItem[]; nextCursor: string | null; total: number }> {
  if (!supabaseServer) return { items: [], nextCursor: null, total: 0 };
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);

  let query = supabaseServer
    .from('media')
    .select('id, filename, public_url, alt, width, height, size_bytes, mime_type, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (opts.filter === 'no-alt') query = query.or('alt.is.null,alt.eq.');
  if (opts.filter === 'with-alt') query = query.not('alt', 'is', null).neq('alt', '');
  if (opts.search?.trim()) {
    const term = opts.search.trim();
    query = query.or(`filename.ilike.%${term}%,alt.ilike.%${term}%`);
  }
  if (opts.cursor) query = query.lt('created_at', opts.cursor);

  const { data, error, count } = await query;
  if (error) {
    console.error('[cms] listMedia', error);
    return { items: [], nextCursor: null, total: 0 };
  }
  const items = (data ?? []) as unknown as CmsMediaItem[];
  const nextCursor = items.length === limit ? items[items.length - 1].created_at : null;
  return { items, nextCursor, total: count ?? 0 };
}

/**
 * Translation coverage row: one per content piece (group). Shows which locales
 * we have for it, plus the canonical PT title/slug for orientation.
 *
 * The grouping uses public.content_translations.group_id. Pieces without a
 * group row are listed under their own pseudo-group (the row's id).
 */
type TranslationPeerRef = { id: string; slug: string; title: string; status: CmsStatus; updated_at: string; mt_unreviewed?: boolean };

export type TranslationCoverageRow = {
  group_id: string;
  content_type: CmsContentType;
  pt: TranslationPeerRef | null;
  en: TranslationPeerRef | null;
  es: TranslationPeerRef | null;
  fr: TranslationPeerRef | null;
  it: TranslationPeerRef | null;
};

export type TranslationCoverageFilter =
  | 'all'
  | 'missing-en'
  | 'missing-es'
  | 'missing-fr'
  | 'missing-it'
  | 'missing-pt'
  | 'pt-only'
  | 'complete';

export type TranslationGroup = { pt: CmsRecord | null; en: CmsRecord | null; es: CmsRecord | null; fr: CmsRecord | null; it: CmsRecord | null };

export async function cmsResolveTranslationGroup(
  type: CmsContentType,
  groupId: string,
): Promise<TranslationGroup> {
  if (!supabaseServer) return { pt: null, en: null, es: null, fr: null, it: null };

  let ids: string[] = [];
  if (groupId.startsWith('solo:')) {
    ids = [groupId.slice('solo:'.length)];
  } else {
    const { data: links } = await supabaseServer
      .from('content_translations')
      .select('content_id')
      .eq('content_type', type)
      .eq('group_id', groupId);
    ids = (links ?? []).map((l) => l.content_id as string);
  }
  if (ids.length === 0) return { pt: null, en: null, es: null, fr: null, it: null };

  const records = await Promise.all(ids.map((id) => cmsGetById(type, id)));
  const out: TranslationGroup = { pt: null, en: null, es: null, fr: null, it: null };
  for (const r of records) {
    if (!r) continue;
    if (r.locale === 'pt' || r.locale === 'en' || r.locale === 'es' || r.locale === 'fr' || r.locale === 'it') {
      out[r.locale] = r;
    }
  }
  return out;
}

/**
 * Resolve the translation group_id for a single content row, plus which locales
 * already have a peer in that group. Powers the "Traduções" shortcut and the
 * coverage badges shown inside the single-content editor. Rows that aren't yet
 * linked into a group fall back to a `solo:<id>` pseudo-group.
 */
export async function cmsTranslationPeersForContent(
  type: CmsContentType,
  contentId: string,
): Promise<{ groupId: string; locales: CmsLocale[] }> {
  if (!supabaseServer) return { groupId: `solo:${contentId}`, locales: [] };
  const { data: link } = await supabaseServer
    .from('content_translations')
    .select('group_id')
    .eq('content_type', type)
    .eq('content_id', contentId)
    .maybeSingle();
  const groupId = (link?.group_id as string | undefined) ?? `solo:${contentId}`;
  if (groupId.startsWith('solo:')) return { groupId, locales: [] };
  const { data: peers } = await supabaseServer
    .from('content_translations')
    .select('locale')
    .eq('content_type', type)
    .eq('group_id', groupId);
  return { groupId, locales: ((peers ?? []) as Array<{ locale: CmsLocale }>).map((p) => p.locale) };
}

export async function cmsTranslationCoverage(
  type: CmsContentType,
  filter: TranslationCoverageFilter = 'missing-en',
): Promise<TranslationCoverageRow[]> {
  if (!supabaseServer) return [];

  // 1. Pull all rows for this content type with the metadata we need.
  const table = type === 'page' ? 'wp_pages' : 'posts';
  const COVERAGE_BASE = 'id, slug, locale, title, status, updated_at';
  let { data: rows, error: rowsErr } = await supabaseServer
    .from(table)
    .select(withMt(COVERAGE_BASE));
  if (rowsErr && isMissingMtColumn(rowsErr)) {
    markMtUnreviewedMissing();
    ({ data: rows, error: rowsErr } = await supabaseServer.from(table).select(COVERAGE_BASE));
  }
  if (rowsErr) {
    console.error('[cms] coverage rows', rowsErr);
    return [];
  }

  // 2. Pull translation links so we can resolve group_id per row.
  const { data: links } = await supabaseServer
    .from('content_translations')
    .select('group_id, content_id, locale')
    .eq('content_type', type);

  const idToGroup = new Map<string, string>();
  for (const l of (links ?? []) as Array<{ group_id: string; content_id: string }>) {
    idToGroup.set(l.content_id, l.group_id);
  }

  // 3. Bucket rows into groups. Rows without a group link become their own
  //    singleton group keyed by their id (rare but possible).
  type Row = { id: string; slug: string; locale: CmsLocale; title: string; status: CmsStatus; updated_at: string; mt_unreviewed?: boolean };
  const groups = new Map<string, TranslationCoverageRow>();
  for (const r of (rows ?? []) as unknown as Row[]) {
    const gid = idToGroup.get(r.id) ?? `solo:${r.id}`;
    const bucket: TranslationCoverageRow = groups.get(gid) ?? { group_id: gid, content_type: type, pt: null, en: null, es: null, fr: null, it: null };
    const peer = { id: r.id, slug: r.slug, title: r.title, status: r.status, updated_at: r.updated_at, mt_unreviewed: !!r.mt_unreviewed };
    if (r.locale === 'pt' || r.locale === 'en' || r.locale === 'es' || r.locale === 'fr' || r.locale === 'it') {
      bucket[r.locale] = peer;
    }
    groups.set(gid, bucket);
  }

  let out = [...groups.values()];

  if (filter === 'missing-en') out = out.filter((g) => g.pt && !g.en);
  else if (filter === 'missing-es') out = out.filter((g) => g.pt && !g.es);
  else if (filter === 'missing-fr') out = out.filter((g) => g.pt && !g.fr);
  else if (filter === 'missing-it') out = out.filter((g) => g.pt && !g.it);
  else if (filter === 'missing-pt') out = out.filter((g) => !g.pt && (g.en || g.es || g.fr || g.it));
  else if (filter === 'pt-only') out = out.filter((g) => g.pt && !g.en && !g.es && !g.fr && !g.it);
  else if (filter === 'complete') out = out.filter((g) => g.pt && g.en && g.es && g.fr && g.it);

  // PT title alphabetical, fall back to EN title.
  out.sort((a, b) => (a.pt?.title ?? a.en?.title ?? '').localeCompare(b.pt?.title ?? b.en?.title ?? ''));
  return out;
}

/**
 * Aggregated translation dashboard for the CMS: how much content exists in each
 * language (PT/EN/ES/FR), split by content type and by category/tag, plus how
 * many PT pieces still lack an EN, ES or FR peer. Powers the overview panel
 * above the side-by-side audit table.
 */
export type LocaleStat = { total: number; published: number; draft: number };
export type LocaleTriple = { pt: LocaleStat; en: LocaleStat; es: LocaleStat; fr: LocaleStat; it: LocaleStat };
export type CategoryCoverage = { label: string; pt: number; en: number; es: number; fr: number; it: number; total: number };
export type TranslationOverview = {
  pages: LocaleTriple;
  posts: LocaleTriple;
  coverage: { ptGroups: number; en: number; es: number; fr: number; it: number; complete: number; missingEn: number; missingEs: number; missingFr: number; missingIt: number };
  byCategory: CategoryCoverage[];
};

function emptyLocaleStat(): LocaleStat {
  return { total: 0, published: 0, draft: 0 };
}
function emptyTriple(): LocaleTriple {
  return { pt: emptyLocaleStat(), en: emptyLocaleStat(), es: emptyLocaleStat(), fr: emptyLocaleStat(), it: emptyLocaleStat() };
}

async function localeStatsFor(table: 'wp_pages' | 'posts'): Promise<LocaleTriple> {
  const out = emptyTriple();
  if (!supabaseServer) return out;
  const { data } = await supabaseServer.from(table).select('locale, status');
  for (const r of (data ?? []) as Array<{ locale: CmsLocale; status: string }>) {
    const stat = out[r.locale];
    if (!stat) continue;
    stat.total++;
    if (r.status === 'published') stat.published++;
    else if (r.status === 'draft') stat.draft++;
  }
  return out;
}

export async function cmsTranslationOverview(type: CmsContentType): Promise<TranslationOverview> {
  const empty: TranslationOverview = {
    pages: emptyTriple(),
    posts: emptyTriple(),
    coverage: { ptGroups: 0, en: 0, es: 0, fr: 0, it: 0, complete: 0, missingEn: 0, missingEs: 0, missingFr: 0, missingIt: 0 },
    byCategory: [],
  };
  if (!supabaseServer) return empty;

  const table = type === 'page' ? 'wp_pages' : 'posts';
  const catCol = type === 'page' ? 'category' : 'tags';

  // Per-language totals for BOTH types (cheap id-less selects) so the top cards
  // always show the full picture regardless of which tab is active.
  const [pages, posts, rowsRes, linksRes] = await Promise.all([
    localeStatsFor('wp_pages'),
    localeStatsFor('posts'),
    supabaseServer.from(table).select(`id, locale, ${catCol}`),
    supabaseServer.from('content_translations').select('group_id, content_id, locale').eq('content_type', type),
  ]);

  const idToGroup = new Map<string, string>();
  for (const l of (linksRes.data ?? []) as Array<{ group_id: string; content_id: string }>) {
    idToGroup.set(l.content_id, l.group_id);
  }

  type G = { pt: boolean; en: boolean; es: boolean; fr: boolean; it: boolean };
  const groups = new Map<string, G>();
  const cat = new Map<string, CategoryCoverage>();
  const bump = (label: string, locale: CmsLocale) => {
    const c = cat.get(label) ?? { label, pt: 0, en: 0, es: 0, fr: 0, it: 0, total: 0 };
    c[locale]++;
    c.total++;
    cat.set(label, c);
  };

  for (const r of (rowsRes.data ?? []) as Array<{ id: string; locale: CmsLocale; category?: string | null; tags?: string[] | null }>) {
    const gid = idToGroup.get(r.id) ?? `solo:${r.id}`;
    const g = groups.get(gid) ?? { pt: false, en: false, es: false, fr: false, it: false };
    g[r.locale] = true;
    groups.set(gid, g);

    if (type === 'page') {
      bump((r.category && r.category.trim()) || 'Sem categoria', r.locale);
    } else {
      const tags = (r.tags ?? []).filter(Boolean);
      if (tags.length === 0) bump('Sem etiqueta', r.locale);
      else for (const t of tags) bump(t, r.locale);
    }
  }

  let ptGroups = 0, en = 0, es = 0, fr = 0, it = 0, complete = 0;
  for (const g of groups.values()) {
    if (!g.pt) continue;
    ptGroups++;
    if (g.en) en++;
    if (g.es) es++;
    if (g.fr) fr++;
    if (g.it) it++;
    if (g.en && g.es && g.fr && g.it) complete++;
  }

  return {
    pages,
    posts,
    coverage: { ptGroups, en, es, fr, it, complete, missingEn: ptGroups - en, missingEs: ptGroups - es, missingFr: ptGroups - fr, missingIt: ptGroups - it },
    byCategory: [...cat.values()].sort((a, b) => b.total - a.total),
  };
}

export type CmsRevision = {
  id: string;
  content_type: CmsContentType;
  content_id: string;
  title: string | null;
  meta_title: string | null;
  meta_description: string | null;
  slug: string | null;
  status: CmsStatus | null;
  content_html: string;
  created_at: string;
  created_by: string | null;
  change_summary: string | null;
};

export async function cmsListRevisions(
  type: CmsContentType,
  contentId: string,
  limit = 50,
): Promise<CmsRevision[]> {
  if (!supabaseServer) return [];
  const { data, error } = await supabaseServer
    .from('content_revisions')
    .select('id, content_type, content_id, title, meta_title, meta_description, slug, status, content_html, created_at, created_by, change_summary')
    .eq('content_type', type)
    .eq('content_id', contentId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[cms] listRevisions', error);
    return [];
  }
  return (data ?? []) as unknown as CmsRevision[];
}

export async function cmsGetRevision(revisionId: string): Promise<CmsRevision | null> {
  if (!supabaseServer) return null;
  const { data, error } = await supabaseServer
    .from('content_revisions')
    .select('id, content_type, content_id, title, meta_title, meta_description, slug, status, content_html, created_at, created_by, change_summary')
    .eq('id', revisionId)
    .maybeSingle();
  if (error) {
    console.error('[cms] getRevision', error);
    return null;
  }
  return (data as unknown as CmsRevision) ?? null;
}

export async function cmsListCategories(): Promise<string[]> {
  if (!supabaseServer) return [];
  const { data } = await supabaseServer
    .from('wp_pages')
    .select('category')
    .not('category', 'is', null);
  const set = new Set<string>();
  for (const r of (data ?? []) as Array<{ category: string | null }>) {
    if (r.category) set.add(r.category);
  }
  return [...set].sort();
}

export type CategoryStat = {
  category: string;
  total: number;
  draft: number;
  published: number;
};

export async function cmsCategoriesWithStats(): Promise<CategoryStat[]> {
  if (!supabaseServer) return [];
  const { data } = await supabaseServer
    .from('wp_pages')
    .select('category, status');
  const map = new Map<string, CategoryStat>();
  for (const r of (data ?? []) as Array<{ category: string | null; status: string }>) {
    const key = r.category ?? '(sem categoria)';
    const stat = map.get(key) ?? { category: key, total: 0, draft: 0, published: 0 };
    stat.total++;
    if (r.status === 'draft') stat.draft++;
    if (r.status === 'published') stat.published++;
    map.set(key, stat);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}
