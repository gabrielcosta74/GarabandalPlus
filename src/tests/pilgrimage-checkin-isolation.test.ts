import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { checkinFormPath, checkinLookupColumn } from '../lib/pilgrimage-checkin';

const mocks = vi.hoisted(() => ({ from: vi.fn(), verifyAdmin: vi.fn(), rateLimit: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabaseServer: { from: mocks.from } }));
vi.mock('../lib/admin-auth', () => ({ verifyAdmin: mocks.verifyAdmin }));
vi.mock('../lib/rate-limit', () => ({ checkRateLimit: mocks.rateLimit }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));

import { GET } from '../app/api/admin/pilgrimages/[pilgrimageId]/checkin-data/route';
import { DELETE } from '../app/api/admin/pilgrimages/[pilgrimageId]/route';
import { GET as GET_ARCHIVES } from '../app/api/admin/checkin-archives/route';
import { POST } from '../app/api/checkin/[slug]/route';
import CheckinPage from '../app/dados-check-in/[slug]/page';

const tripA = { id: '00000000-0000-4000-8000-000000000001', title: 'Peregrinação A', title_en: 'Pilgrimage A', slug: 'peregrinacao-a', start_date: '2027-04-01', end_date: '2027-04-10', checkin_form_enabled: true };
const tripB = { ...tripA, id: '00000000-0000-4000-8000-000000000002', title: 'Peregrinação B', title_en: 'Pilgrimage B', slug: 'peregrinacao-b' };
const archiveA = { id: '00000000-0000-4000-8000-000000000003', source_pilgrimage_id: tripA.id, title: 'Peregrinação de outubro de 2026', notes: 'Inscrições realizadas fora da plataforma.', submissions: [{ count: 1 }] };
const sample = { id: 1, archive_id: null, pilgrimage_id: tripA.id, full_name: 'Ana Silva', birth_date: '1990-01-02', nationality: 'Portuguesa', document_type: 'passport', document_number: 'TEST-ONLY', document_issued_on: '2020-01-01', document_expires_on: '2030-01-01', full_address: 'Morada fictícia para teste', postal_code: '1000-001', city: 'Lisboa', phone: '+351910000000', email: 'qa@example.test', submitted_at: '2026-10-28T10:00:00Z' };

function database() {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const selections: Array<{ table: string; filters: Record<string, unknown> }> = [];
    mocks.from.mockImplementation((table: string) => {
        const filters: Record<string, unknown> = {};
        selections.push({ table, filters });
        const execute = () => {
            const trip = [tripA, tripB].find(trip => (!filters.id || filters.id === trip.id) && (!filters.slug || filters.slug === trip.slug)
                && (!filters.checkin_form_enabled || trip.checkin_form_enabled));
            const data = table === 'pilgrimages' ? trip || null
                : table === 'pilgrimage_checkin_archives' ? [archiveA].filter(archive => !filters.source_pilgrimage_id || filters.source_pilgrimage_id === archive.source_pilgrimage_id)
                    : [sample, { ...sample, id: 2, archive_id: archiveA.id, full_name: 'Participante de outubro 2026', submitted_at: '2026-09-10T10:00:00Z' }, { ...sample, id: 3, pilgrimage_id: tripB.id, full_name: 'Pessoa de outra peregrinação' }]
                        .filter(row => row.pilgrimage_id === filters.pilgrimage_id && row.archive_id === filters.archive_id);
            return { data, error: null, count: table === 'pilgrimage_checkin_archives' && Array.isArray(data) ? data.length : null };
        };
        const chain = {
            select: vi.fn(), eq: vi.fn(), is: vi.fn(), order: vi.fn(), maybeSingle: vi.fn(async () => execute()), insert,
            then: (resolve: (value: ReturnType<typeof execute>) => unknown) => Promise.resolve(execute()).then(resolve),
        };
        chain.select.mockReturnValue(chain);
        chain.order.mockReturnValue(chain);
        chain.eq.mockImplementation((column: string, value: unknown) => { filters[column] = value; return chain; });
        chain.is.mockImplementation((column: string, value: unknown) => { filters[column] = value; return chain; });
        return chain;
    });
    return { selections, insert };
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyAdmin.mockResolvedValue({ authorized: true, user: { email: 'admin@example.test' } });
    mocks.rateLimit.mockReturnValue({ allowed: true });
});

