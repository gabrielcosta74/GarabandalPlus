import { CategoriesManager } from '../../../../components/cms/CategoriesManager';
import { cmsCategoriesWithStats } from '../../../../lib/cms/queries';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Categorias' };

export default async function CategoriesRoute() {
  const stats = await cmsCategoriesWithStats();
  return (
    <main className="cms-page-shell cms-page-shell-narrow">
      <div>
        <header style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
            Categorias
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.95rem', margin: '0.25rem 0 0' }}>
            Agrupa páginas por tema. Renomeia ou limpa em massa.
          </p>
        </header>
        <CategoriesManager stats={stats} />
      </div>
    </main>
  );
}
