import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../../lib/supabase';
import { sendStoreShippingEmail } from '../../../../../../lib/email';
import { ensureNotificationRecord, markNotificationSent } from '../../../../../../lib/email-notifications';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ ref: string }> }
) {
    try {
        const supabase = supabaseServer;
        if (!supabase) {
            return NextResponse.json({ message: 'Supabase não configurado' }, { status: 500 });
        }
        const { ref } = await params;
        const { shippingStatus, tracking } = await request.json();

        if (!ref || shippingStatus !== 'enviado') {
            return NextResponse.json({ message: 'Dados inválidos' }, { status: 400 });
        }

        // 1. Update the order in Supabase
        const { data: order, error } = await supabase
            .from('store_orders')
            .update({
                shipping_status: 'enviado',
                shipping_tracking: tracking,
                shipped_at: new Date().toISOString()
            })
            .eq('order_ref', ref)
            .select('*, store_order_items(*)')
            .single();

        if (error || !order) {
            console.error('Erro ao atualizar encomenda:', error);
            return NextResponse.json({ message: 'Erro ao atualizar encomenda' }, { status: 500 });
        }

        // 2. Send Shipping Confirmation Email
        // Using simple deduplication to prevent double sends if admin clicks multiple times quickly
        // (Though the UI should handle this too, good to have backend safety)
        const { shouldSend, recordId } = await ensureNotificationRecord(supabase, {
            type: 'store_order_shipped',
            reference: order.order_ref,
            email: order.buyer_email
        });

        if (shouldSend) {
            const emailSent = await sendStoreShippingEmail({
                orderRef: order.order_ref,
                buyerName: order.buyer_name,
                buyerEmail: order.buyer_email,
                tracking: tracking,
                shippedAt: new Date().toISOString()
            });

            if (emailSent && recordId) {
                await markNotificationSent(supabase, recordId);
            }
        }

        return NextResponse.json({ success: true, order });
    } catch (err: any) {
        console.error('Erro no endpoint PATCH shipping:', err);
        return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
    }
}
