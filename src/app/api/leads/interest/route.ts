import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { inferRequestLocale } from '../../../../lib/locale-routing';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { getPostHogClient } from '../../../../lib/posthog-server';

/**
 * Lightweight "Estou interessado em ir" capture (one-tap → WhatsApp flow).
 *
 * Stores a demand signal for a waitlisted / sold-out pilgrimage in `booking_leads`
 * with status `interested`. Intentionally separate from `/api/leads/capture` so it
 * never runs the brochure/general-waitlist email waterfall.
 *
 * Marketing safety: `marketing-data.ts` excludes status `interested` from the generic
 * leads counter, so these rows never enter an active funnel (no automatic emails).
 */
export async function POST(req: Request) {
    const rateLimit = checkRateLimit(req, {
        keyPrefix: 'leads-interest',
        windowMs: 60_000,
        max: 20,
    });
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: 'Too many requests' },
            { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
        );
    }

    if (!supabaseServer) {
        return NextResponse.json({ error: 'Configuration Error' }, { status: 500 });
    }

    try {
        const body = await req.json();
        const {
            pilgrimageId,
            pilgrimageTitle,
            email,
            name,
            phone,
            sessionId,
            anonId,
            source,
            locale: bodyLocale,
        } = body || {};

        const locale = bodyLocale === 'en' ? 'en' : inferRequestLocale(req);
        const dedupeKey = String(sessionId || anonId || '').trim() || `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        // booking_leads.email is NOT NULL — use a synthetic address when unknown.
        const safeEmail = (typeof email === 'string' && email.trim()) ? email.trim() : `interesse+${dedupeKey}@chat.local`;

        const leadData = {
            source: source === 'pilgrimage_page_interest' ? 'pilgrimage_page_interest' : 'chat_interest',
            session_id: dedupeKey,
            pilgrimage_title: pilgrimageTitle || null,
            locale,
        };

        // Dedupe: one interest row per (pilgrimage, session/anon key).
        let existingQuery = supabaseServer
            .from('booking_leads')
            .select('id')
            .eq('status', 'interested')
            .filter('data->>session_id', 'eq', dedupeKey)
            .limit(1);
        existingQuery = pilgrimageId
            ? existingQuery.eq('pilgrimage_id', pilgrimageId)
            : existingQuery.is('pilgrimage_id', null);

        const { data: existing } = await existingQuery.maybeSingle();

        let leadId: string;
        if (existing?.id) {
            const { data: updated, error: updateError } = await supabaseServer
                .from('booking_leads')
                .update({
                    ...(name ? { name } : {}),
                    ...(phone ? { phone } : {}),
                    ...(typeof email === 'string' && email.trim() ? { email: email.trim() } : {}),
                    data: leadData,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
                .select('id')
                .single();
            if (updateError) throw updateError;
            leadId = updated.id;
        } else {
            const { data: inserted, error: insertError } = await supabaseServer
                .from('booking_leads')
                .insert({
                    email: safeEmail,
                    phone: phone || null,
                    name: name || null,
                    pilgrimage_id: pilgrimageId || null,
                    status: 'interested',
                    step_reached: 0,
                    data: leadData,
                })
                .select('id')
                .single();
            if (insertError) throw insertError;
            leadId = inserted.id;
        }

        try {
            const posthog = getPostHogClient();
            posthog?.capture({
                distinctId: safeEmail,
                event: 'pilgrimage_interest',
                properties: {
                    lead_id: leadId,
                    pilgrimage_id: pilgrimageId || null,
                    source: leadData.source,
                    locale,
                    is_new: !existing,
                },
            });
        } catch (phErr) {
            console.warn('[API] PostHog interest capture failed:', phErr);
        }

        return NextResponse.json({ success: true, leadId });
    } catch (error: any) {
        console.error('[API] Interest Capture Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
