import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../lib/admin-auth';

export async function POST(req: Request) {
    const { authorized, error } = await verifyAdmin(req);
    if (!authorized) {
        return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseServer) {
        return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
    }

    try {
        const { id, category, invoiceSent } = await req.json();

        if (!id || !category) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const timestamp = invoiceSent ? new Date().toISOString() : null;
        let table = '';
        let idColumn = 'id';

        switch (category) {
            case 'shop':
                table = 'store_orders';
                // Store orders logic might be complex if it involves syncing with other systems, 
                // but for just the status toggle:
                break;
            case 'donation':
                table = 'donations';
                break;
            case 'quota':
                table = 'pagamentos_quotas';
                break;
            case 'pilgrimage':
                table = 'pilgrimage_payments';
                break;
            default:
                return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
        }

        const { error: updateError } = await supabaseServer
            .from(table)
            .update({ invoice_sent_at: timestamp })
            .eq(idColumn, id);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true, timestamp });

    } catch (error: any) {
        console.error("Invoice Update Error:", error);
        return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
    }
}
