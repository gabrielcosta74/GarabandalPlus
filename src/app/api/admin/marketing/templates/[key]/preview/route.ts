import { NextResponse } from 'next/server';
import { renderMarketingEmail } from '../../../../../../../lib/marketing-email';
import { requireMarketingAdmin } from '../../../../../../../lib/marketing-api';
import { getAppUrl } from '../../../../../../../lib/config';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await requireMarketingAdmin(req);
  if (!auth.ok) return auth.response;

  const { key } = await params;
  const body = await req.json().catch(() => ({}));
  const language = body?.language === 'en' ? 'en' as const : 'pt' as const;
  const appUrl = getAppUrl();
  const path = (pt: string, en: string) => `${appUrl}${language === 'en' ? en : pt}`;
  const contact = {
    display_name: body?.name || 'Maria Silva',
    normalized_email: body?.email || 'maria@example.com',
    language,
    recommendation: body?.recommendation || 'Manual follow-up + pilgrimage funnel',
    source_summary: body?.source_summary || {},
  };

  const preview = renderMarketingEmail({
    contact,
    templateKey: key,
    subject: body?.subject || null,
    body: body?.body || null,
    context: {
      pilgrimageName: body?.pilgrimageName || 'Peregrinação a Garabandal',
      pilgrimageUrl: body?.pilgrimageUrl || path('/peregrinacoes', '/en/pilgrimages'),
      bookingResumeUrl: body?.bookingResumeUrl || path('/peregrinacoes', '/en/pilgrimages'),
      brochureUrl: body?.brochureUrl || path('/peregrinacoes', '/en/pilgrimages'),
      memberUrl: body?.memberUrl || path('/tornar-membro', '/en/become-member'),
      donationUrl: body?.donationUrl || path('/donations', '/en/donations'),
      referralUrl: body?.referralUrl || path('/member', '/en/member'),
    },
  });

  return NextResponse.json({ preview });
}
