import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../lib/auth-utils';
import { buildStoreReportData, renderStoreReportPdf, renderStoreReportCsv } from '../../../../../lib/reports';

export const maxDuration = 60; // Allow more time for generation

export async function POST(req: Request) {
    try {
        await verifyAdmin();

        if (!supabaseServer) {
            return NextResponse.json({ error: "Server Error" }, { status: 500 });
        }

        const body = await req.json();
        const { month, year, kind } = body;

        if (!month || !year || !kind) {
            return NextResponse.json({ error: "Dados em falta" }, { status: 400 });
        }

        // Define Period
        const start = new Date(Date.UTC(year, month - 1, 1));
        const end = new Date(Date.UTC(year, month, 1)); // First day of next month

        // Generate Data
        const reportData = await buildStoreReportData(supabaseServer, start, end);

        let fileBuffer: Buffer | string;
        let contentType: string;
        let ext: string;

        if (kind === 'pdf') {
            const pdfBytes = await renderStoreReportPdf(reportData);
            fileBuffer = Buffer.from(pdfBytes);
            contentType = 'application/pdf';
            ext = 'pdf';
        } else {
            const csv = renderStoreReportCsv(reportData);
            fileBuffer = Buffer.from(csv, 'utf-8'); // CSV string to buffer
            contentType = 'text/csv';
            ext = 'csv';
        }

        // Upload to Storage (Temporary or Permanent?)
        // If it's a manual export, maybe just temp folder or date-stamped?
        // Let's use 'exports/' folder in 'store-reports' bucket
        const filename = `manual_export_${year}_${month}_${Date.now()}.${ext}`;
        const filePath = `exports/${filename}`;

        const { error: uploadError } = await supabaseServer.storage
            .from('store-reports')
            .upload(filePath, fileBuffer, {
                contentType,
                upsert: true
            });

        if (uploadError) {
            console.error("Storage Upload Error:", uploadError);
            throw new Error("Falha ao guardar o ficheiro.");
        }

        // Generate Signed URL (1 hour)
        const { data: signedData } = await supabaseServer.storage
            .from('store-reports')
            .createSignedUrl(filePath, 3600);

        if (!signedData?.signedUrl) {
            throw new Error("Falha ao gerar link seguro.");
        }

        return NextResponse.json({
            success: true,
            file: {
                downloadUrl: signedData.signedUrl
            }
        });

    } catch (err: any) {
        console.error("Export Error:", err);
        return NextResponse.json({ message: err.message }, { status: 500 });
    }
}
