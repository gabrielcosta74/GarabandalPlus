"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './account.module.css';
import { supabaseBrowser } from '../../lib/supabase-browser';

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export default function AccountShell({ title, subtitle, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [summaryEmail, setSummaryEmail] = useState('');
  const [summaryIsMember, setSummaryIsMember] = useState(false);

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
  }, [pathname, router]);

  if (!ready) return <div style={{ minHeight: '60vh' }} />;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.aside}>
          <div className={styles.navSection}>
            <h2>Conta</h2>
            <nav className={styles.nav}>
              <Link className={pathname === '/account/profile' ? styles.active : ''} href="/account/profile">
                Perfil
              </Link>
            </nav>
          </div>
          {summaryIsMember ? (
            <div className={styles.navSection}>
              <h2>Membro</h2>
              <nav className={styles.nav}>
                <Link className={pathname === '/member' ? styles.active : ''} href="/member">
                  Area de membro
                </Link>
                <Link className={pathname === '/member/quota' ? styles.active : ''} href="/member/quota">
                  Quota anual
                </Link>
                <Link className={pathname === '/member/history' ? styles.active : ''} href="/member/history">
                  Historico
                </Link>
                <Link className={pathname === '/biblioteca' ? styles.active : ''} href="/biblioteca">
                  Biblioteca
                </Link>
                <Link className={pathname === '/encomendas' ? styles.active : ''} href="/encomendas">
                  Encomendas
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
                <span>Estado</span>
                <strong>{summaryIsMember ? 'Membro ativo' : 'Conta livre'}</strong>
              </div>
            </div>
          ) : null}
          {children}
        </section>
      </div>
    </main>
  );
}
