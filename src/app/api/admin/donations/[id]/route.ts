import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../../../../lib/admin-auth';

const ALLOWED_STATUSES = new Set([
  'pending',
  'pending_verification',
  'processing',
  'succeeded',
  'failed',
  'canceled',
]);

const ALLOWED_RECEIPT_STATUSES = new Set(['pending', 'sent', 'not_required']);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, user, error } = await verifyAdmin(req);
  if (!authorized) {
    const status = error === 'Forbidden: Not an Admin' ? 403 : 401;
    return NextResponse.json({ error: error || 'Unauthorized' }, { status });
  }

  if (!supabaseServer) {
    return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
  }

  try {
    const { id: donationId } = await params;
    if (!donationId) {
      return NextResponse.json({ error: 'Missing donation id' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const nextStatus = typeof body?.status === 'string' ? body.status.trim().toLowerCase() : null;
    const reviewNote =
      typeof body?.review_note === 'string'
        ? body.review_note.trim().slice(0, 4000)
        : typeof body?.reviewNote === 'string'
          ? body.reviewNote.trim().slice(0, 4000)
          : null;
    const receiptStatus =
      typeof body?.receipt_status === 'string'
        ? body.receipt_status.trim().toLowerCase()
        : typeof body?.receiptStatus === 'string'
          ? body.receiptStatus.trim().toLowerCase()
          : null;
    const invoiceSent = typeof body?.invoiceSent === 'boolean' ? body.invoiceSent : null;

    if (!nextStatus && !receiptStatus && invoiceSent === null && !reviewNote) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
    }

    if (nextStatus && !ALLOWED_STATUSES.has(nextStatus)) {
      return NextResponse.json({ error: 'Invalid donation status.' }, { status: 400 });
    }

    if (receiptStatus && !ALLOWED_RECEIPT_STATUSES.has(receiptStatus)) {
      return NextResponse.json({ error: 'Invalid receipt status.' }, { status: 400 });
    }

    const { data: currentDonation, error: currentError } = await supabaseServer
      .from('donations')
      .select('id, status, receipt_required, receipt_status, metadata')
      .eq('id', donationId)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!currentDonation) {
      return NextResponse.json({ error: 'Donation not found.' }, { status: 404 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (nextStatus) {
      updates.status = nextStatus;
      updates.reviewed_at = new Date().toISOString();
      updates.reviewed_by = user?.id || null;
      if (reviewNote) updates.review_note = reviewNote;
      if (nextStatus === 'succeeded') {
        updates.metadata = {
          ...(currentDonation.metadata && typeof currentDonation.metadata === 'object'
            ? currentDonation.metadata
            : {}),
          accounting_v2: true,
          confirmed_via: 'admin',
        };
      }
    } else if (reviewNote) {
      updates.review_note = reviewNote;
    }

    if (invoiceSent !== null) {
      updates.invoice_sent_at = invoiceSent ? new Date().toISOString() : null;
      if (currentDonation.receipt_required) {
        updates.receipt_status = invoiceSent ? 'sent' : 'pending';
      } else {
        updates.receipt_status = 'not_required';
      }
      updates.receipt_sent_by = invoiceSent ? user?.id || null : null;
    } else if (receiptStatus) {
      updates.receipt_status = receiptStatus;
      const sent = receiptStatus === 'sent';
      updates.invoice_sent_at = sent ? new Date().toISOString() : null;
      updates.receipt_sent_by = sent ? user?.id || null : null;
    }

    const { data, error: updateError } = await supabaseServer
      .from('donations')
      .update(updates)
      .eq('id', donationId)
      .select('*')
      .single();

    if (updateError) throw updateError;

    if (nextStatus === 'succeeded' && data?.metadata?.accounting_v2 === true) {
      const { error: raisedError } = await supabaseServer.rpc(
        'record_donation_in_raised_total',
        { p_donation_id: donationId },
      );
      if (raisedError) throw raisedError;
    }

    return NextResponse.json({ success: true, donation: data });
  } catch (err: any) {
    console.error('[Admin Donations PATCH] Error:', err);
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}
