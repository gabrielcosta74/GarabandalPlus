type NotificationType =
  | 'membership_paid'
  | 'membership_renewal'
  | 'donation_paid'
  | 'store_order_owner'
  | 'store_order_buyer'
  | 'store_order_preparing'
  | 'store_order_shipped'
  | 'quota_reminder_30d'
  | 'quota_reminder_7d'
  | 'quota_reminder_1d'
  | 'quota_overdue_7d'
  | 'quota_overdue_14d'
  | 'quota_overdue_30d'
  | 'factpt_doc_client'
  | 'factpt_doc_admin'

type NotificationRecord = {
  id: string;
  sent_at: string | null;
};

type NotificationInput = {
  type: NotificationType;
  reference?: string | null;
  userId?: string | null;
  email?: string | null;
};

export const ensureNotificationRecord = async (
  supabaseServer: any,
  input: NotificationInput,
): Promise<{ shouldSend: boolean; recordId?: string | null }> => {
  if (!supabaseServer) {
    return { shouldSend: true, recordId: null };
  }

  const reference = input.reference || null;
  if (!reference) {
    return { shouldSend: true, recordId: null };
  }

  const { data: existing, error: fetchError } = await supabaseServer
    .from('email_notifications')
    .select('id, sent_at')
    .eq('type', input.type)
    .eq('reference', reference)
    .limit(1)
    .maybeSingle();

  if (!fetchError && existing?.sent_at) {
    return { shouldSend: false, recordId: existing.id };
  }

  if (!fetchError && existing?.id) {
    return { shouldSend: true, recordId: existing.id };
  }

  const { data: inserted, error: insertError } = await supabaseServer
    .from('email_notifications')
    .insert({
      type: input.type,
      reference,
      user_id: input.userId ?? null,
      email: input.email ?? null,
      sent_at: null,
    })
    .select('id')
    .maybeSingle();

  if (insertError) {
    console.warn('Nao foi possivel criar registo de email:', insertError);
    return { shouldSend: true, recordId: null };
  }

  return { shouldSend: true, recordId: (inserted as { id?: string } | null)?.id ?? null };
};

export const markNotificationSent = async (
  supabaseServer: any,
  recordId?: string | null,
) => {
  if (!supabaseServer || !recordId) return;
  const { error } = await supabaseServer
    .from('email_notifications')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', recordId);
  if (error) {
    console.warn('Nao foi possivel marcar envio de email:', error);
  }
};
