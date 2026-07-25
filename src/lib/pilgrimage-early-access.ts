// Early-access ("private launch") helpers.
//
// A pilgrimage can be published with a private early-access window: for the
// hours before `public_launch_at` it is hidden from every public surface
// (listings, homepage, sitemap, the public detail RPC) and its detail page is
// gated behind a shared access code. Code-holders get in early and can book
// before the public. When `now >= public_launch_at` everything opens on its
// own — the switch is purely time-based, no cron job required.
//
// The non-secret timing lives in `pricing_config.early_access` so it can be
// read on both server and client. The access code itself is NEVER stored here;
// it lives in the service-role-only `pilgrimage_access` table.

export type EarlyAccessConfig = {
    enabled: boolean;
    /** ISO timestamp at which the pilgrimage becomes fully public. */
    public_launch_at: string | null;
};

type EarlyAccessSource = {
    // Intentionally loose: callers pass pilgrimage records with varying
    // pricing_config shapes; we only read `early_access` defensively.
    pricing_config?: Record<string, any> | null;
} | null | undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export const getEarlyAccessConfig = (pilgrimage: EarlyAccessSource): EarlyAccessConfig | null => {
    const raw = pilgrimage?.pricing_config?.early_access;
    if (!isRecord(raw)) return null;

    const enabled = raw.enabled === true;
    const launch = typeof raw.public_launch_at === 'string' ? raw.public_launch_at : null;
    if (!enabled) return null;

    return { enabled, public_launch_at: launch };
};

/** Milliseconds timestamp of the public launch, or null when not configured. */
export const getPublicLaunchTimestamp = (pilgrimage: EarlyAccessSource): number | null => {
    const config = getEarlyAccessConfig(pilgrimage);
    if (!config?.public_launch_at) return null;
    const ts = Date.parse(config.public_launch_at);
    return Number.isFinite(ts) ? ts : null;
};

/**
 * True while the pilgrimage is in its private early-access window: early access
 * is enabled and the public launch is still in the future.
 */
export const isPreLaunch = (pilgrimage: EarlyAccessSource, now: number = Date.now()): boolean => {
    const launch = getPublicLaunchTimestamp(pilgrimage);
    if (launch === null) return false;
    return now < launch;
};
