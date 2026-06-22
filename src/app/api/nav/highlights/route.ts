import { NextResponse } from 'next/server';
import { cmsListCategoryHighlights } from '../../../../lib/cms/queries';
import { getPublicStatuses } from '../../../../lib/content/preview';
import { PUBLIC_NAV_ORDER, CATEGORIES, type CategoryKey } from '../../../../lib/cms/categories';

export const dynamic = 'force-dynamic';

/**
 * Mega-menu feed: top items per category for the given locale, used by the
 * client SiteHeaderV2 to render article links inside each dropdown / mobile
 * accordion. Preview-aware — admins with the preview cookie get drafts so the
 * menu can be tested before cutover.
 *
 *   GET /api/nav/highlights?locale=pt   ->   { historia: [...], ... }
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get('locale') === 'en' ? 'en' : 'pt';
  const statuses = await getPublicStatuses();

  const entries = await Promise.all(
    PUBLIC_NAV_ORDER.map(async (key: CategoryKey) => {
      const items = await cmsListCategoryHighlights(key, locale, { limit: 5, statuses });
      const slugify = (i: { type: 'page' | 'post'; slug: string }) =>
        i.type === 'page' ? `${locale === 'pt' ? '' : '/en'}/${i.slug}` : `${locale === 'pt' ? '' : '/en'}/l/${i.slug}`;
      return [
        key,
        {
          href: `${locale === 'pt' ? '' : '/en'}/${CATEGORIES[key][locale].slug}`,
          items: items.map((i) => ({ title: i.title, href: slugify(i) })),
        },
      ] as const;
    }),
  );

  return NextResponse.json(
    Object.fromEntries(entries),
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  );
}
