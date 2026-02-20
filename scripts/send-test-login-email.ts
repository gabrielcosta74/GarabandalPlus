import { Resend } from 'resend';
import { render } from '@react-email/render';
import { createClient } from '@supabase/supabase-js';
import { MemberLoginEmail } from '../src/components/emails/MemberLoginEmail';
import dotenv from 'dotenv';
import * as path from 'path';

// Load .env where the keys actually live
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function sendTest() {
    const email = "ruinovocosta@outlook.com";
    const name = "Rui Costa";

    console.log('Generating Magic Link for', email, '...');

    // Create a real magic link that redirects to the member area
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
        options: {
            // Send them to the exact member landing page after auth
            redirectTo: "https://app.apostoladodegarabandal.com/auth-callback?next=/member"
        }
    });

    if (linkError || !linkData?.properties?.action_link) {
        console.error('Failed to generate magic link:', linkError);
        return;
    }

    const magicLink = linkData.properties.action_link;
    console.log('Magic link generated successfully!');

    console.log('Rendering HTML Email...');
    const html = await render(MemberLoginEmail({
        name: name,
        email: email,
        tempPassword: "Membro.04ObM2E!",
        memberNumber: 1,
        loginUrl: magicLink,
        profileUrl: "https://app.apostoladodegarabandal.com/account/profile"
    }));

    console.log('Sending email...');
    try {
        const res = await resend.emails.send({
            from: 'Apostolado de Garabandal <geral@apostoladodegarabandal.com>',
            to: email, // Sending right to Rui
            subject: 'Acesso à sua nova Área de Membro',
            html,
        });
        console.log('Success! Email sent to Outlook.');
    } catch (err) {
        console.error('Failed to send email:', err);
    }
}

sendTest();
