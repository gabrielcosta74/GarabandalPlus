import type { SupabaseClient } from '@supabase/supabase-js';

export type SitemapTranslationLink = {
  group_id: string;
  content_type: 'page' | 'post';
  content_id: string;
};

/** Supabase caps each response at 1,000 rows; newer translation groups must survive that cap. */
export async function fetchSitemapTranslationLinks(client: SupabaseClient): Promise<SitemapTranslationLink[]> {
  const links: SitemapTranslationLink[] = [];
  const batchSize = 1000;
  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await client
      .from('content_translations')
      .select('group_id, content_type, content_id')
      .in('content_type', ['page', 'post'])
      .order('content_type')
      .order('content_id')
      .range(offset, offset + batchSize - 1);
    if (error) throw new Error(`Sitemap translation lookup failed: ${error.code}`);
    const batch = (data ?? []) as SitemapTranslationLink[];
    links.push(...batch);
    if (batch.length < batchSize) return links;
  }
}
