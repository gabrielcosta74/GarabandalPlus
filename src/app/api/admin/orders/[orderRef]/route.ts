import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/admin-auth';
import { supabaseServer } from '../../../../../lib/supabase';
import { sendStoreShippingEmail } from '../../../../../lib/email';
import { ensureNotificationRecord, markNotificationSent } from '../../../../../lib/email-notifications';
import { logAdminAudit } from '../../../../../lib/admin-audit';

const bodySchema = z.object({
  status: z.string().min(1).optional(),
  shippingStatus: z.string().min(1).optional(),
  tracking: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: { orderRef: string } }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  if (!supabaseServer) {
    return NextResponse.json({ message: 'Supabase não configurado.' }, { status: 500 });
  }

  try {
    const json = await request.json();
    const { status, shippingStatus, tracking } = bodySchema.parse(json);

    const updates: Record<string, any> = {};
    if (status) updates.status = status;
    if (shippingStatus) {
      updates.shipping_status = shippingStatus;
      if (shippingStatus === 'enviado') {
        updates.shipped_at = new Date().toISOString();
      }
    }
    if (typeof tracking === 'string') {
      updates.shipping_tracking = tracking || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: 'Nenhuma atualização fornecida.' }, { status: 400 });
    }

    const { data: order, error: fetchError } = await supabaseServer
      .from('store_orders')
      .select('order_ref, buyer_email, buyer_name, status, shipping_status, shipping_tracking, shipped_at')
      .eq('order_ref', params.orderRef)
      .maybeSingle();

    if (fetchError) {
      console.error('Erro ao carregar pedido:', fetchError);
      return NextResponse.json({ message: 'Erro ao carregar pedido.' }, { status: 500 });
    }

    const { error } = await supabaseServer
      .from('store_orders')
      .update(updates)
      .eq('order_ref', params.orderRef);

    if (error) {
      console.error('Erro ao atualizar pedido:', error);
      return NextResponse.json({ message: 'Erro ao atualizar pedido.' }, { status: 500 });
    }

    await logAdminAudit({
      adminEmail: auth.user?.email || null,
      action: 'update_order',
      details: {
        orderRef: params.orderRef,
        previous: {
          status: order?.status || null,
          shippingStatus: order?.shipping_status || null,
          tracking: order?.shipping_tracking || null,
          shippedAt: order?.shipped_at || null,
        },
        next: {
          status: updates.status || null,
          shippingStatus: updates.shipping_status || null,
          tracking:
            typeof updates.shipping_tracking === 'string' ? updates.shipping_tracking : updates.shipping_tracking ?? null,
          shippedAt: updates.shipped_at || null,
        },
      },
    });

    if (shippingStatus === 'enviado' && order?.buyer_email) {
      try {
        const notify = await ensureNotificationRecord(supabaseServer, {
          type: 'store_order_shipped',
          reference: order.order_ref,
          email: order.buyer_email,
        });

        if (notify.shouldSend) {
          await sendStoreShippingEmail({
            orderRef: order.order_ref,
            buyerEmail: order.buyer_email,
            buyerName: order.buyer_name,
            tracking: typeof tracking === 'string' ? tracking : undefined,
            shippedAt: updates.shipped_at || order.shipped_at,
          });
          await logAdminAudit({
            adminEmail: auth.user?.email || null,
            action: 'send_order_shipping_email',
            details: {
              orderRef: order.order_ref,
              buyerEmail: order.buyer_email,
              tracking: typeof tracking === 'string' ? tracking : null,
              shippedAt: updates.shipped_at || order.shipped_at || null,
            },
          });
          await markNotificationSent(supabaseServer, notify.recordId);
        }
      } catch (err) {
        console.error('Erro ao enviar email de envio:', err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const message = err?.message || 'Pedido inválido.';
    return NextResponse.json({ message }, { status: 400 });
  }
}
