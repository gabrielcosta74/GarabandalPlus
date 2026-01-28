
import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { getAdminCounts } from '../../../../../lib/admin-notifications';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    if (!supabaseServer) {
        return NextResponse.json({
            counts: { orders: 0, members: 0, bookings: 0, unreadNotifications: 0 },
            notifications: []
        });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error } = await supabaseServer.auth.getUser(token);

        if (error || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Use a helper function (logic centralization)
        const counts = await getAdminCounts();

        // Fetch recent unread/read notifications
        const { data: notifications } = await supabaseServer
            .from('admin_notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        return NextResponse.json({
            counts: {
                ...counts,
                unreadNotifications: (notifications || []).filter(n => !n.read_at).length
            },
            notifications
        });

    } catch (err: any) {
        console.error('Error fetching admin stats:', err);
        return NextResponse.json({
            counts: { orders: 0, members: 0, bookings: 0, unreadNotifications: 0 },
            notifications: []
        });
    }
}
