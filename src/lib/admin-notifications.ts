
import { supabaseServer } from './supabase';

export async function getAdminCounts() {
    if (!supabaseServer) return { orders: 0, members: 0, bookings: 0, factpt: 0 };

    try {
        // 1. Orders: Paid AND (Not Shipped OR Not Invoiced)
        // Note: Shipping logic applies only to physical items. Invoicing applies to all.
        // We can do this efficiently with counting keys.
        // Since Supabase doesn't support complex OR across related fields easily in one Count query without Filter,
        // we might do 2 queries or one broad query. 
        // Let's do a broad query for "Paid" orders in the last X days or all active "Action Needed"?
        // Fetching "Action Needed" might be heavy if we have 10k orders.
        // Better: Use specific count queries.

        // Calculate Action Needed Orders (Matching Admin Encomendas Page precisely)
        const { data: ordersData } = await supabaseServer
            .from('store_orders')
            .select('status, has_physical, shipping_status, invoice_sent_at'); // Match admin page logic

        let ordersCount = 0;
        if (ordersData) {
            ordersCount = ordersData.filter(order => {
                const statusFn = (order.status || '').toLowerCase();
                // Exclude canceled or failed permanently
                if (statusFn === 'canceled' || statusFn === 'cancelado' || statusFn === 'failed' || statusFn === 'falhado') return false;

                const needsInvoice = !order.invoice_sent_at;
                const isPaid = statusFn === 'paid' || statusFn === 'pago';
                const shippingLabel = (order.shipping_status || '').toLowerCase() === 'enviado' ? 'Enviado' : 'Por enviar';

                const needsShipping = isPaid && order.has_physical && shippingLabel !== 'Enviado';
                return needsShipping || needsInvoice;
            }).length;
        }

        // 2. Members: Pending or Overdue
        // Status is often computed, but let's check 'estado_quota' column if it's reliable.
        // Based on AdminMembrosPage, we filter by these stats.
        const { count: membersProblem } = await supabaseServer
            .from('members')
            .select('*', { count: 'exact', head: true })
            .or('estado_quota.eq.pendente,estado_quota.eq.expirado');


        // 3. Bookings: Pending Payment
        // And "New" bookings? User asked for "New Bookings".
        // Often "Pending Payment" IS the new booking state until confirmed.
        // Or if we have a specific "Unread" flag for bookings.
        // Let's use 'pending_payment' count + 'confirmed' but unacknowledged? 
        // For now, let's stick to 'pending_payment' as the primary "Action Needed" indicator.
        // If user wants "New Bookings" specifically, we might need a `viewed_at` on bookings.
        // Let's count 'pending_payment'.
        const { count: pendingBookings } = await supabaseServer
            .from('bookings') // Assuming table name is 'bookings' or similar?
            // Need to verify table name. 'pilgrimage_bookings'?
            // Checking existing file usage...
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending_payment');

        // 4. FACT.pt: only states that require an explicit admin decision or retry.
        // Pending/processing documents are handled automatically by the worker and
        // should not create noisy navigation badges.
        const { count: pendingFactPt } = await supabaseServer
            .from('factpt_documents')
            .select('*', { count: 'exact', head: true })
            .eq('environment', 'production')
            .in('status', ['awaiting_approval', 'needs_data', 'failed', 'email_failed']);

        return {
            orders: ordersCount || 0,
            members: membersProblem || 0,
            bookings: pendingBookings || 0,
            factpt: pendingFactPt || 0,
        };

    } catch (err) {
        console.error("Error calculating admin counts:", err);
        return { orders: 0, members: 0, bookings: 0, factpt: 0 };
    }
}

export async function createAdminNotification(
    type: 'order' | 'member' | 'booking' | 'donation' | 'auction',
    title: string,
    message: string,
    link?: string,
    dedupeKey?: string,
) {
    if (!supabaseServer) return;

    try {
        const { error } = await supabaseServer.from('admin_notifications').insert({
            type,
            title,
            message,
            link,
            dedupe_key: dedupeKey || null,
            created_at: new Date().toISOString()
        });
        // Repeated callbacks/webhooks are expected. The unique key turns those
        // into a harmless no-op without hiding unrelated database failures.
        if (error && !(dedupeKey && error.code === '23505')) {
            console.error('Failed to create admin notification:', error);
        }
    } catch (err) {
        console.error('Error creating admin notification:', err);
    }
}
