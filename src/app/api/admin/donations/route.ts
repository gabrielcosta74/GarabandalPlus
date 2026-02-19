import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { verifyAdmin } from '../../../../lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        const status = authError === 'Forbidden: Not an Admin' ? 403 : 401;
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status });
    }

    if (!supabaseServer) {
        return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
    }

    try {
        const url = new URL(req.url);
        const status = url.searchParams.get('status');
        const receiptStatus = url.searchParams.get('receipt_status');
        const method = url.searchParams.get('method');
        const onlyWithProof = url.searchParams.get('with_proof') === 'true';

        let query = supabaseServer
            .from('donations')
            .select('*')
            .order('created_at', { ascending: false });

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }
        if (receiptStatus && receiptStatus !== 'all') {
            query = query.eq('receipt_status', receiptStatus);
        }
        if (method && method !== 'all') {
            query = query.eq('method', method as any);
        }
        if (onlyWithProof) {
            query = query.not('proof_url', 'is', null);
        }

        const { data: donations, error } = await query;

        if (error) throw error;

        return NextResponse.json(donations || []);

    } catch (error) {
        console.error("Admin Donations API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
