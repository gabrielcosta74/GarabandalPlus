
import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { sendAbandonmentRecoveryEmail } from '../../../../lib/email';
import { WhatsAppService } from '../../../../lib/whatsapp';
import { getAppUrl } from '../../../../lib/config';

export const dynamic = 'force-dynamic';

// CRON Endpoint - Should be called every 10-15 minutes or hour
export async function GET(req: Request) {
    if (!supabaseServer) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    // Optional: Secure with a CRON_SECRET header if using Vercel Cron
    // const authHeader = req.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { ... }

    try {
        // 1. Find Abandoned Leads 
        // Criteria: Status 'draft', Created > 30 minutes ago, Not Notified yet
        const now = new Date();
        const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

        const { data: leads, error: fetchError } = await supabaseServer
            .from('booking_leads')
            .select('*, pilgrimages(title, slug)') // Join for names
            .eq('status', 'draft')
            .lt('created_at', thirtyMinutesAgo)
            .is('last_notified_at', null)
            .limit(10); // Batch size to avoid timeouts

        if (fetchError) throw fetchError;

        if (!leads || leads.length === 0) {
            return NextResponse.json({ message: "No abandoned leads found to recover." });
        }

        const results = [];

        // 2. Process each lead
        for (const lead of leads) {
            console.log(`[Cron] Recovering lead ${lead.id} (${lead.email})...`);
            let emailSent = false;
            let whatsappSent = false;

            // Generate Recovery Link (Pointing to resume step ?)
            // For now, simple link to the pilgrimage page or a specific resume param
            const origin = getAppUrl();

            // Should be a dedicated resume link, but for now specific pilgrimage
            const recoveryLink = `${origin}/peregrinacoes/${lead.pilgrimages?.slug}/inscrever?resume=${lead.id}&email=${encodeURIComponent(lead.email)}`;

            // Send Email
            try {
                emailSent = await sendAbandonmentRecoveryEmail({
                    email: lead.email,
                    name: lead.name || 'Peregrino',
                    pilgrimageName: lead.pilgrimages?.title || 'Garabandal',
                    recoveryLink: recoveryLink
                });
            } catch (err) {
                console.error(`[Cron] Failed to send email to ${lead.email}`, err);
            }

            // Send WhatsApp (If phone exists)
            if (lead.phone && lead.phone.length > 8) {
                try {
                    await WhatsAppService.sendMessage(
                        lead.phone,
                        `Olá ${lead.name || 'Peregrino'}! 🕊️\n\nVimos que não conseguiu terminar a sua inscrição para *${lead.pilgrimages?.title || 'Garabandal'}*. \n\nGuardámos o seu lugar temporariamente. Clique aqui para continuar: ${recoveryLink}`
                    );
                    whatsappSent = true;
                } catch (waErr) {
                    console.error(`[Cron] Failed to send WA to ${lead.phone}`, waErr);
                }
            }

            // 3. Mark as Notified
            if (emailSent || whatsappSent) {
                await supabaseServer
                    .from('booking_leads')
                    .update({
                        last_notified_at: new Date().toISOString(),
                        // status: 'recovered_sent' // Optional state change
                    })
                    .eq('id', lead.id);

                results.push({ id: lead.id, email: lead.email, success: true });
            } else {
                results.push({ id: lead.id, email: lead.email, success: false });
            }
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            details: results
        });

    } catch (error: any) {
        console.error("[Cron] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
