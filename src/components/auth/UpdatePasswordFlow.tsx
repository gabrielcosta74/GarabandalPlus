'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  RotateCcw,
} from 'lucide-react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { detectUpdatePasswordAuthPayload } from '../../lib/auth-redirects';
import { isActiveMember } from '../../lib/store-discounts';
import { resolveLoginTarget } from '../../lib/login-routing';
import { captureAnalyticsEvent } from '../../lib/analytics';
import type { RecoveryPageState } from '../../lib/recovery-flow';
import RecoveryShell, {
  recoveryInputClassName,
  recoveryPrimaryButtonClassName,
  recoverySecondaryButtonClassName,
} from './RecoveryShell';

type UpdatePasswordFlowProps = RecoveryPageState & {
  locale: 'pt' | 'en';
};

type FlowScreen = 'checking' | 'link-error' | 'code' | 'password' | 'success';

const RECOVERY_EMAIL_KEY = 'garabandal_recovery_email';

export default function UpdatePasswordFlow({
  locale,
  initialMode,
  initialStatus,
  initialEmail,
}: UpdatePasswordFlowProps) {
  const isEn = locale === 'en';
  const router = useRouter();
  const updatePath = isEn ? '/en/auth/update-password' : '/auth/update-password';
  const requestPath = isEn ? '/en/auth/forgot-password' : '/auth/forgot-password';
  const initialScreen: FlowScreen = initialStatus === 'invalid-link'
    ? 'link-error'
    : initialMode === 'code'
      ? 'code'
      : 'checking';

  const [screen, setScreen] = useState<FlowScreen>(initialScreen);
  const [recoveryEmail, setRecoveryEmail] = useState(initialEmail);
  const [editingEmail, setEditingEmail] = useState(!initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successTarget, setSuccessTarget] = useState(isEn ? '/en' : '/');
  const codeInputRef = useRef<HTMLInputElement>(null);

  const normalizedEmail = recoveryEmail.trim().toLowerCase();
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const codeIsValid = /^\d{6}$/.test(code);
  const passwordIsValid = password.length >= 6;

  useEffect(() => {
    if (initialEmail) {
      window.sessionStorage.setItem(RECOVERY_EMAIL_KEY, initialEmail);
      return;
    }

    const storedEmail = (window.sessionStorage.getItem(RECOVERY_EMAIL_KEY) || '').trim().toLowerCase();
    if (storedEmail) {
      setRecoveryEmail(storedEmail);
      setEditingEmail(false);
    }
  }, [initialEmail]);

  useEffect(() => {
    if (screen !== 'checking') return;

    let cancelled = false;
    const watchdog = window.setTimeout(() => {
      if (cancelled) return;
      setError(isEn
        ? 'This link took too long to validate.'
        : 'A validação deste link demorou demasiado tempo.');
      setScreen('link-error');
    }, 12000);

    const validateRecoveryLink = async () => {
      try {
        const authPayload = detectUpdatePasswordAuthPayload(window.location.href);

        if (authPayload.kind === 'code') {
          const { error: exchangeError } = await supabaseBrowser.auth.exchangeCodeForSession(authPayload.code);
          if (exchangeError) throw exchangeError;
          window.history.replaceState({}, '', updatePath);
        } else if (authPayload.kind === 'otp') {
          if (authPayload.type !== 'recovery') throw new Error('invalid_recovery_type');
          const { error: verifyError } = await supabaseBrowser.auth.verifyOtp({
            type: 'recovery',
            token_hash: authPayload.tokenHash,
          });
          if (verifyError) throw verifyError;
          window.history.replaceState({}, '', updatePath);
        } else if (authPayload.kind === 'session') {
          const { error: sessionError } = await supabaseBrowser.auth.setSession({
            access_token: authPayload.accessToken,
            refresh_token: authPayload.refreshToken,
          });
          if (sessionError) throw sessionError;
          window.history.replaceState({}, '', updatePath);
        }

        const { data: { session }, error: sessionError } = await supabaseBrowser.auth.getSession();
        if (sessionError || !session) throw sessionError || new Error('missing_recovery_session');

        if (!cancelled) {
          window.clearTimeout(watchdog);
          setError(null);
          setScreen('password');
        }
      } catch (caught) {
        console.error('[Recovery] Link validation failed:', caught);
        if (!cancelled) {
          window.clearTimeout(watchdog);
          setError(null);
          setScreen('link-error');
          captureAnalyticsEvent('auth_recovery_link_invalid', { locale });
        }
      }
    };

    void validateRecoveryLink();
    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
    };
  }, [isEn, locale, screen, updatePath]);

  const switchToCode = () => {
    setError(null);
    setScreen('code');
    window.history.replaceState({}, '', `${updatePath}?mode=code`);
    captureAnalyticsEvent('auth_recovery_code_selected', { locale });
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!emailIsValid || !codeIsValid || loading) return;

    setError(null);
    setLoading(true);
    try {
      const { error: verifyError } = await supabaseBrowser.auth.verifyOtp({
        email: normalizedEmail,
        token: code,
        type: 'recovery',
      });
      if (verifyError) throw verifyError;

      window.sessionStorage.setItem(RECOVERY_EMAIL_KEY, normalizedEmail);
      window.history.replaceState({}, '', updatePath);
      setCode('');
      setScreen('password');
      captureAnalyticsEvent('auth_recovery_verified', { locale, method: 'code' });
    } catch (caught) {
      console.error('[Recovery] Code verification failed:', caught);
      setCode('');
      setError(isEn
        ? 'That code is invalid or has expired. Check the email or request a new one.'
        : 'Esse código é inválido ou expirou. Confirme o email ou peça um novo.');
      window.requestAnimationFrame(() => codeInputRef.current?.focus({ preventScroll: true }));
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passwordIsValid || loading) return;

    setError(null);
    setLoading(true);
    try {
      const { data: { session }, error: sessionError } = await supabaseBrowser.auth.getSession();
      if (sessionError || !session) throw sessionError || new Error('missing_recovery_session');

      let timeoutId: number | undefined;
      const updatePromise = supabaseBrowser.auth.updateUser({ password });
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error('recovery_timeout')), 15000);
      });
      const result = await Promise.race([updatePromise, timeoutPromise]).finally(() => {
        if (timeoutId) window.clearTimeout(timeoutId);
      });
      if (result.error) throw result.error;

      const { data: member } = await supabaseBrowser
        .from('membros')
        .select('is_membro, estado_quota, tipo_subscricao, proxima_quota')
        .eq('id', session.user.id)
        .maybeSingle();
      const target = resolveLoginTarget(null, isActiveMember(member), isEn);

      window.sessionStorage.removeItem(RECOVERY_EMAIL_KEY);
      setSuccessTarget(target);
      setScreen('success');
      captureAnalyticsEvent('auth_recovery_completed', { locale });
    } catch (caught: unknown) {
      console.error('[Recovery] Password update failed:', caught);
      const errorCode = typeof caught === 'object' && caught !== null && 'code' in caught
        ? String(caught.code)
        : '';
      setError(errorCode === 'weak_password'
        ? (isEn ? 'Choose a password with at least 6 characters.' : 'Escolha uma password com pelo menos 6 caracteres.')
        : (isEn
          ? 'We could not save the new password. Please try again.'
          : 'Não foi possível guardar a nova password. Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  const codeFormCanSubmit = emailIsValid && codeIsValid && !loading;

  if (screen === 'checking') {
    return (
      <RecoveryShell
        locale={locale}
        step={3}
        title={isEn ? 'Checking your link' : 'A verificar o seu link'}
        subtitle={isEn ? 'This should only take a moment.' : 'Isto deverá demorar apenas um instante.'}
        align="center"
      >
        <div role="status" aria-live="polite" className="flex min-h-32 flex-col items-center justify-center gap-4 text-slate-600">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" aria-hidden="true" />
          <span className="text-sm font-bold">{isEn ? 'Validating secure access…' : 'A validar o acesso seguro…'}</span>
        </div>
      </RecoveryShell>
    );
  }

  if (screen === 'link-error') {
    return (
      <RecoveryShell
        locale={locale}
        step={2}
        title={isEn ? 'This link no longer works' : 'Este link já não funciona'}
        subtitle={isEn
          ? 'Use the 6-digit code from the same email or request a new one.'
          : 'Use o código de 6 dígitos do mesmo email ou peça um novo.'}
        showHelp
      >
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950">
          {isEn
            ? 'Some email services open secure links before you do. Your code still works.'
            : 'Alguns serviços de email abrem links seguros antes de si. O seu código continua a funcionar.'}
        </div>
        <div className="mt-6 space-y-3">
          <button type="button" onClick={switchToCode} className={recoveryPrimaryButtonClassName}>
            <KeyRound className="h-5 w-5" aria-hidden="true" />
            {isEn ? 'Use the code' : 'Usar o código'}
          </button>
          <button type="button" onClick={() => router.push(requestPath)} className={recoverySecondaryButtonClassName}>
            <RotateCcw className="h-5 w-5" aria-hidden="true" />
            {isEn ? 'Send a new email' : 'Enviar novo email'}
          </button>
        </div>
      </RecoveryShell>
    );
  }

  if (screen === 'code') {
    return (
      <RecoveryShell
        locale={locale}
        step={2}
        title={isEn ? 'Enter the code' : 'Introduza o código'}
        subtitle={isEn ? 'It is in the email we just sent you.' : 'Está no email que acabámos de enviar.'}
        showHelp
      >
        <form onSubmit={verifyCode} noValidate>
          {error && (
            <div role="alert" className="mb-5 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-5 text-red-800">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {editingEmail ? (
            <div className="mb-5">
              <label htmlFor="code-email" className="mb-2 block text-sm font-extrabold text-slate-800">Email</label>
              <input
                id="code-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                value={recoveryEmail}
                onChange={(event) => setRecoveryEmail(event.target.value)}
                className={recoveryInputClassName}
              />
            </div>
          ) : (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <Mail className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
              <p className="min-w-0 flex-1 break-all text-sm font-extrabold text-slate-800">{normalizedEmail}</p>
              <button
                type="button"
                onClick={() => setEditingEmail(true)}
                className="min-h-11 shrink-0 rounded-xl px-2 text-sm font-bold text-slate-600 hover:text-slate-950"
              >
                {isEn ? 'Change' : 'Alterar'}
              </button>
            </div>
          )}

          <label htmlFor="recovery-code" className="mb-2 block text-sm font-extrabold text-slate-800">
            {isEn ? '6-digit code' : 'Código de 6 dígitos'}
          </label>
          <input
            ref={codeInputRef}
            id="recovery-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            aria-invalid={Boolean(error)}
            className={`${recoveryInputClassName} text-center font-mono text-[28px] font-black tracking-[0.28em]`}
          />

          <button type="submit" disabled={!codeFormCanSubmit} className={`${recoveryPrimaryButtonClassName} mt-5`}>
            {loading ? (
              <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />{isEn ? 'Checking…' : 'A confirmar…'}</>
            ) : (
              <><ArrowRight className="h-5 w-5" aria-hidden="true" />{isEn ? 'Confirm code' : 'Confirmar código'}</>
            )}
          </button>

          <button
            type="button"
            onClick={() => router.push(requestPath)}
            className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl px-3 text-sm font-bold text-slate-600 hover:text-slate-950"
          >
            {isEn ? 'Send a new code' : 'Enviar novo código'}
          </button>
        </form>
      </RecoveryShell>
    );
  }

  if (screen === 'success') {
    return (
      <RecoveryShell
        locale={locale}
        step={3}
        title={isEn ? 'Password changed' : 'Password alterada'}
        subtitle={isEn ? 'You can now continue to your account.' : 'Já pode continuar para a sua conta.'}
        align="center"
      >
        <div className="mb-7 flex justify-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
          </span>
        </div>
        <button type="button" onClick={() => window.location.assign(successTarget)} className={recoveryPrimaryButtonClassName}>
          {isEn ? 'Go to my account' : 'Entrar na minha conta'}
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </RecoveryShell>
    );
  }

  return (
    <RecoveryShell
      locale={locale}
      step={3}
      title={isEn ? 'Create a new password' : 'Crie uma nova password'}
      subtitle={isEn ? 'Use at least 6 characters.' : 'Use pelo menos 6 caracteres.'}
    >
      <form onSubmit={updatePassword} noValidate>
        {error && (
          <div role="alert" className="mb-5 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-5 text-red-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <label htmlFor="new-password" className="mb-2 block text-sm font-extrabold text-slate-800">
          {isEn ? 'New password' : 'Nova password'}
        </label>
        <div className="relative">
          <input
            id="new-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
            aria-describedby="password-requirement"
            className={`${recoveryInputClassName} pr-28`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute inset-y-0 right-1 flex min-w-24 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-extrabold text-slate-600 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            aria-label={showPassword
              ? (isEn ? 'Hide password' : 'Ocultar password')
              : (isEn ? 'Show password' : 'Mostrar password')}
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            {showPassword ? (isEn ? 'Hide' : 'Ocultar') : (isEn ? 'Show' : 'Mostrar')}
          </button>
        </div>
        <p id="password-requirement" className={`mt-2 flex items-center gap-2 text-sm font-semibold ${passwordIsValid ? 'text-emerald-700' : 'text-slate-500'}`}>
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
          {isEn ? 'At least 6 characters' : 'Pelo menos 6 caracteres'}
        </p>

        <button type="submit" disabled={!passwordIsValid || loading} className={`${recoveryPrimaryButtonClassName} mt-6`}>
          {loading ? (
            <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />{isEn ? 'Saving…' : 'A guardar…'}</>
          ) : (
            <>{isEn ? 'Save and sign in' : 'Guardar e entrar'}<ArrowRight className="h-5 w-5" aria-hidden="true" /></>
          )}
        </button>
      </form>
    </RecoveryShell>
  );
}
