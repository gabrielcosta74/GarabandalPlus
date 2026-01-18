"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MembershipPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/member/quota');
  }, [router]);

  return <div style={{ padding: 16 }}>A redirecionar...</div>;
}
