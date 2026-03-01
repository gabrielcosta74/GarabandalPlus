import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Only warn on server side where this is expected to work
if (typeof window === 'undefined' && (!supabaseUrl || !serviceRoleKey)) {
  console.warn('⚠️ Supabase URL ou SERVICE ROLE KEY não definidos. Operações de escrita vão falhar.');
}

export const supabaseServer = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    }
  })
  : null;
