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

  // Aplica já ao contacto e à subscrição: os envios que lêem o estado guardado
  // (cron, campanhas) não esperam pela próxima reconstrução dos contactos.
  const now = new Date().toISOString();
  const { error: contactError } = await supabase
    .from('marketing_contacts')
    .update({ consent_state: 'unsubscribed', updated_at: now })
    .eq('normalized_email', normalized);
  if (contactError) return { ok: false, error: contactError.message };
  const { error: subscriberError } = await supabase
    .from('newsletter_subscribers')
    .update({ consent_state: 'unsubscribed' })
    .eq('normalized_email', normalized);
  if (subscriberError) return { ok: false, error: subscriberError.message };

  return { ok: true };
};
