"use client";

import { useState } from 'react';
import { FileText, Check, Clock, MoreVertical, Eye, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

export interface Payment {
    id: string;
    amount: number;
    method: string;
    status: string;
    receipt_url?: string;
    notes?: string;
    created_at: string;
    verified_at?: string;
}

interface PaymentHistoryProps {
    payments: Payment[];
    onEdit?: (id: string) => void;
    onDelete?: (id: string) => void;
}

export default function PaymentHistory({
    payments,
    onEdit,
    onDelete
}: PaymentHistoryProps) {
    const [filter, setFilter] = useState<'all' | 'verified' | 'pending'>('all');
    const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'amount'>('recent');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-PT', {
            style: 'currency',
            currency: 'EUR'
        }).format(value);
    };

    const getMethodLabel = (method: string) => {
        const labels: Record<string, string> = {
            bank_transfer: 'Transferência Bancária',
            mbway: 'MB WAY',
            multibanco: 'Multibanco',
            card: 'Cartão',
            cash: 'Dinheiro',
            cheque: 'Cheque',
            pix: 'PIX'
        };
        return labels[method] || method;
    };

    const getStatusBadge = (status: string) => {
        const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
            verified: {
                label: 'Verificado',
                className: 'bg-green-100 text-green-700 border-green-300',
                icon: <Check className="w-3 h-3" />
            },
            succeeded: {
                label: 'Verificado',
                className: 'bg-green-100 text-green-700 border-green-300',
                icon: <Check className="w-3 h-3" />
            },
            verifying: {
                label: 'Pendente',
                className: 'bg-amber-100 text-amber-700 border-amber-300',
                icon: <Clock className="w-3 h-3" />
            },
            pending_verification: {
                label: 'Pendente',
                className: 'bg-amber-100 text-amber-700 border-amber-300',
                icon: <Clock className="w-3 h-3" />
            }
        };

        const statusLower = status.toLowerCase();
        const { label, className, icon } = config[statusLower] || {
            label: status,
            className: 'bg-slate-100 text-slate-700 border-slate-300',
            icon: null
        };

        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold border ${className}`}>
                {icon}
                {label}
            </span>
        );
    };

    // Apply filters and sorting
    const filteredPayments = payments
        .filter((p) => {
            if (filter === 'all') return true;
            if (filter === 'verified') {
                const status = p.status.toLowerCase();
                return status === 'verified' || status === 'succeeded';
            }
            if (filter === 'pending') {
                const status = p.status.toLowerCase();
                return status === 'verifying' || status === 'pending_verification';
            }
            return true;
        })
        .sort((a, b) => {
            if (sortBy === 'recent') {
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
            if (sortBy === 'oldest') {
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            }
            if (sortBy === 'amount') {
                return b.amount - a.amount;
            }
            return 0;
        });

    if (payments.length === 0) {
        return (
            <div className="text-center py-12 text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Nenhum pagamento registado</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-600">Filtro:</label>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as any)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="all">Todos ({payments.length})</option>
                        <option value="verified">Verificados</option>
                        <option value="pending">Pendentes</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-600">Ordenar:</label>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="recent">Mais recente</option>
                        <option value="oldest">Mais antigo</option>
                        <option value="amount">Maior valor</option>
                    </select>
                </div>
            </div>

            {/* Payment List */}
            <div className="space-y-3">
                {filteredPayments.map((payment) => (
                    <div
                        key={payment.id}
                        className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                    >
                        <div className="flex items-start justify-between gap-4">
                            {/* Left: Amount and Method */}
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <p className="text-xl font-bold text-slate-900">
                                        {formatCurrency(payment.amount)}
                                    </p>
                                    {getStatusBadge(payment.status)}
                                </div>
                                <p className="text-sm text-slate-600 mb-1">
                                    <span className="font-medium">{getMethodLabel(payment.method)}</span>
                                    {' · '}
                                    {format(new Date(payment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}
                                </p>
                                {payment.notes && (
                                    <p className="text-xs text-slate-500 italic mt-1">
                                        {payment.notes}
                                    </p>
                                )}
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-2">
                                {payment.receipt_url && (
                                    <a
                                        href={payment.receipt_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                                    >
                                        <Eye className="w-3 h-3" />
                                        Comprovativo
                                    </a>
                                )}

                                {(onEdit || onDelete) && (
                                    <div className="relative">
                                        <button
                                            onClick={() => setOpenMenuId(openMenuId === payment.id ? null : payment.id)}
                                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                        >
                                            <MoreVertical className="w-4 h-4 text-slate-600" />
                                        </button>

                                        {openMenuId === payment.id && (
                                            <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                                                {onEdit && (
                                                    <button
                                                        onClick={() => {
                                                            onEdit(payment.id);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                                                    >
                                                        <Edit2 className="w-3 h-3" />
                                                        Editar
                                                    </button>
                                                )}
                                                {onDelete && (
                                                    <button
                                                        onClick={() => {
                                                            onDelete(payment.id);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                        Eliminar
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
