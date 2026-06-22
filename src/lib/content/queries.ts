import { supabaseServer } from '../supabase';

export type ContentLocale = 'pt' | 'en' | 'es' | 'fr' | 'it';
export type ContentStatus = 'draft' | 'scheduled' | 'published' | 'archived';

type CommonRow = {
  id: string;
  slug: string;
  locale: ContentLocale;
  title: string;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  excerpt: string | null;
  content_html: string | null;
  status: ContentStatus;
  published_at: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
};

export type WpPageRow = CommonRow & { category: string | null };

export type PostRow = CommonRow & {
  cover_image_url: string | null;
  tags: string[];
};

export type TranslationPeer = {
  locale: ContentLocale;
  slug: string;
  title: string;
};

const COMMON_COLS =
  'id, slug, locale, title, meta_title, meta_description, og_image_url, excerpt, content_html, status, published_at, source_url, created_at, updated_at';
const PAGE_COLS = `${COMMON_COLS}, category`;
const POST_COLS = `${COMMON_COLS}, cover_image_url, tags`;

/**
 * Default visibility for public-facing routes.
 *
 * IMPORTANT: this is 'published' only. Drafts are NEVER served to anonymous
 * visitors. To preview drafts, the route handlers must pass the result of
 * `getPublicStatuses()` from `./preview` — which only widens to drafts when
 * the request is from an authenticated admin with the preview cookie set.
 */
const DEFAULT_STATUS: ContentStatus[] = ['published'];

export async function getPageBySlug(
  slug: string,
  locale: ContentLocale,
  statuses: ContentStatus[] = DEFAULT_STATUS,
): Promise<WpPageRow | null> {
  if (!supabaseServer) return null;
  const { data, error } = await supabaseServer
    .from('wp_pages')
    .select(PAGE_COLS)
    .eq('slug', slug)
    .eq('locale', locale)
    .in('status', statuses)
    .maybeSingle();
  if (error) {
    console.error('[content] getPageBySlug', error);
    return null;
  }
  return (data as unknown as WpPageRow) ?? null;
}

export async function getPostBySlug(
  slug: string,
  locale: ContentLocale,
  statuses: ContentStatus[] = DEFAULT_STATUS,
): Promise<PostRow | null> {
  if (!supabaseServer) return null;
  const { data, error } = await supabaseServer
    .from('posts')
    .select(POST_COLS)
    .eq('slug', slug)
    .eq('locale', locale)
    .in('status', statuses)
    .maybeSingle();
  if (error) {
    console.error('[content] getPostBySlug', error);
    return null;
  }
  return (data as unknown as PostRow) ?? null;
}

/** All published posts in a locale, newest first. */
export async function listPosts(
  locale: ContentLocale,
  opts: { limit?: number; offset?: number; statuses?: ContentStatus[] } = {},
): Promise<PostRow[]> {
  if (!supabaseServer) return [];
  const { limit = 50, offset = 0, statuses = DEFAULT_STATUS } = opts;
  const { data, error } = await supabaseServer
    .from('posts')
    .select(POST_COLS)
    .eq('locale', locale)
    .in('status', statuses)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) {
    console.error('[content] listPosts', error);
    return [];
  }
  return (data ?? []) as unknown as PostRow[];
}

/** All slugs for a locale — used by generateStaticParams + sitemap. */
export async function listAllSlugs(
  table: 'wp_pages' | 'posts',
  locale: ContentLocale,
  statuses: ContentStatus[] = DEFAULT_STATUS,
): Promise<{ slug: string; updated_at: string; published_at?: string | null }[]> {
  if (!supabaseServer) return [];
  const { data, error } = await supabaseServer
    .from(table)
    .select('slug, updated_at, published_at')
    .eq('locale', locale)
    .in('status', statuses)
    .order('updated_at', { ascending: false });
  if (error) {
    console.error(`[content] listAllSlugs(${table})`, error);
    return [];
  }
  return (data ?? []) as { slug: string; updated_at: string; published_at?: string | null }[];
}

/**
 * Find peer translations of a piece of content (PT <-> EN <-> ES).
 * Used to build hreflang and the on-page locale switcher.
 */
export async function getTranslationPeers(
  contentType: 'page' | 'post',
  contentId: string,
): Promise<TranslationPeer[]> {
  if (!supabaseServer) return [];
  const { data: groupRows, error: groupErr } = await supabaseServer
    .from('content_translations')
    .select('group_id')
    .eq('content_type', contentType)
    .eq('content_id', contentId)
    .maybeSingle();
  if (groupErr || !groupRows?.group_id) return [];

  const { data: peers, error: peersErr } = await supabaseServer
    .from('content_translations')
    .select('content_id, locale')
    .eq('content_type', contentType)
    .eq('group_id', groupRows.group_id);
  if (peersErr || !peers) return [];

  const ids = peers.map((p) => p.content_id);
  const table = contentType === 'page' ? 'wp_pages' : 'posts';
  const { data: rows, error: rowsErr } = await supabaseServer
    .from(table)
    .select('id, slug, locale, title, status')
    .in('id', ids);
  if (rowsErr || !rows) return [];

  return rows
    .filter((r) => DEFAULT_STATUS.includes(r.status as ContentStatus))
    .map((r) => ({ locale: r.locale as ContentLocale, slug: r.slug, title: r.title }));
}
