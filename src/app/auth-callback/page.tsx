"use client";

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AuthCallbackPage() {
  const [message, setMessage] = useState<string>('A validar ligação segura...');
  const router = useRouter();

  useEffect(() => {
    const handleAuth = async () => {
      // 1. Get Hash Params (Supabase puts tokens in hash)
      const hash = window.location.hash.replace(/^#/, '');
      const params = new URLSearchParams(hash);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      const type = params.get('type'); // recovery, signup, etc.

      // Also check query params for 'next' (e.g. ?next=/foo)
      const nextQuery = new URLSearchParams(window.location.search).get('next');

      if (!access_token || !refresh_token) {
        // Sometimes session is already set by the time we get here (onAuthStateChange), 
        // so we check if we have a user.
        if (supabaseBrowser) {
          const { data } = await supabaseBrowser.auth.getSession();
          if (data.session) {
            // ALREADY LOGGED IN -> REDIRECT
            handleRedirect(type, nextQuery);
            return;
          }
        }

        setMessage('Link inválido ou expirado. Por favor tente novamente.');
        setTimeout(() => router.replace('/login'), 3000);
        return;
      }

      if (!supabaseBrowser) {
        setMessage('Configuração Supabase em falta.');
        return;
      }

      // 2. Set Session manually
      const { error } = await supabaseBrowser.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) {
        console.error('Error setting session:', error);
        setMessage('Erro ao validar sessão. Tente fazer login manual.');
        setTimeout(() => router.replace('/login'), 3000);
        return;
      }

      // 3. SUCCESS -> REDIRECT
      handleRedirect(type, nextQuery);
    };

    handleAuth();
  }, [router]);

  const handleRedirect = (type: string | null, next: string | null) => {
    setMessage('Sessão confirmada. A redirecionar...');

    // Priority 1: Recovery Flow -> ALWAYS go to update password
    if (type === 'recovery') {
      window.location.href = '/auth/update-password';
      return;
    }

    // Priority 2: Explicit Next param
    if (next) {
      window.location.href = next;
      return;
    }

    // Priority 3: Default Home
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-garabandal-gold/10 rounded-full flex items-center justify-center text-garabandal-gold mb-6">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">A Validar...</h2>
        <p className="text-slate-500 text-sm">{message}</p>
      </div>
    </div>
  );
}
