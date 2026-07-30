"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
        if (mounted) router.replace('/admin');
        return;
      }
      // Rely on API routes to enforce role security instead of double-checking here
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative h-full w-[264px] shadow-xl">
            <AdminSidebar onLogout={handleLogout} />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Helper Header for Mobile to open Menu */}
        <div className="md:hidden sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/80 bg-white/85 px-4 py-3 backdrop-blur-md">
          <span className="text-[15px] font-semibold tracking-tight text-slate-900">Admin</span>
          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu"
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-3 sm:p-4 md:p-8 overflow-y-auto">
          <header className="mb-4 md:mb-8 border-b pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="min-w-0">
                {showBackLink && (
                  <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-900 mb-2 inline-block">
                    ← Voltar ao dashboard
                  </Link>
                )}
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight break-words">{title}</h1>
                {description && <p className="text-gray-500 mt-1">{description}</p>}
              </div>
              {toolbar && <div className="w-full md:w-auto">{toolbar}</div>}
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
