export const resolveLoginTarget = (next: string | null, activeMember: boolean, isEn: boolean) => {
  const fallback = activeMember
    ? (isEn ? '/en/member' : '/member')
    : (isEn ? '/en' : '/');

  if (!next || !next.startsWith('/')) return fallback;

  // In the English app, never let a generic Portuguese/root fallback steal the user.
  if (isEn) {
    if (next === '/' || next === '/login' || next === '/register') return fallback;
    if (next === '/member') return activeMember ? '/en/member' : '/en';
    if (next.startsWith('/member/')) return activeMember ? `/en${next}` : '/en';
    if (!(next === '/en' || next.startsWith('/en/')) && !next.startsWith('/auth')) return fallback;
  }

  return next;
};
