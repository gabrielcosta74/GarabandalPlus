import { NextResponse } from 'next/server';
import { generateMemberDiplomaPdf } from '../../../../lib/member-diploma';
import { sendMemberDiplomaEmail } from '../../../../lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const VE_SECRET = process.env.TEST_DIPLOMA_SECRET || '';
  const headerSecret = request.headers.get('x-test-secret') || '';

  if (!VE_SECRET || headerSecret !== VE_SECRET) {
    return NextResponse.json({ message: 'Nao autorizado' }, { status: 404 });
  }

  const payload = await request.json().catch(() => ({}));
  const email = typeof payload?.email === 'string' ? payload.email.trim() : '';
  const name = typeof payload?.name === 'string' ? payload.name.trim() : 'Membro';
  const memberNumber = Number(payload?.memberNumber);

  if (!email || !Number.isFinite(memberNumber) || memberNumber <= 0) {
    return NextResponse.json({ message: 'Dados invalidos' }, { status: 400 });
  }

  try {
    const pdfBytes = await generateMemberDiplomaPdf({
      memberName: name,
      memberNumber,
      issuedAt: new Date().toISOString(),
    });

    // Uses the new specific sender function which uses the new template
    await sendMemberDiplomaEmail({
      toEmail: email,
      memberName: name,
      memberNumber,
      issuedAt: new Date().toISOString(),
      attachments: [
        {
          filename: `diploma-socio-${memberNumber}.pdf`,
          content: Buffer.from(pdfBytes),
          contentType: 'application/pdf',
        },
      ],
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Erro ao enviar diploma de teste:', err);
    return NextResponse.json({ message: 'Erro ao enviar diploma' }, { status: 500 });
  }
}
