import type { SupabaseClient } from '@supabase/supabase-js';

// Persisting the email in the suppression list is what survives the live
// contact rebuild (which otherwise resets consent_state to 'assumed').
// buildMarketingContacts reads this table and flags matches as 'suppressed',
// which the automation engine skips.
export const applyMarketingUnsubscribe = async (
  supabase: SupabaseClient,
  email: string,
): Promise<{ ok: boolean; error?: string }> => {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes('@')) return { ok: false, error: 'Email inválido.' };

  const { error } = await supabase
    .from('marketing_suppression_list')
    .upsert(
      { normalized_email: normalized, reason: 'unsubscribe' },
      { onConflict: 'normalized_email,reason', ignoreDuplicates: true },
    );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
};
