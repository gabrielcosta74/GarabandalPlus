"use client";

import { useState } from 'react';
import InstallmentTracker from '../booking/InstallmentTracker';
import { Eye, Mail, FileText, Download, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { Payment } from '../../lib/utils';

interface PaymentWithReceipt extends Payment {
    receipt_url?: string;
    notes?: string;
}

interface AdminPaymentDashboardProps {
    booking: {
        id: string;
        total_amount: number;
        paid_amount: number;
        payment_plan: Array<{ date: string; amount: number }>;
        pilgrimage: {
            deposit_value: number;
            title: string;
        };
    };
    payments: PaymentWithReceipt[];
    onApprove?: (paymentId: string) => void;
    onReject?: (paymentId: string) => void;
    onSendReminder?: () => void;
    onUpdate?: () => void;
}

export default function AdminPaymentDashboard({
    booking,
    payments,
    onApprove,
    onReject,
    onSendReminder,
    onUpdate
}: AdminPaymentDashboardProps) {
    const [showClientView, setShowClientView] = useState(true);

    // Find pending receipts
    const pendingPayments = payments.filter(p => p.status === 'verifying' || p.status === 'pending_verification');
    const verifiedPayments = payments.filter(p => p.status === 'verified' || p.status === 'succeeded');

    const depositValue = booking.pilgrimage.deposit_value;

    return (
        <div className="space-y-6">
            {/* Toggle View Button */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    💰 Gestão de Pagamentos
                </h3>
                <button
                    onClick={() => setShowClientView(!showClientView)}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all
                        ${showClientView
                            ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300'
                            : 'bg-slate-100 text-slate-600 border-2 border-slate-200 hover:border-slate-300'
                        }
                    `}
                >
                    <Eye className="w-4 h-4" />
                    {showClientView ? 'A Ver como Cliente' : 'Ver como Cliente'}
                </button>
            </div>

            {/* Client View Section */}
            {showClientView && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-2xl border-2 border-indigo-100">
                    <div className="flex items-center gap-2 mb-4">
                        <Eye className="w-5 h-5 text-indigo-600" />
                        <h4 className="text-sm font-bold text-indigo-900 uppercase tracking-wide">
                            Vista do Cliente
                        </h4>
                        <span className="text-xs text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                            Isto é o que o cliente vê
                        </span>
                    </div>

                    <InstallmentTracker
                        totalAmount={booking.total_amount}
                        paidAmount={booking.paid_amount}
                        depositValue={depositValue}
                        paymentPlan={booking.payment_plan}
                        payments={verifiedPayments}
                    />
                </div>
            )}

            {/* Pending Actions Panel */}
            {pendingPayments.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                        <h4 className="text-sm font-bold text-amber-900 uppercase tracking-wide">
                            Ações Pendentes
                        </h4>
                        <span className="text-xs font-bold bg-amber-500 text-white px-2 py-1 rounded-full animate-pulse">
                            {pendingPayments.length} PENDENTE{pendingPayments.length > 1 ? 'S' : ''}
                        </span>
                    </div>

                    <div className="space-y-3">
                        {pendingPayments.map((payment) => {
                            const daysPending = Math.floor(
                                (Date.now() - new Date(payment.created_at).getTime()) / (1000 * 60 * 60 * 24)
                            );
                            const isUrgent = daysPending > 2;

                            return (
                                <div
                                    key={payment.id}
                                    className={`
                                        bg-white p-4 rounded-xl border-2 transition-all
                                        ${isUrgent
                                            ? 'border-red-300 shadow-lg shadow-red-100'
                                            : 'border-amber-200'
                                        }
                                    `}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-lg font-bold text-slate-900">
                                                    {payment.amount.toFixed(2)}€
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                    · {payment.method}
                                                </span>
                                                {isUrgent && (
                                                    <span className="text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                                                        URGENTE
                                                    </span>
                                                )}
                                            </div>

                                            <div className="text-xs text-slate-600 space-y-1">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    <span>
                                                        Enviado há {daysPending} dia{daysPending !== 1 ? 's' : ''}
                                                        ({format(new Date(payment.created_at), 'dd MMM yyyy', { locale: pt })})
                                                    </span>
                                                </div>
                                                {payment.notes && (
                                                    <div className="text-slate-500 italic">
                                                        {payment.notes}
                                                    </div>
                                                )}
                                            </div>

                                            {payment.receipt_url && (
                                                <a
                                                    href={payment.receipt_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 mt-2"
                                                >
                                                    <FileText className="w-3 h-3" />
                                                    Ver Comprovativo
                                                </a>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            {onApprove && (
                                                <button
                                                    onClick={() => onApprove(payment.id)}
                                                    className="flex items-center gap-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg transition-colors"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    Aprovar
                                                </button>
                                            )}
                                            {onReject && (
                                                <button
                                                    onClick={() => onReject(payment.id)}
                                                    className="flex items-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                    Rejeitar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Admin Tools Panel */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-6">
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">
                    🔧 Ferramentas Admin
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {onSendReminder && (
                        <button
                            onClick={onSendReminder}
                            className="flex items-center gap-2 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-200 rounded-xl text-sm font-bold text-indigo-700 transition-all"
                        >
                            <Mail className="w-4 h-4" />
                            Enviar Lembrete
                        </button>
                    )}

                    <button
                        onClick={() => window.open(`/peregrinacoes/inscricao/${booking.id}`, '_blank')}
                        className="flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 transition-all"
                    >
                        <Eye className="w-4 h-4" />
                        Abrir Vista Cliente
                    </button>

                    <button
                        className="flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 transition-all"
                    >
                        <Download className="w-4 h-4" />
                        Exportar Relatório
                    </button>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-green-600 uppercase tracking-wide mb-1">
                        Total Pago
                    </p>
                    <p className="text-2xl font-bold text-green-700">
                        {booking.paid_amount.toFixed(2)}€
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                        {Math.round((booking.paid_amount / Number(booking.total_amount)) * 100)}% do total
                    </p>
                </div>

                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-1">
                        Em Dívida
                    </p>
                    <p className="text-2xl font-bold text-red-700">
                        {(booking.total_amount - booking.paid_amount).toFixed(2)}€
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                        {100 - Math.round((booking.paid_amount / Number(booking.total_amount)) * 100)}% restante
                    </p>
                </div>

                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-1">
                        Pagamentos
                    </p>
                    <p className="text-2xl font-bold text-indigo-700">
                        {verifiedPayments.length}
                    </p>
                    <p className="text-xs text-indigo-600 mt-1">
                        {pendingPayments.length} pendente{pendingPayments.length !== 1 ? 's' : ''}
                    </p>
                </div>
            </div>
        </div>
    );
}
