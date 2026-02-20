import { NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { MemberLoginEmail } from '../../../components/emails/MemberLoginEmail';

export async function GET() {
    const html = await render(
        MemberLoginEmail({
            name: "Maria de Lurdes",
            email: "maria.exemplo@gmail.com",
            tempPassword: "123mudar-pass",
            memberNumber: 847
        })
    );

    return new NextResponse(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
}
