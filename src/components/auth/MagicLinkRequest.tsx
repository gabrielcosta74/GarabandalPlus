"use client";

import { useState } from 'react';
import { Mail, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MagicLinkRequest({ onCancel }: { onCancel?: () => void }) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (!email.includes('@')) throw new Error('Email inválido');

            const response = await fetch('/api/auth/send-magic-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim(),
                    next: '/',
                }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data?.success) {
                throw new Error(data?.message || 'Erro ao enviar link.');
            }

            setSuccess(true);
        } catch (err: any) {
            setError(err.message || 'Erro ao enviar link.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="text-center py-8 animate-in fade-in zoom-in duration-300">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500">
                    <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Email Enviado!</h3>
                <p className="text-gray-500 text-sm mb-6">
                    Verifique a sua caixa de entrada (e spam).<br />
                    Clique no link para entrar automaticamente.
                </p>
                <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100 text-xs text-yellow-800 mb-6">
                    Pode fechar esta página.
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                        O seu Email
                    </label>
                    <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="exemplo@email.com"
                            className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl pl-12 pr-4 py-4 text-gray-900 focus:border-yellow-500 focus:outline-none transition-all placeholder:text-gray-400 font-medium"
                        />
                    </div>
                </div>

                {error && (
                    <div className="text-red-500 text-sm font-bold flex items-center gap-2 bg-red-50 p-3 rounded-lg">
                        <Loader2 className="w-4 h-4 animate-spin" /> {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-garabandal-dark hover:bg-black text-white font-bold py-4 rounded-xl shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin" /> : <>Receber Link de Acesso <ArrowRight className="w-5 h-5" /></>}
                </button>

                <p className="text-xs text-gray-400 text-center leading-relaxed px-4">
                    Sem passwords. Seguro e rápido.
                </p>

                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="w-full pt-4 text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors"
                    >
                        Voltar ao Login com Password
                    </button>
                )}
            </form>
        </div>
    );
}
