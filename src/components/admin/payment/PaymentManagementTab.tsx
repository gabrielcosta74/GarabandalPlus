"use client";

import { useState } from 'react';
import { Plus, Download } from 'lucide-react';
import FinancialSummary from './FinancialSummary';
import PendingReceiptsAlert from './PendingReceiptsAlert';
import PaymentHistory, { type Payment } from './PaymentHistory';
import AddPaymentModal from './AddPaymentModal';
import InstallmentTracker from '../../booking/InstallmentTracker';

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

    // Handle validate receipt
    const handleValidate = async (paymentId: string, amount: number) => {
        try {
            const response = await fetch('/api/admin/payments/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    paymentId,
                    bookingId: booking.id
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Erro ao validar');
            }

            // Refresh booking data
            await onUpdate();
        } catch (err: any) {
            alert('Erro ao validar: ' + err.message);
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
        if (!confirm('Tem a certeza que deseja eliminar este pagamento?')) return;

        try {
            // TODO: Implement delete API
            alert('Funcionalidade de eliminar ainda não implementada');
        } catch (err: any) {
            alert('Erro ao eliminar: ' + err.message);
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

            {/* Installment Tracker - Same as client view */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">
                    📈 Plano de Pagamentos
                </h3>
                <InstallmentTracker
                    totalAmount={booking.total_amount}
                    paidAmount={booking.paid_amount}
                    depositValue={booking.pilgrimage.deposit_value}
                    paymentPlan={booking.payment_plan}
                    payments={booking.payments}
                />
            </div>

            {/* Pending Receipts Alert */}
            {pendingReceipts.length > 0 && (
                <PendingReceiptsAlert
                    receipts={pendingReceipts}
                    onValidate={handleValidate}
                    onReject={handleReject}
                />
            )}

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
        </div>
    );
}
