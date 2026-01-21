"use client";

import { AlertCircle, Eye, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface PendingReceipt {
    id: string;
    amount: number;
    created_at: string;
    receipt_url?: string;
}

interface PendingReceiptsAlertProps {
    receipts: PendingReceipt[];
    onValidate: (id: string, amount: number) => void;
    onReject: (id: string) => void;
}

export default function PendingReceiptsAlert({
    receipts,
    onValidate,
    onReject
}: PendingReceiptsAlertProps) {
    if (receipts.length === 0) return null;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-PT', {
            style: 'currency',
            currency: 'EUR'
        }).format(value);
    };

    return (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertCircle className="w-5 h-5 text-amber-700" />
                </div>
                <div className="flex-1">
                    <h4 className="text-lg font-bold text-amber-900 mb-1">
                        Comprovativos Pendentes de Validação
                    </h4>
                    <p className="text-sm text-amber-700 mb-4">
                        {receipts.length} comprovativo{receipts.length > 1 ? 's' : ''} aguarda{receipts.length > 1 ? 'm' : ''} a tua aprovação
                    </p>

                    <div className="space-y-3">
                        {receipts.map((receipt) => (
                            <div
                                key={receipt.id}
                                className="bg-white rounded-xl p-4 border border-amber-200 flex items-center justify-between gap-4"
                            >
                                <div className="flex-1">
                                    <p className="font-bold text-slate-900">
                                        {formatCurrency(receipt.amount)}
                                    </p>
                                    <p className="text-xs text-slate-600">
                                        Enviado {format(new Date(receipt.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: pt })}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    {receipt.receipt_url && (
                                        <a
                                            href={receipt.receipt_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                                        >
                                            <Eye className="w-4 h-4" />
                                            Ver
                                        </a>
                                    )}
                                    <button
                                        onClick={() => onValidate(receipt.id, receipt.amount)}
                                        className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-1"
                                    >
                                        <Check className="w-4 h-4" />
                                        Validar
                                    </button>
                                    <button
                                        onClick={() => onReject(receipt.id)}
                                        className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                                    >
                                        <X className="w-4 h-4" />
                                        Rejeitar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
