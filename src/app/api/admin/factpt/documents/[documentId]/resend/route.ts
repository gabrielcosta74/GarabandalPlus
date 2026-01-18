import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../../lib/admin-auth';
import { supabaseServer } from '../../../../../../../lib/supabase';
import { downloadFactPtDocumentPdf, getFactPtConfig } from '../../../../../../../lib/factpt';
import { sendFactPtAdminDocumentEmail, sendFactPtClientDocumentEmail } from '../../../../../../../lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FactPtDocumentRow = {
  id: string;
  source_type: 'store' | 'donation' | 'membership';
  source_ref: string;
  factpt_document_id: string | null;
  factpt_url: string | null;
};

export async function POST(
  request: Request,
  { params }: { params: { documentId: string } },
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  if (!supabaseServer) {
    return NextResponse.json({ message: 'Supabase nao configurado.' }, { status: 500 });
  }

  const config = getFactPtConfig(undefined, true);
  if (!config) {
    return NextResponse.json({ message: 'fact.pt nao configurado.' }, { status: 500 });
  }

  const recordId = params.documentId;
  if (!recordId) {
    return NextResponse.json({ message: 'Documento invalido.' }, { status: 400 });
  }

  const { data: doc, error: docError } = await supabaseServer
    .from('factpt_documents')
    .select('id, source_type, source_ref, factpt_document_id, factpt_url')
    .eq('id', recordId)
    .maybeSingle();

  if (docError || !doc) {
    return NextResponse.json({ message: 'Documento nao encontrado.' }, { status: 404 });
  }

  const documentRow = doc as FactPtDocumentRow;
  if (!documentRow.factpt_document_id) {
    return NextResponse.json({ message: 'Documento sem ID fact.pt.' }, { status: 400 });
  }

  let recipientName: string | null = null;
  let recipientEmail: string | null = null;

  if (documentRow.source_type === 'donation') {
    const { data: donation } = await supabaseServer
      .from('donations')
      .select('donor_name, donor_email')
      .or(
        `external_reference.eq.${documentRow.source_ref},payment_intent_id.eq.${documentRow.source_ref}`,
      )
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    recipientName = donation?.donor_name || null;
    recipientEmail = donation?.donor_email || null;
  } else if (documentRow.source_type === 'membership') {
    const { data: paymentRow } = await supabaseServer
      .from('pagamentos_quotas')
      .select('user_id')
      .or(
        `external_reference.eq.${documentRow.source_ref},payment_intent_id.eq.${documentRow.source_ref}`,
      )
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (paymentRow?.user_id) {
      const { data: member } = await supabaseServer
        .from('membros')
        .select('nome, email')
        .eq('id', paymentRow.user_id)
        .maybeSingle();
      recipientName = member?.nome || null;
      recipientEmail = member?.email || null;
    }
  } else if (documentRow.source_type === 'store') {
    const { data: order } = await supabaseServer
      .from('store_orders')
      .select('buyer_name, buyer_email')
      .eq('order_ref', documentRow.source_ref)
      .maybeSingle();
    recipientName = order?.buyer_name || null;
    recipientEmail = order?.buyer_email || null;
  }

  if (!recipientEmail) {
    return NextResponse.json({ message: 'Email do cliente nao encontrado.' }, { status: 400 });
  }

  let attachmentBuffer: Buffer;
  try {
    attachmentBuffer = await downloadFactPtDocumentPdf(documentRow.factpt_document_id, config);
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || 'Erro ao descarregar PDF.' },
      { status: 502 },
    );
  }

  const attachments = [
    {
      filename: `fatura-${documentRow.factpt_document_id}.pdf`,
      content: attachmentBuffer,
      contentType: 'application/pdf',
    },
  ];

  try {
    await sendFactPtClientDocumentEmail({
      toEmail: recipientEmail,
      recipientName,
      documentId: documentRow.factpt_document_id,
      documentUrl: documentRow.factpt_url,
      sourceType: documentRow.source_type,
      sourceRef: documentRow.source_ref,
      attachments,
    });

    await sendFactPtAdminDocumentEmail({
      recipientName,
      documentId: documentRow.factpt_document_id,
      documentUrl: documentRow.factpt_url,
      sourceType: documentRow.source_type,
      sourceRef: documentRow.source_ref,
      attachments,
    });
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || 'Erro ao enviar emails.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
