import { notFound } from 'next/navigation';
import { PostEditor } from '../../../../../components/cms/editor/PostEditor';
import { cmsGetById, cmsTranslationPeersForContent } from '../../../../../lib/cms/queries';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Editar artigo' };

export default async function CmsPostEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await cmsGetById('post', id);
  if (!record) notFound();

  const { groupId, locales } = await cmsTranslationPeersForContent('post', id);

  return (
    <PostEditor initial={record} groupId={groupId} peerLocales={locales} />
  );
}
