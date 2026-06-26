"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './account.module.css';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { useLocale } from '../../contexts/LocaleContext';

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export default function AccountShell({ title, subtitle, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useLocale();
  const [ready, setReady] = useState(false);
  const [summaryEmail, setSummaryEmail] = useState('');
  const [summaryIsMember, setSummaryIsMember] = useState(false);
  const isEn = locale === 'en' || (pathname === '/en' || pathname?.startsWith('/en/'));
  const loginPath = isEn ? '/en/login' : '/login';
  const profilePath = isEn ? '/en/account/profile' : '/account/profile';
  const memberPath = isEn ? '/en/member' : '/member';
  const quotaPath = isEn ? '/en/member/quota' : '/member/quota';
  const historyPath = isEn ? '/en/member/history' : '/member/history';
  const libraryPath = isEn ? '/en/library' : '/biblioteca';
  const ordersPath = isEn ? '/en/orders' : '/encomendas';

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
      setSummaryEmail(data.session.user.email ?? '');
      const { data: member } = await supabaseBrowser
        .from('membros')
        .select('is_membro')
        .eq('id', data.session.user.id)
        .maybeSingle();
      setSummaryIsMember(!!member?.is_membro);
      setReady(true);
    };
    checkSession();
  }, [loginPath, pathname, router]);

  if (!ready) return <div style={{ minHeight: '60vh' }} />;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.aside}>
          <div className={styles.navSection}>
            <h2>{isEn ? 'Account' : 'Conta'}</h2>
            <nav className={styles.nav}>
              <Link className={pathname === profilePath ? styles.active : ''} href={profilePath}>
                {isEn ? 'Profile' : 'Perfil'}
              </Link>
            </nav>
          </div>
          {summaryIsMember ? (
            <div className={styles.navSection}>
              <h2>{isEn ? 'Member' : 'Membro'}</h2>
              <nav className={styles.nav}>
                <Link className={pathname === memberPath ? styles.active : ''} href={memberPath}>
                  {isEn ? 'Member area' : 'Area de membro'}
                </Link>
                <Link className={pathname === quotaPath ? styles.active : ''} href={quotaPath}>
                  {isEn ? 'Annual fee' : 'Quota anual'}
                </Link>
                <Link className={pathname === historyPath ? styles.active : ''} href={historyPath}>
                  {isEn ? 'History' : 'Historico'}
                </Link>
                <Link className={pathname === libraryPath ? styles.active : ''} href={libraryPath}>
                  {isEn ? 'Library' : 'Biblioteca'}
                </Link>
                <Link className={pathname === ordersPath ? styles.active : ''} href={ordersPath}>
                  {isEn ? 'Orders' : 'Encomendas'}
                </Link>
              </nav>
            </div>
          ) : null}
        </aside>
        <section className={styles.content}>
          <header className={styles.header}>
            <div>
              <h1>{title}</h1>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
          </header>
          {summaryEmail ? (
            <div className={styles.summary}>
              <div>
                <span>Email</span>
                <strong>{summaryEmail}</strong>
              </div>
              <div>
                <span>{isEn ? 'Status' : 'Estado'}</span>
                <strong>{summaryIsMember ? (isEn ? 'Active member' : 'Membro ativo') : (isEn ? 'Free account' : 'Conta livre')}</strong>
              </div>
            </div>
          ) : null}
          {children}
        </section>
      </div>
    </main>
  );
}
