import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NavigationManager } from '../../../../components/cms/NavigationManager';
import { CATEGORIES, PUBLIC_NAV_ORDER, type CategoryKey } from '../../../../lib/cms/categories';
import { cmsListByCategory } from '../../../../lib/cms/queries';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Navegação' };

const ALL_KEYS: CategoryKey[] = [...PUBLIC_NAV_ORDER, 'noticias'];

export default async function NavigationRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const requested = (sp.cat as string | undefined) ?? PUBLIC_NAV_ORDER[0];

  // Default to historia if URL says something invalid.
  if (!ALL_KEYS.includes(requested as CategoryKey)) {
    redirect(`/admin/cms/navigation?cat=${PUBLIC_NAV_ORDER[0]}`);
  }
  const cat = requested as CategoryKey;
  const config = CATEGORIES[cat];

  // Counts per category (cheap — runs ALL_KEYS queries in parallel, all small).
  const [items, ...counts] = await Promise.all([
    cmsListByCategory(cat),
    ...ALL_KEYS.map((k) => cmsListByCategory(k).then((arr) => ({ key: k, count: arr.length, featured: arr.filter((r) => r.featured_in_nav).length }))),
  ]);

  return (
    <main className="cms-page-shell">
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
          Navegação
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.95rem', margin: '0.25rem 0 0' }}>
          Escolhe os artigos em destaque para cada categoria. Aparecem no mega-menu da nav e nas páginas de categoria.
        </p>
      </header>

      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.5rem' }}>
        {ALL_KEYS.map((k) => {
          const c = counts.find((x) => x.key === k);
          const active = k === cat;
          const cfg = CATEGORIES[k];
          return (
            <Link
              key={k}
              href={`/admin/cms/navigation?cat=${k}`}
              className={active ? 'cms-btn cms-btn-primary' : 'cms-btn cms-btn-secondary'}
            >
              {cfg.pt.label}
              <span style={{ fontSize: '0.7rem', opacity: 0.7, marginLeft: '0.4rem' }}>
                {c?.featured ?? 0}/{c?.count ?? 0}
              </span>
            </Link>
          );
        })}
      </nav>

      <NavigationManager category={cat} label={config.pt.label} items={items} />
    </main>
  );
}
