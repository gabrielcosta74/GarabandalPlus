import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../../lib/supabase';
import { sendStoreShippingEmail } from '../../../../../../lib/email';
import { ensureNotificationRecord, markNotificationSent } from '../../../../../../lib/email-notifications';

import { verifyAdmin } from '../../../../../../lib/admin-auth';
import { logAdminAction } from '../../../../../../lib/admin-logger';

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
        const { shippingStatus, tracking, carrier, carrierName } = await request.json();

        if (!ref || shippingStatus !== 'enviado') {
            return NextResponse.json({ message: 'Dados inválidos' }, { status: 400 });
        }

        // 1. Update the order in Supabase
        const updatePayload: Record<string, any> = {
            shipping_status: 'enviado',
            shipping_tracking: tracking || null,
            shipped_at: new Date().toISOString(),
        };

        const { data: order, error } = await supabase
            .from('store_orders')
            .update(updatePayload)
            .eq('order_ref', ref)
            .select('*, store_order_items(*)')
            .single();

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
                        tracking: tracking || null,
                        carrierName: carrierName || carrier || null,
                        carrierId: carrier || null,
                        shippedAt: new Date().toISOString(),
                        shippingAddress: [
                            order.shipping_address1,
                            order.shipping_address2,
                            `${order.shipping_postal_code || ''} ${order.shipping_city || ''}`.trim(),
                            (order.shipping_country || '').toUpperCase()
                        ].filter(Boolean).join('\n'),
                        items: (order.store_order_items || []).map((i: any) => ({
                            name: i.name,
                            qty: i.qty,
                            unit_price: i.unit_price,
                        })),
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
    } catch (err: any) {
        console.error('Erro no endpoint PATCH shipping:', err);
        return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
    }
}
