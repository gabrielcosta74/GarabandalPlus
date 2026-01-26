import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
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

        // Access Control Logic
        const isQuotaPage = pathname === '/member/quota';

        if (!allowPublic && requireMember && !memberData?.is_membro) {
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

    const isOverdue = memberData?.estado_quota?.toLowerCase().includes('atras');
    const isQuotaPage = pathname === '/member/quota';

    return (
        <div className="min-h-screen bg-slate-950 pt-24">
            {isOverdue && !isQuotaPage && (
                <div className="bg-amber-600/90 backdrop-blur text-white px-4 py-3 mx-4 md:mx-8 rounded-xl flex items-center justify-between shadow-lg border border-amber-500/50 mb-6 animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-800/50 p-2 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-amber-200" />
                        </div>
                        <div>
                            <p className="font-bold text-sm md:text-base">Quota em Atraso</p>
                            <p className="text-xs md:text-sm text-amber-100/80">A tua subscrição expirou. Renova agora para evitar a perda de acesso.</p>
                        </div>
                    </div>
                    <Link
                        href="/member/quota"
                        className="whitespace-nowrap px-4 py-2 bg-white text-amber-900 font-bold text-sm rounded-lg hover:bg-amber-50 transition-colors shadow-sm"
                    >
                        Pagar Agora
                    </Link>
                </div>
            )}
            {children}
        </div>
    );
}
