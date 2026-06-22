import 'server-only';
import crypto from 'node:crypto';
import { supabaseServer } from '../supabase';
import { sanitizeAndValidate, buildExcerpt } from './sanitize';
import { mtUnreviewedAvailable, markMtUnreviewedMissing, isMissingMtColumn } from './schema';
import type { CmsLocale, CmsStatus, CmsContentType } from './queries';

/** Field set when a row's machine-translation review state should be written. */
function mtField(value: boolean): Record<string, boolean> {
  return mtUnreviewedAvailable() ? { mt_unreviewed: value } : {};
}

/**
 * Update a row, transparently retrying without `mt_unreviewed` if the column
 * isn't there yet (pre-migration). Keeps saves working before the migration is
 * applied; the review flag is simply dropped until then.
 */
async function updateRowWithMtFallback<T>(
  table: 'wp_pages' | 'posts',
  id: string,
  update: Record<string, unknown>,
  returning: string,
): Promise<{ data: T | null; error: { message: string } | null }> {
  if (!supabaseServer) return { data: null, error: { message: 'No DB' } };
  let res = await supabaseServer.from(table).update(update).eq('id', id).select(returning).single();
  if (res.error && isMissingMtColumn(res.error) && 'mt_unreviewed' in update) {
    markMtUnreviewedMissing();
    const rest = { ...update };
    delete rest.mt_unreviewed;
    res = await supabaseServer.from(table).update(rest).eq('id', id).select(returning).single();
  }
  return { data: (res.data as T | null) ?? null, error: res.error };
}

export type SavePagePayload = {
  id: string;
  title: string;
  slug: string;
  locale: CmsLocale;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  category: string | null;
  parent_slug: string | null;
  status: CmsStatus;
  content_html: string;
  content_json: unknown;
  /** ISO of the row's updated_at when the editor opened it. Used for conflict detection. */
  client_version: string;
};

export type SavePostPayload = {
  id: string;
  title: string;
  slug: string;
  locale: CmsLocale;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  cover_image_url: string | null;
  tags: string[];
  featured: boolean;
  status: CmsStatus;
  published_at: string | null;
  content_html: string;
  content_json: unknown;
  client_version: string;
};

export type SaveResult =
  | { ok: true; row: { id: string; updated_at: string; status: CmsStatus; slug: string } }
  | { ok: false; code: 'conflict' | 'not_found' | 'db_error' | 'forbidden' | 'invalid'; message: string };

async function snapshotRevision(
  type: CmsContentType,
  id: string,
  before: Record<string, unknown>,
  userId: string,
): Promise<void> {
  if (!supabaseServer) return;
  await supabaseServer.from('content_revisions').insert({
    content_type: type,
    content_id: id,
    content_html: (before.content_html as string) ?? '',
    content_json: before.content_json ?? null,
    title: before.title ?? null,
    meta_title: before.meta_title ?? null,
    meta_description: before.meta_description ?? null,
    og_image_url: before.og_image_url ?? null,
    status: before.status ?? null,
    slug: before.slug ?? null,
    created_by: userId,
  });
}

async function writeAudit(
  userId: string,
  email: string,
  action: string,
  entityType: CmsContentType,
  entityId: string,
  diff: Record<string, unknown> = {},
): Promise<void> {
  if (!supabaseServer) return;
  // best-effort; audit_logs may have varying schema, so we coerce loosely
  try {
    await supabaseServer.from('admin_audit_logs').insert({
      user_id: userId,
      user_email: email,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: diff,
    });
  } catch (e) {
    console.warn('[cms] audit log write failed', (e as Error).message);
  }
}

export type CreatePagePayload = {
  title: string;
  slug: string;
  locale: CmsLocale;
};
export type CreatePostPayload = CreatePagePayload;

export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; code: 'duplicate' | 'invalid' | 'db_error'; message: string };

function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

