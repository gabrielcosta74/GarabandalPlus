import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/marian-2027-campaign', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/marian-2027-campaign')>();
  return {
    ...original,
    loadMarian2027Audience: vi.fn(async (_db, language: 'pt' | 'en') => ({
      audience: [{ normalized_email: `${language}@example.com`, display_name: 'Maria', language, recommendation: '' }],
      sendable: true,
      stats: { eligible: 1 },
    })),
  };
});

import { MARIAN_2027_STEPS } from '../lib/marian-2027-campaign';
import { scheduleMarian2027Campaign } from '../lib/marian-2027-scheduler';

describe('Caminho Mariano 2027 scheduling', () => {
  it('creates all six PT/EN messages on days 0, 7 and 14', async () => {
    let inserted: any[] = [];
    const db = {
      from(table: string) {
        expect(table).toBe('marketing_campaigns');
        return {
          select: () => ({ contains: () => ({ order: async () => ({ data: [], error: null }) }) }),
          insert: (rows: any[]) => {
            inserted = rows;
            return { select: async () => ({ data: rows.map((row, index) => ({ ...row, id: String(index) })), error: null }) };
          },
        };
      },
    };
    const start = new Date(Date.now() + 2 * 86_400_000);
    const result = await scheduleMarian2027Campaign(db, start.toISOString());

    expect(result.campaigns).toHaveLength(6);
    for (const language of ['pt', 'en'] as const) {
      for (const step of MARIAN_2027_STEPS) {
        const row = inserted.find((item) => item.metrics.language === language && item.template_key === step.key);
        expect(row).toBeDefined();
        expect(row.status).toBe('scheduled');
        expect(row.scheduled_at).toBe(new Date(start.getTime() + step.day * 86_400_000).toISOString());
        expect(row.metrics.audience_cutoff).toBeTruthy();
      }
    }
  });
});
