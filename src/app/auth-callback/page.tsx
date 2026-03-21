"use client";

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { resolveAuthCallbackRedirect } from '../../lib/auth-redirects';

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
        const refCode = searchParams.get('ref');

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
          handleRedirect(type, nextQuery, refCode);
          return;
        }

        const handleError = (msg: string) => {
          setMessage(msg);
          setTimeout(() => {
            if (refCode) {
              window.location.replace(`/tornar-membro?ref=${encodeURIComponent(refCode)}&join=1`);
            } else {
              window.location.replace('/login');
            }
          }, 3000);
        };

        if (errorParam) {
          // If the OTP expired (e.g. email scanner consumed the token), the user's email might actually be confirmed.
          // They should just log in. We must preserve the ref code so they don't lose the referral!
          handleError(errorDescription || 'Link inválido ou expirado. Redirecionando...');
          return;
        }

        // 2. Handle PKCE Code Exchange
        if (code) {
          setMessage('A confirmar código de acesso...');
          const { error } = await supabaseBrowser.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('Error exchanging code:', error);
            handleError('Erro ao validar código. Tente fazer login manual.');
            return;
          }
          handleRedirect(type, nextQuery, refCode);
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
            handleError('Erro ao validar o link. Tente fazer login manual.');
            return;
          }
          handleRedirect(type, nextQuery, refCode);
          return;
        }

        // 4. Handle Hash Tokens
        if (!access_token || !refresh_token) {
          // Sometimes session is already set by the time we get here (onAuthStateChange),
          // so we check if we have a user.
          const { data } = await supabaseBrowser.auth.getSession();
          if (data.session) {
            // ALREADY LOGGED IN -> REDIRECT
            handleRedirect(type, nextQuery, refCode);
            return;
          }

          handleError('Link inválido ou expirado. Por favor tente novamente.');
          return;
        }

        // 5. Set Session manually
        const { error } = await supabaseBrowser.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error) {
          console.error('Error setting session:', error);
          handleError('Erro ao validar sessão. Tente fazer login manual.');
          return;
        }

        // 6. SUCCESS -> Ensuring Member Record Exists (Critical for Google Auth)
        // Check if user has a member record
        const { data: memberCheck } = await supabaseBrowser
          .from('membros')
          .select('id')
          .eq('id', (await supabaseBrowser.auth.getUser()).data.user?.id)
          .maybeSingle();

        if (!memberCheck) {
          const user = (await supabaseBrowser.auth.getUser()).data.user;
          if (user?.id) {
            console.log('Creating default member record for new social login user...');
            const newMemberPayload: Record<string, any> = {
              id: user.id,
              email: user.email,
              nome: user.user_metadata?.full_name || user.email?.split('@')[0],
              avatar_url: user.user_metadata?.avatar_url,
              is_membro: false,
              tipo_subscricao: 'regulares',
              data_adesao: new Date().toISOString(),
              estado_quota: 'pendente',
            };
            // If there's a referral code in the URL, save it now.
            if (refCode) {
              newMemberPayload.referred_by_code = refCode;
            }
            await supabaseBrowser.from('membros').insert(newMemberPayload);
          }
        } else if (memberCheck && refCode) {
          // Existing member record (e.g. returning Google user who hasn't set referred_by_code yet).
          // Only set if they don't already have one to avoid overwriting.
          await supabaseBrowser
            .from('membros')
            .update({ referred_by_code: refCode })
            .eq('id', memberCheck.id)
            .is('referred_by_code', null);
        }

        handleRedirect(type, nextQuery, refCode);
      } catch (err) {
        console.error('Auth callback error:', err);
        setMessage('Erro inesperado ao validar a conta.');
        setTimeout(() => {
          const fallbackRef = new URL(window.location.href).searchParams.get('ref');
          if (fallbackRef) {
            window.location.replace(`/tornar-membro?ref=${encodeURIComponent(fallbackRef)}&join=1`);
          } else {
            window.location.replace('/login');
          }
        }, 3000);
      }
    };

    handleAuth();

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
    };
  }, [router]);

  const handleRedirect = (type: string | null, next: string | null, refCode?: string | null) => {
    setMessage('Sessão confirmada. A redirecionar...');
    window.location.href = resolveAuthCallbackRedirect({ type, next, refCode });
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
