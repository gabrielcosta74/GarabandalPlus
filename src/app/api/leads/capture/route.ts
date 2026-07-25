
import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { APP_URL } from '../../../../lib/config';
import { sendBrochureEmail } from '../../../../lib/email';
import { inferRequestLocale } from '../../../../lib/locale-routing';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { getPostHogClient } from '../../../../lib/posthog-server';
import { analyticsSessionProperties, getServerAnalyticsContext } from '../../../../lib/analytics-consent-server';

export async function POST(req: Request) {
    const rateLimit = checkRateLimit(req, {
        keyPrefix: 'leads-capture',
        windowMs: 60_000,
        max: 20
    });
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: 'Too many requests' },
            {
                status: 429,
                headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) }
            }
        );
    }

    if (!supabaseServer) {
        return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
    }

    try {
        const body = await req.json();
        const analyticsContext = getServerAnalyticsContext(req, body?.analytics);
        const { email, phone, name, pilgrimageId, step, data, type, channel_preference } = body;
        const locale = body?.locale === 'en' || data?.locale === 'en' ? 'en' : inferRequestLocale(req);

        // Validation for Brochure: Needs either email or phone depending on channel
        const isBrochure = type === 'brochure_request';


        // Validation: If not general type, we might need pilgrimageId?
        // Actually, for "Did not find date", pilgrimageId is undefined.
        // So we allow it.

        const isGeneralLead = !pilgrimageId || type === 'general_waitlist';

        // Upsert Logic
        let existingLead = null;


        const query = supabaseServer
            .from('booking_leads')
            .select('id, status')
            .eq('email', email)
            .in('status', ['draft', 'brochure_request', 'waitlist'])
            .order('created_at', { ascending: false })
            .limit(1);

        if (pilgrimageId) {
            query.eq('pilgrimage_id', pilgrimageId);
        } else {
            query.is('pilgrimage_id', null);
        }

        const { data: foundLead } = await query.maybeSingle();

        existingLead = foundLead;

        let result;
        // Status logic
        let statusToSet = 'draft';
        if (isBrochure) statusToSet = 'brochure_request';
        if (isGeneralLead) statusToSet = 'waitlist';

        const leadData = {
            ...(data || {}),
            locale,
            channel_preference: channel_preference
        };

        if (existingLead) {
            const { data: updateData, error: updateError } = await supabaseServer
                .from('booking_leads')
                .update({
                    phone: phone || undefined,
                    name: name || undefined,
                    ...(step ? { step_reached: step } : {}),
                    data: leadData,
                    updated_at: new Date().toISOString(),
                    // If moving to waitlist? Update status if it was draft? 
                    // Let's just update status if it's general
                    ...(isGeneralLead ? { status: 'waitlist' } : {})
                })
                .eq('id', existingLead.id)
                .select()
                .single();
            if (updateError) throw updateError;
            result = updateData;
        } else {
            const { data: insertData, error: insertError } = await supabaseServer
                .from('booking_leads')
                .insert({
                    email: email || 'no-email@placeholder',
                    phone,
                    name,
                    pilgrimage_id: pilgrimageId || null,
                    step_reached: step || 0,
                    data: leadData,
                    status: statusToSet
                })
                .select()
                .single();
            if (insertError) throw insertError;
            result = insertData;
        }

        // IF BROCHURE: Trigger Delivery Immediately
        if (isBrochure) {
            let pdfLink = `${APP_URL}/programa-2025.pdf`;
            let pilgrimageTitle = 'Peregrinação';

            // Fetch dynamic details if possible
            if (pilgrimageId) {
                const { data: pData } = await supabaseServer
                    .from('pilgrimages')
                    .select('slug, title')
                    .eq('id', pilgrimageId)
                    .single();

                if (pData) {
                    const currency = body.currency || 'EUR';
                    const currencyParam = currency === 'BRL' ? '?currency=BRL' : '';
                    pdfLink = `${APP_URL}/api/pilgrimages/${pData.slug}/pdf${currencyParam}`;
                    pilgrimageTitle = pData.title;
                }
            }

            console.log(`[SoftCapture] Delivering brochure to ${name} via ${channel_preference}: ${pdfLink}`);

            if (email) {
                try {
                    await sendBrochureEmail({
                        email,
                        name,
                        pilgrimageName: pilgrimageTitle,
                        pdfUrl: pdfLink,
                        locale
                    });
                } catch (emailError) {
                    console.error("Email Brochure Send Failed", emailError);
                }
            } else {
                console.info("[SoftCapture] Brochure delivery skipped: no email provided.");
            }
        }

        // IF GENERAL WAITLIST: Send Email
        if (isGeneralLead && email) {
            // Import dynamically to avoid circular deps if any, or just call helper
            const { sendGeneralLeadEmail } = await import('../../../../lib/email');
            try {
                await sendGeneralLeadEmail({ email, name, locale });

                // CRITICAL FIX: Update DB to mark as notified
                await supabaseServer
                    .from('booking_leads')
                    .update({
                        status: 'notified',
                        last_notified_at: new Date().toISOString()
                    })
                    .eq('id', result.id);

            } catch (emailError) {
                console.error("Failed to send waitlist email", emailError);
            }
        }

        // Track lead capture server-side
        try {
            if (analyticsContext) {
                const posthog = getPostHogClient();
                posthog?.capture({
                    distinctId: analyticsContext.distinctId,
                    event: 'lead_captured',
                    properties: {
                        ...analyticsSessionProperties(analyticsContext),
                        lead_type: type || (isGeneralLead ? 'general_waitlist' : 'draft'),
                        is_brochure: isBrochure,
                        is_general_waitlist: isGeneralLead,
                        pilgrimage_id: pilgrimageId || null,
                        channel: channel_preference || null,
                        locale,
                        is_new_lead: !existingLead,
                    },
                });
            }
        } catch (phErr) {
            console.warn('[API] PostHog capture failed:', phErr);
        }

        return NextResponse.json({ success: true, leadId: result.id });

    } catch (error: any) {
        console.error("[API] Lead Capture Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
