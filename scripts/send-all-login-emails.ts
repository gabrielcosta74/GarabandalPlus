import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { MemberLoginEmail } from '../src/components/emails/MemberLoginEmail';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const resend = new Resend(process.env.RESEND_API_KEY);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface MemberData {
    numero_socio: string;
    name: string;
    email: string;
    tempPassword?: string;
    status: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runBulkSend() {
    const csvFilePath = path.join(process.cwd(), 'migration-output', 'member-logins-consolidado-2026-02-18.csv');
    const results: MemberData[] = [];

    console.log(`Lendo o ficheiro CSV: ${csvFilePath}`);

    fs.createReadStream(csvFilePath)
        .pipe(csv(['numero_socio', 'name', 'email', 'tempPassword', 'status']))
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            console.log(`Encontrados ${results.length} membros no CSV.`);

            let successCount = 0;
            let errorCount = 0;

            for (const [index, member] of results.entries()) {
                const { numero_socio, name, email, tempPassword, status } = member;

                // Skip obvious invalid lines or headers
                if (numero_socio === 'numero_socio' || !email || !tempPassword || status === 'failed') {
                    console.log(`[${index + 1}/${results.length}] A ignorar: ${email} (${status})`);
                    continue;
                }

                console.log(`\n[${index + 1}/${results.length}] A processar ${email} (nº ${numero_socio})...`);

                try {
                    // 1. Generate Magic Link
                    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
                        type: 'magiclink',
                        email: email,
                        options: {
                            redirectTo: "https://app.apostoladodegarabandal.com/auth-callback?next=/member"
                        }
                    });

                    if (linkError || !linkData?.properties?.action_link) {
                        console.error(`  -> Erro a gerar magic link para ${email}:`, linkError);
                        errorCount++;
                        continue;
                    }

                    const magicLink = linkData.properties.action_link;

                    // 2. Render HTML Email
                    const html = await render(MemberLoginEmail({
                        name: name,
                        email: email,
                        tempPassword: tempPassword,
                        memberNumber: isNaN(Number(numero_socio)) ? 0 : Number(numero_socio), // fallback just in case
                        loginUrl: magicLink,
                        profileUrl: "https://app.apostoladodegarabandal.com/account/profile"
                    }));

                    // 3. Dispatch Email via Resend
                    const res = await resend.emails.send({
                        from: 'Apostolado de Garabandal <geral@apostoladodegarabandal.com>',
                        to: email,
                        subject: 'Acesso à sua nova Área de Membro',
                        html,
                    });

                    if (res.error) {
                        console.error(`  -> Erro Resend para ${email}:`, res.error);
                        errorCount++;
                    } else {
                        console.log(`  -> Sucesso! Email enviado. ID: ${res.data?.id}`);
                        successCount++;
                    }
                } catch (err) {
                    console.error(`  -> Erro catastrofico para ${email}:`, err);
                    errorCount++;
                }

                // Throttle to avoid hitting rate limits (e.g., 2 emails per sec limit for max limits, 1 sec sleep is safe)
                await sleep(1200);
            }

            console.log(`\n--- CONCLUSÃO ---`);
            console.log(`Enviados com sucesso: ${successCount}`);
            console.log(`Erros: ${errorCount}`);
        });
}

runBulkSend();
