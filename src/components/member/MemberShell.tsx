 "use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './member.module.css';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { isActiveMember } from '../../lib/store-discounts';

type Props = {
  title: string;
  subtitle?: string;
  onMemberLoaded?: (member: {
    nome?: string | null;
    numero_socio?: number | null;
    estado_quota?: string | null;
    proxima_quota?: string | null;
    tipo_subscricao?: string | null;
    is_membro?: boolean | null;
    data_adesao?: string | null;
  }) => void;
  children: React.ReactNode;
};

export default function MemberShell({ title, subtitle, children, onMemberLoaded }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [memberInfo, setMemberInfo] = useState<{
    nome?: string | null;
    numero_socio?: number | null;
    estado_quota?: string | null;
    proxima_quota?: string | null;
    tipo_subscricao?: string | null;
    is_membro?: boolean | null;
    data_adesao?: string | null;
  } | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      if (!supabaseBrowser) {
        router.replace('/login');
        return;
      }
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session?.user?.id) {
        const next = pathname ? `?next=${encodeURIComponent(pathname)}` : '';
        router.replace(`/login${next}`);
        return;
      }
      const { data: member } = await supabaseBrowser
        .from('membros')
        .select('is_membro, nome, numero_socio, estado_quota, proxima_quota, tipo_subscricao, data_adesao')
        .eq('id', data.session.user.id)
        .maybeSingle();
      const isActive = isActiveMember(member);
      if (!isActive) {
        if (member?.numero_socio) {
          router.replace('/member/quota');
        } else {
          router.replace('/tornar-membro');
        }
        return;
      }
      setMemberInfo(member);
      if (member) {
        onMemberLoaded?.(member);
      }
      setReady(true);
    };
    checkSession();
  }, [pathname, router, onMemberLoaded]);

  if (!ready) {
    return <div style={{ minHeight: '60vh' }} />;
  }

  const quotaLabel = memberInfo?.estado_quota
    ? memberInfo.estado_quota.toString().replace(/_/g, ' ')
    : '—';
  const nextQuotaLabel = memberInfo?.proxima_quota
    ? new Date(memberInfo.proxima_quota).toLocaleDateString('pt-PT')
    : '—';
  const tenureLabel = (() => {
    if (!memberInfo?.data_adesao) return '—';
    const start = new Date(memberInfo.data_adesao);
    if (Number.isNaN(start.getTime())) return '—';
    const today = new Date();
    const msDiff = today.getTime() - start.getTime();
    if (msDiff <= 0) return '0 dias';
    const days = Math.floor(msDiff / (1000 * 60 * 60 * 24));
    let months =
      (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
    if (today.getDate() < start.getDate()) {
      months -= 1;
    }
    if (months < 0) months = 0;
    if (months < 1) return `${days} dias`;
    if (months < 12) return `${months} meses`;
    const years = Math.floor(months / 12);
    return `${years} anos`;
  })();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.aside}>
          <h2>Área de membro</h2>
          <nav className={styles.nav}>
            <Link className={pathname === '/member' ? styles.navActive : ''} href="/member">
              Resumo
            </Link>
            <Link className={pathname === '/member/quota' ? styles.navActive : ''} href="/member/quota">
              Quota anual
            </Link>
            <Link className={pathname === '/member/history' ? styles.navActive : ''} href="/member/history">
              Histórico
            </Link>
          </nav>
        </aside>
        <section className={styles.content}>
          <header className={styles.header}>
            <div className={styles.headerMain}>
              <span className={styles.headerBadge}>Área privada</span>
              <h1>{title}</h1>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            <div className={styles.headerMeta}>
              <div>
                <span>Número de sócio</span>
                <strong>{memberInfo?.numero_socio ? `#${memberInfo.numero_socio}` : '—'}</strong>
              </div>
              <div>
                <span>Estado da quota</span>
                <strong>{quotaLabel}</strong>
              </div>
              <div>
                <span>Próxima quota</span>
                <strong>{nextQuotaLabel}</strong>
              </div>
              <div>
                <span>Sócio há</span>
                <strong>{tenureLabel}</strong>
              </div>
            </div>
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
