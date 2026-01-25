"use client";

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';

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

        if (!allowPublic && requireMember && !memberData?.is_membro) {
            if (memberData?.numero_socio) {
                router.replace('/member/quota');
            } else {
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

    return (
        <div className="min-h-screen bg-slate-950 pt-24">
            {children}
        </div>
    );
}
