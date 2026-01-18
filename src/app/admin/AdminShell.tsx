"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import styles from './AdminShell.module.css';
import { supabaseBrowser } from '../../lib/supabase-browser';

const navItems = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/courses', label: 'Cursos' },
  { href: '/admin/membros', label: 'Membros' },
  { href: '/admin/intentions', label: 'Intenções' },
  { href: '/admin/events', label: 'Eventos' }, // Added
  { href: '/admin/transacoes', label: 'Transacoes' },
  { href: '/admin/encomendas', label: 'Encomendas' },
  { href: '/admin/loja', label: 'Loja/Stock' },
  { href: '/admin/factpt', label: 'fact.pt' },
  { href: '/admin/relatorios', label: 'Relatorios' },
  { href: '/admin/auditoria', label: 'Auditoria' },
  { href: '/admin/configuracoes', label: 'Configuracoes' },
];

type AdminShellProps = {
  title: string;
  description?: string;
  toolbar?: ReactNode;
  showBackLink?: boolean;
  children: ReactNode;
};

export default function AdminShell({
  title,
  description,
  toolbar,
  showBackLink = true,
  children,
}: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    const verifyAdmin = async () => {
      if (!supabaseBrowser) return;
      const { data } = await supabaseBrowser.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        router.replace('/admin');
        return;
      }
      try {
        const res = await fetch('/api/admin/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401 || res.status === 403) {
          if (mounted) router.replace('/');
        }
      } catch (err) {
        console.warn('Nao foi possivel validar admin:', err);
      }
    };
    verifyAdmin();
    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <main className={styles.root}>
      <button
        className={`${styles.overlay} ${sidebarOpen ? styles.overlayOpen : ''}`}
        type="button"
        aria-label="Fechar menu"
        onClick={() => setSidebarOpen(false)}
      />
      <div className={`${styles.layout} ${!sidebarOpen ? styles.layoutCollapsed : ''}`}>
        <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarCollapsed}`}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>AG</span>
            <div>
              <strong>Admin</strong>
              <span>Apostolado de Garabandal</span>
            </div>
            <button
              className={styles.iconButton}
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Fechar menu"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <nav className={styles.nav}>
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className={styles.content}>
          <header className={styles.header}>
            <div className={styles.headerText}>
              <button
                className={styles.iconButton}
                type="button"
                onClick={() => setSidebarOpen((open) => !open)}
                aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path
                    d="M4 7h16M4 12h16M4 17h16"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              {showBackLink && (
                <Link href="/admin" className={styles.backLink}>
                  ← Voltar ao dashboard
                </Link>
              )}
              <h1>{title}</h1>
              {description && <p>{description}</p>}
            </div>
            {toolbar && <div className={styles.toolbar}>{toolbar}</div>}
          </header>
          {children}
        </div>
      </div>
    </main>
  );
}
