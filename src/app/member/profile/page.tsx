"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MemberProfilePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/account/profile');
  }, [router]);

  return <div style={{ padding: 16 }}>A redirecionar...</div>;
}
