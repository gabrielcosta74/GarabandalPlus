import { MediaLibrary } from '../../../../components/cms/MediaLibrary';
import { cmsListMedia } from '../../../../lib/cms/queries';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Media library' };

export default async function MediaRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const search = (sp.q as string) ?? '';
  const filterRaw = (sp.filter as string) ?? 'no-alt';
  const filter = (['all', 'no-alt', 'with-alt'] as const).includes(filterRaw as 'all' | 'no-alt' | 'with-alt')
    ? (filterRaw as 'all' | 'no-alt' | 'with-alt')
    : 'no-alt';

  const { items, total, nextCursor } = await cmsListMedia({ search, filter, limit: 60 });

  return (
    <main className="cms-page-shell">
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
          Media library
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.95rem', margin: '0.25rem 0 0' }}>
          {' '}1.181 imagens migradas do Webnode. Adiciona alt text para SEO e acessibilidade — guarda automaticamente.
        </p>
      </header>
      <MediaLibrary items={items} total={total} filter={filter} search={search} hasMore={!!nextCursor} />
    </main>
  );
}
