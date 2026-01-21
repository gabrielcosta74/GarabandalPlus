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
        const checkSession = async () => {
            try {
                if (!supabaseBrowser) {
                    throw new Error("Supabase client not initialized");
                }

                // Race Promise: Auth check vs Timeout
                const sessionPromise = supabaseBrowser.auth.getSession();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Timeout")), 5000)
                );

                const { data } = await Promise.race([sessionPromise, timeoutPromise]) as any;

                if (!data.session?.user) {
                    if (allowPublic) {
                        setReady(true); // Public access allowed, just render content
                        return;
                    }
                    if (mounted) {
                        const next = pathname ? `?next=${encodeURIComponent(pathname)}` : '';
                        router.replace(`/login${next}`);
                    }
                    return;
                }

                const { data: member, error: memberError } = await supabaseBrowser
                    .from('membros')
                    .select('is_membro')
                    .eq('id', data.session.user.id)
                    .maybeSingle();

                if (!mounted) return;

                if (memberError) console.error("Member fetch error:", memberError);

                if (!member?.is_membro) {
                    if (!allowPublic) {
                        router.replace('/tornar-membro');
                        return;
                    }
                }

                setReady(true);
            } catch (err) {
                console.error("Session check error:", err);
                if (mounted) {
                    if (allowPublic) {
                        setReady(true);
                    } else {
                        router.replace('/login');
                    }
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
