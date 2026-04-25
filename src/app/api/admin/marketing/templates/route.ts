import { NextResponse } from 'next/server';
import { listMarketingEmailTemplates } from '../../../../../lib/marketing-email';
import { requireMarketingAdmin } from '../../../../../lib/marketing-api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  return NextResponse.json({ templates: listMarketingEmailTemplates() });
}
