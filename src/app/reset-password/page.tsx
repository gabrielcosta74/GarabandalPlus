"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import AuthShell from '../../components/auth/AuthShell';
import AuthCard from '../../components/auth/AuthCard';
import AuthInput from '../../components/auth/AuthInput';
import AuthErrorBanner from '../../components/auth/AuthErrorBanner';
import styles from '../../components/auth/auth.module.css';
import { supabaseBrowser } from '../../lib/supabase-browser';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const canSubmit = useMemo(() => email.trim().length > 3, [email]);

  const handleReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSent(false);
    if (!supabaseBrowser) {
      setError('Configuração Supabase em falta.');
      return;
    }
    if (!canSubmit) {
      setError('Indica um email válido.');
      return;
    }
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth-callback`;
      const { error: resetError } = await supabaseBrowser.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (resetError) {
        setError(resetError.message || 'Não foi possível enviar o link.');
        return;
      }
      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Erro ao enviar link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Recuperar acesso"
      subtitle="Enviaremos um link seguro para redefinir a tua password."
      features={[
        'Link valido por tempo limitado',
        'Recuperacao segura com confirmacao por email',
        'Volta a entrar em poucos passos',
      ]}
    >
      <AuthCard title="Recuperar password" subtitle="Indica o email associado a tua conta.">
        <form onSubmit={handleReset}>
          <AuthErrorBanner message={error} />
          {sent ? <div className={styles.helper}>Link enviado. Verifica o teu email.</div> : null}
          <AuthInput
            label="Email"
            name="email"
            type="email"
            placeholder="email@exemplo.com"
            autoComplete="email"
            value={email}
            onChange={setEmail}
          />
          <div className={styles.actions}>
            <button className={styles.primaryButton} type="submit" disabled={!canSubmit || loading}>
              {loading ? 'A enviar...' : 'Enviar link'}
            </button>
            <Link className={styles.secondaryLink} href="/login">
              Voltar ao login
            </Link>
          </div>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
