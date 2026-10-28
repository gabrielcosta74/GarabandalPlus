import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), verifyAdmin: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabaseServer: { from: mocks.from } }));
vi.mock('../lib/admin-auth', () => ({ verifyAdmin: mocks.verifyAdmin }));
import { GET } from '../app/api/admin/pilgrimages/[pilgrimageId]/dietary/route';

const params = { params: Promise.resolve({ pilgrimageId: 'trip-1' }) };
const request = (query = '') => new Request(`http://localhost/api/admin/pilgrimages/trip-1/dietary${query}`);
const booking = (id: string, name: string, allergies: string | null, status = 'confirmed') => ({ id, status, pilgrims: [{ id: `person-${id}`, full_name: name, allergies, dietary_restrictions: null }] });

function setup(pages: unknown[][]) {
    const chain = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn(), maybeSingle: vi.fn() };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);
    chain.maybeSingle.mockResolvedValue({ data: { id: 'trip-1', title: 'Peregrinação', slug: 'peregrinacao' }, error: null });
    pages.forEach(data => chain.range.mockResolvedValueOnce({ data, error: null }));
    mocks.from.mockReturnValue(chain);
    return chain;
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyAdmin.mockResolvedValue({ authorized: true });
});

describe('admin dietary list and export', () => {
    it('requires admin access for both the list and CSV', async () => {
        mocks.verifyAdmin.mockResolvedValue({ authorized: false });
        expect((await GET(request(), params)).status).toBe(401);
        expect((await GET(request('?format=csv'), params)).status).toBe(401);
        expect(mocks.from).not.toHaveBeenCalled();
    });

    it('restricts records to the selected pilgrimage and reports unanswered fields', async () => {
        const chain = setup([[booking('a', 'Ana', 'Lactose'), booking('b', 'Bruno', null), booking('c', 'Carlos', 'Não')]]);
        const response = await GET(request(), params);
        const body = await response.json();
        expect(chain.eq).toHaveBeenCalledWith('pilgrimage_id', 'trip-1');
        expect(body.rows.map((row: { status: string }) => row.status)).toEqual(['declared', 'pending', 'none']);
        expect(response.headers.get('Cache-Control')).toContain('no-store');
    });

    it('exports only declared dietary needs from active bookings, without contact or medical documents', async () => {
        setup([[booking('a', 'Ana', 'Lactose'), booking('b', 'Bruno', null), booking('c', 'Carlos', 'Não'), booking('d', 'Diana', 'Ovos', 'cancelled')]]);
        const response = await GET(request('?format=csv'), params);
        const csv = await response.text();
        expect(response.headers.get('Content-Type')).toContain('text/csv');
        expect(response.headers.get('Content-Disposition')).toContain('alergias-alimentares-peregrinacao.csv');
        expect(csv).toContain('Ana');
        expect(csv).toContain('Lactose');
        for (const name of ['Bruno', 'Carlos', 'Diana']) expect(csv).not.toContain(name);
        expect(csv).not.toMatch(/email|telefone|documento/i);
    });

    it('fetches further pages so large pilgrimages are not truncated', async () => {
        const chain = setup([Array.from({ length: 200 }, (_, index) => booking(`a-${index}`, `Pessoa ${index}`, 'Lactose')), [booking('last', 'Última pessoa', 'Ovos')]]);
        const response = await GET(request(), params);
        expect((await response.json()).rows).toHaveLength(201);
        expect(chain.range.mock.calls).toEqual([[0, 199], [200, 399]]);
    });
});
