"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import DonationHero from '../../components/donations/DonationHero';
import DonationStory from '../../components/donations/DonationStory';
import DonationAllocation from '../../components/donations/DonationAllocation';
import DonationFAQ from '../../components/donations/DonationFAQ';
import DonationModal from '../../components/donations/DonationModal';
import DonationVideo from '../../components/donations/DonationVideo';
import AuctionSection from '../../components/donations/AuctionSection';
import MobileDonationCTA from '../../components/donations/MobileDonationCTA';
import { useLocale } from '../../contexts/LocaleContext';
import { captureAnalyticsEvent } from '../../lib/analytics';

type ProgressMeta = {
    goal: number;
    raised: number;
};

type ReduniqResult = {
    success: boolean;
    resultCode?: string | null;
    resultMessage?: string | null;
    transactionStatus?: string | null;
    statusLabel?: string | null;
    transactionId?: string | null;
    paymentSolution?: string | null;
    paymentAmount?: string | null;
    extraData?: Array<{ name?: string; value?: string }>;
};

export default function DonationsClient() {
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const [progress, setProgress] = useState<ProgressMeta>({ goal: 2500, raised: 0 });
    const [modalOpen, setModalOpen] = useState(false);
    const [reduniqResult, setReduniqResult] = useState<ReduniqResult | null>(null);
    const [reduniqError, setReduniqError] = useState<string | null>(null);
    const [reduniqLoading, setReduniqLoading] = useState(false);
    const [showReduniqBanner, setShowReduniqBanner] = useState(true);
    const lastConfirmKeyRef = useRef<string | null>(null);
    const handledDonationLinkRef = useRef(false);
    const searchParams = useSearchParams();

    const reduniqParams = useMemo(() => {
        const provider = searchParams.get('provider');
        const token = searchParams.get('token');
        const canceled = searchParams.get('canceled');
        const orderRef = searchParams.get('orderRef');
        return { provider, token, canceled, orderRef };
    }, [searchParams]);

    const loadProgress = useCallback(async () => {
        try {
            const res = await fetch('/api/donations/meta', { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            setProgress({ goal: Number(data.goal || 0), raised: Number(data.raised || 0) });
        } catch {
            setProgress((prev) => prev);
        }
    }, []);

    useEffect(() => {
        loadProgress();
    }, [loadProgress]);

    useEffect(() => {
        if (handledDonationLinkRef.current || searchParams.get('donate') !== '1') return;
        handledDonationLinkRef.current = true;
        setModalOpen(true);
        captureAnalyticsEvent('donation_modal_opened_from_link', {
            locale,
            source: searchParams.get('source') || 'direct-link',
        });
    }, [locale, searchParams]);

    useEffect(() => {
        const loadReduniqResult = async () => {
            if (reduniqParams.provider !== 'reduniq') return;
            if (!showReduniqBanner) return;

            if (!reduniqParams.token && !reduniqParams.orderRef) {
                if (reduniqParams.canceled) {
                    setReduniqError('Pagamento cancelado ou não concluído.');
                }
                return;
            }

            setReduniqLoading(true);
            setReduniqError(null);

            try {
                const confirmKey = `${reduniqParams.orderRef || ''}|${reduniqParams.token || ''}`;
                if (lastConfirmKeyRef.current === confirmKey) return;
                lastConfirmKeyRef.current = confirmKey;

                const res = await fetch('/api/reduniq/confirm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...(reduniqParams.token ? { token: reduniqParams.token } : {}),
                        ...(reduniqParams.orderRef ? { orderRef: reduniqParams.orderRef } : {}),
                    }),
                });
                const data = await res.json();
                if (!res.ok || !data?.success) {
                    throw new Error(data?.message || 'Erro ao validar pagamento com a Reduniq.');
                }
                setReduniqResult(data);
                if (String(data?.transactionStatus || '') === '4') {
                    captureAnalyticsEvent('donation_completed', {
                        amount: data?.paymentAmount ? Number(data.paymentAmount) : null,
                        payment_provider: 'reduniq',
                        locale,
                    });
                    await loadProgress();
                }
            } catch (error: any) {
                setReduniqError(error?.message || 'Erro ao validar pagamento com a Reduniq.');
            } finally {
                setReduniqLoading(false);
            }
        };

        loadReduniqResult();
    }, [reduniqParams, showReduniqBanner, loadProgress]);

    const bannerState = useMemo(() => {
        if (!showReduniqBanner || reduniqParams.provider !== 'reduniq') return null;
        if (reduniqLoading) return { type: 'info', title: isEn ? 'Checking payment...' : 'A verificar pagamento...', message: isEn ? 'We are checking the payment status with Reduniq.' : 'Estamos a consultar o estado do pagamento na Reduniq.' };
        if (reduniqError) return { type: 'error', title: isEn ? 'Payment not confirmed' : 'Pagamento não confirmado', message: reduniqError };
        if (!reduniqResult) return null;

        const status = reduniqResult.transactionStatus || '';
        const isSuccess = status === '4';
        if (isSuccess) {
            return {
                type: 'success',
                title: isEn ? 'Payment confirmed' : 'Pagamento confirmado',
                message: isEn ? 'The payment was confirmed by Reduniq.' : 'O pagamento foi confirmado pela Reduniq.'
            };
        }

            const isPending = status === '0' || status === '1' || status === '2';
        if (isPending) {
            const messageParts = [];
            if (reduniqResult.resultMessage) messageParts.push(reduniqResult.resultMessage);
            if (reduniqResult.statusLabel) messageParts.push(`${isEn ? 'Status' : 'Estado'}: ${reduniqResult.statusLabel}`);
            if (!messageParts.length) messageParts.push(isEn ? 'Payment is being processed.' : 'Pagamento em processamento.');
            return {
                type: 'info',
                title: isEn ? 'Payment processing' : 'Pagamento em processamento',
                message: messageParts.join(' • ')
            };
        }

        const messageParts = [];
        if (reduniqResult.resultMessage) messageParts.push(reduniqResult.resultMessage);
        if (reduniqResult.statusLabel) messageParts.push(`${isEn ? 'Status' : 'Estado'}: ${reduniqResult.statusLabel}`);
        if (!messageParts.length) messageParts.push(isEn ? 'Payment not confirmed.' : 'Pagamento não confirmado.');

        return {
            type: 'error',
            title: isEn ? 'Payment not confirmed' : 'Pagamento não confirmado',
            message: messageParts.join(' • ')
        };
    }, [isEn, reduniqLoading, reduniqError, reduniqResult, reduniqParams.provider, showReduniqBanner]);

    return (
        <main className="bg-white min-h-screen">
            {bannerState && (
                <section className="pt-6">
                    <div className="container mx-auto px-6">
                        <div className={`rounded-2xl border p-4 flex flex-col gap-2 shadow-sm ${bannerState.type === 'success'
                            ? 'border-green-200 bg-green-50 text-green-900'
                            : bannerState.type === 'info'
                                ? 'border-blue-200 bg-blue-50 text-blue-900'
                                : 'border-red-200 bg-red-50 text-red-900'
                            }`}>
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="font-bold">{bannerState.title}</div>
                                    <div className="text-sm opacity-80">{bannerState.message}</div>
                                </div>
                                <button
                                    onClick={() => setShowReduniqBanner(false)}
                                    className="text-xs font-semibold uppercase tracking-wide opacity-70 hover:opacity-100"
                                >
                                    {isEn ? 'Close' : 'Fechar'}
                                </button>
                            </div>
                            {reduniqResult && (
                                <div className="text-xs opacity-80 flex flex-wrap gap-3">
                                    {reduniqParams.orderRef && <span>Ref: {reduniqParams.orderRef}</span>}
                                    {reduniqResult.resultCode && <span>Código: {reduniqResult.resultCode}</span>}
                                    {reduniqResult.transactionId && <span>Transação: {reduniqResult.transactionId}</span>}
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            )}
            <DonationHero progress={progress} onDonateClick={() => setModalOpen(true)} />
            <DonationVideo />
            <DonationStory />
            <DonationAllocation />
            <AuctionSection />
            <DonationFAQ />

            {/* Footer CTA */}
            <section className="py-16 md:py-24 bg-garabandal-dark text-white text-center">
                <div className="container mx-auto px-6">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif mb-6">{isEn ? 'Together we build the future' : 'Juntos construímos o futuro'}</h2>
                    <p className="text-gray-400 max-w-2xl mx-auto mb-10">
                        {isEn
                            ? 'Your generosity allows us to continue welcoming with love and dignity. Thank you for being part of this mission.'
                            : 'A tua generosidade permite-nos continuar a acolher com amor e dignidade. Obrigado por fazeres parte desta missão.'}
                    </p>
                    <button
                        onClick={() => setModalOpen(true)}
                        className="px-10 py-4 bg-garabandal-gold text-garabandal-dark font-bold rounded-full hover:scale-105 hover:shadow-[0_0_20px_rgba(234,179,8,0.4)] transition-all duration-300"
                    >
                        {isEn ? 'Make a Donation' : 'Fazer uma Doação'}
                    </button>
                </div>
            </section>

            <DonationModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
            <MobileDonationCTA onDonate={() => setModalOpen(true)} hidden={modalOpen} />
        </main>
    );
}
