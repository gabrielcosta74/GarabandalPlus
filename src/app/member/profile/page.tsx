"use client";

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from '../../../contexts/LocaleContext';

export default function MemberProfilePage() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useLocale();
  const isEn = locale === 'en' || (pathname === '/en' || pathname?.startsWith('/en/'));

  useEffect(() => {
    router.replace(isEn ? '/en/account/profile' : '/account/profile');
  }, [isEn, router]);

  return <div style={{ padding: 16 }}>{isEn ? 'Redirecting...' : 'A redirecionar...'}</div>;
}
