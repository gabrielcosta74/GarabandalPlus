"use client";

import { useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import {
    Plus,
    Check,
    X,
    FileText,
    Clock,
    AlertCircle,
    Trash2,
    DollarSign,
    Calendar,
    ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Payment {
    id: string;
    amount: number;
    method: string;
    status: string;
    receipt_url?: string;
    notes?: string;
    created_at: string;
    verified_at?: string;
}

interface PaymentHistoryManagerProps {
    bookingId: string;
    totalAmount: number;
    paidAmount: number;
    paymentPlan?: any[];
    onUpdate: () => void;
}

export default function PaymentHistoryManager({
    bookingId,
    totalAmount,
    paidAmount,
    paymentPlan = [],
    onUpdate
}: PaymentHistoryManagerProps) {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [newAmount, setNewAmount] = useState('');
    const [newMethod, setNewMethod] = useState('bank_transfer');
    const [newNote, setNewNote] = useState('');
    const [newLabel, setNewLabel] = useState('');

    const fetchPayments = async () => {
        if (!supabaseBrowser) return;
        setLoading(true);
        try {
            const { data, error } = await supabaseBrowser
                .from('pilgrimage_payments')
                .select('*')
                .eq('booking_id', bookingId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPayments(data || []);
        } catch (err) {
            console.error("Error fetching payments:", err);
        } finally {
            setLoading(false);
        }
    };

    useState(() => {
        fetchPayments();
    });

    const handleAddManualPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAmount || Number(newAmount) <= 0 || !supabaseBrowser) return;

        setIsSubmitting(true);
        try {
            const { data: { session } } = await supabaseBrowser.auth.getSession();
            const token = session?.access_token;
            if (!token) {
                throw new Error('Sessão inválida. Faça login novamente.');
            }

            const response = await fetch('/api/admin/payments/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    bookingId,
                    amount: Number(newAmount),
                    method: newMethod,
                    notes: newNote,
                    label: newLabel,
                    verifiedAt: new Date().toISOString()
                })
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(result?.error || 'Falha ao registar pagamento');
            }

            setShowAddForm(false);
            setNewAmount('');
            setNewNote('');
            setNewLabel('');
            fetchPayments();
            onUpdate();
        } catch (err: any) {
            alert("Erro ao adicionar: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerify = async (paymentId: string, amount: number) => {
        if (!confirm("Validar este comprovativo?")) return;

        try {
            const res = await fetch('/api/admin/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentId, bookingId })
            });

            if (!res.ok) throw new Error("Erro ao validar");

            fetchPayments();
            onUpdate();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const remaining = Math.max(0, totalAmount - paidAmount);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Header / Summary */}
            <div className="bg-slate-50 p-6 border-b border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Gestão Financeira</h3>
                        <p className="text-sm text-slate-500">Histórico de pagamentos e acertos manuais.</p>
                    </div>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
                    >
                        <Plus className="w-4 h-4" /> Registar Pagamento
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total da Reserva</p>
                        <p className="text-xl font-bold text-slate-900">{totalAmount}€</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Pago</p>
                        <p className="text-xl font-bold text-green-600">{paidAmount}€</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Em Dívida</p>
                        <p className="text-xl font-bold text-red-600">{remaining}€</p>
                    </div>
                </div>
            </div>

            {/* Add Payment Form */}
            {showAddForm && (
                <div className="p-6 bg-indigo-50 border-b border-indigo-100 animate-in slide-in-from-top-4 duration-300">
                    <form onSubmit={handleAddManualPayment} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-indigo-900 uppercase">Valor (€)</label>
                            <input
                                type="number"
                                value={newAmount}
                                onChange={(e) => setNewAmount(e.target.value)}
                                className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="ex: 500"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-indigo-900 uppercase">Método</label>
                            <select
                                value={newMethod}
                                onChange={(e) => setNewMethod(e.target.value)}
                                className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="bank_transfer">Transferência</option>
                                <option value="cash">Numerário / Dinheiro</option>
                                <option value="mbway">MBWAY</option>
                                <option value="manual">Outro</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-indigo-900 uppercase">Referente a</label>
                            <select
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="">Pagamento Geral (Saldo)</option>
                                <option value="Sinal">Sinal de Reserva</option>
                                {paymentPlan.map((step, i) => (
                                    <option key={i} value={`Prestação ${i + 1}`}>Prestação {i + 1} ({format(new Date(step.date), "MMM", { locale: pt })})</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-indigo-900 uppercase">Nota Adicional</label>
                            <input
                                type="text"
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="..."
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {isSubmitting ? '...' : 'Confirmar'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowAddForm(false)}
                                className="px-3 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg hover:bg-white/50"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Payments List */}
            <div className="divide-y divide-slate-100">
                {payments.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-sm italic">
                        Nenhum registo de pagamento encontrado.
                    </div>
                ) : (
                    payments.map((p) => (
                        <div key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${p.status === 'verified' || p.status === 'succeeded' ? 'bg-green-100 text-green-600' :
                                    p.status === 'verifying' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'
                                    }`}>
                                    {p.status === 'verified' || p.status === 'succeeded' ? <Check className="w-5 h-5" /> :
                                        p.status === 'verifying' ? <Clock className="w-5 h-5 animate-pulse" /> : <AlertCircle className="w-5 h-5" />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900">{p.amount}€</span>
                                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-bold uppercase">{p.method}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                        <span>{format(new Date(p.created_at), 'dd MMM yyyy HH:mm', { locale: pt })}</span>
                                        {p.notes && <span className="text-slate-300">•</span>}
                                        {p.notes && <span className="italic">{p.notes}</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {p.receipt_url && (
                                    <a
                                        href={p.receipt_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded"
                                    >
                                        <FileText className="w-3 h-3" /> Ver Talão
                                    </a>
                                )}

                                {p.status === 'verifying' && (
                                    <button
                                        onClick={() => handleVerify(p.id, p.amount)}
                                        className="bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all flex items-center gap-1"
                                    >
                                        <Check className="w-3 h-3" /> Validar
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Payment Plan Timeline (Admin View) */}
            {paymentPlan.length > 0 && (
                <div className="bg-slate-50/50 p-6 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Plano de Prestações</h4>
                    <div className="space-y-3">
                        {paymentPlan.map((step, idx) => {
                            const stepAmount = Number(step.amount);
                            // Simple heuristic to see if this installment is paid
                            // We use the cumulative approach again
                            const depositValue = totalAmount * 0.2; // This is a fallback if we don't have it, but we should pass it
                            // For simplicity, let's just show it as a guide for now
                            return (
                                <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 text-sm">
                                    <div className="flex items-center gap-3">
                                        <Calendar className="w-4 h-4 text-slate-400" />
                                        <span className="font-medium text-slate-700">Prestação {idx + 1}</span>
                                        <span className="text-slate-400">•</span>
                                        <span className="text-slate-500">{format(new Date(step.date), "dd/MM/yyyy")}</span>
                                    </div>
                                    <span className="font-bold text-slate-900">{stepAmount}€</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
