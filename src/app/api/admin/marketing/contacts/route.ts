import { NextResponse } from 'next/server';
import { DEFAULT_MARKETING_SEGMENTS } from '../../../../../lib/marketing-core';
import { buildMarketingContacts, filterMarketingContacts } from '../../../../../lib/marketing-data';
import { jsonError, requireMarketingAdmin } from '../../../../../lib/marketing-api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const contacts = await buildMarketingContacts(auth.supabase);
    const filtered = filterMarketingContacts(contacts, {
      search: url.searchParams.get('search'),
      segment: url.searchParams.get('segment'),
      stage: url.searchParams.get('stage'),
      minScore: url.searchParams.get('minScore') ? Number(url.searchParams.get('minScore')) : null,
    });

    const segmentCounts = DEFAULT_MARKETING_SEGMENTS.map((segment) => ({
      ...segment,
      count: contacts.filter((contact) => contact.segments.includes(segment.slug)).length,
    }));

    return NextResponse.json({
      contacts: filtered.map((contact) => ({
        ...contact,
        events: contact.events.slice(0, 3),
        links: contact.links.slice(0, 8),
      })),
      total: filtered.length,
      segmentCounts,
    });
  } catch (error) {
    return jsonError(error, 'Não foi possível carregar contactos.');
  }
}
