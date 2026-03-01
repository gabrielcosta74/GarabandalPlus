"use client";

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import SiteHeader from '../site/SiteHeader';
import SiteFooter from '../site/SiteFooter';
import { CurrencyProvider } from '../providers/CurrencyProvider';
import { AuthProvider } from '../../contexts/AuthContext';
import { AuctionWinnerBanner } from '../auction/AuctionWinnerBanner';

export default function ClientLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const isAdmin = pathname?.startsWith('/admin');
    const isEmbed = pathname?.startsWith('/embed');
    const hideHeader = isAdmin || isEmbed;
    const hideFooter = isAdmin || isEmbed;

    return (
        <AuthProvider>
            <CurrencyProvider>
                {!hideHeader && <SiteHeader />}
                {!hideHeader && <AuctionWinnerBanner />}
                {children}
                {!hideFooter && <SiteFooter />}
            </CurrencyProvider>
        </AuthProvider>
    );
}
