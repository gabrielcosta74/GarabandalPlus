'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '../../../lib/cms/authz';
import {
  savePage as savePageMutation,
  savePost as savePostMutation,
  createPage as createPageMutation,
  createPost as createPostMutation,
  isSlugAvailable as isSlugAvailableMutation,
  rollbackToRevision as rollbackMutation,
  renameCategory as renameCategoryMutation,
  deleteCategory as deleteCategoryMutation,
  setPostFeatured as setPostFeaturedMutation,
  setNavFeatured as setNavFeaturedMutation,
  reorderNavFeatured as reorderNavFeaturedMutation,
  setMediaAlt as setMediaAltMutation,
  bulkApply as bulkApplyMutation,
  createTranslationPeer as createTranslationPeerMutation,
  applyMachineTranslation as applyMachineTranslationMutation,
  type BulkAction,
  type SavePagePayload,
  type SavePostPayload,
  type CreatePagePayload,
  type CreatePostPayload,
} from '../../../lib/cms/mutations';
import { cmsResolveTranslationGroup, type CmsContentType, type CmsLocale } from '../../../lib/cms/queries';
import { translateText } from '../../../lib/cms/translate';
import { pagePublicPaths, postPublicPaths, SITEMAP_PATH } from '../../../lib/cms/cache-keys';

const TRANSLATE_TARGETS: CmsLocale[] = ['en', 'es', 'fr', 'it'];

export type TranslateGroupResult = {
  ok: boolean;
  message?: string;
  results: { locale: CmsLocale; status: 'translated' | 'created' | 'skipped' | 'error'; message?: string }[];
};

/**
 * Batch-translate a whole translation group from PT into every target locale
 * that is still missing or empty. Creates the missing peer rows, runs the AI
 * translation for body/title/meta, and flags each result as machine-translated
 * (mt_unreviewed). Existing locales that already have content are left untouched
 * so human translations are never clobbered.
 */
export async function translateGroupAction(
  type: CmsContentType,
  groupId: string,
): Promise<TranslateGroupResult> {
  const admin = await requireAdmin();
  const group = await cmsResolveTranslationGroup(type, groupId);
  const pt = group.pt;
  if (!pt || !pt.content_html?.trim()) {
    return { ok: false, message: 'Precisas de um original em PT com conteúdo antes de traduzir.', results: [] };
  }

  const results: TranslateGroupResult['results'] = [];
  for (const locale of TRANSLATE_TARGETS) {
    const existing = group[locale];
    const isEmpty = !existing?.content_html?.trim();
    // Skip locales that already have human/AI content — don't overwrite work.
    if (existing && !isEmpty) {
      results.push({ locale, status: 'skipped', message: 'Já tem conteúdo' });
      continue;
    }

    let targetId = existing?.id ?? null;
    let created = false;
    if (!targetId) {
      const c = await createTranslationPeerMutation(type, pt.id, locale, { copyContent: false }, admin);
      if (!c.ok) {
        results.push({ locale, status: 'error', message: c.message });
        continue;
      }
      targetId = c.id;
      created = true;
    }

    const [body, title, meta] = await Promise.all([
      translateText({ source: pt.content_html ?? '', sourceLocale: 'pt', targetLocale: locale, kind: 'body' }),
      translateText({ source: pt.title, sourceLocale: 'pt', targetLocale: locale, kind: 'short' }),
      pt.meta_description?.trim()
        ? translateText({ source: pt.meta_description, sourceLocale: 'pt', targetLocale: locale, kind: 'short' })
        : Promise.resolve({ ok: true as const, translated: '' }),
    ]);

    if (!body.ok) {
      results.push({ locale, status: 'error', message: body.message });
      continue;
    }

    const r = await applyMachineTranslationMutation(
      type,
      targetId,
      {
        content_html: body.translated,
        title: title.ok ? title.translated : undefined,
        meta_description: meta.ok ? meta.translated : undefined,
      },
      admin,
    );
    if (!r.ok) {
      results.push({ locale, status: 'error', message: r.message });
      continue;
    }
    results.push({ locale, status: created ? 'created' : 'translated' });
  }

  revalidatePath('/admin/cms', 'layout');
  revalidatePath(SITEMAP_PATH);
  return { ok: true, results };
}

