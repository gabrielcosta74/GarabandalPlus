"use client";

import { useState } from 'react';
import { X, Loader2, Eye } from 'lucide-react';

interface ValidateReceiptModalProps {
    receipt: {
        id: string;
        receipt_url?: string;
    };
    onClose: () => void;
    onConfirm: (paymentId: string, amount: number, label?: string) => Promise<void>;
}

export default function ValidateReceiptModal({
    receipt,
    onClose,
    onConfirm
}: ValidateReceiptModalProps) {
    const [amount, setAmount] = useState('');
    const [label, setLabel] = useState('');
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
            await onConfirm(receipt.id, Number(amount), label.trim() || undefined);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <h3 className="text-xl font-bold text-slate-900">
                        Validar Comprovativo
                    </h3>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-1 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5 text-slate-600" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Receipt Preview */}
                    {receipt.receipt_url && (
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Comprovativo Enviado
                            </label>
                            <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
                                <img
                                    src={receipt.receipt_url}
                                    alt="Comprovativo"
                                    className="w-full h-auto"
                                />
                            </div>
                            <a
                                href={receipt.receipt_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                                <Eye className="w-4 h-4" />
                                Abrir em nova janela
                            </a>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Amount */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Montante Verificado (€) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="Ex: 250.00"
                                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                disabled={isSubmitting}
                                required
                                autoFocus
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Insira o valor que consta no comprovativo
                            </p>
                        </div>

                        {/* Label */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Referente a (opcional)
                            </label>
                            <select
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                                disabled={isSubmitting}
                            >
                                <option value="Saldo Final">Saldo Final</option>
                            </select>
                            <p className="text-xs text-slate-500 mt-1">
                                A que fase do pagamento se refere este valor
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
                                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        A validar...
                                    </>
                                ) : (
                                    '✓ Validar e Registar'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
