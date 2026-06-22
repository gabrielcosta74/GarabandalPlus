import { notFound } from 'next/navigation';
import { SideBySideTranslator } from '../../../../../../components/cms/SideBySideTranslator';
import { cmsResolveTranslationGroup, type CmsContentType } from '../../../../../../lib/cms/queries';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tradução' };

export default async function TranslationGroupPage({
  params,
}: {
  params: Promise<{ type: string; group_id: string }>;
}) {
  const { type, group_id } = await params;
  if (type !== 'page' && type !== 'post') notFound();

  const group = await cmsResolveTranslationGroup(type as CmsContentType, group_id);
  if (!group.pt && !group.en && !group.es && !group.fr && !group.it) notFound();

  return (
    <main className="cms-page-shell">
      <SideBySideTranslator type={type as CmsContentType} groupId={group_id} group={group} />
    </main>
  );
}
