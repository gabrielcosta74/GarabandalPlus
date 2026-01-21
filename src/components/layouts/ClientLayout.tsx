"use client";

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import SiteHeader from '../site/SiteHeader';
import SiteFooter from '../site/SiteFooter';
import { CurrencyProvider } from '../providers/CurrencyProvider';
import { AuthProvider } from '../../contexts/AuthContext';

export default function ClientLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const isAdmin = pathname?.startsWith('/admin');
    const hideHeader = isAdmin;

    return (
        <AuthProvider>
            <CurrencyProvider>
                {!hideHeader && <SiteHeader />}
                {children}
                {!isAdmin && <SiteFooter />}
            </CurrencyProvider>
        </AuthProvider>
    );
}
