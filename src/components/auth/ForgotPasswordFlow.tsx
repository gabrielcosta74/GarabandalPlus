'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, KeyRound, Loader2, Mail } from 'lucide-react';
import { captureAnalyticsEvent } from '../../lib/analytics';
import RecoveryShell, {
  recoveryInputClassName,
  recoveryPrimaryButtonClassName,
  recoverySecondaryButtonClassName,
} from './RecoveryShell';

type ForgotPasswordFlowProps = {
  locale: 'pt' | 'en';
};

const RECOVERY_EMAIL_KEY = 'garabandal_recovery_email';
const RESEND_SECONDS = 60;

export default function ForgotPasswordFlow({ locale }: ForgotPasswordFlowProps) {
  const isEn = locale === 'en';
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);

  const normalizedEmail = email.trim().toLowerCase();
  const canSubmit = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const sendRecoveryEmail = async (isResend = false) => {
    if (!canSubmit || loading) return;

    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/send-recovery-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, locale }),
      });
      const payload = await response.json().catch(() => ({}));

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('Retry-After')) || RESEND_SECONDS;
        setResendSeconds(retryAfter);
        throw new Error(isEn
          ? `Please wait ${retryAfter} seconds before trying again.`
          : `Aguarde ${retryAfter} segundos antes de tentar novamente.`);
      }

      if (!response.ok || !payload?.success) {
        throw new Error(isEn
          ? 'We could not send the email. Please try again.'
          : 'Não foi possível enviar o email. Tente novamente.');
      }

      window.sessionStorage.setItem(RECOVERY_EMAIL_KEY, normalizedEmail);
      setSent(true);
      setResendSeconds(RESEND_SECONDS);
      captureAnalyticsEvent(isResend ? 'auth_recovery_resent' : 'auth_recovery_requested', {
        locale,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (isEn
        ? 'We could not send the email. Please try again.'
        : 'Não foi possível enviar o email. Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendRecoveryEmail(false);
  };

  const useCode = () => {
    captureAnalyticsEvent('auth_recovery_code_selected', { locale });
    router.push(isEn ? '/en/auth/update-password?mode=code' : '/auth/update-password?mode=code');
  };

  if (sent) {
    return (
      <RecoveryShell
        locale={locale}
        step={2}
        title={isEn ? 'Now open your email' : 'Agora abra o seu email'}
        subtitle={isEn ? 'We sent the instructions to:' : 'Enviámos as instruções para:'}
        showHelp
      >
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="break-all text-base font-extrabold text-emerald-950">{normalizedEmail}</p>
              <p className="mt-1 text-sm leading-5 text-emerald-800">
                {isEn ? 'Also check your Spam or Junk folder.' : 'Veja também a pasta Spam ou Lixo.'}
              </p>
            </div>
          </div>
        </div>

        <ol className="mt-6 space-y-4" aria-label={isEn ? 'Next steps' : 'Próximos passos'}>
          <li className="flex gap-3 text-base leading-6 text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">1</span>
            <span>{isEn ? 'Open the email from the Garabandal Apostolate.' : 'Abra o email enviado pelo Apostolado.'}</span>
          </li>
          <li className="flex gap-3 text-base leading-6 text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">2</span>
            <span>{isEn ? 'Tap “Set new password”.' : 'Toque em “Definir nova password”.'}</span>
          </li>
        </ol>

        {error && (
          <div role="alert" className="mt-5 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-5 text-red-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-7 space-y-3">
          <button type="button" onClick={useCode} className={recoverySecondaryButtonClassName}>
            <KeyRound className="h-5 w-5" aria-hidden="true" />
            {isEn ? 'Use the 6-digit code' : 'Usar o código de 6 dígitos'}
          </button>

          <button
            type="button"
            onClick={() => void sendRecoveryEmail(true)}
            disabled={loading || resendSeconds > 0}
            className="flex min-h-11 w-full items-center justify-center rounded-xl px-3 text-sm font-bold text-slate-600 hover:text-slate-950 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />{isEn ? 'Sending…' : 'A enviar…'}</>
            ) : resendSeconds > 0 ? (
              isEn ? `Resend in ${resendSeconds}s` : `Reenviar em ${resendSeconds}s`
            ) : (
              isEn ? 'Resend email' : 'Reenviar email'
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setSent(false);
              setError(null);
            }}
            className="flex min-h-11 w-full items-center justify-center rounded-xl px-3 text-sm font-bold text-slate-600 hover:text-slate-950"
          >
            {isEn ? 'Change email address' : 'Alterar o email'}
          </button>
        </div>
      </RecoveryShell>
    );
  }

  return (
    <RecoveryShell
      locale={locale}
      step={1}
      title={isEn ? 'Recover access' : 'Recuperar acesso'}
      subtitle={isEn ? 'Enter the email address you use to sign in.' : 'Escreva o email que usa para entrar.'}
    >
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div role="alert" className="mb-5 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-5 text-red-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <label htmlFor="recovery-email" className="mb-2 block text-sm font-extrabold text-slate-800">
          Email
        </label>
        <input
          id="recovery-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          placeholder={isEn ? 'name@example.com' : 'nome@exemplo.com'}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={loading}
          aria-invalid={Boolean(email && !canSubmit)}
          className={recoveryInputClassName}
        />

        <button type="submit" disabled={!canSubmit || loading} className={`${recoveryPrimaryButtonClassName} mt-5`}>
          {loading ? (
            <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />{isEn ? 'Sending…' : 'A enviar…'}</>
          ) : (
            <><Check className="h-5 w-5" aria-hidden="true" />{isEn ? 'Send email' : 'Enviar email'}</>
          )}
        </button>
      </form>
    </RecoveryShell>
  );
}
