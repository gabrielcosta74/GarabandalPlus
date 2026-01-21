"use client";

import { DollarSign, TrendingUp, Clock } from 'lucide-react';

interface FinancialSummaryProps {
    totalAmount: number;
    paidAmount: number;
    status: 'pending' | 'partial' | 'paid';
}

export default function FinancialSummary({
    totalAmount,
    paidAmount,
    status
}: FinancialSummaryProps) {
    const remaining = totalAmount - paidAmount;
    const percentage = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

    const statusConfig = {
        pending: { label: 'Pendente', color: 'bg-slate-100 text-slate-700 border-slate-300' },
        partial: { label: 'Parcial', color: 'bg-amber-100 text-amber-700 border-amber-300' },
        paid: { label: 'Pago', color: 'bg-green-100 text-green-700 border-green-300' }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-PT', {
            style: 'currency',
            currency: 'EUR'
        }).format(value);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl border border-slate-200">
            {/* Total */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-indigo-600" />
                    </div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total</p>
                </div>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalAmount)}</p>
            </div>

            {/* Pago */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                    </div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pago</p>
                </div>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(paidAmount)}</p>
                <p className="text-xs text-slate-500 mt-1">{percentage}% do total</p>
            </div>

            {/* Falta */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                        <Clock className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Falta</p>
                </div>
                <p className="text-2xl font-bold text-amber-600">{formatCurrency(remaining)}</p>
                <p className="text-xs text-slate-500 mt-1">{100 - percentage}% restante</p>
            </div>

            {/* Status */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</p>
                <div className={`inline-flex items-center justify-center px-4 py-2 rounded-lg border-2 font-bold text-sm ${statusConfig[status].color}`}>
                    {statusConfig[status].label}
                </div>
            </div>
        </div>
    );
}
