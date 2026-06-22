import { CmsListView } from '../../../../components/cms/CmsListView';
import { CreateContentDialog } from '../../../../components/cms/CreateContentDialog';
import { cmsListContent, type CmsLocale, type CmsStatus } from '../../../../lib/cms/queries';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Artigos' };

export default async function CmsPostsList({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const search = (sp.q as string) ?? '';
  const locale = ((sp.locale as string) ?? 'all');
  const status = ((sp.status as string) ?? 'all');
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 25;

  const { items, total } = await cmsListContent({
    type: 'post',
    search,
    locale: (locale === 'all' ? 'all' : locale) as CmsLocale | 'all',
    status: (status === 'all' ? 'all' : status) as CmsStatus | 'all',
    page,
    pageSize,
  });

  return (
    <main className="cms-page-shell">
      <div>
        <header style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Artigos
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem', margin: '0.25rem 0 0' }}>
              Posts do blog (Webnode <code>/l/&lt;slug&gt;</code>) — meditações, notícias, testemunhos.
            </p>
          </div>
          <CreateContentDialog type="post" />
        </header>

        <CmsListView
          type="post"
          items={items}
          total={total}
          page={page}
          pageSize={pageSize}
          filters={{ search, locale, status, category: '' }}
        />
      </div>
    </main>
  );
}