export async function savePageAction(payload: SavePagePayload) {
  const admin = await requireAdmin();
  const result = await savePageMutation(payload, admin);
  if (result.ok) {
    for (const p of pagePublicPaths(result.row.slug, payload.locale)) revalidatePath(p);
    revalidatePath(SITEMAP_PATH);
    revalidatePath('/admin/cms', 'layout');
  }
  return result;
}

export async function savePostAction(payload: SavePostPayload) {
  const admin = await requireAdmin();
  const result = await savePostMutation(payload, admin);
  if (result.ok) {
    for (const p of postPublicPaths(result.row.slug, payload.locale)) revalidatePath(p);
    revalidatePath(SITEMAP_PATH);
    revalidatePath('/admin/cms', 'layout');
  }
  return result;
}

export async function redirectToList(type: 'pages' | 'posts'): Promise<void> {
  redirect(`/admin/cms/${type}`);
}

export async function createPageAction(payload: CreatePagePayload) {
  const admin = await requireAdmin();
  const result = await createPageMutation(payload, admin);
  if (result.ok) revalidatePath('/admin/cms', 'layout');
  return result;
}

export async function createPostAction(payload: CreatePostPayload) {
  const admin = await requireAdmin();
  const result = await createPostMutation(payload, admin);
  if (result.ok) revalidatePath('/admin/cms', 'layout');
  return result;
}

export async function checkSlugAction(
  type: CmsContentType,
  slug: string,
  locale: CmsLocale,
  excludeId?: string,
): Promise<{ available: boolean }> {
  await requireAdmin();
  const available = await isSlugAvailableMutation(type, slug, locale, excludeId);
  return { available };
}

export async function rollbackAction(type: CmsContentType, revisionId: string) {
  const admin = await requireAdmin();
  const result = await rollbackMutation(type, revisionId, admin);
  if (result.ok) revalidatePath('/admin/cms', 'layout');
  return result;
}

export async function renameCategoryAction(oldName: string, newName: string) {
  const admin = await requireAdmin();
  const r = await renameCategoryMutation(oldName, newName, admin);
  if (r.ok) revalidatePath('/admin/cms', 'layout');
  return r;
}

export async function deleteCategoryAction(name: string) {
  const admin = await requireAdmin();
  const r = await deleteCategoryMutation(name, admin);
  if (r.ok) revalidatePath('/admin/cms', 'layout');
  return r;
}

export async function setPostFeaturedAction(postId: string, featured: boolean) {
  const admin = await requireAdmin();
  const r = await setPostFeaturedMutation(postId, featured, admin);
  if (r.ok) revalidatePath('/admin/cms', 'layout');
  return r;
}

export async function setNavFeaturedAction(
  type: 'page' | 'post',
  id: string,
  featured: boolean,
) {
  const admin = await requireAdmin();
  const r = await setNavFeaturedMutation(type, id, featured, admin);
  if (r.ok) {
    revalidatePath('/admin/cms/navigation');
    revalidatePath('/', 'layout');
  }
  return r;
}

export async function reorderNavFeaturedAction(type: 'page' | 'post', ids: string[]) {
  const admin = await requireAdmin();
  const r = await reorderNavFeaturedMutation(type, ids, admin);
  if (r.ok) {
    revalidatePath('/admin/cms/navigation');
    revalidatePath('/', 'layout');
  }
  return r;
}

export async function setMediaAltAction(mediaId: string, alt: string) {
  const admin = await requireAdmin();
  return setMediaAltMutation(mediaId, alt, admin);
}

export async function createTranslationPeerAction(
  type: CmsContentType,
  sourceId: string,
  targetLocale: CmsLocale,
  copyContent: boolean,
) {
  const admin = await requireAdmin();
  const r = await createTranslationPeerMutation(type, sourceId, targetLocale, { copyContent }, admin);
  if (r.ok) revalidatePath('/admin/cms', 'layout');
  return r;
}

export async function bulkApplyAction(
  type: CmsContentType,
  ids: string[],
  action: BulkAction,
) {
  const admin = await requireAdmin();
  const r = await bulkApplyMutation(type, ids, action, admin);
  if (r.ok) {
    revalidatePath('/admin/cms', 'layout');
    revalidatePath(SITEMAP_PATH);
  }
  return r;
}
