import { supabaseServer } from './supabase';

/**
 * Logs admin actions to the database for audit trail.
 * Fire and forget (skips await usually to not block response, or await if critical).
 */
export async function logAdminAction(
    adminEmail: string,
    action: string,
    details: object,
    targetId?: string
) {
    if (!supabaseServer) return;

    try {
        const { error } = await supabaseServer.from('admin_audit_logs').insert({
            admin_email: adminEmail,
            action,
            details,
            // target_id: targetId, // NOTE: Removed because column doesn't exist in DB schema yet
            // created_at is usually default now()
        });

        if (error) {
            console.error('Audit Log Error:', error);
        }
    } catch (e) {
        console.error('Audit Log Exception:', e);
    }
}
