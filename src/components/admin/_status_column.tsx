// Helper function to insert Status column into BookingsManager
// This will be manually integrated

import PaymentStatusBadge from './PaymentStatusBadge';

type Booking = {
    verifying_payment?: boolean;
    created_at: string;
    total_amount: number;
    paid_amount: number;
    status: string;
};

export const statusColumn = {
    key: 'status',
    header: 'Status',
    render: (row: Booking) => {
        // Calculate pending receipts
        const pendingReceipts = row.verifying_payment ? 1 : 0;

        // Calculate days pending (if applicable)
        const daysPending = row.verifying_payment
            ? Math.floor((Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

        // Determine payment status
        const paidPercent = row.total_amount > 0 ? (row.paid_amount / row.total_amount) : 0;
        let paymentStatus: 'paid' | 'partial' | 'pending' | 'overdue' = 'pending';

        if (paidPercent >= 1) {
            paymentStatus = 'paid';
        } else if (paidPercent > 0) {
            paymentStatus = 'partial';
        } else {
            paymentStatus = 'pending';
        }

        return (
            <PaymentStatusBadge
                pendingReceipts={pendingReceipts}
                paymentStatus={paymentStatus}
                bookingStatus={row.status as 'confirmed' | 'pending' | 'cancelled'}
                daysPending={daysPending}
            />
        );
    }
};

// INSERT THIS COLUMN AFTER LINE 396 in BookingsManager.tsx
// Between the 'pilgrims' column and 'payment_progress' column
