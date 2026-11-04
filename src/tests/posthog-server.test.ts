import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callbacks: [] as Array<() => Promise<void>>,
  captureImmediate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next/server', () => ({
  after: (callback: () => Promise<void>) => mocks.callbacks.push(callback),
}));
vi.mock('posthog-node', () => ({
  PostHog: class {
    captureImmediate = mocks.captureImmediate;
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.callbacks.length = 0;
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
});

afterEach(() => vi.unstubAllEnvs());

describe('server-side PostHog conversion capture', () => {
  it('waits for delivery after the route response', async () => {
    const { capturePostHogAfterResponse } = await import('../lib/posthog-server');
    const event = { distinctId: 'visitor-1', event: 'booking_created', properties: { pilgrimage_slug: 'trip' } };

    capturePostHogAfterResponse(event);
    expect(mocks.captureImmediate).not.toHaveBeenCalled();
    expect(mocks.callbacks).toHaveLength(1);

    await mocks.callbacks[0]();
    expect(mocks.captureImmediate).toHaveBeenCalledWith(event);
  });
});
