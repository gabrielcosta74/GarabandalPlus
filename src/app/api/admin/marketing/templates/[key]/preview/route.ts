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
      pilgrimageName: body?.pilgrimageName || (language === 'en' ? 'Pilgrimage to Garabandal — Marian Way, October 2026' : 'Peregrinação a Garabandal — Caminho Mariano, Outubro 2026'),
      pilgrimageImageUrl: body?.pilgrimageImageUrl || 'https://pntzzuxzjnzksubbjfvj.supabase.co/storage/v1/object/public/site-content/pilgrimages/covers/1768917805305_l2ho16.png',
      pilgrimageDates: body?.pilgrimageDates || (language === 'en' ? '11–24 October 2026' : '11 a 24 de outubro de 2026'),
      pilgrimageStatus: body?.pilgrimageStatus || 'waitlist',
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
