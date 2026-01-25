"use client";

import { Check, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { calculateInstallmentStatus, type InstallmentStatus, type Payment } from '../../lib/utils';

interface InstallmentTrackerProps {
    totalAmount: number;
    paidAmount: number;
    depositValue: number;
    paymentPlan: Array<{ date: string; amount: number }>;
    payments: Payment[];
    formatPrice?: (value: number) => string;
    useDonationCopy?: boolean;
}

export default function InstallmentTracker({
    totalAmount,
    paidAmount,
    depositValue,
    paymentPlan,
    payments,
    formatPrice = (val) => `${val.toFixed(2)}€`,
    useDonationCopy = false
}: InstallmentTrackerProps) {
    // Calculate installment status using waterfall algorithm
    const installments = calculateInstallmentStatus(
        paidAmount,
        depositValue,
        paymentPlan,
        payments
    );

    const getStatusIcon = (status: InstallmentStatus['status']) => {
        switch (status) {
            case 'paid':
                return <Check className="w-5 h-5 text-green-600" />;
            case 'partial':
                return <AlertCircle className="w-5 h-5 text-amber-600" />;
            case 'pending':
                return <Clock className="w-5 h-5 text-slate-400" />;
        }
    };

    const getStatusColor = (status: InstallmentStatus['status']) => {
        switch (status) {
            case 'paid':
                return 'bg-green-100 border-green-200 text-green-900';
            case 'partial':
                return 'bg-amber-100 border-amber-200 text-amber-900';
            case 'pending':
                return 'bg-slate-100 border-slate-200 text-slate-600';
        }
    };

    const getProgressColor = (status: InstallmentStatus['status']) => {
        switch (status) {
            case 'paid':
                return 'bg-green-500';
            case 'partial':
                return 'bg-amber-500';
            case 'pending':
                return 'bg-slate-300';
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    💰 Plano de {useDonationCopy ? 'Doações' : 'Pagamentos'}
                </h3>
                <p className="text-indigo-100 text-sm mt-1">
                    Acompanha o estado de cada prestação
                </p>
            </div>

            {/* Installments List */}
            <div className="p-6 space-y-4">
                {installments.map((installment: InstallmentStatus, idx: number) => (
                    <div
                        key={idx}
                        className={`border-2 rounded-xl p-4 transition-all ${getStatusColor(installment.status)}`}
                    >
                        {/* Header Row */}
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="flex-shrink-0">
                                    {getStatusIcon(installment.status)}
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">
                                        {installment.label}
                                    </h4>
                                    {installment.dueDate && (
                                        <p className="text-xs opacity-75">
                                            Vencimento: {format(new Date(installment.dueDate), 'dd MMM yyyy', { locale: pt })}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Status Badge */}
                            <div className="text-xs font-bold uppercase px-3 py-1 rounded-full bg-white/50">
                                {installment.status === 'paid' && (useDonationCopy ? '✅ Doado' : '✅ Pago')}
                                {installment.status === 'partial' && '⚠️ Parcial'}
                                {installment.status === 'pending' && '⏳ Pendente'}
                            </div>
                        </div>

                        {/* Amount Info */}
                        <div className="flex items-baseline gap-2 mb-3">
                            <span className="text-2xl font-bold">
                                {formatPrice(installment.paidAmount)}
                            </span>
                            <span className="text-sm opacity-75">
                                / {formatPrice(installment.expectedAmount)}
                            </span>
                            {installment.remainingAmount > 0 && (
                                <span className="text-sm font-bold ml-auto">
                                    Falta: {formatPrice(installment.remainingAmount)}
                                </span>
                            )}
                        </div>

                        {/* Progress Bar */}
                        <div className="relative h-3 bg-white/50 rounded-full overflow-hidden">
                            <div
                                className={`absolute inset-y-0 left-0 ${getProgressColor(installment.status)} transition-all duration-500 rounded-full`}
                                style={{ width: `${installment.percentage}%` }}
                            />
                        </div>
                        <div className="text-right text-xs font-bold mt-1 opacity-75">
                            {installment.percentage.toFixed(0)}%
                        </div>

                        {/* Payment Details (if any) */}
                        {installment.payments.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-current/20">
                                <p className="text-xs font-bold mb-2 opacity-75">
                                    📎 {installment.payments.length} doaç{installment.payments.length > 1 ? 'ões' : 'ão'} registada{installment.payments.length > 1 ? 's' : ''}:
                                </p>
                                <div className="space-y-1">
                                    {installment.payments.map((payment: { id: string; amount: number; date: string; method: string }, pidx: number) => (
                                        <div key={pidx} className="text-xs flex items-center justify-between bg-white/30 rounded px-2 py-1">
                                            <span>
                                                {formatPrice(payment.amount)} · {payment.method}
                                            </span>
                                            <span className="opacity-75">
                                                {format(new Date(payment.date), 'dd MMM', { locale: pt })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Summary Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-6">
                <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-700">{useDonationCopy ? 'Total Doado:' : 'Total Pago:'}</span>
                    <span className="text-2xl font-bold text-green-600">
                        {formatPrice(paidAmount)}
                    </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                    <span className="font-bold text-slate-700">{useDonationCopy ? 'Saldo a Doar:' : 'Saldo Devedor:'}</span>
                    <span className="text-2xl font-bold text-slate-900">
                        {formatPrice(totalAmount - paidAmount)}
                    </span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-300">
                    <div className="text-xs text-slate-500 text-center">
                        💡 {useDonationCopy ? 'As doações são alocadas automaticamente por ordem de vencimento' : 'Os pagamentos são alocados automaticamente por ordem de vencimento'}
                    </div>
                </div>
            </div>
        </div>
    );
}
