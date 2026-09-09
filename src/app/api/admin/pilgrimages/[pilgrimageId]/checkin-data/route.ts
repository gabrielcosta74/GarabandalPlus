import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';
import { verifyAdmin } from '../../../../../../lib/admin-auth';
import { supabaseServer } from '../../../../../../lib/supabase';
import { CHECKIN_EXPORT_HEADERS, documentTypeLabel } from '../../../../../../lib/pilgrimage-checkin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Submission = {
  id: number;
  full_name: string;
  nationality: string;
  document_type: string;
  document_number: string;
  document_issued_on: string;
  document_expires_on: string;
  birth_date: string;
  full_address: string;
  postal_code: string;
  city: string;
  phone: string;
  email: string;
  submitted_at: string;
};

async function loadCheckinData(pilgrimageId: string) {
  if (!supabaseServer) return { error: 'Server not configured' } as const;

  const [pilgrimageResult, submissionsResult] = await Promise.all([
    supabaseServer
      .from('pilgrimages')
      .select('id, title, slug, start_date, end_date, checkin_form_enabled')
      .eq('id', pilgrimageId)
      .maybeSingle(),
    supabaseServer
      .from('pilgrimage_checkin_submissions')
      .select('id, full_name, nationality, document_type, document_number, document_issued_on, document_expires_on, birth_date, full_address, postal_code, city, phone, email, submitted_at')
      .eq('pilgrimage_id', pilgrimageId)
      .order('submitted_at', { ascending: true }),
  ]);

  if (pilgrimageResult.error) return { error: pilgrimageResult.error.message } as const;
  if (!pilgrimageResult.data) return { notFound: true } as const;
  if (submissionsResult.error) return { error: submissionsResult.error.message } as const;

  return {
    pilgrimage: pilgrimageResult.data,
    submissions: (submissionsResult.data || []) as Submission[],
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pilgrimageId: string }> },
) {
  const { authorized, error: authError } = await verifyAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
  }

  const { pilgrimageId } = await params;
  const result = await loadCheckinData(pilgrimageId);
  if ('notFound' in result) return NextResponse.json({ error: 'Peregrinação não encontrada.' }, { status: 404 });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 });

  const url = new URL(request.url);
  if (url.searchParams.get('format') !== 'xlsx') {
    return NextResponse.json(result);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Apostolado de Garabandal';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Dados Check in', {
    views: [{ state: 'frozen', ySplit: 5 }],
  });

  sheet.columns = [
    { width: 7 }, { width: 48 }, { width: 26 }, { width: 31 }, { width: 20 },
    { width: 21 }, { width: 21 }, { width: 18 }, { width: 43 }, { width: 21 },
    { width: 26 }, { width: 24 }, { width: 30 },
  ];

  sheet.mergeCells('C2:H2');
  const titleCell = sheet.getCell('C2');
  titleCell.value = result.pilgrimage.title;
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1F2937' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells('D4:G4');
  const documentHeading = sheet.getCell('D4');
  documentHeading.value = "Documento de identificação / Identification document / Document d'identité";
  documentHeading.font = { bold: true, size: 12 };
  documentHeading.alignment = { horizontal: 'center', vertical: 'middle' };

  const headerRow = sheet.getRow(5);
  headerRow.values = [...CHECKIN_EXPORT_HEADERS];
  headerRow.height = 58;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 9, color: { argb: 'FF111827' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'medium', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };
  });

  result.submissions.forEach((submission, index) => {
    const row = sheet.addRow([
      index + 1,
      submission.full_name,
      submission.nationality,
      documentTypeLabel(submission.document_type),
      submission.document_number,
      new Date(`${submission.document_issued_on}T00:00:00Z`),
      new Date(`${submission.document_expires_on}T00:00:00Z`),
      new Date(`${submission.birth_date}T00:00:00Z`),
      submission.full_address,
      submission.postal_code,
      submission.city,
      submission.phone,
      submission.email,
    ]);
    row.eachCell((cell, columnNumber) => {
      cell.alignment = { vertical: 'middle', wrapText: columnNumber !== 1 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFBFC3C8' } },
        left: { style: 'thin', color: { argb: 'FFBFC3C8' } },
        bottom: { style: 'thin', color: { argb: 'FFBFC3C8' } },
        right: { style: 'thin', color: { argb: 'FFBFC3C8' } },
      };
      if (columnNumber === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if ([6, 7, 8].includes(columnNumber)) cell.numFmt = 'dd/mm/yyyy';
    });
  });

  const lastRow = Math.max(5, 5 + result.submissions.length);
  sheet.autoFilter = { from: 'A5', to: `M${lastRow}` };
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const file = await workbook.xlsx.writeBuffer();
  const safeSlug = result.pilgrimage.slug.replace(/[^a-z0-9-]+/gi, '-');
  return new NextResponse(file as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="dados-check-in-${safeSlug}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
