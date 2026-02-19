"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, X } from 'lucide-react';
import { isActiveMember } from '../../lib/store-discounts';
import { normalizeQuotaStatus } from '../../lib/membership-status';

type QuotaWarningProps = {
    memberData: any;
    className?: string;
};

export function QuotaWarning({ memberData, className = '' }: QuotaWarningProps) {
    const [dismissed, setDismissed] = useState(true); // Default to true to prevent flash
    const [isOverdue, setIsOverdue] = useState(false);

    useEffect(() => {
        // Calculate status
        const active = isActiveMember(memberData);
        const status = normalizeQuotaStatus(memberData?.estado_quota);
        const overdueByStatus = status === 'expirado' || status === 'revogado';
        const overdueByDate = !!memberData?.is_membro && status === 'pago' && !!memberData?.proxima_quota && !active;
        const overdue = overdueByStatus || overdueByDate;

        setIsOverdue(overdue);

        // Check dismissal status
        const isDismissed = sessionStorage.getItem('quota_warning_dismissed') === 'true';
        setDismissed(isDismissed);
    }, [memberData]);

    const handleDismiss = () => {
        sessionStorage.setItem('quota_warning_dismissed', 'true');
        setDismissed(true);
    };

    if (!isOverdue || dismissed) return null;

    return (
        <div className={`bg-amber-600/90 backdrop-blur text-white px-4 py-3 rounded-xl flex items-center justify-between shadow-lg border border-amber-500/50 animate-in slide-in-from-top-4 ${className}`}>
            <div className="flex items-center gap-3">
                <div className="bg-amber-800/50 p-2 rounded-lg shrink-0">
                    <AlertTriangle className="w-5 h-5 text-amber-200" />
                </div>
                <div>
                    <p className="font-bold text-sm md:text-base leading-tight">Quota em Atraso</p>
                    <p className="text-xs md:text-sm text-amber-100/80 leading-tight mt-0.5">
                        A tua subscrição expirou. Renova agora para evitar a perda de acesso.
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-3 pl-3">
                <Link
                    href="/member/quota"
                    className="whitespace-nowrap px-4 py-1.5 bg-white !text-black font-bold text-xs md:text-sm rounded-lg hover:bg-amber-50 transition-colors shadow-sm border border-amber-100"
                >
                    Pagar
                </Link>
                <button
                    onClick={handleDismiss}
                    className="p-1 hover:bg-amber-700/50 rounded-lg transition-colors text-amber-200 hover:text-white"
                    aria-label="Fechar aviso"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
