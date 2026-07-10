import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../../lib/supabase';
import { sendStoreShippingEmail } from '../../../../../../lib/email';
import { ensureNotificationRecord, markNotificationSent } from '../../../../../../lib/email-notifications';

import { verifyAdmin } from '../../../../../../lib/admin-auth';
import { buildShipOrderUpdate, getEmbeddedStoreOrderItems, omitShippingCarrier, ShipOrderBody } from '../../../../../../lib/admin-order-shipping';

type SupabaseErrorLike = {
    code?: unknown;
    message?: unknown;
};

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ ref: string }> }
) {
    const { authorized, user, error: authError } = await verifyAdmin(request);
    if (!authorized || !user) {
        return NextResponse.json({ message: authError || 'Unauthorized' }, { status: 401 });
    }
    try {
        const supabase = supabaseServer;
        if (!supabase) {
            return NextResponse.json({ message: 'Supabase não configurado' }, { status: 500 });
        }
        const { ref } = await params;
        const body = await request.json() as ShipOrderBody;

        if (!ref) {
            return NextResponse.json({ message: 'Dados inválidos' }, { status: 400 });
        }

        let shipping;
        try {
            shipping = buildShipOrderUpdate(body);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Dados inválidos';
            return NextResponse.json({ message }, { status: 400 });
        }

        // 1. Update the order in Supabase
        let { data: order, error } = await supabase
            .from('store_orders')
            .update(shipping.updatePayload)
            .eq('order_ref', ref)
            .select('*, items:store_order_items(*)')
            .single();

        const updateError = error as SupabaseErrorLike | null;
        if (updateError && String(updateError.code || '') === '42703' && /shipping_carrier/i.test(String(updateError.message || ''))) {
            const retry = await supabase
                .from('store_orders')
                .update(omitShippingCarrier(shipping.updatePayload))
                .eq('order_ref', ref)
                .select('*, items:store_order_items(*)')
                .single();
            order = retry.data;
            error = retry.error;
        }

        if (error || !order) {
            console.error('Erro ao atualizar encomenda:', error);
            return NextResponse.json({ message: 'Erro ao atualizar encomenda', error }, { status: 500 });
        }

        // 2. Send Shipping Confirmation Email with full details
        if (order.buyer_email) {
            try {
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
                        tracking: order.shipping_tracking || shipping.emailPayload.tracking,
                        carrierName: order.shipping_carrier || shipping.emailPayload.carrierName,
                        carrierId: shipping.emailPayload.carrierId,
                        shippedAt: order.shipped_at || shipping.emailPayload.shippedAt,
                        shippingAddress: [
                            order.shipping_address1,
                            order.shipping_address2,
                            `${order.shipping_postal_code || ''} ${order.shipping_city || ''}`.trim(),
                            (order.shipping_country || '').toUpperCase()
                        ].filter(Boolean).join('\n'),
                        items: getEmbeddedStoreOrderItems(order),
                        totalAmount: order.total_amount,
                        currency: order.currency || 'EUR',
                    });

                    if (emailSent && recordId) {
                        await markNotificationSent(supabase, recordId);
                    }
                }
            } catch (emailErr) {
                console.error('Erro ao enviar email de envio:', emailErr);
            }
        }

        return NextResponse.json({ success: true, order });
    } catch (err: unknown) {
        console.error('Erro no endpoint PATCH shipping:', err);
        return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
    }
}
