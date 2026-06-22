import { notFound } from 'next/navigation';
import { PageEditor } from '../../../../../components/cms/editor/PageEditor';
import { cmsGetById, cmsTranslationPeersForContent } from '../../../../../lib/cms/queries';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Editar página' };

export default async function CmsPageEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await cmsGetById('page', id);
  if (!record) notFound();

  const { groupId, locales } = await cmsTranslationPeersForContent('page', id);

  return (
    <PageEditor initial={record} groupId={groupId} peerLocales={locales} />
  );
}
