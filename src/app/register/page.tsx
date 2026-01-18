"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import AuthLayout, { PremiumInput } from '../../components/auth/AuthLayout';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  const canSubmit = useMemo(
    () =>
      email.trim().length > 3 &&
      password.trim().length >= 6 &&
      confirmPassword.trim() === password.trim() &&
      acceptedTerms,
    [email, password, confirmPassword, acceptedTerms],
  );

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || loading) return;

    setError(null);
    setConfirmSent(false);
    setLoading(true);

    try {
      if (!supabaseBrowser) throw new Error('Erro de configuração: Supabase indisponível.');

      const redirectTo = `${window.location.origin}/auth-callback`;
      const { data, error: signUpError } = await supabaseBrowser.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: { emailRedirectTo: redirectTo },
      });

      if (signUpError) throw signUpError;

      if (data.user?.identities?.length === 0) {
        throw new Error('Este email já está registado.');
      }

      // Initialize member record logic here if critical, usually handled by webhook/trigger
      // but for safety in this flow:
      if (data.user?.id) {
        await supabaseBrowser.from('membros').insert({
          id: data.user.id,
          is_membro: false,
          tipo_subscricao: 'regulares',
          data_adesao: new Date().toISOString(),
          estado_quota: 'pendente',
        }).catch(() => { }); // Ignore duplicate error if trigger handled it
      }

      setConfirmSent(true);

    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  if (confirmSent) {
    return (
      <AuthLayout
        title="Verifique o seu email"
        subtitle="Enviámos um link de confirmação."
        backgroundImage="https://images.unsplash.com/photo-1605810230434-7631ac76ec81?q=80&w=2670&auto=format&fit=crop"
      >
        <div className="text-center py-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600"
          >
            <CheckCircle2 className="w-10 h-10" />
          </motion.div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Registo com sucesso!</h3>
          <p className="text-gray-500 mb-8 max-w-xs mx-auto">
            Por favor verifique a sua caixa de entrada ({email}) e clique no link para ativar a conta.
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-3 bg-garabandal-dark text-white font-bold rounded-xl hover:bg-black transition-colors"
          >
            Voltar ao Login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Criar Conta"
      subtitle="Junte-se à nossa comunidade digital."
      backgroundImage="https://images.unsplash.com/photo-1605810230434-7631ac76ec81?q=80&w=2670&auto=format&fit=crop"
      quote="A Penitência salva as almas e o mundo."
    >
      <form onSubmit={handleRegister} className="space-y-6">
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

          <PremiumInput
            label="Password"
            type="password"
            placeholder="Min. 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />

          <PremiumInput
            label="Confirmar Password"
            type="password"
            placeholder="Repita a password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="flex items-start gap-3">
          <div className="relative flex items-center h-6">
            <input
              id="terms"
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-garabandal-gold focus:ring-garabandal-gold"
            />
          </div>
          <label htmlFor="terms" className="text-xs text-white/60 lg:text-gray-500 leading-relaxed font-medium">
            Li e aceito os <a href="#" className="underline hover:text-garabandal-gold">Termos e Condições</a> e a <a href="#" className="underline hover:text-garabandal-gold">Política de Privacidade</a> do Apostolado de Garabandal.
          </label>
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
              Criar Conta
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <div className="text-center pt-4 border-t border-gray-100 lg:border-none border-white/10">
          <p className="text-sm text-white/60 lg:text-gray-500">
            Já tem conta?{' '}
            <Link href="/login" className="font-bold text-white lg:text-garabandal-dark hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}
