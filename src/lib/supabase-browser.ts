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

export async function getBrowserAccessToken(retries = 1): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const { data: { session }, error } = await supabaseBrowser.auth.getSession();

    if (error) {
      lastError = error;
    }

    if (session?.access_token) {
      return session.access_token;
    }

    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  throw lastError ?? new Error('Sessao expirada. Inicia sessao novamente.');
}
