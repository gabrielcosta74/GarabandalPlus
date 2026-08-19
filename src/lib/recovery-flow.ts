export type RecoveryQueryValue = string | string[] | undefined;

export type RecoveryPageState = {
  initialMode: 'link' | 'code';
  initialStatus: 'idle' | 'invalid-link';
  initialEmail: string;
};

const FOCUSED_RECOVERY_PATHS = new Set([
  '/auth/forgot-password',
  '/auth/update-password',
  '/en/auth/forgot-password',
  '/en/auth/update-password',
]);

export function isFocusedRecoveryPath(pathname: string | null | undefined) {
  if (!pathname) return false;
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  return FOCUSED_RECOVERY_PATHS.has(normalized);
}

const firstValue = (value: RecoveryQueryValue) => Array.isArray(value) ? value[0] : value;

export function parseRecoveryPageState(
  query: Record<string, RecoveryQueryValue>,
): RecoveryPageState {
  const mode = firstValue(query.mode);
  const status = firstValue(query.status);
  const legacyEmail = (firstValue(query.email) || '').trim().toLowerCase();

  return {
    initialMode: mode === 'code' || Boolean(legacyEmail) ? 'code' : 'link',
    initialStatus: status === 'invalid-link' ? 'invalid-link' : 'idle',
    initialEmail: legacyEmail,
  };
}
