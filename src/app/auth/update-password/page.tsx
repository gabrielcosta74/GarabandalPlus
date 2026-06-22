"use client";

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import AuthLayout, { PremiumInput } from '../../../components/auth/AuthLayout';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, AlertCircle, CheckCircle2, Lock, KeyRound } from 'lucide-react';
import { detectUpdatePasswordAuthPayload } from '../../../lib/auth-redirects';

export default function UpdatePasswordPage() {
    const router = useRouter();
    const pathname = usePathname();
    const isEn = pathname?.startsWith('/en') ?? false;
    const homePath = isEn ? '/en/member' : '/';
    const loginPath = isEn ? '/en/login' : '/login';
    const updatePath = isEn ? '/en/auth/update-password' : '/auth/update-password';

    // Code-entry mode is driven by the URL query (?mode=code&email=...), set when
    // the user comes from the "Recover Account" page. It is link-free, so it is
    // immune to email-client link scanners (e.g. Hotmail/Outlook SafeLinks) that
    // can consume or break one-time recovery links before the user clicks them.
    const [codeMode, setCodeMode] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        const params = new URLSearchParams(window.location.search);
        return params.get('mode') === 'code' || !!params.get('email');
    });
    const [recoveryEmail, setRecoveryEmail] = useState<string>(() => {
        if (typeof window === 'undefined') return '';
        return (new URLSearchParams(window.location.search).get('email') || '').trim().toLowerCase();
    });
    const [code, setCode] = useState('');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    // In code mode there is no link to process, so skip the session-detection spinner.
    const [checkingSession, setCheckingSession] = useState(() => {
        if (typeof window === 'undefined') return true;
        const params = new URLSearchParams(window.location.search);
        return !(params.get('mode') === 'code' || !!params.get('email'));
    });

    // Verify if user is authenticated (which happens after auth-callback redirect).
    // Only runs for the link-based flow; the code-entry flow handles its own auth.
    useEffect(() => {
        if (codeMode) return;

        let cancelled = false;
        const watchdog = window.setTimeout(() => {
            if (cancelled) return;
            console.warn("⏱️ [UpdatePassword] Session check timeout.");
            setError(isEn ? 'Link invalid or expired. Request a new recovery email.' : 'Link inválido ou expirado. Peça um novo email de recuperação.');
            setCheckingSession(false);
        }, 12000);

        if (!supabaseBrowser) {
            console.error("Supabase client missing");
            setError(isEn ? 'Authentication configuration missing.' : 'Configuração de autenticação em falta.');
            setCheckingSession(false);
            return;
        }

        // Listener for immediate updates (handles hash, storage, etc.)
        const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
            console.log("🔔 [UpdatePassword] Auth Event:", event);
            if (event === 'USER_UPDATED') {
                console.log("✅ [UpdatePassword] Password update verified via event via listener.");
                setSuccess(true);
                setLoading(false);
                setTimeout(() => router.push(homePath), 3000); // Ensure redirect happens
            } else if (session) {
                console.log("✅ [UpdatePassword] Session confirmed:", session.user.email);
                window.clearTimeout(watchdog);
                setCheckingSession(false);
            } else if (event === 'SIGNED_OUT') {
                // Only redirect if explicitly signed out and no hash present to process
                const hash = window.location.hash;
                if (!hash) {
                    console.warn("⚠️ [UpdatePassword] No session/hash. Redirecting.");
                    // Debounce redirect slightly to allow hash processing if any
                    setTimeout(() => {
                        if (!window.location.hash) router.replace(loginPath);
                    }, 1000);
                }
            }
        });

        // Support direct recovery links from both PKCE and legacy hash flows.
        const checkRecoverySession = async () => {
            const authPayload = detectUpdatePasswordAuthPayload(window.location.href);

            if (authPayload.kind === 'code') {
                console.log("🔗 [UpdatePassword] PKCE code found, exchanging session...");
                const { error: exchangeError } = await supabaseBrowser.auth.exchangeCodeForSession(authPayload.code);

                if (exchangeError) {
                    console.error("🚨 [UpdatePassword] exchangeCodeForSession error:", exchangeError);
                    setError(isEn ? 'The recovery link is invalid or has expired.' : 'O link de recuperação é inválido ou expirou.');
                    setCheckingSession(false);
                    return;
                }

                window.history.replaceState({}, '', updatePath);
            } else if (authPayload.kind === 'otp') {
                console.log("🔗 [UpdatePassword] OTP token found, verifying recovery...");
                const { error: verifyError } = await supabaseBrowser.auth.verifyOtp({
                    type: authPayload.type as any,
                    token_hash: authPayload.tokenHash,
                });

                if (verifyError) {
                    console.error("🚨 [UpdatePassword] verifyOtp error:", verifyError);
                    setError(isEn ? 'The recovery link is invalid or has expired.' : 'O link de recuperação é inválido ou expirou.');
                    setCheckingSession(false);
                    return;
                }

                window.history.replaceState({}, '', updatePath);
            } else if (authPayload.kind === 'session') {
                console.log("🔗 [UpdatePassword] Recovery hash found, setting session...");
                const { error: sessionError } = await supabaseBrowser.auth.setSession({
                    access_token: authPayload.accessToken,
                    refresh_token: authPayload.refreshToken,
                });

                if (sessionError) {
                    console.error("🚨 [UpdatePassword] setSession error:", sessionError);
                    setError(isEn ? 'The recovery link is invalid or has expired.' : 'O link de recuperação é inválido ou expirou.');
                    setCheckingSession(false);
                    return;
                }

                window.history.replaceState({}, '', updatePath);
            }

            const { data: { session } } = await supabaseBrowser.auth.getSession();
            if (session) {
                window.clearTimeout(watchdog);
                setCheckingSession(false);
                return;
            }

            setError(isEn ? 'Link invalid or expired. Request a new recovery email.' : 'Link inválido ou expirado. Peça um novo email de recuperação.');
            setCheckingSession(false);
        };
        checkRecoverySession().catch((err) => {
            console.error("🚨 [UpdatePassword] Session check failed:", err);
            setError(isEn ? 'Could not validate the recovery link.' : 'Não foi possível validar o link de recuperação.');
            setCheckingSession(false);
        });

        return () => {
            cancelled = true;
            window.clearTimeout(watchdog);
            subscription.unsubscribe();
        };
    }, [router, codeMode]);

    // Let users who got a broken link (e.g. SafeLinks) switch to entering the
    // 6-digit code that is also included in the recovery email.
    const switchToCodeMode = () => {
        setError(null);
        setCodeMode(true);
        setCheckingSession(false);
    };

    const passwordOk = useMemo(() =>
        password.trim().length >= 6 && password === confirmPassword,
        [password, confirmPassword]);

    const canSubmit = useMemo(() => {
        if (!passwordOk) return false;
        if (codeMode) {
            return /^\d{6}$/.test(code.trim()) && recoveryEmail.includes('@');
        }
        return true;
    }, [passwordOk, codeMode, code, recoveryEmail]);

    const handlePasswordUpdate = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!canSubmit || loading) return;

        setError(null);
        setLoading(true);

        try {
            if (!supabaseBrowser) throw new Error(isEn ? 'Supabase client not initialised.' : 'Cliente Supabase não inicializado.');

            if (codeMode) {
                // Establish a recovery session from the 6-digit code (link-free).
                console.log("🔑 [UpdatePassword] Verifying recovery code...");
                const { error: verifyError } = await supabaseBrowser.auth.verifyOtp({
                    email: recoveryEmail.trim().toLowerCase(),
                    token: code.trim(),
                    type: 'recovery',
                });

                if (verifyError) {
                    console.error("🚨 [UpdatePassword] verifyOtp (code) error:", verifyError);
                    throw new Error(isEn
                        ? 'Invalid or expired code. Request a new recovery email.'
                        : 'Código inválido ou expirado. Peça um novo email de recuperação.');
                }
            } else {
                // Double check session (established via the recovery link).
                const { data: { session } } = await supabaseBrowser.auth.getSession();
                if (!session) throw new Error(isEn ? 'Session expired. Please reload the page.' : 'Sessão expirada. Recarregue a página.');
            }

            console.log("🔒 [UpdatePassword] Attempting update...");

            // Create a race between update and a 15s timeout
            const updatePromise = supabaseBrowser.auth.updateUser({
                password: password.trim()
            });

            const timeoutPromise = new Promise<{ error: { message: string } | null }>((_, reject) =>
                setTimeout(() => reject(new Error(isEn ? 'The request took too long. Please check your connection.' : 'O pedido demorou demasiado tempo. Verifique a sua conexão.')), 15000)
            );

            // Type assertion to handle the race result correctly
            const result = await Promise.race([updatePromise, timeoutPromise]) as any;

            // Supabase returns { data, error }
            if (result.error) throw result.error;

            console.log("✅ [UpdatePassword] Success.");
            setSuccess(true);
            setLoading(false); // Explicitly stop loading even if success switches view

            // Auto redirect
            setTimeout(() => {
                router.push(homePath);
            }, 3000);

        } catch (err: any) {
            console.error("🚨 [UpdatePassword] Error:", err);
            setError(err.message || (isEn ? 'Error updating password.' : 'Erro ao atualizar a password.'));
            setLoading(false);
        }
    };

    if (checkingSession) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-yellow-600 animate-spin" />
            </div>
        );
    }

    if (success) {
        return (
            <AuthLayout
                title={isEn ? 'Password Updated' : 'Password Atualizada'}
                subtitle={isEn ? 'Your account is secure.' : 'A sua conta está segura.'}
                backgroundImage="https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?q=80&w=3570&auto=format&fit=crop"
            >
                <div className="text-center py-10">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600"
                    >
                        <CheckCircle2 className="w-10 h-10" />
                    </motion.div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{isEn ? 'Success!' : 'Sucesso!'}</h3>
                    <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                        {isEn
                            ? 'Your password has been changed successfully. Redirecting to the application...'
                            : 'A sua password foi alterada com sucesso. A redirecionar para a aplicação...'}
                    </p>
                    <Link
                        href={homePath}
                        className="inline-block px-8 py-3 bg-garabandal-dark text-white font-bold rounded-xl hover:bg-black transition-colors"
                    >
                        {isEn ? 'Go to App' : 'Ir para a Aplicação'}
                    </Link>
                </div>
            </AuthLayout>
        );
    }

    // Error screen for the link-based flow: offer the code as an escape hatch.
    if (error && !codeMode) {
        return (
            <AuthLayout
                title={isEn ? 'New Password' : 'Nova Password'}
                subtitle={isEn ? 'Set a new secure password for your account.' : 'Defina uma nova password segura para a sua conta.'}
                backgroundImage="https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?q=80&w=3570&auto=format&fit=crop"
            >
                <div className="space-y-6">
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-3 text-sm font-medium">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        {error}
                    </div>
                    <button
                        type="button"
                        onClick={switchToCodeMode}
                        className="w-full py-4 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 bg-garabandal-dark text-white hover:bg-black transition-colors"
                    >
                        <KeyRound className="w-4 h-4" />
                        {isEn ? 'I have a code' : 'Tenho um código'}
                    </button>
                    <p className="text-center text-sm text-gray-500">
                        <Link href={isEn ? '/en/auth/forgot-password' : '/auth/forgot-password'} className="font-bold text-garabandal-dark hover:underline">
                            {isEn ? 'Request a new recovery email' : 'Pedir novo email de recuperação'}
                        </Link>
                    </p>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title={isEn ? 'New Password' : 'Nova Password'}
            subtitle={isEn ? 'Set a new secure password for your account.' : 'Defina uma nova password segura para a sua conta.'}
            backgroundImage="https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?q=80&w=3570&auto=format&fit=crop"
            quote={isEn ? 'The Truth shall set you free.' : 'A Verdade libertar-vos-á.'}
        >
            <form onSubmit={handlePasswordUpdate} className="space-y-6">
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

                {codeMode ? (
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
                        <div className="flex gap-3">
                            <KeyRound className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-blue-700 leading-relaxed">
                                {isEn
                                    ? 'We emailed you a 6-digit code. Enter it below together with your new password.'
                                    : 'Enviámos um código de 6 dígitos para o seu email. Introduza-o abaixo junto com a sua nova password.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 mb-6">
                        <div className="flex gap-3">
                            <Lock className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-yellow-800 leading-relaxed">
                                {isEn
                                    ? 'Create a password with at least 6 characters. We recommend using numbers and letters.'
                                    : 'Crie uma password com pelo menos 6 caracteres. Recomendamos usar números e letras.'}
                            </p>
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    {codeMode && (
                        <>
                            <PremiumInput
                                label={isEn ? 'Account Email' : 'Email da Conta'}
                                type="email"
                                placeholder="example@email.com"
                                value={recoveryEmail}
                                onChange={(e) => setRecoveryEmail(e.target.value)}
                                disabled={loading}
                            />
                            <PremiumInput
                                label={isEn ? '6-digit Code' : 'Código de 6 dígitos'}
                                type="text"
                                inputMode="numeric"
                                placeholder="000000"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                disabled={loading}
                            />
                        </>
                    )}

                    <PremiumInput
                        label={isEn ? 'New Password' : 'Nova Password'}
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                    />

                    <PremiumInput
                        label={isEn ? 'Confirm New Password' : 'Confirmar Nova Password'}
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={loading}
                        error={confirmPassword && password !== confirmPassword ? (isEn ? 'Passwords do not match' : 'As passwords não coincidem') : undefined}
                    />
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
                            {isEn ? 'Update Password' : 'Atualizar Password'}
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>

                {codeMode && (
                    <p className="text-center text-sm text-gray-500">
                        <Link href={isEn ? '/en/auth/forgot-password' : '/auth/forgot-password'} className="font-bold text-garabandal-dark hover:underline">
                            {isEn ? 'Resend code' : 'Reenviar código'}
                        </Link>
                    </p>
                )}
            </form>
        </AuthLayout>
    );
}
