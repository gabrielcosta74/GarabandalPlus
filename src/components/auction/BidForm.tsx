"use client";

import { useEffect, useState } from 'react';
import { Gavel, Loader2, AlertCircle, CheckCircle2, Trophy, LogIn } from 'lucide-react';
import Link from 'next/link';
import { supabaseBrowser } from '../../lib/supabase-browser';

interface BidFormProps {
    itemId: string;
    currentBid: number | null;
    startingPrice: number;
    minIncrement: number;
    isExpired: boolean;
    isLeader?: boolean;
}

export function BidForm({ itemId, currentBid, startingPrice, minIncrement, isExpired, isLeader = false }: BidFormProps) {
    const minBid = currentBid ? currentBid + minIncrement : startingPrice;
    const [amount, setAmount] = useState<string>((minBid / 100).toFixed(0));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null = loading

    // Check auth state on mount
    useEffect(() => {
        const checkAuth = async () => {
            const session = await supabaseBrowser?.auth.getSession();
            setIsAuthenticated(!!session?.data?.session?.user);
        };
        checkAuth();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        const amountCents = Math.round(parseFloat(amount) * 100);
        if (isNaN(amountCents) || amountCents < minBid) {
            setError(`O lance mínimo é ${(minBid / 100).toFixed(0)}€.`);
            return;
        }

        setLoading(true);
        try {
            const session = await supabaseBrowser?.auth.getSession();
            const token = session?.data?.session?.access_token;

            if (!token) {
                setError('Sessão expirada. Refresque a página e tente novamente.');
                return;
            }

            const res = await fetch('/api/auction/bid', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ item_id: itemId, amount: amountCents })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Erro ao realizar o lance.');
                if (data.min_bid) {
                    setAmount((data.min_bid / 100).toFixed(0));
                }
                return;
            }

            setSuccess(true);
            setTimeout(() => window.location.reload(), 1500);
        } catch {
            setError('Erro de rede. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    // State 1: Auction ended
    if (isExpired) {
        return (
            <div className="bg-slate-50 rounded-2xl p-6 text-center border border-slate-100">
                <p className="text-slate-500 font-medium">Este leilão já terminou.</p>
            </div>
        );
    }

    // State 2: User is the current leader
    if (isLeader) {
        return (
            <div className="bg-green-50 rounded-2xl p-6 text-center border border-green-100">
                <Trophy className="w-10 h-10 text-green-500 mx-auto mb-3" />
                <p className="text-green-800 font-bold text-lg">Está a ganhar!</p>
                <p className="text-green-600 text-sm mt-1">
                    O seu lance é o mais alto. Se ninguém o ultrapassar, a peça é sua!
                </p>
                <p className="text-green-500 text-xs mt-3">
                    Receberá um email com instruções de pagamento quando o leilão terminar.
                </p>
            </div>
        );
    }

    // State 3: Not authenticated — show login prompt
    if (isAuthenticated === false) {
        return (
            <div className="bg-yellow-50 rounded-2xl p-6 text-center border border-yellow-100 space-y-4">
                <LogIn className="w-10 h-10 text-yellow-600 mx-auto" />
                <div>
                    <p className="text-yellow-900 font-bold text-lg">Inicie sessão para licitar</p>
                    <p className="text-yellow-700 text-sm mt-1">
                        Precisa de uma conta para participar no leilão.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/login"
                        className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold rounded-xl transition-colors text-sm"
                    >
                        Entrar
                    </Link>
                    <Link
                        href="/register"
                        className="px-6 py-3 bg-white border border-yellow-200 text-yellow-800 font-bold rounded-xl hover:bg-yellow-50 transition-colors text-sm"
                    >
                        Criar Conta
                    </Link>
                </div>
            </div>
        );
    }

    // State 4: Loading auth state
    if (isAuthenticated === null) {
        return (
            <div className="bg-slate-50 rounded-2xl p-6 text-center border border-slate-100">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" />
            </div>
        );
    }

    // State 5: Bid submitted successfully
    if (success) {
        return (
            <div className="bg-green-50 rounded-2xl p-6 text-center border border-green-100 animate-fade-in">
                <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-green-800 font-bold">Lance registado com sucesso!</p>
                <p className="text-green-600 text-sm mt-1">A atualizar...</p>
            </div>
        );
    }

    // State 6: Bid form (default — authenticated, not leader, not expired)
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                    O seu lance (€)
                </label>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">€</span>
                    <input
                        type="number"
                        min={(minBid / 100).toFixed(0)}
                        step="1"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        disabled={loading}
                        className="w-full pl-10 pr-4 py-4 text-2xl font-bold text-slate-900 border-2 border-slate-200 rounded-xl focus:border-yellow-500 focus:ring-4 focus:ring-yellow-500/10 outline-none transition-all disabled:opacity-50"
                    />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                    Lance mínimo: {(minBid / 100).toFixed(0)}€
                </p>
            </div>

            {error && (
                <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm p-3 rounded-xl border border-red-100">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-slate-900 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-yellow-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <>
                        <Gavel className="w-5 h-5" />
                        Fazer Lance
                    </>
                )}
            </button>
        </form>
    );
}
