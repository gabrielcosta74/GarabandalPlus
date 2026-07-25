import { createHmac, timingSafeEqual } from 'crypto';

// Server-only signing for early-access grant cookies. When a visitor enters the
// correct code we hand them a signed cookie `pea_<pilgrimageId>` that proves the
// grant without another DB round-trip. The cookie encodes the pilgrimage id and
// an expiry, HMAC-signed so it cannot be forged.

const SECRET =
    process.env.EARLY_ACCESS_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.CRON_SECRET ||
    '';

export const earlyAccessCookieName = (pilgrimageId: string) => `pea_${pilgrimageId}`;

const b64url = (input: string) => Buffer.from(input).toString('base64url');

const sign = (payload: string) => createHmac('sha256', SECRET).update(payload).digest('base64url');

/**
 * Build a signed token for a pilgrimage grant. `expMs` is the absolute expiry
 * (epoch ms) — set it to the public launch so the grant naturally dies when the
 * page becomes public anyway.
 */
export const signEarlyAccessToken = (pilgrimageId: string, expMs: number): string => {
    const payload = b64url(JSON.stringify({ id: pilgrimageId, exp: Math.floor(expMs) }));
    return `${payload}.${sign(payload)}`;
};

/** Verify a token belongs to `pilgrimageId` and has not expired. */
export const verifyEarlyAccessToken = (
    token: string | undefined | null,
    pilgrimageId: string,
    now: number = Date.now(),
): boolean => {
    if (!token || !SECRET) return false;
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return false;

    const expected = sign(payload);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

    try {
        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (decoded?.id !== pilgrimageId) return false;
        if (typeof decoded?.exp !== 'number' || now >= decoded.exp) return false;
        return true;
    } catch {
        return false;
    }
};

/** Constant-time comparison for the shared access code. */
export const codesMatch = (a: string, b: string): boolean => {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
};
