"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { Mail, Lock, Flame, AlertTriangle, Loader2 } from 'lucide-react';

export default function PortalLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // On mount: check if there's already a valid session
    useEffect(() => {
        (async () => {
            if (!supabaseBrowser) { setChecking(false); return; }
            const { data: { session } } = await supabaseBrowser.auth.getSession();
            if (!session) { setChecking(false); return; }

            // Verify if the logged-in user is whitelisted
            const res = await fetch('/api/prayer-portal/auth', {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });

            if (res.ok) {
                router.replace('/portal-oracoes');
                return;
            }

            // Session exists but not authorized — sign out silently
            await supabaseBrowser.auth.signOut();
            setError('A conta com sessão activa não tem acesso a este portal. Inicie sessão com uma conta autorizada.');
            setChecking(false);
        })();
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supabaseBrowser) return;
        setLoading(true);
        setError(null);

        const { data, error: authError } = await supabaseBrowser.auth.signInWithPassword({ email, password });
        if (authError || !data.session) {
            setError('Email ou palavra-passe incorrectos.');
            setLoading(false);
            return;
        }

        // Check whitelist
        const res = await fetch('/api/prayer-portal/auth', {
            headers: { Authorization: `Bearer ${data.session.access_token}` },
        });

        if (res.ok) {
            router.replace('/portal-oracoes');
            return;
        }

        // Authenticated but not whitelisted
        await supabaseBrowser.auth.signOut();
        setError('Esta conta não está autorizada para aceder ao portal de orações.');
        setLoading(false);
    };

    if (checking) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="max-w-sm mx-auto mt-12">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                <div className="flex flex-col items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center">
                        <Flame className="w-6 h-6 text-amber-500" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-xl font-bold text-slate-900">Portal de Orações</h1>
                        <p className="text-sm text-slate-500 mt-1">Acesso restrito a gestores autorizados</p>
                    </div>
                </div>

                {error && (
                    <div className="mb-5 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-red-700 text-sm">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                                placeholder="o-seu@email.com"
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none text-sm"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Palavra-passe</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                placeholder="••••••••"
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none text-sm"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-2 flex items-center justify-center gap-2 w-full py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors font-medium text-sm"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Entrar
                    </button>
                </form>
            </div>
        </div>
    );
}
