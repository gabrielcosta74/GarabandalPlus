import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const bookingId = '123e4567-e89b-42d3-a456-426614174000';
const userId = '123e4567-e89b-42d3-a456-426614174001';
const state = vi.hoisted(() => ({
  bookingOwner: '123e4567-e89b-42d3-a456-426614174001',
  bookingStatus: 'pending',
  generatedLinkUserId: '123e4567-e89b-42d3-a456-426614174001',
  handoff: null as null | Record<string, string | null>,
}));

vi.mock('../lib/supabase', () => ({
  supabaseServer: {
    auth: {
      getUser: async () => ({ data: { user: { id: userId, email: 'test@example.com' } }, error: null }),
      admin: {
        getUserById: async () => ({ data: { user: { email: 'test@example.com' } }, error: null }),
        generateLink: async () => ({ data: { user: { id: state.generatedLinkUserId }, properties: { hashed_token: 'one-time-auth-hash' } }, error: null }),
      },
    },
    from: (table: string) => {
      if (table === 'pilgrimages') return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { slug: 'garabandal-2027' }, error: null }) }) }),
      };
      if (table === 'bookings') return {
        select: () => ({
          eq: () => ({
            eq: (_field: string, owner: string) => ({
              maybeSingle: async () => ({
                data: owner === state.bookingOwner ? { id: bookingId, user_id: owner, status: state.bookingStatus } : null,
                error: null,
              }),
            }),
          }),
        }),
      };
      if (table === 'mobile_booking_web_handoffs') return {
        insert: async (record: Record<string, string>) => {
          state.handoff = { ...record, consumed_at: null };
          return { error: null };
        },
        update: (values: { consumed_at: string }) => ({
          eq: (_field: string, hash: string) => ({
            is: () => ({
              gt: () => ({
                select: () => ({
                  maybeSingle: async () => {
                    if (!state.handoff || state.handoff.token_hash !== hash || state.handoff.consumed_at) {
                      return { data: null, error: null };
                    }
                    state.handoff.consumed_at = values.consumed_at;
                    return { data: state.handoff, error: null };
                  },
                }),
              }),
            }),
          }),
        }),
      };
      throw new Error(`Unexpected table ${table}`);
    },
  },
}));

import { GET } from '../app/api/booking/mobile-handoff/route';
import { POST } from '../app/api/mobile/pilgrimage-bookings/[id]/web-access/route';
import { POST as createRegistrationHandoff } from '../app/api/mobile/pilgrimages/[slug]/web-access/route';

