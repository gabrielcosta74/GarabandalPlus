
import { supabaseServer } from './supabase';
import { sendWhatsAppMessage } from './whatsapp-provider';

/**
 * Service to handle business logic for WhatsApp notifications.
 * Automatically handles deduplication via database.
 */

export const WhatsAppService = {

    async sendWelcomeMessage(booking: any, pilgrimageTitle: string) {
        // Find the main contact phone
        // We usually target the USER who made the booking, or the first pilgrim if has phone.
        // For simplicity, we'll try to find a valid phone in the first pilgrim or user profile.
        // But the booking object passed here usually needs to be enriched.

        // Let's assume we pass the target phone directly for simplicity in this V1
        const targetPhone = booking.pilgrims?.[0]?.phone || booking.pilgrims?.[0]?.whatsapp;
        const targetName = booking.pilgrims?.[0]?.full_name?.split(' ')[0] || 'Peregrino';

        if (!targetPhone) {
            console.warn(`⚠️ [WhatsApp] No phone found for booking ${booking.id}`);
            return;
        }

        const message = `Olá ${targetName}! 👋\n\nA tua inscrição na peregrinação *${pilgrimageTitle}* foi recebida com sucesso.\n\nReferência: ${booking.id.slice(0, 8)}\n\nIremos enviar-te mais detalhes por email brevemente. Obrigado pela confiança!\n\n_Apostolado de Garabandal_`;

        await this.dispatch(
            'booking_welcome',
            booking.id,
            targetPhone,
            message
        );
    },

    async sendPaymentConfirmation(bookingId: string, amount: number, phone: string, name: string) {
        const message = `✅ Pagamento Confirmado!\n\nOlá ${name}, recebemos o teu pagamento de *${amount}€*.\n\nO teu lugar está cada vez mais seguro. Consulta o estado da tua inscrição na tua área de membro.\n\nDeus te abençoe,\n_Apostolado de Garabandal_`;

        await this.dispatch(
            'payment_confirmed',
            bookingId + '_' + Date.now().toString().slice(0, 5), // Unique enough per payment event roughly
            // Actually, ideally we pass the PAYMENT_ID as reference.
            // But let's stick to bookingID logic for now or composite.
            phone,
            message
        );
    },

    /**
     * Send a generic message (used for ad-hoc alerts, brochures, etc)
     */
    async sendMessage(phone: string, message: string, reference?: string) {
        // If no reference provided, generate a random one to allow multiple sends
        // or force caller to provide one for idempotency.
        // For brochure, allow re-send? Maybe.
        const ref = reference || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        await this.dispatch(
            'generic_message',
            ref,
            phone,
            message
        );
    },

    /**
     * Core Dispatcher with Idempotency
     */
    async dispatch(type: string, reference: string, phone: string, body: string) {
        if (!supabaseServer) return;

        // 1. Check if already sent
        const { data: existing } = await supabaseServer
            .from('whatsapp_notifications')
            .select('id')
            .eq('type', type)
            .eq('reference', reference)
            .single();

        if (existing) {
            console.log(`info: [WhatsApp] Message ${type} for ${reference} already sent. Skipping.`);
            return;
        }

        // 2. Send via Provider
        const result = await sendWhatsAppMessage({ to: phone, body });

        // 3. Log to DB
        if (result.success) {
            await supabaseServer
                .from('whatsapp_notifications')
                .insert({
                    type,
                    reference,
                    phone,
                    status: 'sent',
                    payload: { body }
                });
        } else {
            // Optionally log failure
            console.error(`error: [WhatsApp] Failed to dispatch ${type}.`);
        }
    }
};
