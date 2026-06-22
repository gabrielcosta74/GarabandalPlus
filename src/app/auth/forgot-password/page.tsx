"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthLayout, { PremiumInput } from '../../../components/auth/AuthLayout';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { useLocale } from '../../../contexts/LocaleContext';

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const { locale, t } = useLocale();
    const isEn = locale === 'en';
    const updatePasswordPath = isEn ? '/en/auth/update-password' : '/auth/update-password';

    const canSubmit = useMemo(() => email.trim().length > 3 && email.includes('@'), [email]);

    const handleResetRequest = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!canSubmit || loading) return;

        setError(null);
        setLoading(true);

        try {
            const res = await fetch('/api/auth/send-recovery-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success) {
                throw new Error(data?.message || 'Não foi possível enviar o email de recuperação.');
            }

            setSuccess(true);
            // Forward to the password page in code-entry mode (immune to email
            // link scanners). Email is pre-filled; the user just types the code.
            router.push(`${updatePasswordPath}?mode=code&email=${encodeURIComponent(email.trim())}`);
        } catch (err: any) {
            console.error("🚨 [Recovery] Error:", err);
            setError(err.message || 'Erro ao enviar email de recuperação.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <AuthLayout
                title={isEn ? 'Check your email' : 'Verifique o seu email'}
                subtitle={isEn ? 'We sent you a recovery link.' : 'Enviámos um link de recuperação.'}
                backgroundImage="https://images.unsplash.com/photo-1493612276216-99392bbc8476?q=80&w=3570&auto=format&fit=crop"
            >
                <div className="text-center py-10">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600"
                    >
                        <CheckCircle2 className="w-10 h-10" />
                    </motion.div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{isEn ? 'Email sent!' : 'Email enviado!'}</h3>
                    <p className="text-gray-500 mb-8 max-w-sm mx-auto leading-relaxed">
                        {isEn
                            ? <>If an account exists for <strong>{email}</strong>, you will receive an email with a link to set a new password.<br /><br /><span className="text-xs text-gray-400">Also check your Spam/Junk folder.</span></>
                            : <>Se existir uma conta associada a <strong>{email}</strong>, receberá um email com um link para definir uma nova password.<br /><br /><span className="text-xs text-gray-400">Verifique também a caixa de Spam/Lixo.</span></>}
                    </p>
                    <Link
                        href={t.urls.login}
                        className="inline-block px-8 py-3 bg-garabandal-dark text-white font-bold rounded-xl hover:bg-black transition-colors"
                    >
                        {isEn ? 'Back to Sign In' : 'Voltar ao Login'}
                    </Link>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title={isEn ? 'Recover Account' : 'Recuperar Conta'}
            subtitle={isEn ? 'Enter your email to recover access.' : 'Introduza o seu email para recuperar o acesso.'}
            backgroundImage="https://images.unsplash.com/photo-1493612276216-99392bbc8476?q=80&w=3570&auto=format&fit=crop"
            quote={isEn ? 'Ask and it will be given to you; seek and you will find.' : 'Quem pede, recebe; e quem procura, encontra.'}
        >
            <form onSubmit={handleResetRequest} className="space-y-6">
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

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
                    <div className="flex gap-3">
                        <Mail className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-700 leading-relaxed">
                            {isEn
                                ? 'We will send you a secure link to your email. By clicking that link, you can create a new password immediately.'
                                : 'Vamos enviar-lhe um link seguro para o seu email. Ao clicar nesse link, poderá criar uma nova password imediatamente.'}
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <PremiumInput
                        label={isEn ? 'Account Email' : 'Email da Conta'}
                        type="email"
                        placeholder="example@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
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
                            {isEn ? 'Send Recovery Link' : 'Enviar Link de Recuperação'}
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>

                <div className="text-center pt-4 border-t border-gray-100 lg:border-none border-white/10">
                    <p className="text-sm text-white/60 lg:text-gray-500">
                        {isEn ? 'Remembered your password?' : 'Lembrou-se da password?'}{' '}
                        <Link href={t.urls.login} className="font-bold text-white lg:text-garabandal-dark hover:underline">
                            {isEn ? 'Back to Sign In' : 'Voltar ao Login'}
                        </Link>
                    </p>
                </div>
            </form>
        </AuthLayout>
    );
}
