import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { fetchSitemapTranslationLinks } from '../lib/content/sitemap-translations';

function mockClient(range: ReturnType<typeof vi.fn>) {
  const query = { select: vi.fn(), in: vi.fn(), order: vi.fn(), range };
  query.select.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);
  return { client: { from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient, query };
}

describe('sitemap translation pagination', () => {
  it('includes translation groups beyond the 1,000-row response cap', async () => {
    const rows = Array.from({ length: 1449 }, (_, index) => ({
      group_id: `group-${index}`, content_type: 'page', content_id: `page-${index}`,
    }));
    const range = vi.fn(async (start: number, end: number) => ({ data: rows.slice(start, end + 1), error: null }));
    const { client, query } = mockClient(range);
    expect(await fetchSitemapTranslationLinks(client)).toEqual(rows);
    expect(range.mock.calls).toEqual([[0, 999], [1000, 1999]]);
    expect(query.order.mock.calls.slice(0, 2)).toEqual([['content_type'], ['content_id']]);
  });

  it('rejects an incomplete result when a later batch fails', async () => {
    const range = vi.fn()
      .mockResolvedValueOnce({ data: Array(1000).fill({ group_id: 'group', content_type: 'page', content_id: 'id' }), error: null })
      .mockResolvedValueOnce({ data: null, error: { code: '57014' } });
    const { client } = mockClient(range);
    await expect(fetchSitemapTranslationLinks(client)).rejects.toThrow('57014');
  });
});
