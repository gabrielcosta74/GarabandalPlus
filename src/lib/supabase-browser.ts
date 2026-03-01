import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL ou ANON KEY nao definidos. Verifique o .env.');
}

export const supabaseBrowser = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: typeof window !== 'undefined',
    autoRefreshToken: typeof window !== 'undefined',
    detectSessionInUrl: typeof window !== 'undefined',
    flowType: 'pkce',
  },
  cookieOptions: {
    maxAge: 31536000,
    path: '/',
    sameSite: 'lax',
  }
});
