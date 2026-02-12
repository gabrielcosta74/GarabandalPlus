import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isActiveMember } from '../../lib/store-discounts';
import { QuotaWarning } from '../membership/QuotaWarning';

type VIPLayoutProps = {
    children: React.ReactNode;
    allowPublic?: boolean;
    requireMember?: boolean;
};

export default function VIPLayout({ children, allowPublic, requireMember = true }: VIPLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [ready, setReady] = useState(false);
    const { user, memberData, loading } = useAuth();

    useEffect(() => {
        if (allowPublic && !ready) {
            setReady(true);
        }

        if (loading) return;

        if (!user) {
            if (!allowPublic) {
                const next = pathname ? `?next=${encodeURIComponent(pathname)}` : '';
                router.replace(`/login${next}`);
            }
            return;
        }

        // Access Control Logic
        const isQuotaPage = pathname === '/member/quota';

        const isActive = isActiveMember(memberData);
        if (!allowPublic && requireMember && !isActive) {
            // If revoked/expired/suspended, allow access only to quota page to pay
            if (isQuotaPage) {
                if (!ready) setReady(true);
                return;
            }

            if (memberData?.numero_socio) {
                // Has been a member -> Redirect to Pay Quota
                router.replace('/member/quota');
            } else {
                // Never was a member -> Redirect to Signup
                router.replace('/tornar-membro');
            }
            return;
        }

        if (!ready) setReady(true);
    }, [allowPublic, loading, memberData, pathname, ready, router, user]);

    if (!ready) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-white">Carregando...</div>
            </div>
        );
    }

    const isActive = isActiveMember(memberData);
    const isOverdue = !isActive && !!memberData?.numero_socio;
    const isQuotaPage = pathname === '/member/quota';

    return (
        <div className="min-h-screen bg-slate-950 pt-24">
            <QuotaWarning memberData={memberData} className="mx-4 md:mx-8 mb-6" />
            {children}
        </div>
    );
}
