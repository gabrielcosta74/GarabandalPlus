
import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { WhatsAppService } from '../../../../lib/whatsapp';

export async function POST(req: Request) {
    if (!supabaseServer) {
        return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { email, phone, name, pilgrimageId, step, data, type, channel_preference } = body;

        // Validation for Brochure: Needs either email or phone depending on channel
        const isBrochure = type === 'brochure_request';

        if (!pilgrimageId) {
            return NextResponse.json({ error: "Missing pilgrimageId" }, { status: 400 });
        }

        // Logic split based on type
        // If brochure, we allow multiple requests or just update latest?
        // Let's simple insert a NEW lead if status is 'draft' or create one.

        // Upsert Logic
        const { data: existingLead } = await supabaseServer
            .from('booking_leads')
            .select('id, status')
            .eq('email', email) // if email provided
            .eq('pilgrimage_id', pilgrimageId)
            .in('status', ['draft', 'brochure_request'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(); // Use maybeSingle to avoid null error

        let result;
        const statusToSet = isBrochure ? 'brochure_request' : 'draft';
        const leadData = {
            ...(data || {}),
            channel_preference: channel_preference
        };

        if (existingLead) {
            const { data: updateData, error: updateError } = await supabaseServer
                .from('booking_leads')
                .update({
                    phone: phone || undefined,
                    name: name || undefined,
                    // Only update step if it's a booking flow
                    ...(step ? { step_reached: step } : {}),
                    data: leadData,
                    updated_at: new Date().toISOString(),
                    // If moving from draft to brochure? keep draft. If moving from brochure to draft? 
                    // Let's keep status as is unless it's a pure brochure request on a draft
                    // simplify: if current is draft, keep draft. if brochure, keep brochure.
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
                    email: email || 'no-email@placeholder', // handle whatsapp only cases 
                    phone,
                    name,
                    pilgrimage_id: pilgrimageId,
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
            console.log(`[SoftCapture] Delivering brochure to ${name} via ${channel_preference}`);

            if (channel_preference === 'whatsapp' && phone) {
                try {
                    // Using a placeholder PDF link for now as defined in plan
                    const pdfLink = 'https://apostoladodegarabandal.com/programa-2025.pdf';
                    await WhatsAppService.sendMessage(
                        phone,
                        `Olá ${name}! Aqui está o programa da Peregrinação que pediu. 📄\n\nQualquer dúvida, estamos aqui.\n\n${pdfLink}`,
                        `brochure_${result.id}_${Date.now()}` // Unique ref per request attempt
                    );
                } catch (waError) {
                    console.error("WA Send Failed", waError);
                }
            }
            // Add Email logic later if needed
        }

        return NextResponse.json({ success: true, leadId: result.id });

    } catch (error: any) {
        console.error("[API] Lead Capture Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
