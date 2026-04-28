"use client";

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import SiteHeader from '../site/SiteHeader';
import SiteFooter from '../site/SiteFooter';
import { CurrencyProvider } from '../providers/CurrencyProvider';
import { AuthProvider } from '../../contexts/AuthContext';
import { AuctionWinnerBanner } from '../auction/AuctionWinnerBanner';
import { LocaleProvider } from '../../contexts/LocaleContext';
import type { LocaleCode } from '../../i18n';
import AuthLandingGuard from '../auth/AuthLandingGuard';
import PublicAnalytics from '../analytics/PublicAnalytics';
import CookieConsentBanner from '../privacy/CookieConsentBanner';

export default function ClientLayout({
    children,
    locale,
}: {
    children: ReactNode;
    locale?: LocaleCode;
}) {
    const pathname = usePathname();
    const resolvedLocale: LocaleCode = locale ?? (pathname?.startsWith('/en') ? 'en' : 'pt');
    const isAdmin = pathname?.startsWith('/admin');
    const isEmbed = pathname?.startsWith('/embed');
    const hideHeader = isAdmin || isEmbed;
    const hideFooter = isAdmin || isEmbed;

    return (
        <LocaleProvider locale={resolvedLocale}>
            <AuthProvider>
                <AuthLandingGuard />
                <PublicAnalytics />
                <CurrencyProvider>
                    {!hideHeader && <SiteHeader />}
                    {!hideHeader && <AuctionWinnerBanner />}
                    {children}
                    {!hideFooter && <SiteFooter />}
                    {!isAdmin && !isEmbed && <CookieConsentBanner />}
                </CurrencyProvider>
            </AuthProvider>
        </LocaleProvider>
    );
}
