import Link from 'next/link';
import {
  BookOpen,
  FileText,
  CircleDot,
  CheckCircle2,
  Clock,
  ArrowRight,
  Tags,
  Image as ImageIcon,
  Languages,
  Compass,
} from 'lucide-react';
import { cmsCounts, cmsRecentlyEdited } from '../../../lib/cms/queries';
import { CreateContentDialog } from '../../../components/cms/CreateContentDialog';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard',
};

function StatCard({
  label,
  value,
  hint,
  href,
  icon: Icon,
  accent = '#1d4ed8',
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  icon: typeof BookOpen;
  accent?: string;
}) {
  const style = { ['--accent']: accent } as React.CSSProperties;
  const inner = (
    <>
      <div className="cms-stat-top">
        <span className="cms-stat-icon"><Icon size={17} aria-hidden /></span>
        <span className="cms-stat-label">{label}</span>
      </div>
      <div className="cms-stat-value">{value}</div>
      {hint && <div className="cms-stat-hint">{hint}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="cms-stat-card" style={style}>{inner}</Link>
  ) : (
    <div className="cms-stat-card" style={style}>{inner}</div>
  );
}

const SHORTCUTS: { href: string; label: string; desc: string; icon: typeof BookOpen }[] = [
  { href: '/admin/cms/media', label: 'Media', desc: 'Imagens e ficheiros', icon: ImageIcon },
  { href: '/admin/cms/categories', label: 'Categorias', desc: 'Organizar conteúdo', icon: Tags },
  { href: '/admin/cms/translations', label: 'Traduções', desc: 'PT · EN · ES', icon: Languages },
  { href: '/admin/cms/navigation', label: 'Navegação', desc: 'Menus do site', icon: Compass },
];

export default async function CmsDashboard() {
  const [counts, recent] = await Promise.all([cmsCounts(), cmsRecentlyEdited(8)]);
  const draftsTotal = counts.pages.draft + counts.posts.draft;

  return (
    <main className="cms-page-shell">
      <div className="cms-dash">
        <header className="cms-dash-head">
          <div>
            <h1 className="cms-dash-title">Conteúdo do site</h1>
            <p className="cms-dash-subtitle">
              Edita, publica e organiza páginas e artigos. Tudo a partir daqui.
            </p>
          </div>
          <div className="cms-dash-actions">
            <CreateContentDialog type="page" />
            <CreateContentDialog type="post" />
          </div>
        </header>

        <section className="cms-stat-grid" aria-label="Resumo">
          <StatCard label="Páginas" value={counts.pages.total} icon={BookOpen} href="/admin/cms/pages" hint={`${counts.pages.published} publicadas`} />
          <StatCard label="Artigos" value={counts.posts.total} icon={FileText} href="/admin/cms/posts" accent="#7c3aed" hint={`${counts.posts.published} publicados`} />
          <StatCard label="Por publicar" value={draftsTotal} icon={Clock} href="/admin/cms/pages?status=draft" accent="#b45309" hint="rascunhos em páginas e artigos" />
          <StatCard label="Publicado" value={counts.pages.published + counts.posts.published} icon={CheckCircle2} accent="#15803d" hint="visível ao público" />
        </section>

        <section aria-label="Atalhos">
          <p className="cms-section-label">Gerir</p>
          <div className="cms-shortcut-grid">
            {SHORTCUTS.map(({ href, label, desc, icon: Icon }) => (
              <Link key={href} href={href} className="cms-shortcut">
                <span className="cms-shortcut-icon"><Icon size={18} aria-hidden /></span>
                <span className="cms-shortcut-text">
                  <strong>{label}</strong>
                  <span>{desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="cms-panel" aria-label="Editado recentemente">
          <header className="cms-panel-head">
            <h2>Editado recentemente</h2>
            <span>{recent.length} item(s)</span>
          </header>
          {recent.length === 0 ? (
            <div className="cms-recent-empty">Sem edições recentes.</div>
          ) : (
            recent.map((item) => {
              const href = `/admin/cms/${item.type === 'page' ? 'pages' : 'posts'}/${item.id}`;
              const date = new Date(item.updated_at).toLocaleString('pt-BR', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
              });
              return (
                <Link key={`${item.type}-${item.id}`} href={href} className="cms-recent-row">
                  <span className="cms-recent-type" data-type={item.type}>
                    {item.type === 'page' ? 'Página' : 'Artigo'}
                  </span>
                  <span className="cms-badge" data-status={item.status}>{item.status}</span>
                  <span className="cms-recent-main">
                    <strong>{item.title}</strong>
                    <span>{item.locale.toUpperCase()} · /{item.slug}</span>
                  </span>
                  <span className="cms-recent-date">
                    {date}
                    <ArrowRight size={14} aria-hidden />
                  </span>
                </Link>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
