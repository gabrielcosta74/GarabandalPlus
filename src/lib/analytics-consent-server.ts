const ANALYTICS_CONSENT_COOKIE = 'garabandal_analytics_consent';

export type ServerAnalyticsContext = {
  distinctId: string;
  sessionId?: string;
};

const readCookie = (request: Request, name: string) => {
  const cookieHeader = request.headers.get('cookie') || '';
  for (const part of cookieHeader.split(';')) {
    const [key, ...valueParts] = part.trim().split('=');
    if (key === name) return decodeURIComponent(valueParts.join('='));
  }
  return null;
};

const cleanIdentifier = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 200) return null;
  return normalized;
};

export function getServerAnalyticsContext(request: Request, rawContext: unknown): ServerAnalyticsContext | null {
  if (readCookie(request, ANALYTICS_CONSENT_COOKIE) !== 'granted') return null;
  if (!rawContext || typeof rawContext !== 'object') return null;

  const context = rawContext as Record<string, unknown>;
  if (context.consent !== true) return null;
  const distinctId = cleanIdentifier(context.distinctId);
  if (!distinctId) return null;
  const sessionId = cleanIdentifier(context.sessionId);

  return {
    distinctId,
    ...(sessionId ? { sessionId } : {}),
  };
}

export const analyticsSessionProperties = (context: ServerAnalyticsContext) =>
  context.sessionId ? { $session_id: context.sessionId } : {};
