import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { sendStoreShippingEmail } from '../../../../../lib/email';
import { ensureNotificationRecord, markNotificationSent } from '../../../../../lib/email-notifications';

export async function PATCH(
    request: Request,
    { params }: { params: { ref: string } }
) {
    try {
        const { ref } = params;
        const body = await request.json();
        const { shippingStatus, tracking, invoiceSent } = body;

        // Build update object
        const updates: any = {};
        const now = new Date().toISOString();

        if (shippingStatus) {
            if (shippingStatus === 'enviado') {
                updates.shipping_status = 'enviado';
                updates.shipped_at = now;
            } else {
                updates.shipping_status = shippingStatus;
            }
        }

        if (typeof tracking !== 'undefined') {
            updates.shipping_tracking = tracking;
        }

        if (typeof invoiceSent === 'boolean') {
            if (invoiceSent) {
                updates.invoice_sent_at = now;
            } else {
                updates.invoice_sent_at = null;
            }
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ message: 'Nothing to update' }, { status: 400 });
        }

        if (!supabaseServer) {
            return NextResponse.json({ error: 'DB Error' }, { status: 500 });
        }

        // Update Order
        const { data: order, error } = await supabaseServer
            .from('store_orders')
            .update(updates)
            .eq('order_ref', ref)
            .select('*, items:store_order_items(*)')
            .single();

        if (error) throw error;

        // If marked as shipped, send email
        if (shippingStatus === 'enviado') {
            try {
                const notify = await ensureNotificationRecord(supabaseServer, {
                    type: 'store_order_shipped',
                    reference: order.order_ref,
                    email: order.buyer_email
                });

                if (notify.shouldSend) {
                    const emailSent = await sendStoreShippingEmail({
                        orderRef: order.order_ref,
                        buyerName: order.buyer_name,
                        buyerEmail: order.buyer_email,
                        tracking: order.shipping_tracking,
                        shippedAt: order.shipped_at
                    });

                    if (emailSent && notify.recordId) {
                        await markNotificationSent(supabaseServer, notify.recordId);
                    }
                    console.log('Email de envio enviado para', order.buyer_email);
                } else {
                    console.log('Email de envio já registado anteriormente para', order.buyer_email);
                }
            } catch (emailErr) {
                console.error('Falha ao enviar email de envio:', emailErr);
                // Don't fail the request, just log
            }
        }

        return NextResponse.json(order);
    } catch (err: any) {
        console.error('Error updating order:', err);
        return NextResponse.json({ message: err.message }, { status: 500 });
    }
}