describe('per-pilgrimage hotel check-in isolation', () => {
    it('gives each pilgrimage a different stable link, independent of its editable slug', () => {
        expect(checkinFormPath(tripA.id)).not.toBe(checkinFormPath(tripB.id));
        expect(checkinLookupColumn(tripA.id)).toBe('id');
        expect(checkinLookupColumn('old-shared-slug')).toBe('slug');
    });

    it('renders each public form with its own immutable ID and translated title', async () => {
        database();
        const formA = await CheckinPage({ params: Promise.resolve({ slug: tripA.id }) });
        const formB = await CheckinPage({ params: Promise.resolve({ slug: tripB.slug }) });
        expect(formA.props).toMatchObject({ pilgrimageId: tripA.id, title: tripA.title, englishTitle: tripA.title_en });
        expect(formB.props).toMatchObject({ pilgrimageId: tripB.id, title: tripB.title, englishTitle: tripB.title_en });
        expect(formA.key).not.toBe(formB.key);
    });

    it('returns 404 for unknown forms instead of falling back to another pilgrimage', async () => {
        database();
        await expect(CheckinPage({ params: Promise.resolve({ slug: 'unknown-pilgrimage' }) })).rejects.toThrow('NOT_FOUND');
    });

    it.each([tripA.id, tripA.slug])('stores a response only under the pilgrimage resolved from %s', async reference => {
        const { insert } = database();
        const response = await POST(new Request('http://localhost/api/checkin/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...sample, pilgrimage_id: tripB.id, archive_id: archiveA.id, privacy_consent: true }) }), { params: Promise.resolve({ slug: reference }) });
        expect(response.status).toBe(201);
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ pilgrimage_id: tripA.id }));
        expect(insert.mock.calls[0][0]).not.toHaveProperty('id');
        expect(insert.mock.calls[0][0]).not.toHaveProperty('archive_id');
    });

    it('keeps current responses without requiring an online booking and excludes the historical edition', async () => {
        const { selections } = database();
        const response = await GET(new Request('http://localhost/checkin-data'), { params: Promise.resolve({ pilgrimageId: tripA.id }) });
        const data = await response.json();
        expect(data.pilgrimage.id).toBe(tripA.id);
        expect(data.submissions.map((row: { full_name: string }) => row.full_name)).toEqual(['Ana Silva']);
        expect(data.archives).toEqual([expect.objectContaining({ id: archiveA.id, count: 1 })]);
        expect(selections.some(item => item.table === 'bookings')).toBe(false);
        expect(data.dataset).toMatchObject({ title: tripA.title, archived: false });
        expect(response.headers.get('Cache-Control')).toContain('no-store');
    });

    it('opens the offline archive under its original edition title', async () => {
        database();
        const response = await GET(new Request(`http://localhost/checkin-data?archive=${archiveA.id}`), { params: Promise.resolve({ pilgrimageId: tripA.id }) });
        const data = await response.json();
        expect(data.dataset).toMatchObject({ title: archiveA.title, archived: true });
        expect(data.submissions.map((row: { full_name: string }) => row.full_name)).toEqual(['Participante de outubro 2026']);
    });

    it('does not let an archive from one pilgrimage be opened under another', async () => {
        database();
        const response = await GET(new Request(`http://localhost/checkin-data?archive=${archiveA.id}`), { params: Promise.resolve({ pilgrimageId: tripB.id }) });
        expect(response.status).toBe(404);
    });

    it('lists archive titles and counts without disclosing identification documents', async () => {
        database();
        const response = await GET_ARCHIVES(new Request('http://localhost/api/admin/checkin-archives'));
        const body = await response.json();
        expect(body.archives).toEqual([expect.objectContaining({ id: archiveA.id, title: archiveA.title, count: 1, pilgrimageId: tripA.id })]);
        expect(JSON.stringify(body)).not.toContain(sample.document_number);
    });

    it.each([false, true])('exports the requested edition without mixing historical and current responses (archive: %s)', async historical => {
        database();
        const response = await GET(new Request(`http://localhost/checkin-data?format=xlsx${historical ? `&archive=${archiveA.id}` : ''}`), { params: Promise.resolve({ pilgrimageId: tripA.id }) });
        expect(response.status).toBe(200);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await response.arrayBuffer());
        const sheet = workbook.worksheets[0];
        expect(sheet.getCell('C2').value).toBe(historical ? archiveA.title : tripA.title);
        expect(sheet.rowCount).toBe(6);
        expect(sheet.getCell('B6').value).toBe(historical ? 'Participante de outubro 2026' : 'Ana Silva');
        expect(response.headers.get('Content-Disposition')).toContain(historical ? `${archiveA.id}.xlsx` : 'peregrinacao-a.xlsx');
    });

    it('protects the historical archive before any deletion of a reused pilgrimage starts', async () => {
        const { selections } = database();
        const response = await DELETE(new Request('http://localhost/api/admin/pilgrimages/test', { method: 'DELETE' }), { params: Promise.resolve({ pilgrimageId: tripA.id }) });
        expect(response.status).toBe(409);
        expect(selections.map(item => item.table)).toEqual(['pilgrimage_checkin_archives']);
    });

    it('requires admin access before looking up personal data', async () => {
        mocks.verifyAdmin.mockResolvedValue({ authorized: false });
        const response = await GET(new Request('http://localhost/checkin-data'), { params: Promise.resolve({ pilgrimageId: tripA.id }) });
        expect(response.status).toBe(401);
        expect((await GET_ARCHIVES(new Request('http://localhost/api/admin/checkin-archives'))).status).toBe(401);
        expect(mocks.from).not.toHaveBeenCalled();
    });
});
