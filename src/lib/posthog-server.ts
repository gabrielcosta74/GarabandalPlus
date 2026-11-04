import { PostHog } from 'posthog-node';
import { after } from 'next/server';

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog | null {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.POSTHOG_KEY;
  if (!posthogKey) return null;

  if (!posthogClient) {
    posthogClient = new PostHog(
      posthogKey,
      {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST || process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
        flushAt: 1,
        flushInterval: 0,
      }
    );
  }
  return posthogClient;
}

/** Keep a route handler alive until a critical conversion event is delivered. */
export function capturePostHogAfterResponse(event: Parameters<PostHog['captureImmediate']>[0]): void {
  const posthog = getPostHogClient();
  if (!posthog) return;

  after(async () => {
    try {
      await posthog.captureImmediate(event);
    } catch (error) {
      console.warn('PostHog capture failed:', error);
    }
  });
}
