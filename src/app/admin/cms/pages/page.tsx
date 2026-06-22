import { CmsListView } from '../../../../components/cms/CmsListView';
import { CreateContentDialog } from '../../../../components/cms/CreateContentDialog';
import { cmsListContent, cmsListCategories, type CmsLocale, type CmsStatus } from '../../../../lib/cms/queries';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Páginas' };

export default async function CmsPagesList({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const search = (sp.q as string) ?? '';
  const locale = ((sp.locale as string) ?? 'all');
  const status = ((sp.status as string) ?? 'all');
  const category = ((sp.category as string) ?? '');
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 25;

  const [{ items, total }, categories] = await Promise.all([
    cmsListContent({
      type: 'page',
      search,
      locale: (locale === 'all' ? 'all' : locale) as CmsLocale | 'all',
      status: (status === 'all' ? 'all' : status) as CmsStatus | 'all',
      category: category || undefined,
      page,
      pageSize,
    }),
    cmsListCategories(),
  ]);

  return (
    <main className="cms-page-shell">
      <div>
        <header style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Páginas
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem', margin: '0.25rem 0 0' }}>
              Conteúdo estático devocional — história, videntes, ensinamentos.
            </p>
          </div>
          <CreateContentDialog type="page" />
        </header>

        <CmsListView
          type="page"
          items={items}
          total={total}
          page={page}
          pageSize={pageSize}
          filters={{ search, locale, status, category }}
          categories={categories}
        />
      </div>
    </main>
  );
}
