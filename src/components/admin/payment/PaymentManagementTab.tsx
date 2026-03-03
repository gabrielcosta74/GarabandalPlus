"use client";

import { useState } from 'react';
import { Plus, Download, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import FinancialSummary from './FinancialSummary';
import PendingReceiptsAlert from './PendingReceiptsAlert';
import PaymentHistory, { type Payment } from './PaymentHistory';
import AddPaymentModal from './AddPaymentModal';
import ValidateReceiptModal from './ValidateReceiptModal';
import InstallmentTracker from '../../booking/InstallmentTracker';
import { supabaseBrowser } from '../../../lib/supabase-browser';

interface PaymentManagementTabProps {
    booking: {
        id: string;
        total_amount: number;
        paid_amount: number;
        payment_plan: any[];
        payments: Payment[];
        pilgrimage: {
            deposit_value: number;
        };
        pilgrims?: any[];
    };
    onUpdate: () => Promise<void>;
}

export default function PaymentManagementTab({
    booking,
    onUpdate
}: PaymentManagementTabProps) {
    const [showAddModal, setShowAddModal] = useState(false);

    // Calculate status
    const getStatus = (): 'pending' | 'partial' | 'paid' => {
        if (booking.paid_amount >= booking.total_amount) return 'paid';
        if (booking.paid_amount > 0) return 'partial';
        return 'pending';
    };

    // Filter pending receipts
    const pendingReceipts = booking.payments.filter(
        (p) => p.status === 'verifying' || p.status === 'pending_verification'
    ).map(p => ({
        id: p.id,
        amount: p.amount,
        created_at: p.created_at,
        receipt_url: p.receipt_url
    }));

    // State for validating receipt
    const [validatingReceipt, setValidatingReceipt] = useState<{ id: string; receipt_url?: string } | null>(null);

    // Handle validate receipt - open modal for amount entry
    const handleValidate = (paymentId: string, suggestedAmount: number, receipt_url?: string) => {
        setValidatingReceipt({ id: paymentId, receipt_url });
    };

    // Actually validate after admin enters amount
    // Actually validate after admin enters amount
    // Actually validate after admin enters amount
    const handleConfirmValidation = async (paymentId: string, amount: number, label?: string) => {
        console.log('🚀 [Validation] Starting validation...');
        const loadingId = toast.loading('A validar pagamento...');
        try {
            console.log('🚀 [Validation] Getting session...');

            if (!supabaseBrowser) {
                throw new Error('Cliente Supabase não inicializado.');
            }

            const { data: { session }, error: sessionError } = await supabaseBrowser.auth.getSession();

            if (sessionError) console.error('🚀 [Validation] Session error:', sessionError);
            console.log('🚀 [Validation] Session found:', !!session);

            const token = session?.access_token;

            if (!token) {
                throw new Error('Sessão expirada. Por favor faça login novamente.');
            }

            console.log('🚀 [Validation] Sending API request...');
            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), 15000);

            let response: Response | null = null;
            try {
                response = await fetch('/api/admin/payments/verify', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        paymentId,
                        bookingId: booking.id,
                        amount,
                        label
                    }),
                    signal: controller.signal
                });
            } finally {
                window.clearTimeout(timeoutId);
            }

            if (!response) {
                throw new Error('Falha ao contactar o servidor.');
            }

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Erro ao validar');
            }

            setValidatingReceipt(null);
            toast.dismiss(loadingId);
            toast.success('Pagamento validado com sucesso!');

            void onUpdate().catch((updateErr: any) => {
                console.error(updateErr);
                toast.error('Pagamento validado, mas falhou a atualização da lista.');
            });
        } catch (err: any) {
            console.error(err);
            toast.dismiss(loadingId);
            const message = err?.name === 'AbortError'
                ? 'Tempo esgotado ao validar o pagamento.'
                : 'Erro ao validar: ' + err.message;
            toast.error(message);
        }
    };

    // Handle reject receipt
    const handleReject = async (paymentId: string) => {
        if (!confirm('Tem a certeza que deseja rejeitar este comprovativo?')) return;

        try {
            // TODO: Implement reject API
            alert('Funcionalidade de rejeitar ainda não implementada');
        } catch (err: any) {
            alert('Erro ao rejeitar: ' + err.message);
        }
    };

    // Handle edit payment
    const handleEdit = (paymentId: string) => {
        // TODO: Implement edit modal
        alert('Funcionalidade de editar ainda não implementada na Fase 2. Será adicionada na Fase 4.');
    };

    // Handle delete payment
    const handleDelete = async (paymentId: string) => {
        if (!confirm('Tem a certeza que deseja eliminar este pagamento? O valor em dívida será recalculado e a reserva pode voltar ao estado pendente.')) return;

        const loadingId = toast.loading('A eliminar pagamento...');
        try {
            if (!supabaseBrowser) throw new Error('Cliente Supabase não inicializado.');

            const { data: { session } } = await supabaseBrowser.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                throw new Error('Sessão expirada. Por favor faça login novamente.');
            }

            const res = await fetch(`/api/admin/payments/${paymentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Erro ao remover pagamento');
            }

            toast.dismiss(loadingId);
            toast.success('Pagamento eliminado com sucesso!');

            await onUpdate();
        } catch (err: any) {
            toast.dismiss(loadingId);
            toast.error('Erro ao eliminar: ' + err.message);
        }
    };

    return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
            {/* Financial Summary */}
            <FinancialSummary
                totalAmount={booking.total_amount}
                paidAmount={booking.paid_amount}
                status={getStatus()}
            />

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">
                    📈 Plano de Pagamentos
                </h3>
                <InstallmentTracker
                    totalAmount={booking.total_amount}
                    paidAmount={booking.paid_amount}
                    depositValue={
                        (booking.pilgrims || []).length > 0
                            ? booking.pilgrims!.reduce((acc: number, p: any) => {
                                const age = p.birth_date ? (new Date().getFullYear() - new Date(p.birth_date).getFullYear()) : 30;
                                const isInfant = age <= 2 && p.birth_date;
                                return acc + (isInfant ? 0 : (booking.pilgrimage.deposit_value || 0));
                            }, 0)
                            : (booking.pilgrimage.deposit_value || 0) * (booking.pilgrims?.length || 1)
                    }
                    paymentPlan={booking.payment_plan}
                    payments={booking.payments}
                />
            </div>

            {/* Pending Receipts Alert (receipt uploaded, awaiting validation) */}
            {pendingReceipts.length > 0 && (
                <PendingReceiptsAlert
                    receipts={pendingReceipts}
                    onValidate={handleValidate}
                    onReject={handleReject}
                />
            )}

            {/* Bank Transfer No-Receipt Warning */}
            {(() => {
                const pendingBankTransfers = booking.payments.filter(
                    p => p.method === 'bank_transfer' && p.status === 'pending' && !p.receipt_url
                );
                if (pendingBankTransfers.length === 0) return null;
                return (
                    <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-5">
                        <div className="flex items-start gap-3 mb-4">
                            <div className="w-9 h-9 bg-orange-200 rounded-full flex items-center justify-center shrink-0">
                                <Landmark className="w-4 h-4 text-orange-700" />
                            </div>
                            <div>
                                <h4 className="font-bold text-orange-900 text-sm">
                                    {pendingBankTransfers.length} Transferência{pendingBankTransfers.length > 1 ? 's' : ''} Bancária{pendingBankTransfers.length > 1 ? 's' : ''} Pendente{pendingBankTransfers.length > 1 ? 's' : ''} sem Comprovativo
                                </h4>
                                <p className="text-sm text-orange-700 mt-0.5">
                                    O peregrino declarou transferência bancária mas não enviou comprovativo. Se o dinheiro já entrou na conta, clique em <strong>Validar</strong>.
                                </p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {pendingBankTransfers.map(p => (
                                <div key={p.id} className="bg-white rounded-xl border border-orange-100 px-4 py-3 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="font-bold text-slate-900 text-sm">{(p.amount || 0).toFixed(2)}€</p>
                                        <p className="text-xs text-slate-400">Registada em {p.created_at ? new Date(p.created_at).toLocaleDateString('pt-PT') : '—'}</p>
                                    </div>
                                    <button
                                        onClick={() => handleValidate(p.id, p.amount || 0, p.receipt_url)}
                                        className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-2 rounded-lg transition-colors"
                                    >
                                        ✓ Validar
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* Payment Actions */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center gap-2 shadow-lg hover:shadow-xl"
                >
                    <Plus className="w-5 h-5" />
                    Registar Pagamento Manual
                </button>

                <button
                    onClick={() => alert('Export ainda não implementado')}
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors flex items-center gap-2"
                >
                    <Download className="w-5 h-5" />
                    Exportar Histórico
                </button>
            </div>

            {/* Payment History */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">
                    📜 Histórico de Pagamentos ({booking.payments.length})
                </h3>
                <PaymentHistory
                    payments={booking.payments}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            </div>

            {/* Add Payment Modal */}
            {showAddModal && (
                <AddPaymentModal
                    bookingId={booking.id}
                    onClose={() => setShowAddModal(false)}
                    onSuccess={async () => {
                        setShowAddModal(false);
                        await onUpdate();
                    }}
                />
            )}

            {validatingReceipt && (
                <ValidateReceiptModal
                    receipt={validatingReceipt}
                    onClose={() => setValidatingReceipt(null)}
                    onConfirm={handleConfirmValidation}
                />
            )}
        </div>
    );
}
