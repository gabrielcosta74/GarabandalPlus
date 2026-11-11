import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorized: true,
  list: vi.fn(), download: vi.fn(), audit: vi.fn(),
}));

vi.mock('../lib/admin-auth', () => ({
  verifyAdmin: async () => mocks.authorized
    ? { authorized: true, user: { email: 'admin@example.com' } }
    : { authorized: false },
}));
vi.mock('../lib/supabase', () => ({
  supabaseServer: {
    storage: { from: () => ({ list: mocks.list, download: mocks.download }) },
    from: () => ({ insert: mocks.audit }),
  },
}));

import { archivePath } from '../lib/ledger/accounting-archive';
import { GET as list } from '../app/api/admin/contabilidade/arquivo/route';
import { GET as download } from '../app/api/admin/contabilidade/arquivo/download/route';

const folderKey = `b_${Buffer.from('IVA').toString('base64url')}`;
const subfolderKey = `b_${Buffer.from('2026').toString('base64url')}`;
const fileKey = `b_${Buffer.from('fatura.pdf').toString('base64url')}.pdf`;
const folderPath = `contabilidade-apostolado/${folderKey}`;
const filePath = `${folderPath}/${fileKey}`;
const request = (path: string, suffix = '') => new Request(`http://localhost/api/admin/contabilidade/arquivo${suffix}?path=${encodeURIComponent(path)}`);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorized = true;
  mocks.list.mockResolvedValue({ data: [
    { id: null, name: subfolderKey, metadata: null },
    { id: 'file-id', name: fileKey, metadata: { size: 123 } },
  ], error: null });
  mocks.download.mockResolvedValue({ data: new Blob(['%PDF-documento']), error: null });
  mocks.audit.mockResolvedValue({ error: null });
});

describe('private accounting archive', () => {
  it('rejects traversal and paths outside the collection', () => {
    expect(archivePath(`contabilidade-apostolado/../${fileKey}`, true)).toBeNull();
    expect(archivePath(`outra-pasta/${folderKey}/${fileKey}`, true)).toBeNull();
    expect(archivePath(filePath, true)).toBe(filePath);
  });

  it('requires admin authentication before listing or downloading', async () => {
    mocks.authorized = false;
    expect((await list(request('contabilidade-apostolado'))).status).toBe(403);
    expect((await download(request(filePath, '/download'))).status).toBe(403);
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it('lists only the requested private collection', async () => {
    const response = await list(request(folderPath));
    expect(response.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith(folderPath, expect.objectContaining({ limit: 200 }));
    expect((await response.json()).items).toEqual([
      { name: '2026', path: `${folderPath}/${subfolderKey}`, kind: 'folder', size: null },
      { name: 'fatura.pdf', path: filePath, kind: 'file', size: 123 },
    ]);
  });

  it('audits access and forces a noncached attachment download', async () => {
    const response = await download(request(filePath, '/download'));
    expect(response.status).toBe(200);
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'ledger.archive.download' }));
    expect(response.headers.get('Content-Disposition')).toContain('attachment;');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('does not release the document when the audit log fails', async () => {
    mocks.audit.mockResolvedValue({ error: { message: 'unavailable' } });
    const response = await download(request(filePath, '/download'));
    expect(response.status).toBe(503);
  });
});
