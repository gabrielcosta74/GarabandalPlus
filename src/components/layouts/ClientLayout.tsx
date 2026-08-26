"use client";

import { ReactNode, useEffect } from 'react';
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
import { isFocusedRecoveryPath } from '../../lib/recovery-flow';

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
    const isFocusedRecovery = isFocusedRecoveryPath(pathname);
    const isEarlyAccessLanding = pathname === '/acesso-antecipado' || pathname?.startsWith('/acesso-antecipado/');
    const suppressSenderPopup = isFocusedRecovery || isEarlyAccessLanding;
    const hideHeader = isAdmin || isEmbed || isFocusedRecovery || isEarlyAccessLanding;
    const hideFooter = isAdmin || isEmbed || isFocusedRecovery || isEarlyAccessLanding;

    useEffect(() => {
        if (!suppressSenderPopup) return;

        const hiddenElements = new Set<HTMLElement>();
        const hideSenderPopup = () => {
            document
                .querySelectorAll<HTMLElement>('.sender-form-modal, .sender-modal-background, [class*="sender-subs-popup-form-"]')
                .forEach((element) => {
                    hiddenElements.add(element);
                    element.style.setProperty('display', 'none', 'important');
                    element.setAttribute('aria-hidden', 'true');
                });
        };

        hideSenderPopup();
        const observer = new MutationObserver(hideSenderPopup);
        observer.observe(document.body, { childList: true, subtree: true });
        return () => {
            observer.disconnect();
            hiddenElements.forEach((element) => {
                element.style.removeProperty('display');
                element.removeAttribute('aria-hidden');
            });
        };
    }, [suppressSenderPopup]);

    if (isFocusedRecovery) {
        return (
            <LocaleProvider locale={resolvedLocale}>
                <AuthLandingGuard />
                <PublicAnalytics />
                {children}
            </LocaleProvider>
        );
    }

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
                        {!isAdmin && !isEmbed && !isFocusedRecovery && <CookieConsentBanner />}
                        {!isAdmin && !isEmbed && !isFocusedRecovery && !isEarlyAccessLanding && <WhatsAppFloatingButton />}
                    </CurrencyProvider>
                </PilgrimagePaymentAlertsProvider>
            </AuthProvider>
        </LocaleProvider>
    );
}
