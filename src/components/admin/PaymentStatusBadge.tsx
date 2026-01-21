"use client";

import { AlertCircle, Clock, CheckCircle, Bell } from 'lucide-react';

interface PaymentStatusBadgeProps {
    pendingReceipts: number;
    paymentStatus: 'paid' | 'partial' | 'pending' | 'overdue';
    bookingStatus: 'confirmed' | 'pending' | 'cancelled';
    daysPending?: number; // Days since oldest pending receipt
}

export default function PaymentStatusBadge({
    pendingReceipts,
    paymentStatus,
    bookingStatus,
    daysPending = 0
}: PaymentStatusBadgeProps) {
    const badges = [];

    // 1. CRITICAL: Pending Receipts (Highest Priority)
    if (pendingReceipts > 0) {
        const isUrgent = daysPending > 2; // >48h
        badges.push(
            <div
                key="pending-receipts"
                className={`
                    inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold
                    ${isUrgent
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-yellow-500 text-white'
                    }
                `}
                title={`${pendingReceipts} comprovativo${pendingReceipts > 1 ? 's' : ''} pendente${pendingReceipts > 1 ? 's' : ''} há ${daysPending} dias`}
            >
                <Bell className="w-3 h-3" />
                {pendingReceipts} PENDENTE{pendingReceipts > 1 ? 'S' : ''}
            </div>
        );
    }

    // 2. IMPORTANT: Payment Status
    if (paymentStatus === 'overdue') {
        badges.push(
            <div
                key="overdue"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-600 text-white"
                title="Prestação vencida"
            >
                <AlertCircle className="w-3 h-3" />
                VENCIDO
            </div>
        );
    } else if (paymentStatus === 'partial') {
        badges.push(
            <div
                key="partial"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-amber-500 text-white"
                title="Pagamento parcial"
            >
                <Clock className="w-3 h-3" />
                PARCIAL
            </div>
        );
    } else if (paymentStatus === 'pending') {
        badges.push(
            <div
                key="pending"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-slate-400 text-white"
                title="Aguarda pagamento"
            >
                <Clock className="w-3 h-3" />
                AGUARDA SINAL
            </div>
        );
    } else if (paymentStatus === 'paid') {
        badges.push(
            <div
                key="paid"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-green-500 text-white"
                title="Totalmente pago"
            >
                <CheckCircle className="w-3 h-3" />
                PAGO
            </div>
        );
    }

    // 3. INFORMATIVE: Booking Status
    if (bookingStatus === 'confirmed') {
        badges.push(
            <div
                key="confirmed"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-300"
                title="Reserva confirmada"
            >
                <CheckCircle className="w-3 h-3" />
                CONFIRMADO
            </div>
        );
    } else if (bookingStatus === 'pending') {
        badges.push(
            <div
                key="pending-booking"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300"
                title="Reserva pendente"
            >
                <Clock className="w-3 h-3" />
                PENDENTE
            </div>
        );
    } else if (bookingStatus === 'cancelled') {
        badges.push(
            <div
                key="cancelled"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-300"
                title="Reserva cancelada"
            >
                <AlertCircle className="w-3 h-3" />
                CANCELADO
            </div>
        );
    }

    return (
        <div className="flex flex-wrap gap-2">
            {badges}
        </div>
    );
}
