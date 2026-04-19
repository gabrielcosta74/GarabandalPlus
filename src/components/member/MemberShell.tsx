 "use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './member.module.css';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { isActiveMember } from '../../lib/store-discounts';
import { useLocale } from '../../contexts/LocaleContext';

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
  const { locale } = useLocale();
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
  const isEn = locale === 'en' || pathname?.startsWith('/en');
  const loginPath = isEn ? '/en/login' : '/login';
  const memberPath = isEn ? '/en/member' : '/member';
  const quotaPath = isEn ? '/en/member/quota' : '/member/quota';
  const historyPath = isEn ? '/en/member/history' : '/member/history';
  const becomeMemberPath = isEn ? '/en/become-member' : '/tornar-membro';

  useEffect(() => {
    const checkSession = async () => {
      if (!supabaseBrowser) {
        router.replace(loginPath);
        return;
      }
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session?.user?.id) {
        const next = pathname ? `?next=${encodeURIComponent(pathname)}` : '';
        router.replace(`${loginPath}${next}`);
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
          router.replace(quotaPath);
        } else {
          router.replace(becomeMemberPath);
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
  }, [becomeMemberPath, historyPath, loginPath, onMemberLoaded, pathname, quotaPath, router]);

  if (!ready) {
    return <div style={{ minHeight: '60vh' }} />;
  }

  const quotaLabel = memberInfo?.estado_quota
    ? memberInfo.estado_quota.toString().replace(/_/g, ' ')
    : '—';
  const nextQuotaLabel = memberInfo?.proxima_quota
    ? new Date(memberInfo.proxima_quota).toLocaleDateString(isEn ? 'en-GB' : 'pt-PT')
    : '—';
  const tenureLabel = (() => {
    if (!memberInfo?.data_adesao) return '—';
    const start = new Date(memberInfo.data_adesao);
    if (Number.isNaN(start.getTime())) return '—';
    const today = new Date();
    const msDiff = today.getTime() - start.getTime();
    if (msDiff <= 0) return isEn ? '0 days' : '0 dias';
    const days = Math.floor(msDiff / (1000 * 60 * 60 * 24));
    let months =
      (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
    if (today.getDate() < start.getDate()) {
      months -= 1;
    }
    if (months < 0) months = 0;
    if (months < 1) return `${days} ${isEn ? 'days' : 'dias'}`;
    if (months < 12) return `${months} ${isEn ? 'months' : 'meses'}`;
    const years = Math.floor(months / 12);
    return `${years} ${isEn ? 'years' : 'anos'}`;
  })();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.aside}>
          <h2>{isEn ? 'Member area' : 'Área de membro'}</h2>
          <nav className={styles.nav}>
            <Link className={pathname === memberPath ? styles.navActive : ''} href={memberPath}>
              {isEn ? 'Overview' : 'Resumo'}
            </Link>
            <Link className={pathname === quotaPath ? styles.navActive : ''} href={quotaPath}>
              {isEn ? 'Annual fee' : 'Quota anual'}
            </Link>
            <Link className={pathname === historyPath ? styles.navActive : ''} href={historyPath}>
              {isEn ? 'History' : 'Histórico'}
            </Link>
          </nav>
        </aside>
        <section className={styles.content}>
          <header className={styles.header}>
            <div className={styles.headerMain}>
              <span className={styles.headerBadge}>{isEn ? 'Private area' : 'Área privada'}</span>
              <h1>{title}</h1>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            <div className={styles.headerMeta}>
              <div>
                <span>{isEn ? 'Member number' : 'Número de sócio'}</span>
                <strong>{memberInfo?.numero_socio ? `#${memberInfo.numero_socio}` : '—'}</strong>
              </div>
              <div>
                <span>{isEn ? 'Fee status' : 'Estado da quota'}</span>
                <strong>{quotaLabel}</strong>
              </div>
              <div>
                <span>{isEn ? 'Next fee' : 'Próxima quota'}</span>
                <strong>{nextQuotaLabel}</strong>
              </div>
              <div>
                <span>{isEn ? 'Member for' : 'Sócio há'}</span>
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
