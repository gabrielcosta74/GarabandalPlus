import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { BookOpen, FileText, LayoutDashboard, Tags, Image as ImageIcon, Languages, Compass } from 'lucide-react';
import { requireAdmin } from '../../../lib/cms/authz';
import '../../../components/cms/editor/layout.css';

export const metadata: Metadata = {
  title: { template: '%s · CMS', default: 'CMS' },
  robots: { index: false, follow: false },
};

// Server-side gate: every page under /admin/cms re-checks admin status before
// any data is fetched or rendered. If the user isn't an admin, requireAdmin
// redirects to /admin (login). Run on every request (no caching of auth).
export const dynamic = 'force-dynamic';

export default async function CmsLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <div className="cms-app-shell">
      <nav className="cms-workspace-nav" aria-label="CMS workspace">
        <Link href="/admin/cms" className="cms-workspace-brand">
          CMS
        </Link>
        <div className="cms-workspace-links">
          <Link href="/admin/cms" className="cms-workspace-link">
            <LayoutDashboard size={16} /> Início
          </Link>
          <Link href="/admin/cms/pages" className="cms-workspace-link">
            <BookOpen size={16} /> Páginas
          </Link>
          <Link href="/admin/cms/posts" className="cms-workspace-link">
            <FileText size={16} /> Artigos
          </Link>
          <Link href="/admin/cms/categories" className="cms-workspace-link">
            <Tags size={16} /> Categorias
          </Link>
          <Link href="/admin/cms/media" className="cms-workspace-link">
            <ImageIcon size={16} /> Media
          </Link>
          <Link href="/admin/cms/translations" className="cms-workspace-link">
            <Languages size={16} /> Traduções
          </Link>
          <Link href="/admin/cms/navigation" className="cms-workspace-link">
            <Compass size={16} /> Navegação
          </Link>
        </div>
      </nav>
      <div className="cms-app-content">{children}</div>
    </div>
  );
}
