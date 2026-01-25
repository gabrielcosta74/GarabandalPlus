import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { verifyAdmin } from '../../../../lib/auth-utils';
import { getSignedUrl } from '../../../../lib/receipt-utils'; // We can reuse this or create specific one

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        await verifyAdmin();

        if (!supabaseServer) {
            return NextResponse.json({ error: "Server Error" }, { status: 500 });
        }

        const supabase = supabaseServer;

        const { data: reports, error } = await supabase
            .from('store_reports')
            .select('*')
            .order('report_year', { ascending: false })
            .order('report_month', { ascending: false });

        if (error) throw error;

        // Sign the URLs if they exist (assuming privacy on store-reports bucket too?)
        // The implementation plan implies we should use strict signed URLs for reports too,
        // although we didn't explicitly lock 'store-reports' bucket yet.
        // Good practice to sign them anyway if they are in storage.

        const enhancedReports = await Promise.all((reports || []).map(async (r: any) => {
            // Assuming r.file_path stores the path in bucket
            let downloadUrl = null;
            if (r.file_path) {
                const { data } = await supabase.storage
                    .from('store-reports') // Check bucket name in next step
                    .createSignedUrl(r.file_path, 3600);
                downloadUrl = data?.signedUrl;
            }
            return {
                ...r,
                download_url: downloadUrl
            };
        }));

        return NextResponse.json({ reports: enhancedReports });
    } catch (err: any) {
        console.error("Reports List Error:", err);
        return NextResponse.json({ message: err.message }, { status: 500 });
    }
}