describe('single-use mobile booking handoff', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_PILGRIMAGE_WEB_HANDOFF_ENABLED', 'true');
    state.bookingOwner = userId;
    state.bookingStatus = 'pending';
    state.generatedLinkUserId = userId;
    state.handoff = null;
  });
  afterEach(() => vi.unstubAllEnvs());

  it('only creates a link for the booking owner and stores a hash, not the raw token', async () => {
    state.bookingOwner = '123e4567-e89b-42d3-a456-426614174099';
    const request = new Request('https://apostoladodegarabandal.com/api/mobile/pilgrimage-bookings/x/web-access?locale=en', {
      method: 'POST', headers: { authorization: 'Bearer member-access-token' },
    });
    const denied = await POST(request, { params: Promise.resolve({ id: bookingId }) });
    expect(denied.status).toBe(404);
    expect(state.handoff).toBeNull();

    state.bookingOwner = userId;
    const allowed = await POST(request, { params: Promise.resolve({ id: bookingId }) });
    const body = await allowed.json();
    const token = new URL(body.data.url).searchParams.get('token')!;
    expect(allowed.status).toBe(200);
    expect(body.data.url).toContain('/api/booking/mobile-handoff?token=');
    expect(state.handoff?.token_hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(state.handoff?.token_hash).not.toBe(token);
    expect(state.handoff?.locale).toBe('en');
  });

  it('consumes a link once and redirects to a fresh same-site auth confirmation', async () => {
    const created = await POST(new Request('https://apostoladodegarabandal.com/api/mobile/pilgrimage-bookings/x/web-access', {
      method: 'POST', headers: { authorization: 'Bearer member-access-token' },
    }), { params: Promise.resolve({ id: bookingId }) });
    const { data } = await created.json();
    const first = await GET(new Request(data.url));
    const second = await GET(new Request(data.url));
    expect(first.status).toBe(303);
    expect(first.headers.get('location')).toContain('/auth/confirm?');
    expect(first.headers.get('location')).toContain(`%2Fperegrinacoes%2Finscricao%2F${bookingId}`);
    expect(first.headers.get('referrer-policy')).toBe('no-referrer');
    expect(second.headers.get('location')).toContain('/login?error=invalid-link');
  });

  it('opens the whole website registration with the member signed in', async () => {
    const created = await createRegistrationHandoff(
      new Request('https://apostoladodegarabandal.com/api/mobile/pilgrimages/garabandal-2027/web-access?locale=en', {
        method: 'POST', headers: { authorization: 'Bearer member-access-token' },
      }),
      { params: Promise.resolve({ slug: 'garabandal-2027' }) },
    );
    expect(created.status).toBe(200);
    expect(state.handoff?.booking_id).toBeUndefined();
    expect(state.handoff?.pilgrimage_slug).toBe('garabandal-2027');
    const { data } = await created.json();
    const entered = await GET(new Request(data.url));
    const confirmation = new URL(entered.headers.get('location')!);
    expect(confirmation.pathname).toBe('/auth/confirm');
    expect(confirmation.searchParams.get('next')).toBe('/en/pilgrimages/garabandal-2027/register');
  });

  it('returns only official-domain links when the request arrives through localhost', async () => {
    const created = await POST(new Request('http://localhost:3000/api/mobile/pilgrimage-bookings/x/web-access', {
      method: 'POST', headers: { authorization: 'Bearer member-access-token' },
    }), { params: Promise.resolve({ id: bookingId }) });
    const { data } = await created.json();
    expect(new URL(data.url).origin).toBe('https://apostoladodegarabandal.com');

    const entered = await GET(new Request(data.url));
    expect(new URL(entered.headers.get('location')!).origin).toBe('https://apostoladodegarabandal.com');

    const registration = await createRegistrationHandoff(
      new Request('http://localhost:3000/api/mobile/pilgrimages/garabandal-2027/web-access', {
        method: 'POST', headers: { authorization: 'Bearer member-access-token' },
      }),
      { params: Promise.resolve({ slug: 'garabandal-2027' }) },
    );
    const registrationBody = await registration.json();
    expect(new URL(registrationBody.data.url).origin).toBe('https://apostoladodegarabandal.com');
  });

  it('does not authenticate another user if the generated link resolves to a different account', async () => {
    const created = await POST(new Request('https://apostoladodegarabandal.com/api/mobile/pilgrimage-bookings/x/web-access', {
      method: 'POST', headers: { authorization: 'Bearer member-access-token' },
    }), { params: Promise.resolve({ id: bookingId }) });
    const { data } = await created.json();
    state.generatedLinkUserId = '123e4567-e89b-42d3-a456-426614174099';

    const entered = await GET(new Request(data.url));
    expect(entered.headers.get('location')).toContain('/login?error=auth-config');
    expect(entered.headers.get('location')).not.toContain('/auth/confirm');
  });

  it('does not issue an automatic login link without the app session or rollout flag', async () => {
    const withoutSession = await createRegistrationHandoff(
      new Request('https://apostoladodegarabandal.com/api/mobile/pilgrimages/garabandal-2027/web-access', { method: 'POST' }),
      { params: Promise.resolve({ slug: 'garabandal-2027' }) },
    );
    expect(withoutSession.status).toBe(401);
    expect(state.handoff).toBeNull();

    vi.stubEnv('MOBILE_PILGRIMAGE_WEB_HANDOFF_ENABLED', 'false');
    const disabled = await createRegistrationHandoff(
      new Request('https://apostoladodegarabandal.com/api/mobile/pilgrimages/garabandal-2027/web-access', {
        method: 'POST', headers: { authorization: 'Bearer member-access-token' },
      }),
      { params: Promise.resolve({ slug: 'garabandal-2027' }) },
    );
    expect(disabled.status).toBe(503);
    expect(state.handoff).toBeNull();
  });

  it('rejects canceled bookings before creating or consuming a link', async () => {
    state.bookingStatus = 'canceled';
    const blocked = await POST(new Request('https://apostoladodegarabandal.com/api/mobile/pilgrimage-bookings/x/web-access', {
      method: 'POST', headers: { authorization: 'Bearer member-access-token' },
    }), { params: Promise.resolve({ id: bookingId }) });
    expect(blocked.status).toBe(404);
    expect(state.handoff).toBeNull();
  });
});
