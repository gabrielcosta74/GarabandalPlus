import { notFound } from 'next/navigation';
import { RevisionHistory } from '../../../../../../components/cms/RevisionHistory';
import { cmsGetById, cmsListRevisions } from '../../../../../../lib/cms/queries';
import '../../../../../../components/content/article-prose.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Histórico' };

export default async function PostHistoryRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [record, revisions] = await Promise.all([
    cmsGetById('post', id),
    cmsListRevisions('post', id),
  ]);
  if (!record) notFound();

  return (
    <main className="cms-page-shell">
      <RevisionHistory
        type="post"
        contentId={id}
        current={{ title: record.title, updated_at: record.updated_at, content_html: record.content_html }}
        revisions={revisions}
      />
    </main>
  );
}
