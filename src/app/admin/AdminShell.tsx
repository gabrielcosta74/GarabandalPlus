"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { Menu } from 'lucide-react';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const handleLogout = async () => {
    if (supabaseBrowser) {
      await supabaseBrowser.auth.signOut();
      router.replace('/');
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar (Desktop) */}
      <div className="hidden md:block">
        <AdminSidebar onLogout={handleLogout} />
      </div>

      {/* Sidebar (Mobile) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden font-sans">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative h-full w-72">
            <AdminSidebar onLogout={handleLogout} />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Helper Header for Mobile to open Menu */}
        <div className="md:hidden bg-garabandal-dark text-white p-4 flex items-center justify-between">
          <span className="font-bold">Admin Garabandal</span>
          <button onClick={() => setMobileMenuOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 p-8 overflow-y-auto">
          <header className="mb-8 border-b pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                {showBackLink && (
                  <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-900 mb-2 inline-block">
                    ← Voltar ao dashboard
                  </Link>
                )}
                <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
                {description && <p className="text-gray-500 mt-1">{description}</p>}
              </div>
              {toolbar && <div>{toolbar}</div>}
            </div>
          </header>
          <main>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
