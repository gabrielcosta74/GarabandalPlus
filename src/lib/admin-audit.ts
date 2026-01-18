import { supabaseServer } from './supabase';

type AuditInput = {
  adminEmail?: string | null;
  memberId?: string | null;
  action: string;
  details?: Record<string, any> | null;
};

export const logAdminAudit = async ({ adminEmail, memberId, action, details }: AuditInput) => {
  if (!supabaseServer) return;
  try {
    await supabaseServer.from('admin_audit_logs').insert({
      admin_email: adminEmail || null,
      member_id: memberId || null,
      action,
      details: details || null,
    });
  } catch (err) {
    console.warn('Nao foi possivel gravar auditoria admin:', err);
  }
};
