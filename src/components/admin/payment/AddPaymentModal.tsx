"use client";

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';

interface AddPaymentModalProps {
    bookingId: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddPaymentModal({
    bookingId,
    onClose,
    onSuccess
}: AddPaymentModalProps) {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('bank_transfer');
    const [label, setLabel] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!amount || Number(amount) <= 0) {
            setError('Por favor insira um valor válido');
            return;
        }

        setIsSubmitting(true);

        try {
            // Get session token for admin auth
            const { supabaseBrowser } = await import('../../lib/supabase-browser');
            const { data: { session } } = await supabaseBrowser!.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                throw new Error('Sessão expirada. Por favor faça login novamente.');
            }

            const response = await fetch('/api/admin/payments/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    bookingId,
                    amount: Number(amount),
                    method,
                    label: label.trim() || undefined,
                    notes: notes.trim() || undefined,
                    status: 'verified'
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao registar pagamento');
            }

            // Success!
            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <h3 className="text-xl font-bold text-slate-900">
                        Registar Pagamento Manual
                    </h3>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-1 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5 text-slate-600" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Amount */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Montante (€) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="250.00"
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            disabled={isSubmitting}
                            required
                        />
                    </div>

                    {/* Method */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Método de Pagamento <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                            disabled={isSubmitting}
                            required
                        >
                            <option value="bank_transfer">Transferência Bancária</option>
                            <option value="cash">Dinheiro</option>
                            <option value="cheque">Cheque</option>
                            <option value="mbway">MB WAY</option>
                            <option value="multibanco">Multibanco</option>
                            <option value="card">Cartão</option>
                        </select>
                    </div>

                    {/* Label */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Label (opcional)
                        </label>
                        <input
                            type="text"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder="Ex: Sinal de Inscrição, Prestação 1..."
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            disabled={isSubmitting}
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Identificação rápida do pagamento
                        </p>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Notas Internas (opcional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ex: Recebido por transferência ref. 12345..."
                            rows={3}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                            disabled={isSubmitting}
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Apenas visível para admins
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3">
                            <p className="text-sm text-red-700 font-medium">{error}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    A registar...
                                </>
                            ) : (
                                '✓ Registar'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
