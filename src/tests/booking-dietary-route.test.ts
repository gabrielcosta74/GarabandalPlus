import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    from: vi.fn(), getUser: vi.fn(), rateLimit: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({ supabaseServer: { from: mocks.from } }));
vi.mock('../lib/auth-utils', () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock('../lib/rate-limit', () => ({ checkRateLimit: mocks.rateLimit }));

import { PATCH } from '../app/api/booking/[id]/dietary/route';

const participantId = '00000000-0000-4000-8000-000000000001';
const request = (body: unknown) => new Request('http://localhost/api/booking/booking-1/dietary', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const params = { params: Promise.resolve({ id: 'booking-1' }) };

function setup(booking: unknown = { id: 'booking-1', status: 'confirmed' }, pilgrim: unknown = { id: participantId, allergies: 'Não', dietary_restrictions: 'Não' }) {
    const builder = (data: unknown) => {
        const chain = { select: vi.fn(), eq: vi.fn(), update: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data, error: null }) };
        chain.select.mockReturnValue(chain);
        chain.eq.mockReturnValue(chain);
        chain.update.mockReturnValue(chain);
        return chain;
    };
    const bookings = builder(booking);
    const pilgrims = builder(pilgrim);
    mocks.from.mockImplementation(table => table === 'bookings' ? bookings : pilgrims);
    return { bookings, pilgrims };
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner-1' } }, error: null });
    mocks.rateLimit.mockReturnValue({ allowed: true });
});

describe('booking dietary update permissions', () => {
    it('requires an authenticated owner when no private link token is supplied', async () => {
        setup();
        mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
        expect((await PATCH(request({ pilgrimId: participantId, answer: 'Não' }), params)).status).toBe(401);
        expect(mocks.from).not.toHaveBeenCalledWith('pilgrims');
    });

    it('scopes both the booking and participant, updating only dietary fields', async () => {
        const { bookings, pilgrims } = setup();
        const response = await PATCH(request({ pilgrimId: participantId, answer: '  Não  ', full_name: 'Untrusted change' }), params);
        expect(response.status).toBe(200);
        expect(bookings.eq).toHaveBeenCalledWith('user_id', 'owner-1');
        expect(bookings.eq).toHaveBeenCalledWith('id', 'booking-1');
        expect(pilgrims.eq).toHaveBeenCalledWith('booking_id', 'booking-1');
        expect(pilgrims.eq).toHaveBeenCalledWith('id', participantId);
        expect(pilgrims.update).toHaveBeenCalledWith({ allergies: 'Não', dietary_restrictions: 'Não' });
    });

    it('permits the existing private booking link without requiring a new login', async () => {
        const { bookings } = setup();
        expect((await PATCH(request({ pilgrimId: participantId, answer: 'Não', token: 'private-link-token' }), params)).status).toBe(200);
        expect(bookings.eq).toHaveBeenCalledWith('view_token', 'private-link-token');
        expect(mocks.getUser).not.toHaveBeenCalled();
    });

    it('does not write with an invalid token or another user’s booking', async () => {
        setup(null);
        expect((await PATCH(request({ pilgrimId: participantId, answer: 'Não', token: 'wrong-token' }), params)).status).toBe(404);
        expect(mocks.from).not.toHaveBeenCalledWith('pilgrims');
    });

    it('rejects participants outside the authorised booking', async () => {
        setup(undefined, null);
        expect((await PATCH(request({ pilgrimId: participantId, answer: 'Não' }), params)).status).toBe(404);
    });

    it('rejects blank answers and cancelled bookings', async () => {
        setup({ id: 'booking-1', status: 'cancelled' });
        expect((await PATCH(request({ pilgrimId: participantId, answer: '   ' }), params)).status).toBe(400);
        expect((await PATCH(request({ pilgrimId: participantId, answer: 'Não' }), params)).status).toBe(409);
        expect(mocks.from).not.toHaveBeenCalledWith('pilgrims');
    });

    it('rate-limits writes before accessing any participant data', async () => {
        mocks.rateLimit.mockReturnValue({ allowed: false });
        expect((await PATCH(request({ pilgrimId: participantId, answer: 'Não' }), params)).status).toBe(429);
        expect(mocks.from).not.toHaveBeenCalled();
    });
});
