"use client";

import { Suspense, useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthLayout, { PremiumInput, GoogleButton } from '../../components/auth/AuthLayout';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '../../contexts/LocaleContext';

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-garabandal-mist flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-garabandal-gold animate-spin" />
      </div>
    }>
      <LoginScreen />
    </Suspense>
  );
}

function LoginScreen() {
  const router = useRouter();
  const search = useSearchParams();
  const { setSession, isAuthenticated, loading: authLoading } = useAuth();
  const { locale, t } = useLocale();
  const isEn = locale === 'en';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Hooks must be called before early returns
  const canSubmit = useMemo(() => email.trim().length > 3 && password.trim().length >= 6, [email, password]);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      const next = search.get('next');
      const target = next && next.startsWith('/') ? next : '/';
      router.replace(target);
    }
  }, [isAuthenticated, authLoading, router, search]);

  if (isAuthenticated && !authLoading) {
    return (
      <div className="min-h-screen bg-garabandal-mist flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-garabandal-gold animate-spin" />
      </div>
    );
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || loading) return;

    setError(null);
    setLoading(true);

    try {
      if (!supabaseBrowser) throw new Error('Cliente Supabase não inicializado.');

      const { data, error: loginError } = await supabaseBrowser.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (loginError) throw loginError;

      if (loginError) throw loginError;

      // Note: We don't need to manually call setSession here because
      // supabaseBrowser.auth.signInWithPassword will trigger the onAuthStateChange event
      // in AuthContext, which will update the session/user state naturally.

      // Wait a brief moment for the auth listener to pick it up?
      // Actually, we can just rely on the router pushing.
      // But if we want instant feedback, the context is already listening.

      const next = search.get('next');
      const target = next && next.startsWith('/') ? next : '/';

      // Force a hard refresh if needed, but usually push is enough.
      // If we are already authenticated (via effect), we will redirect anyway.
      router.push(target);
      router.refresh();

    } catch (err: any) {
      setError(err.message || 'Erro ao iniciar sessão.');
      setLoading(false); // Only set loading false on error. On success, we redirect.
    } finally {
      // If success, we stay loading until redirect happens
      // If error, we stopped loading above
    }
  };

  return (
    <AuthLayout
      title={isEn ? 'Welcome' : 'Bem-vindo'}
      subtitle={isEn ? 'Sign in to manage your account and donations.' : 'Inicie sessão para gerir a sua conta e doações.'}
      backgroundImage="/images/nossasenhoragarabandal.jpg"
      quote={isEn ? 'Faith is the light that guides our steps in the darkness.' : 'A Fé é a luz que guia os nossos passos na escuridão.'}
    >
      <form onSubmit={handleLogin} className="space-y-6">
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-3 text-sm font-medium"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </motion.div>
        )}

        <div className="space-y-6">
          <GoogleButton isLoading={loading} text={isEn ? 'Sign in with Google' : 'Entrar com Google'} />

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <span className="relative z-10 bg-white px-2 text-xs text-gray-400 font-bold uppercase tracking-widest">
              {isEn ? 'Or sign in with email' : 'Ou entrar com email'}
            </span>
          </div>

          <div className="space-y-4">
            <PremiumInput
              label="Email"
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />

            <div className="space-y-1">
              <PremiumInput
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <div className="flex justify-end">
                <Link
                  href={t.urls.forgotPassword}
                  className="text-xs font-bold text-garabandal-gold hover:text-yellow-600 transition-colors uppercase tracking-wider mt-2"
                >
                  {isEn ? 'Forgot your password?' : 'Esqueceu a password?'}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className={`
                    w-full py-4 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all duration-300
                    ${!canSubmit || loading
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-garabandal-dark text-white hover:bg-black hover:scale-[1.02] shadow-xl shadow-garabandal-dark/20'
            }
                `}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              {isEn ? 'Sign In' : 'Entrar na App'}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <div className="text-center pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            {isEn ? "Don't have an account?" : 'Ainda não tem conta?'}{' '}
            <Link href={t.urls.register} className="font-bold text-garabandal-dark hover:underline">
              {isEn ? 'Create account' : 'Criar conta'}
            </Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}
