
import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { sendAbandonmentRecoveryEmail } from '../../../../lib/email';
import { WhatsAppService } from '../../../../lib/whatsapp';
import { getAppUrl } from '../../../../lib/config';

export async function POST(req: Request) {
    if (!supabaseServer) {
        console.error('[Manual Notify] Supabase not configured');
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    try {
        const { leadId } = await req.json();
        console.log(`[Manual Notify] Received request for leadId: ${leadId}`);

        if (!leadId) {
            console.error('[Manual Notify] No leadId provided');
            return NextResponse.json({ error: "Lead ID is required" }, { status: 400 });
        }

        // 1. Fetch Lead
        console.log(`[Manual Notify] Fetching lead from database...`);
        const { data: lead, error: fetchError } = await supabaseServer
            .from('booking_leads')
            .select('*, pilgrimages(title, slug)')
            .eq('id', leadId)
            .single();

        if (fetchError) {
            console.error(`[Manual Notify] Database error:`, fetchError);
            return NextResponse.json({ error: `Database error: ${fetchError.message}` }, { status: 500 });
        }

        if (!lead) {
            console.error(`[Manual Notify] Lead not found: ${leadId}`);
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }

        console.log(`[Manual Notify] Lead found:`, {
            id: lead.id,
            email: lead.email,
            name: lead.name,
            phone: lead.phone,
            pilgrimage: lead.pilgrimages?.title,
            status: lead.status
        });

        let emailSent = false;
        let whatsappSent = false;

        // Generate Recovery Link
        const origin = getAppUrl();
        const recoveryLink = `${origin}/peregrinacoes/${lead.pilgrimages?.slug || 'geral'}/inscrever?resume=${lead.id}&email=${encodeURIComponent(lead.email)}`;
        console.log(`[Manual Notify] Recovery link: ${recoveryLink}`);

        // Send Email
        console.log(`[Manual Notify] Attempting to send email to ${lead.email}...`);
        try {
            const result = await sendAbandonmentRecoveryEmail({
                email: lead.email,
                name: lead.name || 'Peregrino',
                pilgrimageName: lead.pilgrimages?.title || 'Garabandal',
                recoveryLink: recoveryLink
            });
            emailSent = result === true;
            console.log(`[Manual Notify] Email send result: ${emailSent ? 'SUCCESS' : 'FAILED'}`);
        } catch (err: any) {
            console.error(`[Manual Notify] Email send exception:`, err);
            console.error(`[Manual Notify] Error details:`, {
                message: err.message,
                stack: err.stack,
                name: err.name
            });
        }

        // Send WhatsApp (If phone exists)
        if (lead.phone && lead.phone.length > 8) {
            console.log(`[Manual Notify] Attempting to send WhatsApp to ${lead.phone}...`);
            try {
                await WhatsAppService.sendWhatsAppMessage(
                    lead.phone,
                    `Olá ${lead.name || 'Peregrino'}! 🕊️\n\nVimos que não conseguiu terminar a sua inscrição para *${lead.pilgrimages?.title || 'Garabandal'}*. \n\nGuardámos o seu lugar temporariamente. Clique aqui para continuar: ${recoveryLink}`
                );
                whatsappSent = true;
                console.log(`[Manual Notify] WhatsApp sent successfully`);
            } catch (waErr: any) {
                console.error(`[Manual Notify] WhatsApp send failed:`, waErr);
            }
        } else {
            console.log(`[Manual Notify] Skipping WhatsApp (no valid phone number)`);
        }

        // 3. Mark as Notified
        console.log(`[Manual Notify] Email sent: ${emailSent}, WhatsApp sent: ${whatsappSent}`);

        if (emailSent || whatsappSent) {
            console.log(`[Manual Notify] Updating database status...`);
            const { error: updateError } = await supabaseServer
                .from('booking_leads')
                .update({
                    status: lead.status === 'draft' ? 'notified' : lead.status,
                    last_notified_at: new Date().toISOString()
                })
                .eq('id', lead.id);

            if (updateError) {
                console.error(`[Manual Notify] Failed to update database:`, updateError);
            } else {
                console.log(`[Manual Notify] Database updated successfully`);
            }

            return NextResponse.json({
                success: true,
                method: emailSent ? 'email' : 'whatsapp',
                details: {
                    emailSent,
                    whatsappSent,
                    leadId: lead.id
                }
            });
        } else {
            console.error(`[Manual Notify] FAILED: No notification channel succeeded`);
            return NextResponse.json({
                error: "Failed to send notification via any channel",
                details: {
                    emailAttempted: true,
                    emailSent: false,
                    whatsappAttempted: !!lead.phone,
                    whatsappSent: false
                }
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error("[Manual Notify] Unexpected error:", error);
        console.error("[Manual Notify] Error stack:", error.stack);
        return NextResponse.json({
            error: error.message || 'Unknown error',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}

