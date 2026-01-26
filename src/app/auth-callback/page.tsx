"use client";

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AuthCallbackPage() {
  const [message, setMessage] = useState<string>('A validar ligação segura...');
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const watchdog = window.setTimeout(() => {
      if (cancelled) return;
      setMessage('A validação está a demorar. A redirecionar para login...');
      window.location.replace('/login');
    }, 12000);

    const handleAuth = async () => {
      try {
        // 1. Get Params
        const url = new URL(window.location.href);
        const searchParams = url.searchParams;
        const nextQuery = searchParams.get('next');

        // Handle Hash Params (Legacy/Implicit flow)
        const hash = window.location.hash.replace(/^#/, '');
        const hashParams = new URLSearchParams(hash);

        const code = searchParams.get('code') || hashParams.get('code');
        const type = searchParams.get('type') || hashParams.get('type');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        const access_token = hashParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token');
        const tokenHash = searchParams.get('token_hash') || searchParams.get('token');

        if (!supabaseBrowser) {
          setMessage('Configuração Supabase em falta.');
          return;
        }

        // 0. Check if already logged in (Priority)
        // This handles cases where auto-refresh or race conditions already established the session
        const { data: { session } } = await supabaseBrowser.auth.getSession();
        if (session) {
          handleRedirect(type, nextQuery);
          return;
        }

        if (errorParam) {
          setMessage(errorDescription || 'Erro ao validar a conta. Tente novamente.');
          setTimeout(() => router.replace('/login'), 3000);
          return;
        }

        // 2. Handle PKCE Code Exchange
        if (code) {
          setMessage('A confirmar código de acesso...');
          const { error } = await supabaseBrowser.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('Error exchanging code:', error);
            setMessage('Erro ao validar código. Tente fazer login manual.');
            setTimeout(() => router.replace('/login'), 3000);
            return;
          }
          handleRedirect(type, nextQuery);
          return;
        }

        // 3. Handle explicit token verification (when supplied)
        if (tokenHash && type) {
          setMessage('A confirmar ligação segura...');
          const { error } = await supabaseBrowser.auth.verifyOtp({
            type: type as any,
            token_hash: tokenHash,
          });
          if (error) {
            console.error('Error verifying token:', error);
            setMessage('Erro ao validar o link. Tente fazer login manual.');
            setTimeout(() => router.replace('/login'), 3000);
            return;
          }
          handleRedirect(type, nextQuery);
          return;
        }

        // 4. Handle Hash Tokens
        if (!access_token || !refresh_token) {
          // Sometimes session is already set by the time we get here (onAuthStateChange),
          // so we check if we have a user.
          const { data } = await supabaseBrowser.auth.getSession();
          if (data.session) {
            // ALREADY LOGGED IN -> REDIRECT
            handleRedirect(type, nextQuery);
            return;
          }

          setMessage('Link inválido ou expirado. Por favor tente novamente.');
          setTimeout(() => router.replace('/login'), 3000);
          return;
        }

        // 5. Set Session manually
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

        // 6. SUCCESS -> REDIRECT
        handleRedirect(type, nextQuery);
      } catch (err) {
        console.error('Auth callback error:', err);
        setMessage('Erro inesperado ao validar a conta.');
        setTimeout(() => router.replace('/login'), 3000);
      }
    };

    handleAuth();

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
    };
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
