import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), upload: vi.fn(), remove: vi.fn(), audit: vi.fn(), rows: { existing: null as unknown, insertError: null as unknown, movement: null as unknown } }));
vi.mock('../lib/ledger/server', () => ({
  db: () => ({ from: mocks.from, storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) } }),
  requireAdmin: async () => ({ ok: true, email: 'admin@example.com', userId: 'u' }),
}));
vi.mock('../lib/admin-audit', () => ({ logAdminAudit: mocks.audit }));

import { POST } from '../app/api/admin/contabilidade/movimentos/[id]/documentos/route';
import { MAX_DOCUMENT_BYTES, detectDocumentType, documentProblem, documentStoragePath } from '../lib/ledger/document-rules';

const id = '11111111-1111-4111-8111-111111111111';
const context = { params: Promise.resolve({ id }) };
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const request = (bytes: Uint8Array, name = 'fatura.pdf') => {
  const form = new FormData();
  form.append('file', new File([bytes as BlobPart], name));
  return new Request(`http://localhost/api/admin/contabilidade/movimentos/${id}/documentos`, { method: 'POST', body: form });
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows.movement = { id, period: '2026-10', amount: '-50.00', status: 'reconciled' };
  mocks.rows.existing = null;
  mocks.rows.insertError = null;
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.audit.mockResolvedValue(undefined);
  mocks.from.mockImplementation((table: string) => table === 'bank_transactions'
    ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.rows.movement, error: null }) }) }) }
    : {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.rows.existing, error: null }) }) }) }),
        insert: () => ({ select: () => ({ single: async () => ({ data: mocks.rows.insertError ? null : { id: 'doc-1' }, error: mocks.rows.insertError }) }) }),
      });
});

describe('expense document rules', () => {
  it('trusts the bytes, not the name', () => {
    expect(detectDocumentType(pdf)?.mime).toBe('application/pdf');
    expect(detectDocumentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.extension).toBe('jpg');
    expect(detectDocumentType(new TextEncoder().encode('<html>'))).toBeNull();
  });

  it('refuses empty and oversized files', () => {
    expect(documentProblem({ name: 'a.pdf', size: 0 })).toContain('vazio');
    expect(documentProblem({ name: 'a.pdf', size: MAX_DOCUMENT_BYTES + 1 })).toContain('9 MB');
    expect(documentProblem({ name: 'a.pdf', size: 100 })).toBeNull();
  });

  it('stores under the month and the movement', () => {
    expect(documentStoragePath('2026-10', id, 'a'.repeat(64), 'pdf')).toBe(`2026-10/${id}/${'a'.repeat(32)}.pdf`);
  });
});

describe('attaching a document', () => {
  it('works on an already approved expense', async () => {
    const response = await POST(request(pdf), context);
    expect(response.status).toBe(200);
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(mocks.upload.mock.calls[0][2]).toMatchObject({ contentType: 'application/pdf', upsert: false });
    expect(mocks.audit).toHaveBeenCalledOnce();
  });

  it('refuses a disguised file before storing it', async () => {
    const response = await POST(request(new TextEncoder().encode('<script>'), 'fatura.pdf'), context);
    expect(response.status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('only expenses take a document', async () => {
    mocks.rows.movement = { id, period: '2026-10', amount: '50.00', status: 'suggested' };
    expect((await POST(request(pdf), context)).status).toBe(409);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('refuses the same file twice on a movement', async () => {
    mocks.rows.existing = { id: 'doc-0' };
    expect((await POST(request(pdf), context)).status).toBe(409);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('leaves no orphan file when a closed month refuses the row', async () => {
    mocks.rows.insertError = { code: 'P0001', message: 'Este mês está fechado.' };
    const response = await POST(request(pdf), context);
    expect(response.status).toBe(409);
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
});

describe('documents in folders', () => {
  it('names a file the way an accountant reads it', async () => {
    const { archiveFileName } = await import('../lib/ledger/document-rules');
    expect(archiveFileName({ date: '2026-10-06', who: 'Hôtel Évreux / Grupo', amount: -8276.1, kind: 'Proforma', extension: 'pdf' }))
      .toBe('2026-10-06 Hotel Evreux Grupo 8276,10 EUR Proforma.pdf');
  });

  it('never gives two files the same place in the ZIP', async () => {
    vi.doMock('../lib/ledger/server', () => ({ db: () => ({}) }));
    const { archivePaths } = await import('../lib/ledger/document-archive');
    const doc = (id: string) => ({
      id, kind: 'fatura', kindLabel: 'Fatura', fileName: 'a.pdf', sizeBytes: 10, storagePath: `x/${id}.pdf`, createdAt: '',
      movement: { id: 'm', date: '2026-10-06', period: '2026-10', who: 'Hotel', description: '', amount: -10, category: 'Alojamento e refeições' },
    });
    const paths = archivePaths([doc('1'), doc('2')]);
    expect(paths.get('1')).toBe('Alojamento e refeições/2026-10-06 Hotel 10,00 EUR Fatura.pdf');
    expect(paths.get('2')).toBe('Alojamento e refeições/2026-10-06 Hotel 10,00 EUR Fatura (1).pdf');
  });

  it('only accepts the known kinds', async () => {
    const { isDocumentKind } = await import('../lib/ledger/document-rules');
    expect(isDocumentKind('proforma')).toBe(true);
    expect(isDocumentKind('nota')).toBe(false);
  });
});
