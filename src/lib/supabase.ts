import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.warn('⚠️ Supabase URL ou SERVICE ROLE KEY não definidos. Operações de escrita vão falhar.');
}

export const supabaseServer = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : null;
