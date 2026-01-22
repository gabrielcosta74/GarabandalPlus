"use client";

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthLayout, { PremiumInput } from '../../../components/auth/AuthLayout';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, AlertCircle, CheckCircle2, Lock } from 'lucide-react';

export default function UpdatePasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);

    // Verify if user is authenticated (which happens after auth-callback redirect)
    useEffect(() => {
        const checkSession = async () => {
            if (!supabaseBrowser) return;
            const { data: { session } } = await supabaseBrowser.auth.getSession();
            if (!session) {
                // If no session, they probably came here directly without the magic link
                console.warn("⚠️ [UpdatePassword] No session found. Redirecting to login.");
                router.replace('/login');
            } else {
                setCheckingSession(false);
            }
        };
        checkSession();
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
            if (!supabaseBrowser) throw new Error('Cliente Supabase não inicializado.');

            const { error: updateError } = await supabaseBrowser.auth.updateUser({
                password: password.trim()
            });

            if (updateError) throw updateError;

            setSuccess(true);

            // Auto redirect after 3 seconds
            setTimeout(() => {
                router.push('/');
            }, 3000);

        } catch (err: any) {
            console.error("🚨 [UpdatePassword] Error:", err);
            setError(err.message || 'Erro ao atualizar a password.');
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
                title="Password Atualizada"
                subtitle="A sua conta está segura."
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
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Sucesso!</h3>
                    <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                        A sua password foi alterada com sucesso. A redirecionar para a aplicação...
                    </p>
                    <Link
                        href="/"
                        className="inline-block px-8 py-3 bg-garabandal-dark text-white font-bold rounded-xl hover:bg-black transition-colors"
                    >
                        Ir para a Aplicação
                    </Link>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title="Nova Password"
            subtitle="Defina uma nova password segura para a sua conta."
            backgroundImage="https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?q=80&w=3570&auto=format&fit=crop"
            quote="A Verdade libertar-vos-á."
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
                            Crie uma password com pelo menos 6 caracteres. Recomendamos usar números e letras.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <PremiumInput
                        label="Nova Password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                    />

                    <PremiumInput
                        label="Confirmar Nova Password"
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={loading}
                        error={confirmPassword && password !== confirmPassword ? "As passwords não coincidem" : undefined}
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
                            Atualizar Password
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </form>
        </AuthLayout>
    );
}
