"use client";

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import SiteHeaderSwitch from '../site/SiteHeaderSwitch';
import SiteFooter from '../site/SiteFooter';
import { CurrencyProvider } from '../providers/CurrencyProvider';
import { AuthProvider } from '../../contexts/AuthContext';
import { AuctionWinnerBanner } from '../auction/AuctionWinnerBanner';
import { LocaleProvider } from '../../contexts/LocaleContext';
import { isEnglishPathname } from '../../lib/locale-routing';
import type { LocaleCode } from '../../i18n';
import AuthLandingGuard from '../auth/AuthLandingGuard';
import PublicAnalytics from '../analytics/PublicAnalytics';
import CookieConsentBanner from '../privacy/CookieConsentBanner';
import WhatsAppFloatingButton from '../site/WhatsAppFloatingButton';
import { PilgrimagePaymentAlertsProvider } from '../../contexts/PilgrimagePaymentAlertsContext';
import PilgrimagePaymentAlerts from '../pilgrimage/PilgrimagePaymentAlerts';

export default function ClientLayout({
    children,
    locale,
    navV2Enabled = false,
}: {
    children: ReactNode;
    locale?: LocaleCode;
    navV2Enabled?: boolean;
}) {
    const pathname = usePathname();
    const resolvedLocale: LocaleCode = locale ?? (isEnglishPathname(pathname) ? 'en' : 'pt');
    const isAdmin = pathname?.startsWith('/admin');
    const isEmbed = pathname?.startsWith('/embed');
    const hideHeader = isAdmin || isEmbed;
    const hideFooter = isAdmin || isEmbed;

    return (
        <LocaleProvider locale={resolvedLocale}>
            <AuthProvider>
                <PilgrimagePaymentAlertsProvider>
                    <AuthLandingGuard />
                    <PublicAnalytics />
                    <CurrencyProvider>
                        {!hideHeader && <SiteHeaderSwitch navV2Enabled={navV2Enabled} />}
                        {!hideHeader && <PilgrimagePaymentAlerts />}
                        {!hideHeader && <AuctionWinnerBanner />}
                        {children}
                        {!hideFooter && <SiteFooter />}
                        {!isAdmin && !isEmbed && <CookieConsentBanner />}
                        {!isAdmin && !isEmbed && <WhatsAppFloatingButton />}
                    </CurrencyProvider>
                </PilgrimagePaymentAlertsProvider>
            </AuthProvider>
        </LocaleProvider>
    );
}