export async function createPage(
  payload: CreatePagePayload,
  user: { id: string; email: string },
): Promise<CreateResult> {
  if (!supabaseServer) return { ok: false, code: 'db_error', message: 'No DB' };
  const title = payload.title.trim();
  const slug = normalizeSlug(payload.slug || payload.title);
  if (!title) return { ok: false, code: 'invalid', message: 'Title required' };
  if (!slug) return { ok: false, code: 'invalid', message: 'Slug required' };

  const { data, error } = await supabaseServer
    .from('wp_pages')
    .insert({
      title,
      slug,
      locale: payload.locale,
      status: 'draft',
      content_html: '',
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return { ok: false, code: 'duplicate', message: 'Já existe uma página com esse slug+idioma.' };
    return { ok: false, code: 'db_error', message: error.message };
  }
  await writeAudit(user.id, user.email, 'cms.page.create', 'page', data.id, { title, slug, locale: payload.locale });
  return { ok: true, id: data.id };
}

export async function createPost(
  payload: CreatePostPayload,
  user: { id: string; email: string },
): Promise<CreateResult> {
  if (!supabaseServer) return { ok: false, code: 'db_error', message: 'No DB' };
  const title = payload.title.trim();
  const slug = normalizeSlug(payload.slug || payload.title);
  if (!title) return { ok: false, code: 'invalid', message: 'Title required' };
  if (!slug) return { ok: false, code: 'invalid', message: 'Slug required' };

  const { data, error } = await supabaseServer
    .from('posts')
    .insert({
      title,
      slug,
      locale: payload.locale,
      status: 'draft',
      content_html: '',
      tags: [],
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return { ok: false, code: 'duplicate', message: 'Já existe um artigo com esse slug+idioma.' };
    return { ok: false, code: 'db_error', message: error.message };
  }
  await writeAudit(user.id, user.email, 'cms.post.create', 'post', data.id, { title, slug, locale: payload.locale });
  return { ok: true, id: data.id };
}

/**
 * Check if a slug+locale is available for the given content type.
 * Used by the editor to give live feedback as the user types a slug.
 */
/**
 * Rollback to a specific revision: snapshots the current state, then writes
 * the revision's content/title/meta/slug back to the live row.
 * Status of the live row is NOT changed (you don't accidentally publish).
 */
export async function rollbackToRevision(
  type: CmsContentType,
  revisionId: string,
  user: { id: string; email: string },
): Promise<{ ok: true; contentId: string } | { ok: false; message: string }> {
  if (!supabaseServer) return { ok: false, message: 'No DB' };
  const { data: rev } = await supabaseServer
    .from('content_revisions')
    .select('content_id, content_type, content_html, title, meta_title, meta_description, og_image_url, slug')
    .eq('id', revisionId)
    .maybeSingle();
  if (!rev) return { ok: false, message: 'Revisão não encontrada' };
  if (rev.content_type !== type) return { ok: false, message: 'Tipo de conteúdo não corresponde' };

  const table = type === 'page' ? 'wp_pages' : 'posts';
  const { data: current } = await supabaseServer
    .from(table)
    .select('id, content_html, content_json, title, meta_title, meta_description, og_image_url, status, slug')
    .eq('id', rev.content_id)
    .maybeSingle();
  if (!current) return { ok: false, message: 'Linha actual não encontrada' };

  await snapshotRevision(type, rev.content_id, current, user.id);

  const update: Record<string, unknown> = {
    content_html: sanitizeAndValidate(rev.content_html ?? ''),
    excerpt: buildExcerpt(rev.content_html ?? ''),
  };
  if (rev.title) update.title = rev.title;
  if (rev.meta_title !== undefined) update.meta_title = rev.meta_title;
  if (rev.meta_description !== undefined) update.meta_description = rev.meta_description;
  if (rev.og_image_url !== undefined) update.og_image_url = rev.og_image_url;
  // slug NOT auto-restored to avoid breaking redirects unintentionally

  const { error } = await supabaseServer.from(table).update(update).eq('id', rev.content_id);
  if (error) return { ok: false, message: error.message };

  await writeAudit(user.id, user.email, 'cms.rollback', type, rev.content_id, { from_revision: revisionId });
  return { ok: true, contentId: rev.content_id };
}

export async function renameCategory(
  oldName: string,
  newName: string,
  user: { id: string; email: string },
): Promise<{ ok: boolean; affected: number; message?: string }> {
  if (!supabaseServer) return { ok: false, affected: 0, message: 'No DB' };
  const next = newName.trim();
  if (!next) return { ok: false, affected: 0, message: 'Nome vazio' };
  const { data, error } = await supabaseServer
    .from('wp_pages')
    .update({ category: next })
    .eq('category', oldName)
    .select('id');
  if (error) return { ok: false, affected: 0, message: error.message };
  await writeAudit(user.id, user.email, 'cms.category.rename', 'page', oldName, { from: oldName, to: next, count: data?.length ?? 0 });
  return { ok: true, affected: data?.length ?? 0 };
}

export async function deleteCategory(
  name: string,
  user: { id: string; email: string },
): Promise<{ ok: boolean; affected: number }> {
  if (!supabaseServer) return { ok: false, affected: 0 };
  const { data, error } = await supabaseServer
    .from('wp_pages')
    .update({ category: null })
    .eq('category', name)
    .select('id');
  if (error) return { ok: false, affected: 0 };
  await writeAudit(user.id, user.email, 'cms.category.clear', 'page', name, { name, count: data?.length ?? 0 });
  return { ok: true, affected: data?.length ?? 0 };
}

/**
 * Create a new content row in `targetLocale` linked to the same translation
 * group as the source row. Optionally pre-fills the new row with the source
 * row's content_html / metadata so the editor opens with something to translate.
 */
export async function createTranslationPeer(
  type: CmsContentType,
  sourceId: string,
  targetLocale: CmsLocale,
  options: { copyContent: boolean },
  user: { id: string; email: string },
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (!supabaseServer) return { ok: false, message: 'No DB' };
  const table = type === 'page' ? 'wp_pages' : 'posts';

  // Load source for copying + slug + current group_id (if any)
  const { data: source } = await supabaseServer
    .from(table)
    .select('*')
    .eq('id', sourceId)
    .maybeSingle();
  if (!source) return { ok: false, message: 'Source not found' };

  const { data: existingLink } = await supabaseServer
    .from('content_translations')
    .select('group_id')
    .eq('content_type', type)
    .eq('content_id', sourceId)
    .maybeSingle();

  // Resolve group_id: existing or new uuid (Postgres default)
  let groupId = existingLink?.group_id ?? null;
  if (!groupId) {
    // create a fresh group by inserting source first
    groupId = crypto.randomUUID();
    const { error } = await supabaseServer.from('content_translations').insert({
      group_id: groupId,
      content_type: type,
      content_id: sourceId,
      locale: source.locale,
    });
    if (error && error.code !== '23505') return { ok: false, message: error.message };
  } else {
    // make sure the group already has someone in target locale; if so, refuse
    const { count } = await supabaseServer
      .from('content_translations')
      .select('content_id', { head: true, count: 'exact' })
      .eq('group_id', groupId)
      .eq('locale', targetLocale);
    if ((count ?? 0) > 0) return { ok: false, message: 'Já existe peer nesse idioma' };
  }

  const baseInsert: Record<string, unknown> = {
    slug: source.slug,
    locale: targetLocale,
    title: options.copyContent ? source.title : `${source.title} [${targetLocale.toUpperCase()}]`,
    meta_title: source.meta_title,
    meta_description: source.meta_description,
    og_image_url: source.og_image_url,
    excerpt: source.excerpt,
    content_html: options.copyContent ? source.content_html : '',
    content_json: options.copyContent ? source.content_json : null,
    status: 'draft' as const,
  };
  if (type === 'page') {
    baseInsert.category = source.category;
    baseInsert.parent_slug = source.parent_slug;
  } else {
    baseInsert.cover_image_url = source.cover_image_url;
    baseInsert.tags = source.tags ?? [];
    baseInsert.featured = false;
  }

  const { data: created, error: insErr } = await supabaseServer
    .from(table)
    .insert(baseInsert)
    .select('id')
    .single();
  if (insErr) {
    if (insErr.code === '23505') return { ok: false, message: 'Slug+locale já existe' };
    return { ok: false, message: insErr.message };
  }

  await supabaseServer.from('content_translations').insert({
    group_id: groupId,
    content_type: type,
    content_id: created.id,
    locale: targetLocale,
  });

  await writeAudit(user.id, user.email, `cms.${type}.create_peer`, type, created.id, {
    from: sourceId,
    target_locale: targetLocale,
    group_id: groupId,
  });

  return { ok: true, id: created.id };
}

/**
 * Write machine-translated content into an existing row and flag it as
 * unreviewed (mt_unreviewed = true). Used by the batch translateGroup action.
 * Unlike savePage/savePost this has no optimistic-concurrency check — it runs
 * server-side right after the content was created/translated — but it still
 * snapshots a revision and sanitizes the HTML. Title/meta are only overwritten
 * when a non-empty translation is provided.
 */
export async function applyMachineTranslation(
  type: CmsContentType,
  id: string,
  fields: { title?: string; meta_description?: string; content_html?: string },
  user: { id: string; email: string },
): Promise<{ ok: true; updated_at: string } | { ok: false; message: string }> {
  if (!supabaseServer) return { ok: false, message: 'No DB' };
  const table = type === 'page' ? 'wp_pages' : 'posts';

  const { data: current } = await supabaseServer
    .from(table)
    .select('id, content_html, content_json, title, meta_title, meta_description, og_image_url, status, slug')
    .eq('id', id)
    .maybeSingle();
  if (!current) return { ok: false, message: 'Row not found' };

  await snapshotRevision(type, id, current, user.id);

  const update: Record<string, unknown> = { ...mtField(true) };
  if (fields.title && fields.title.trim()) update.title = fields.title.trim();
  if (fields.meta_description && fields.meta_description.trim()) update.meta_description = fields.meta_description.trim();
  if (fields.content_html && fields.content_html.trim()) {
    const cleanHtml = sanitizeAndValidate(fields.content_html);
    update.content_html = cleanHtml;
    update.content_json = null; // body changed outside TipTap; drop stale JSON
    update.excerpt = buildExcerpt(cleanHtml);
  }

  const { data: updated, error } = await updateRowWithMtFallback<{ updated_at: string }>(table, id, update, 'updated_at');
  if (error || !updated) return { ok: false, message: error?.message ?? 'Update failed' };

  await writeAudit(user.id, user.email, `cms.${type}.machine_translate`, type, id, { fields: Object.keys(update) });
  return { ok: true, updated_at: updated.updated_at };
}

export async function setMediaAlt(
  mediaId: string,
  alt: string,
  user: { id: string; email: string },
): Promise<{ ok: boolean; message?: string }> {
  if (!supabaseServer) return { ok: false, message: 'No DB' };
  const trimmed = alt.trim();
  const { error } = await supabaseServer
    .from('media')
    .update({ alt: trimmed || null })
    .eq('id', mediaId);
  if (error) return { ok: false, message: error.message };
  await writeAudit(user.id, user.email, 'cms.media.alt', 'page', mediaId, { alt: trimmed });
  return { ok: true };
}

export async function setPostFeatured(
  postId: string,
  featured: boolean,
  user: { id: string; email: string },
): Promise<{ ok: boolean; message?: string }> {
  if (!supabaseServer) return { ok: false, message: 'No DB' };
  const { error } = await supabaseServer
    .from('posts')
    .update({ featured })
    .eq('id', postId);
  if (error) return { ok: false, message: error.message };
  await writeAudit(user.id, user.email, 'cms.post.featured', 'post', postId, { featured });
  return { ok: true };
}

/**
 * Toggle the featured_in_nav flag on a single page or post (used by the
 * /admin/cms/navigation panel). When featuring a row for the first time we
 * also push it to the end of the existing sort order so it doesn't collide
 * with already-featured peers at sort=0.
 */
export async function setNavFeatured(
  type: 'page' | 'post',
  id: string,
  featured: boolean,
  user: { id: string; email: string },
): Promise<{ ok: boolean; message?: string }> {
  if (!supabaseServer) return { ok: false, message: 'No DB' };
  const table = type === 'page' ? 'wp_pages' : 'posts';
  const update: Record<string, unknown> = { featured_in_nav: featured };
  if (featured) {
    // Find current row's category, then place it after existing featured rows.
    const catCol = type === 'page' ? 'category' : 'tags';
    const { data: row } = await supabaseServer.from(table).select(`${catCol}, locale`).eq('id', id).single();
    if (row) {
      const cat = type === 'page' ? (row as { category: string | null }).category : ((row as { tags: string[] | null }).tags ?? [])[0];
      const locale = (row as { locale: string }).locale;
      if (cat) {
        const filter = type === 'page'
          ? supabaseServer.from(table).select('nav_sort_order').eq('category', cat).eq('locale', locale).eq('featured_in_nav', true)
          : supabaseServer.from(table).select('nav_sort_order').contains('tags', [cat]).eq('locale', locale).eq('featured_in_nav', true);
        const { data: peers } = await filter.order('nav_sort_order', { ascending: false }).limit(1);
        const next = ((peers?.[0]?.nav_sort_order as number | undefined) ?? -1) + 1;
        update.nav_sort_order = next;
      }
    }
  }
  const { error } = await supabaseServer.from(table).update(update).eq('id', id);
  if (error) return { ok: false, message: error.message };
  await writeAudit(user.id, user.email, `cms.${type}.nav_featured`, type, id, { featured });
  return { ok: true };
}

/**
 * Bulk reorder featured items in a category. Receives the desired final
 * order as a list of ids and writes nav_sort_order = index. Used by the
 * drag-and-drop UI in the nav panel.
 */
export async function reorderNavFeatured(
  type: 'page' | 'post',
  ids: string[],
  user: { id: string; email: string },
): Promise<{ ok: boolean; message?: string }> {
  if (!supabaseServer) return { ok: false, message: 'No DB' };
  const table = type === 'page' ? 'wp_pages' : 'posts';
  // Apply sequentially — Supabase has no atomic batch update with distinct
  // values per row. The list is small (≤20 featured per category) so this
  // is fine.
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabaseServer.from(table).update({ nav_sort_order: i }).eq('id', ids[i]);
    if (error) return { ok: false, message: error.message };
  }
  await writeAudit(user.id, user.email, `cms.${type}.nav_reorder`, type, 'bulk', { ids });
  return { ok: true };
}

export type BulkAction =
  | { kind: 'set_status'; status: CmsStatus }
  | { kind: 'set_category'; category: string | null }
  | { kind: 'set_featured'; featured: boolean }
  | { kind: 'delete' };

export async function bulkApply(
  type: CmsContentType,
  ids: string[],
  action: BulkAction,
  user: { id: string; email: string },
): Promise<{ ok: boolean; affected: number; message?: string }> {
  if (!supabaseServer) return { ok: false, affected: 0, message: 'No DB' };
  if (ids.length === 0) return { ok: true, affected: 0 };
  const table = type === 'page' ? 'wp_pages' : 'posts';

  if (action.kind === 'delete') {
    const { data, error } = await supabaseServer.from(table).delete().in('id', ids).select('id');
    if (error) return { ok: false, affected: 0, message: error.message };
    await writeAudit(user.id, user.email, `cms.${type}.bulk_delete`, type, 'bulk', { ids });
    return { ok: true, affected: data?.length ?? 0 };
  }

  const update: Record<string, unknown> = {};
  if (action.kind === 'set_status') {
    update.status = action.status;
    if (action.status === 'published') {
      // bump published_at if going live for the first time — done per-row below
    }
  }
  if (action.kind === 'set_category') {
    if (type !== 'page') return { ok: false, affected: 0, message: 'Categoria só para páginas' };
    update.category = action.category;
  }
  if (action.kind === 'set_featured') {
    if (type !== 'post') return { ok: false, affected: 0, message: 'Featured só para artigos' };
    update.featured = action.featured;
  }

  // For status=published we want to set published_at where it's null.
  if (action.kind === 'set_status' && action.status === 'published') {
    const nowIso = new Date().toISOString();
    const { data: rows, error: e1 } = await supabaseServer
      .from(table)
      .update({ status: 'published', published_at: nowIso })
      .in('id', ids)
      .is('published_at', null)
      .select('id');
    const { data: rows2, error: e2 } = await supabaseServer
      .from(table)
      .update({ status: 'published' })
      .in('id', ids)
      .not('published_at', 'is', null)
      .select('id');
    if (e1 || e2) return { ok: false, affected: 0, message: e1?.message ?? e2?.message };
    const affected = (rows?.length ?? 0) + (rows2?.length ?? 0);
    await writeAudit(user.id, user.email, `cms.${type}.bulk_publish`, type, 'bulk', { ids, affected });
    return { ok: true, affected };
  }

  const { data, error } = await supabaseServer.from(table).update(update).in('id', ids).select('id');
  if (error) return { ok: false, affected: 0, message: error.message };
  await writeAudit(user.id, user.email, `cms.${type}.bulk_update`, type, 'bulk', { ids, action });
  return { ok: true, affected: data?.length ?? 0 };
}

export async function isSlugAvailable(
  type: CmsContentType,
  slug: string,
  locale: CmsLocale,
  excludeId?: string,
): Promise<boolean> {
  if (!supabaseServer) return false;
  const table = type === 'page' ? 'wp_pages' : 'posts';
  let q = supabaseServer.from(table).select('id', { head: true, count: 'exact' })
    .eq('slug', slug)
    .eq('locale', locale);
  if (excludeId) q = q.neq('id', excludeId);
  const { count, error } = await q;
  if (error) return false;
  return (count ?? 0) === 0;
}

async function maybeAddRedirect(
  oldSlug: string,
  newSlug: string,
  locale: CmsLocale,
  type: CmsContentType,
): Promise<void> {
  if (!supabaseServer || oldSlug === newSlug) return;
  const prefix = locale === 'pt' ? '' : `/${locale}`;
  const seg = type === 'post' ? '/l/' : '/';
  const source_path = `${prefix}${seg}${oldSlug}`;
  const destination_path = `${prefix}${seg}${newSlug}`;
  await supabaseServer
    .from('redirects')
    .upsert({
      source_path,
      destination_path,
      status_code: 301,
      reason: `Slug renamed (${type})`,
    }, { onConflict: 'source_path' });
}

/** Idempotent save with optimistic concurrency. Bumps published_at on first publish. */
export async function savePage(
  payload: SavePagePayload,
  user: { id: string; email: string },
): Promise<SaveResult> {
  if (!supabaseServer) return { ok: false, code: 'db_error', message: 'No DB' };

  if (!payload.title.trim()) return { ok: false, code: 'invalid', message: 'Title required' };
  if (!payload.slug.trim()) return { ok: false, code: 'invalid', message: 'Slug required' };

  // Read current row for conflict detection + revision snapshot
  const { data: current, error: readErr } = await supabaseServer
    .from('wp_pages')
    .select('id, slug, updated_at, content_html, content_json, title, meta_title, meta_description, og_image_url, status')
    .eq('id', payload.id)
    .maybeSingle();
  if (readErr) return { ok: false, code: 'db_error', message: readErr.message };
  if (!current) return { ok: false, code: 'not_found', message: 'Page not found' };
  if (current.updated_at !== payload.client_version) {
    return { ok: false, code: 'conflict', message: 'Page was modified by another session.' };
  }

  const cleanHtml = sanitizeAndValidate(payload.content_html);
  const excerpt = buildExcerpt(cleanHtml);
  const oldSlug = current.slug;

  // Snapshot before the write so history captures the previous state.
  await snapshotRevision('page', payload.id, current, user.id);

  const update = {
    title: payload.title.trim(),
    slug: payload.slug.trim(),
    locale: payload.locale,
    meta_title: payload.meta_title?.trim() || null,
    meta_description: payload.meta_description?.trim() || null,
    og_image_url: payload.og_image_url?.trim() || null,
    category: payload.category?.trim() || null,
    parent_slug: payload.parent_slug?.trim() || null,
    status: payload.status,
    content_html: cleanHtml,
    content_json: payload.content_json ?? null,
    excerpt,
    // A manual save counts as a human review.
    ...mtField(false),
    published_at:
      payload.status === 'published'
        ? (current as any).published_at ?? new Date().toISOString()
        : null,
  };

  const { data: updated, error: writeErr } = await updateRowWithMtFallback<{ id: string; updated_at: string; status: CmsStatus; slug: string }>(
    'wp_pages',
    payload.id,
    update,
    'id, updated_at, status, slug',
  );

  if (writeErr || !updated) {
    return { ok: false, code: 'db_error', message: writeErr?.message ?? 'Update failed' };
  }

  await maybeAddRedirect(oldSlug, updated.slug, payload.locale, 'page');
  await writeAudit(user.id, user.email, 'cms.page.save', 'page', payload.id, {
    before: { slug: oldSlug, status: current.status, title: current.title },
    after: { slug: updated.slug, status: updated.status, title: update.title },
  });

  return { ok: true, row: updated };
}

export async function savePost(
  payload: SavePostPayload,
  user: { id: string; email: string },
): Promise<SaveResult> {
  if (!supabaseServer) return { ok: false, code: 'db_error', message: 'No DB' };
  if (!payload.title.trim()) return { ok: false, code: 'invalid', message: 'Title required' };
  if (!payload.slug.trim()) return { ok: false, code: 'invalid', message: 'Slug required' };

  const { data: current, error: readErr } = await supabaseServer
    .from('posts')
    .select('id, slug, updated_at, content_html, content_json, title, meta_title, meta_description, og_image_url, status, published_at, cover_image_url, tags, featured')
    .eq('id', payload.id)
    .maybeSingle();
  if (readErr) return { ok: false, code: 'db_error', message: readErr.message };
  if (!current) return { ok: false, code: 'not_found', message: 'Post not found' };
  if (current.updated_at !== payload.client_version) {
    return { ok: false, code: 'conflict', message: 'Post was modified by another session.' };
  }

  const cleanHtml = sanitizeAndValidate(payload.content_html);
  const excerpt = buildExcerpt(cleanHtml);
  const oldSlug = current.slug;

  await snapshotRevision('post', payload.id, current, user.id);

  const update = {
    title: payload.title.trim(),
    slug: payload.slug.trim(),
    locale: payload.locale,
    meta_title: payload.meta_title?.trim() || null,
    meta_description: payload.meta_description?.trim() || null,
    og_image_url: payload.og_image_url?.trim() || null,
    cover_image_url: payload.cover_image_url?.trim() || null,
    tags: payload.tags ?? [],
    featured: !!payload.featured,
    status: payload.status,
    content_html: cleanHtml,
    content_json: payload.content_json ?? null,
    excerpt,
    // A manual save counts as a human review.
    ...mtField(false),
    published_at:
      payload.status === 'published'
        ? payload.published_at ?? (current as any).published_at ?? new Date().toISOString()
        : null,
  };

  const { data: updated, error: writeErr } = await updateRowWithMtFallback<{ id: string; updated_at: string; status: CmsStatus; slug: string }>(
    'posts',
    payload.id,
    update,
    'id, updated_at, status, slug',
  );

  if (writeErr || !updated) {
    return { ok: false, code: 'db_error', message: writeErr?.message ?? 'Update failed' };
  }

  await maybeAddRedirect(oldSlug, updated.slug, payload.locale, 'post');
  await writeAudit(user.id, user.email, 'cms.post.save', 'post', payload.id, {
    before: { slug: oldSlug, status: current.status, featured: (current as any).featured },
    after: { slug: updated.slug, status: updated.status, featured: update.featured },
  });

  return { ok: true, row: updated };
}
