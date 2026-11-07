import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdmin = vi.fn();
const loadAnalysis = vi.fn();

vi.mock('../lib/ledger/server', () => ({ requireAdmin }));
vi.mock('../lib/ledger/analysis-server', () => ({ loadAnalysis }));

const { GET } = await import('../app/api/admin/financas/analise/route');
const request = new Request('http://localhost/api/admin/financas/analise');

describe('GET /api/admin/financas/analise', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    loadAnalysis.mockReset();
  });

  it('refuses anyone who is not an admin, without reading any data', async () => {
    requireAdmin.mockResolvedValue({ ok: false, response: Response.json({ error: 'Sem acesso.' }, { status: 401 }) });
    const response = await GET(request);
    expect(response.status).toBe(401);
    expect(loadAnalysis).not.toHaveBeenCalled();
  });

  it('returns the analysis uncached to an admin', async () => {
    requireAdmin.mockResolvedValue({ ok: true, email: 'admin@example.com', userId: '1' });
    loadAnalysis.mockResolvedValue({ balance: 10 });
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ balance: 10 });
  });

  it('does not leak database errors', async () => {
    requireAdmin.mockResolvedValue({ ok: true, email: 'admin@example.com', userId: '1' });
    loadAnalysis.mockRejectedValue(new Error('relation secret_table does not exist'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await GET(request);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('secret_table');
  });
});
