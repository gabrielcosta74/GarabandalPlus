"use client";

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import AuthLayout, { PremiumInput } from '../../../components/auth/AuthLayout';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { detectUpdatePasswordAuthPayload } from '../../../lib/auth-redirects';

export default function UpdatePasswordPage() {
    const router = useRouter();
    const pathname = usePathname();
    const isEn = pathname?.startsWith('/en') ?? false;
    const homePath = isEn ? '/en/member' : '/';
    const loginPath = isEn ? '/en/login' : '/login';
    const updatePath = isEn ? '/en/auth/update-password' : '/auth/update-password';
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);

    // Verify if user is authenticated (which happens after auth-callback redirect)
    useEffect(() => {
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
    }, [router]);

    const canSubmit = useMemo(() =>
        password.trim().length >= 6 &&
        password === confirmPassword,
        [password, confirmPassword]);

    const handlePasswordUpdate = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!canSubmit || loading) return;

        setError(null);
        setLoading(true);

        try {
            if (!supabaseBrowser) throw new Error(isEn ? 'Supabase client not initialised.' : 'Cliente Supabase não inicializado.');

            // Double check session
            const { data: { session } } = await supabaseBrowser.auth.getSession();
            if (!session) throw new Error(isEn ? 'Session expired. Please reload the page.' : 'Sessão expirada. Recarregue a página.');

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

                <div className="space-y-4">
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
            </form>
        </AuthLayout>
    );
}
