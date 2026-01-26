"use client";

import { Suspense, useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthLayout, { PremiumInput } from '../../components/auth/AuthLayout';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Hooks must be called before early returns
  const canSubmit = useMemo(() => email.trim().length > 3 && password.trim().length >= 6, [email, password]);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.replace('/');
    }
  }, [isAuthenticated, authLoading, router]);

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
      title="Bem-vindo"
      subtitle="Inicie sessão para gerir a sua conta e doações."
      backgroundImage="https://images.unsplash.com/photo-1510303099958-3d5df0274191?q=80&w=3431&auto=format&fit=crop"
      quote="A Fé é a luz que guia os nossos passos na escuridão."
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

        <div className="space-y-4">
          <PremiumInput
            label="Email"
            type="email"
            placeholder="exemplo@email.com"
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
                href="/auth/forgot-password"
                className="text-xs font-bold text-garabandal-gold hover:text-yellow-600 transition-colors uppercase tracking-wider mt-2"
              >
                Esqueceu a password?
              </Link>
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
              Entrar na App
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <div className="text-center pt-4 border-t border-gray-100 lg:border-none border-white/10">
          <p className="text-sm text-white/60 lg:text-gray-500">
            Ainda não tem conta?{' '}
            <Link href="/register" className="font-bold text-white lg:text-garabandal-dark hover:underline">
              Criar conta
            </Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}
