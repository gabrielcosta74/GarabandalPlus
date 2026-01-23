"use client";

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../lib/supabase-browser';

type VIPLayoutProps = {
    children: React.ReactNode;
    allowPublic?: boolean;
};

export default function VIPLayout({ children, allowPublic }: VIPLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let mounted = true;

        if (allowPublic) {
            setReady(true);
        }

        const checkSession = async () => {
            try {
                if (!supabaseBrowser) return;

                const { data } = await supabaseBrowser.auth.getSession();

                if (!mounted) return;

                if (!data?.session?.user) {
                    if (!allowPublic) {
                        const next = pathname ? `?next=${encodeURIComponent(pathname)}` : '';
                        router.replace(`/login${next}`);
                    }
                    return;
                }

                const { data: member } = await supabaseBrowser
                    .from('membros')
                    .select('is_membro, numero_socio')
                    .eq('id', data.session.user.id)
                    .maybeSingle();

                if (!mounted) return;

                if (!member?.is_membro && !allowPublic) {
                    // Smart Redirection:
                    // If they have a member number (suspended/expired), go to Quota Renewal
                    // If they don't (new lead), go to Sales Page
                    if (member?.numero_socio) {
                        router.replace('/member/quota');
                    } else {
                        router.replace('/tornar-membro');
                    }
                    return;
                }

                if (!ready) setReady(true);
            } catch (err) {
                console.warn("Session check issues:", err);
                if (mounted && !allowPublic) {
                    router.replace('/login');
                }
            }
        };

        checkSession();
        return () => { mounted = false; };
    }, [router, pathname, allowPublic]);

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
