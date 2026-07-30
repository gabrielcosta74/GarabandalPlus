"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import VIPLayout from '../../../../components/member/VIPLayout';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import {
    CreditCard,
    // ... rest of imports
    Upload,
    CheckCircle2,
    Clock,
    AlertCircle,
    ChevronRight,
    Users,
    Check,
    Loader2,
    Package,
    Landmark,
    X,
    QrCode,
    ShieldCheck,
    UserRound,
    Bus,
} from 'lucide-react';
import { format } from 'date-fns';
import { enUS, pt } from 'date-fns/locale';
import BookingOnboardingModal from '../../../../components/booking/BookingOnboardingModal';
import BankTransferModal from '../../../../components/booking/BankTransferModal'; // Imported BankTransferModal
import BillingDetailsModal from '../../../../components/booking/BillingDetailsModal';
import PaymentConfirmationModal, {
    type PaymentConfirmationFiscalDocument,
} from '../../../../components/booking/PaymentConfirmationModal';
import CustomPaymentAmount, { buildPaymentPreview } from '../../../../components/booking/CustomPaymentAmount';
import { UNIFIED_ONLINE_PAYMENT_OPTIONS } from '../../../../lib/payment-options';
import {
    BANK_TRANSFER_SITE_CONTENT_KEY,
    DEFAULT_BANK_TRANSFER_DETAILS,
    normalizeBankTransferDetails,
} from '../../../../lib/bank-transfer-details';
import { calculatePilgrimageReduniqCharge } from '../../../../lib/pilgrimage-reduniq-fees';
import { useLocale } from '../../../../contexts/LocaleContext';
import { useCurrency } from '../../../../components/providers/CurrencyProvider';
import PaymentCurrencyDisplay, {
    LocalizedPilgrimageAmount,
} from '../../../../components/pilgrimage/PaymentCurrencyDisplay';
import type { FiscalBillingDetails } from '../../../../lib/fiscal-billing';

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

type Booking = {
    id: string;
    total_amount: number;
    paid_amount: number;
    status: string;
    created_at: string;
    notes: string;
    pilgrims: any[];
    pilgrimage: {
        title: string;
        start_date: string;
        end_date: string;
        cover_image: string;
        deposit_value: number;
        base_price?: number;
        pricing_config?: any;
    };
    payments: BookingPayment[];
    payment_plan?: { date: string; amount: number }[];
    billing_profile?: FiscalBillingDetails | null;
};

type BookingPayment = {
    id: string;
    amount: number;
    processing_fee_amount?: number | null;
    charged_amount?: number | null;
    status: string;
    method: string;
    external_reference?: string | null;
    factpt_document?: PaymentConfirmationFiscalDocument;
    [key: string]: unknown;
};

type PilgrimPass = {
    id: string;
    status: 'active' | 'revoked';
    issued_at: string;
    pilgrim: {
        id: string;
        full_name: string;
        email?: string | null;
        phone?: string | null;
        room_type?: string | null;
        flight_option?: string | null;
    };
    qrSvg: string;
    qrPayload: string;
};

type PaymentOption = {
    id: string;
    label: string;
    description: string;
    provider: 'reduniq';
    iconSrc?: string;
    iconAlt?: string;
};

const paymentOptions: PaymentOption[] = UNIFIED_ONLINE_PAYMENT_OPTIONS
    .filter((option) => option.provider === 'reduniq')
    .map((option) => ({
        id: option.id,
        label: option.label,
        description: option.description,
        provider: 'reduniq',
        iconSrc: option.iconSrc,
        iconAlt: option.iconAlt,
    }));

const findConfirmedPayment = (
    booking: Booking | null,
    orderReference: string | null,
): BookingPayment | null => {
    const payments = booking?.payments || [];
    if (orderReference) {
        const exact = payments.find(
            (payment) => payment.external_reference === orderReference,
        );
        if (exact) return exact;
    }

    return payments.find(
        (payment) =>
            String(payment.method || '').startsWith('reduniq')
            && ['verified', 'succeeded', 'paid'].includes(
                String(payment.status || '').toLowerCase(),
            ),
    ) || null;
};

const getBookingApiUrl = (bookingId: string, provider: string): string => {
    const token = resolveBookingViewToken(provider);

    return token
        ? `/api/booking/${bookingId}?token=${encodeURIComponent(token)}`
        : `/api/booking/${bookingId}`;
};

const resolveBookingViewToken = (provider: string): string | null => {
    const urlParams = new URLSearchParams(window.location.search);
    const directViewToken = urlParams.get('viewToken');
    const tokenValues = urlParams.getAll('token');
    const legacyViewTokenFromDuplicate =
        provider === 'reduniq'
        && !directViewToken
        && tokenValues.length > 1
            ? tokenValues[0]
            : null;
    const legacyToken = provider === 'reduniq'
        ? legacyViewTokenFromDuplicate
        : (tokenValues[0] || null);
    const token = directViewToken || legacyToken;

    return token;
};

/* -------------------------------------------------------------------------- */
/*                                  Component                                 */
/* -------------------------------------------------------------------------- */

export default function BookingDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const { locale } = useLocale();
    const { formatEUR } = useCurrency();
    const id = params.id as string;
    const isEn = locale === 'en';
    const dateLocale = isEn ? enUS : pt;
    const loginPath = isEn ? '/en/login' : '/login';
    const homePath = isEn ? '/en' : '/';
    const registrationsPath = isEn ? '/en/my-registrations' : '/peregrinacoes/minhas-inscricoes';

    const [processing, setProcessing] = useState(false);
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const isSuccess = searchParams?.get('success') === 'true';
    const providerParam = (searchParams?.get('provider') || '').toLowerCase();
    const orderRefParam = searchParams?.get('orderRef') || null;
    const reduniqTokenParam = searchParams?.getAll('token')?.at(-1) || null;
    const statusParam = (searchParams?.get('status') || '').toLowerCase();
    const canceledParam = (searchParams?.get('canceled') || '').toLowerCase();
    const sessionId = searchParams?.get('session_id');
    const [selectedPaymentId, setSelectedPaymentId] = useState(paymentOptions[0].id);
    // Which method the pay button acts on. Purely presentational — both branches
    // call the exact same handlers as before.
    const [payMethod, setPayMethod] = useState<'card' | 'transfer'>('card');
    const [reduniqConfirming, setReduniqConfirming] = useState(false);
    const [reduniqHandledKey, setReduniqHandledKey] = useState<string | null>(null);
    const [showPaymentConfirmation, setShowPaymentConfirmation] = useState(false);
    const [confirmedPayment, setConfirmedPayment] = useState<BookingPayment | null>(null);
    const REDUNIQ_CONFIRM_MAX_ATTEMPTS = 8;
    const REDUNIQ_CONFIRM_RETRY_MS = 2500;
    const [reduniqFeedback, setReduniqFeedback] = useState<{
        kind: 'success' | 'info' | 'error';
        title: string;
        message: string;
    } | null>(null);

    useEffect(() => {
        const verifyPayment = async () => {
            if (providerParam === 'reduniq') return;
            if (isSuccess && sessionId) {
                setProcessing(true); // Show spinner or loading state
                try {
                    // Call backend to force sync with Stripe (in case webhook failed)
                    await fetch(`/api/pilgrimages/verify-payment?session_id=${sessionId}`);

                    // Allow DB to propagate (minor delay often helps)
                    await new Promise(r => setTimeout(r, 1000));

                    // Reload page logic or re-fetch
                    window.location.href = window.location.pathname; // Clean URL? Or just fetchBooking.
                    // Actually, let's just re-fetch in the existing effect by toggling a trigger?
                    // Better: hard reload to clean URL params and show fresh state
                    router.replace(window.location.pathname);
                } catch (e) {
                    console.error("Verification failed", e);
                } finally {
                    setProcessing(false);
                }
            }
        };

        verifyPayment();
    }, [isSuccess, sessionId, router, providerParam]);

    useEffect(() => {
        if (providerParam !== 'reduniq') return;

        const key = `${orderRefParam || ''}|${reduniqTokenParam || ''}|${statusParam || ''}|${canceledParam || ''}`;
        if (!key || reduniqHandledKey === key) return;
        setReduniqHandledKey(key);

        const hasFailureHint = statusParam === 'failed' || statusParam === 'error' || statusParam === 'canceled' || canceledParam === 'true';

        if (!orderRefParam && !reduniqTokenParam) {
            if (hasFailureHint) {
                setReduniqFeedback({
                    kind: 'error',
                    title: isEn ? 'Payment not completed' : 'Pagamento não concluído',
                    message: isEn ? 'The pilgrimage payment was canceled or refused.' : 'O pagamento da peregrinação foi cancelado ou recusado.',
                });
            }
            return;
        }

        const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

        const confirmPayment = async () => {
            setReduniqConfirming(true);
            setProcessing(true);
            try {
                let finalStatus = '';
                let finalMessage = '';
                let gotTerminalStatus = false;

                for (let attempt = 1; attempt <= REDUNIQ_CONFIRM_MAX_ATTEMPTS; attempt++) {
                    const res = await fetch('/api/reduniq/confirm', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ...(orderRefParam ? { orderRef: orderRefParam } : {}),
                            ...(reduniqTokenParam ? { token: reduniqTokenParam } : {}),
                        }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok || !data?.success) {
                        throw new Error(data?.message || (isEn ? 'Failed to confirm Reduniq payment.' : 'Falha ao confirmar pagamento Reduniq.'));
                    }

                    const txStatus = String(data?.transactionStatus || '');
                    finalStatus = txStatus;
                    finalMessage = String(data?.resultMessage || '');

                    if (txStatus === '4') {
                        if (data?.updated !== true) {
                            throw new Error(
                                isEn
                                    ? 'Reduniq confirmed the payment, but the booking has not been updated yet. Do not pay again; contact support.'
                                    : 'A Reduniq confirmou o pagamento, mas a reserva ainda não foi atualizada. Não pagues novamente; contacta o suporte.',
                            );
                        }
                        gotTerminalStatus = true;
                        setReduniqFeedback({
                            kind: 'success',
                            title: isEn ? 'Payment confirmed' : 'Pagamento confirmado',
                            message: isEn ? 'We received your payment. The booking has been updated.' : 'Recebemos o teu pagamento. A reserva foi atualizada.',
                        });
                        setShowPaymentConfirmation(true);
                        const refreshedBooking = await fetchBooking(true);
                        setConfirmedPayment(findConfirmedPayment(refreshedBooking, orderRefParam));
                        break;
                    }

                    if (txStatus === '3') {
                        gotTerminalStatus = true;
                        setReduniqFeedback({
                            kind: 'error',
                            title: isEn ? 'Payment not completed' : 'Pagamento não concluído',
                            message: finalMessage || (isEn ? 'The transaction ended with an error or was canceled.' : 'A transação terminou com erro ou foi cancelada.'),
                        });
                        break;
                    }

                    if (attempt < REDUNIQ_CONFIRM_MAX_ATTEMPTS) {
                        await delay(REDUNIQ_CONFIRM_RETRY_MS);
                    }
                }

                if (!gotTerminalStatus) {
                    if (hasFailureHint && finalStatus !== '4') {
                        setReduniqFeedback({
                            kind: 'error',
                            title: isEn ? 'Payment not completed' : 'Pagamento não concluído',
                            message: finalMessage || (isEn ? 'The transaction ended with an error or was canceled.' : 'A transação terminou com erro ou foi cancelada.'),
                        });
                    } else {
                        setReduniqFeedback({
                            kind: 'info',
                            title: isEn ? 'Payment processing' : 'Pagamento em processamento',
                            message: isEn ? 'The payment was received and is being confirmed by Reduniq. We will update the values automatically.' : 'O pagamento foi recebido e está a ser confirmado pela Reduniq. Vamos atualizar os valores automaticamente.',
                        });
                    }
                }
            } catch (err: any) {
                setReduniqFeedback({
                    kind: 'error',
                    title: isEn ? 'Confirmation failed' : 'Falha na confirmação',
                    message: err?.message || (isEn ? 'Could not confirm the Reduniq payment status.' : 'Não foi possível confirmar o estado do pagamento Reduniq.'),
                });
            } finally {
                setReduniqConfirming(false);
                setProcessing(false);
            }
        };

        confirmPayment();
    }, [providerParam, orderRefParam, reduniqTokenParam, statusParam, canceledParam, reduniqHandledKey]);

    const [booking, setBooking] = useState<Booking | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [passes, setPasses] = useState<PilgrimPass[]>([]);
    const [passesLoading, setPassesLoading] = useState(false);
    const [passesMessage, setPassesMessage] = useState<string | null>(null);
    const [activePassIndex, setActivePassIndex] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [showPilgrims, setShowPilgrims] = useState(false);
    const [authError, setAuthError] = useState(false);

    const [uploadSuccess, setUploadSuccess] = useState(false);

    // Onboarding State
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [showBankModal, setShowBankModal] = useState(false); // New State for Bank Modal
    const [showBillingModal, setShowBillingModal] = useState(false);
    const [pendingBillingAction, setPendingBillingAction] = useState<
        { type: 'reduniq'; paymentId: string } | { type: 'bank_transfer' } | null
    >(null);
    const [confirmedBilling, setConfirmedBilling] = useState<FiscalBillingDetails | null>(null);
    const [bankTransferDetails, setBankTransferDetails] = useState(DEFAULT_BANK_TRANSFER_DETAILS);
    const [customAmount, setCustomAmount] = useState<number | null>(null);
    const [showMobilePaySheet, setShowMobilePaySheet] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('first_time') === 'true') {
            setShowOnboarding(true);

            // Clean URL without refresh
            const newUrl = window.location.pathname + window.location.search.replace(/&?first_time=true/, '');
            window.history.replaceState({}, '', newUrl);
        }
    }, []);

    // -- Derived State (Moved to Top) --
    // Calculate the total deposit ignoring 100% discounted pilgrims (like infants)
    const depositPerPerson = Number(booking?.pilgrimage?.deposit_value) || 0;
    const depositValue = (booking?.pilgrims || []).length > 0
        ? booking!.pilgrims.reduce((acc: number, p: any) => {
            const age = p.birth_date ? (new Date().getFullYear() - new Date(p.birth_date).getFullYear()) : 30;
            const isInfant = age <= 2 && p.birth_date;
            return acc + (isInfant ? 0 : depositPerPerson);
        }, 0)
        : depositPerPerson;
    const totalAmount = booking?.total_amount || 0;
    const successfulStatuses = ['verified', 'succeeded', 'paid', 'manual'];
    const successfulPaidFromPayments = (booking?.payments || [])
        .filter((p: any) => successfulStatuses.includes(String(p?.status || '').toLowerCase()))
        .reduce((sum: number, p: any) => sum + (Number(p?.amount) || 0), 0);
    const paidAmount = Math.max(booking?.paid_amount || 0, successfulPaidFromPayments);

    const isFullyPaid = totalAmount > 0 && paidAmount >= totalAmount;
    const isDepositPaid = depositValue > 0 && paidAmount >= depositValue;
    const isVerifying = booking?.payments?.some((p: any) => p.status === 'verifying' || p.status === 'pending_verification');
    const percentPaid = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

    // -- Advanced Installment Logic --
    // Parse paymentPlan from API safely
    let parsedPaymentPlan: { date: string; amount: number }[] = [];
    try {
        if (Array.isArray(booking?.payment_plan)) {
            parsedPaymentPlan = booking.payment_plan;
        } else if (typeof booking?.payment_plan === 'string') {
            parsedPaymentPlan = JSON.parse(booking.payment_plan);
        }
    } catch (e) {
        console.error("Error parsing payment plan on client side:", e);
    }

    const paymentPlan = parsedPaymentPlan;
    const hasPlan = paymentPlan.length > 0;
    const bookingNotes = String(booking?.notes || '').toLowerCase();
    const paymentMode: 'deposit' | 'full' =
        bookingNotes.includes('payment plan: full')
            ? 'full'
            : bookingNotes.includes('payment plan: installments')
                ? 'deposit'
                : hasPlan
                    ? 'deposit'
                    : 'full';
    const isFullPaymentFlow = paymentMode === 'full';

    // Helper to find state of an installment
    const getInstallmentState = (index: number, amount: number) => {
        if (isFullyPaid) return 'paid';
        // Calculate the target amount to reach this installment
        const cumulativeTarget = depositValue + paymentPlan.slice(0, index + 1).reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);

        if (paidAmount >= cumulativeTarget) return 'paid';

        // Check for pending/verifying payments
        const pendingPayments = booking?.payments?.filter((p: any) => p.status === 'verifying' || p.status === 'pending_verification') || [];
        const totalPending = pendingPayments.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);

        if (paidAmount + totalPending >= cumulativeTarget) return 'verifying';
        return 'pending';
    };

    // Calculate Amount to Pay Now
    let nextAmountToPay = totalAmount - paidAmount;
    let nextLabel = isEn ? 'Remaining Total' : 'Total Restante';

    if (paymentMode === 'full') {
        nextAmountToPay = Math.max(0, parseFloat((totalAmount - paidAmount).toFixed(2)));
        nextLabel = paidAmount > 0 ? (isEn ? 'Remaining Amount' : 'Valor Restante') : (isEn ? 'Full Payment' : 'Pagamento Total');
    } else {
        if (!isDepositPaid) {
            nextAmountToPay = depositValue - paidAmount;
            nextLabel = isEn ? 'Registration Deposit' : 'Sinal de Inscrição';
        } else if (hasPlan && !isFullyPaid) {
            // Find first installment not paid
            const nextIdx = paymentPlan.findIndex((_: any, idx: number) => getInstallmentState(idx, 0) === 'pending');
            if (nextIdx !== -1) {
                // Calculate the cumulative target for this installment
                const cumulativeTarget = depositValue + paymentPlan.slice(0, nextIdx + 1).reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);

                // The amount to pay is the difference between the target and what has been paid so far
                // This handles partial payments correctly
                nextAmountToPay = cumulativeTarget - paidAmount;

                // Ensure we don't show negative values (floating point safety)
                nextAmountToPay = Math.max(0, parseFloat(nextAmountToPay.toFixed(2)));

                nextLabel = `${isEn ? 'Installment' : 'Prestação'} ${nextIdx + 1} (${format(new Date(paymentPlan[nextIdx].date), 'MMMM', { locale: dateLocale })})`;
            }
        }
    }

    const amountToPay = nextAmountToPay;

    // Gate for the custom payment amount UI: only show when on an installment plan,
    // the registration deposit is already settled, the booking is not fully paid,
    // and there is no receipt currently under review.
    const totalRemaining = Math.max(0, parseFloat((totalAmount - paidAmount).toFixed(2)));
    const customMinAmount = parseFloat(Math.min(amountToPay, totalRemaining).toFixed(2));
    const canUseCustomAmount =
        !isFullPaymentFlow &&
        hasPlan &&
        isDepositPaid &&
        !isFullyPaid &&
        !isVerifying &&
        totalRemaining > 0 &&
        customMinAmount > 0;

    const useCustomAmount =
        canUseCustomAmount &&
        customAmount != null &&
        customAmount >= customMinAmount - 0.009 &&
        customAmount <= totalRemaining + 0.009;

    const effectiveAmountToPay = useCustomAmount ? (customAmount as number) : amountToPay;
    const effectiveLabel = useCustomAmount
        ? (isEn ? 'Custom Payment' : 'Pagamento Personalizado')
        : nextLabel;

    const selectedPaymentOption = paymentOptions.find((opt) => opt.id === selectedPaymentId) || paymentOptions[0];
    const reduniqChargePreview = calculatePilgrimageReduniqCharge(effectiveAmountToPay);
    const showReduniqFeePreview = selectedPaymentOption?.provider === 'reduniq' && effectiveAmountToPay > 0;


    // Fetch Booking Data - Extracted for reuse
    const fetchBooking = async (isRefresh = false): Promise<Booking | null> => {
        if (isRefresh) {
            setRefreshing(true);
            console.log('🔄 [Client] Refreshing booking data...');
        }

        try {
            const res = await fetch(getBookingApiUrl(id, providerParam), {
                cache: 'no-store',
            });
            const data = await res.json();

            if (!res.ok) {
                // Check if it's an auth issue or just not found
                if (res.status === 401) {
                    setAuthError(true);
                    return null;
                }
                throw new Error(data.error || (isEn ? 'Error loading' : 'Erro ao carregar'));
            } else {
                const normalizedBooking = data as Booking;
                setBooking(normalizedBooking);
                if (isRefresh) {
                    console.log('✅ [Client] Booking refreshed successfully');
                }
                return normalizedBooking;
            }
        } catch (err: any) {
            console.error("Fetch error:", err);
            return null;
        } finally {
            if (isRefresh) setRefreshing(false);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (
            !showPaymentConfirmation
            || confirmedPayment?.factpt_document?.email_sent_at
        ) {
            return;
        }

        let canceled = false;
        const pollFiscalStatus = async () => {
            while (!canceled) {
                await new Promise((resolve) => setTimeout(resolve, 5000));
                if (canceled) return;

                const response = await fetch(getBookingApiUrl(id, providerParam), {
                    cache: 'no-store',
                });
                if (canceled || !response.ok) continue;

                const refreshedBooking = await response.json() as Booking;
                setBooking(refreshedBooking);

                const payment = findConfirmedPayment(refreshedBooking, orderRefParam);
                setConfirmedPayment(payment);
                if (payment?.factpt_document?.email_sent_at) return;
            }
        };

        void pollFiscalStatus();
        return () => {
            canceled = true;
        };
    }, [
        showPaymentConfirmation,
        id,
        orderRefParam,
        providerParam,
        confirmedPayment?.factpt_document?.email_sent_at,
    ]);

    const getBookingViewToken = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const directViewToken = urlParams.get('viewToken');
        const tokenValues = urlParams.getAll('token');
        const legacyViewTokenFromDuplicate = providerParam === 'reduniq' && !directViewToken && tokenValues.length > 1
            ? tokenValues[0]
            : null;
        return directViewToken || (providerParam === 'reduniq' ? legacyViewTokenFromDuplicate : (tokenValues[0] || null));
    };

    const fetchPilgrimPasses = async () => {
        setPassesLoading(true);
        setPassesMessage(null);
        try {
            const viewToken = getBookingViewToken();
            const url = viewToken
                ? `/api/pilgrimage-passes/booking/${id}?token=${encodeURIComponent(viewToken)}`
                : `/api/pilgrimage-passes/booking/${id}`;
            const res = await fetch(url, { cache: 'no-store' });
            const data = await res.json();

            if (!res.ok) throw new Error(data?.error || (isEn ? 'Could not load pilgrim pass.' : 'Não foi possível carregar o passe.'));

            setPasses(Array.isArray(data?.passes) ? data.passes : []);
            setActivePassIndex(0);
            setPassesMessage(data?.available ? null : (data?.message || null));
        } catch (err: any) {
            console.error('Pass fetch error:', err);
            setPasses([]);
            setPassesMessage(err?.message || (isEn ? 'Could not load pilgrim pass.' : 'Não foi possível carregar o passe.'));
        } finally {
            setPassesLoading(false);
        }
    };

    //  Initial fetch
    useEffect(() => {
        if (id) fetchBooking(false);
    }, [id, providerParam]);

    useEffect(() => {
        if (!booking || !isFullyPaid) {
            setPasses([]);
            return;
        }
        fetchPilgrimPasses();
    }, [booking?.id, isFullyPaid]);

    useEffect(() => {
        const fetchBankTransferDetails = async () => {
            if (!supabaseBrowser) return;

            const { data } = await supabaseBrowser
                .from('site_content')
                .select('content')
                .eq('key', BANK_TRANSFER_SITE_CONTENT_KEY)
                .maybeSingle();

            if (data?.content) {
                setBankTransferDetails(normalizeBankTransferDetails(data.content));
            }
        };

        fetchBankTransferDetails();
    }, []);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (!id || loading) return;

        const interval = setInterval(() => {
            console.log('⏰ [Client] Auto-refresh triggered');
            fetchBooking(true);
        }, 30000); // 30 seconds

        return () => clearInterval(interval);
    }, [id, loading]);

    // ... (rest of logic)

    // Check if we have a token in URL - if so, don't show auth errors
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const tokenValuesForAuth = urlParams?.getAll('token') || [];
    const hasLegacyViewTokenInReduniq = providerParam === 'reduniq' && !urlParams?.get('viewToken') && tokenValuesForAuth.length > 1
        ? tokenValuesForAuth[0]
        : null;
    const hasToken = urlParams?.get('viewToken') || (providerParam === 'reduniq' ? hasLegacyViewTokenInReduniq : (tokenValuesForAuth[0] || null));

    // Inline Login Prompt if Auth Failed (but NOT if we have a valid token)
    if (authError && !booking && !hasToken) {
        // If it's a fresh booking (Guest Flow), show Success Message instead of potentially confusing Auth Prompt
        if (isSuccess) {
            return (
                <VIPLayout allowPublic={true}>
                    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="w-full max-w-lg rounded-3xl bg-[#0d1117] p-7 ring-1 ring-white/10 md:p-8">
                            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-400">
                                <CheckCircle2 className="h-7 w-7" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">{isEn ? 'ALMOST THERE!' : 'QUASE LÁ!'}</h2>

                            <div className="my-6 rounded-2xl bg-amber-400/10 p-5 text-left ring-1 ring-amber-400/20">
                                <div className="flex items-start gap-3.5">
                                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-400"><Clock className="h-5 w-5" /></div>
                                    <div>
                                        <h3 className="text-base font-bold text-white">{isEn ? '1 Step Left: Validation & Payment' : 'Falta 1 Passo: Validação & Pagamento'}</h3>
                                        <p className="mt-1.5 text-sm leading-relaxed text-white/55">{isEn ? <>We have just sent you an email. <strong className="text-white/85">You must open that email</strong> and click the link to access your account and pay, otherwise the booking will not become valid.</> : <>Enviámos agora mesmo um email para ti. <strong className="text-white/85">Tens de abrir esse email</strong> e clicar no link para acederes à tua conta e pagares, senão a reserva não fica válida.</>}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-7 rounded-2xl bg-white/[0.04] p-5 text-left">
                                <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.16em] text-white/35">{isEn ? 'Reference (save this number)' : 'Referência (Guarda este número)'}</p>
                                <p className="font-mono text-2xl font-bold tracking-wider text-white">#{id.slice(0, 8).toUpperCase()}</p>
                            </div>

                            <p className="mb-6 text-sm leading-relaxed text-white/40">
                                {isEn ? 'You can access this area later through the secure link we sent to your email.' : 'Podes aceder a esta área mais tarde através do link seguro que enviámos para o teu email.'}
                            </p>

                            <button
                                onClick={() => window.location.href = homePath}
                                className="min-h-[52px] w-full rounded-2xl bg-white px-6 text-base font-bold text-slate-950 transition-colors hover:bg-white/90"
                            >
                                {isEn ? 'Back to Home Page' : 'Voltar à Página Inicial'}
                            </button>
                        </div>
                    </div>
                </VIPLayout>
            );
        }

        return (
            <VIPLayout allowPublic={true}>
                <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
                    <div className="w-full max-w-md rounded-3xl bg-[#0d1117] p-7 ring-1 ring-white/10 md:p-8">
                        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/15 text-amber-400">
                            <Users className="h-7 w-7" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">{isEn ? 'Confirm Your Identity' : 'Confirma a tua Identidade'}</h2>
                        <p className="mb-7 mt-2 text-base leading-relaxed text-white/45">{isEn ? 'To view your booking details, please sign in with the account you used.' : 'Para veres os detalhes da tua reserva, por favor faz login com a conta que usaste.'}</p>

                        <button
                            onClick={() => window.location.href = `${loginPath}?next=${encodeURIComponent(window.location.pathname)}`}
                            className="min-h-[52px] w-full rounded-2xl bg-amber-400 px-6 text-base font-bold text-slate-950 transition-colors hover:bg-amber-300"
                        >
                            {isEn ? 'Sign In to My Account' : 'Entrar na Minha Conta'}
                        </button>
                    </div>
                </div>
            </VIPLayout>
        );
    }

    if (loading) return <VIPLayout allowPublic={true}><div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" /></div></VIPLayout>;

    if (!booking) return (
        <VIPLayout allowPublic={true}>
            <div className="flex justify-center py-20 text-white/40">{isEn ? 'Booking not found.' : 'Reserva não encontrada.'}</div>
        </VIPLayout>
    );

    const requestBillingConfirmation = (
        action: { type: 'reduniq'; paymentId: string } | { type: 'bank_transfer' },
    ) => {
        setPendingBillingAction(action);
        setShowMobilePaySheet(false);
        setShowBillingModal(true);
    };

    const handleOnlinePayment = async (
        paymentOverrideId: string,
        billing: FiscalBillingDetails,
    ) => {
        const paymentIdToUse = paymentOverrideId || selectedPaymentId;
        const selectedOption = paymentOptions.find((opt) => opt.id === paymentIdToUse);
        if (!selectedOption) return;
        setSelectedPaymentId(selectedOption.id);

        setProcessing(true);
        setReduniqFeedback(null);

        // 1. Start checkout
        try {
            const res = await fetch('/api/payments/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookingId: id,
                    priceType: paymentMode,
                    provider: selectedOption.provider,
                    paymentOptionId: selectedOption.id,
                    amountToPay: effectiveAmountToPay,
                    viewToken: getBookingViewToken(),
                    billing,
                }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || (isEn ? 'Error starting payment' : 'Erro ao iniciar pagamento'));

            if (data.url) {
                const paymentUrl = String(data.url || '').trim();
                if (!paymentUrl) {
                    throw new Error(isEn ? 'Empty payment URL.' : 'URL de pagamento vazia.');
                }

                let redirectTo: string;
                try {
                    redirectTo = new URL(paymentUrl, window.location.origin).toString();
                } catch {
                    try {
                        redirectTo = encodeURI(paymentUrl);
                    } catch {
                        throw new Error(isEn ? 'Invalid payment URL. Please try again.' : 'URL de pagamento inválida. Tenta novamente.');
                    }
                }

                try {
                    window.location.assign(redirectTo);
                } catch {
                    window.location.href = redirectTo;
                }
                return;
            }
            throw new Error(isEn ? 'Gateway did not return a payment URL.' : 'Gateway não devolveu URL de pagamento.');
        } catch (e: any) {
            const msg = String(e?.message || (isEn ? 'Error starting payment' : 'Erro ao iniciar pagamento'));
            const safeMsg = msg.toLowerCase().includes('expected pattern')
                ? (isEn ? 'Failed to open the payment gateway. Please try again.' : 'Falha a abrir o gateway de pagamento. Tenta novamente.')
                : msg;
            alert((isEn ? 'Error: ' : 'Erro: ') + safeMsg);
            setProcessing(false);
        }
    };

    const handleManualUpload = () => {
        const input = document.getElementById('receipt-upload') as HTMLInputElement;
        if (input) input.click();
    };

    const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirmedBilling) {
            e.target.value = '';
            setPendingBillingAction({ type: 'bank_transfer' });
            setShowBillingModal(true);
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            alert(isEn ? 'Invalid file type. Use JPG, PNG, WEBP, HEIC or PDF.' : 'Tipo de ficheiro inválido. Use JPG, PNG, WEBP, HEIC ou PDF.');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            alert(isEn ? 'File is too large (maximum 10MB).' : 'O ficheiro é demasiado grande (máximo 10MB).');
            return;
        }

        setUploading(true);
        try {
            // Read file as base64
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Content = reader.result?.toString().split(',')[1];

                // Get booking view token from URL if present
                const urlParams = new URLSearchParams(window.location.search);
                const tokenValues = urlParams.getAll('token');
                const legacyViewTokenFromDuplicate = providerParam === 'reduniq' && !urlParams.get('viewToken') && tokenValues.length > 1
                    ? tokenValues[0]
                    : null;
                const viewToken = urlParams.get('viewToken') || (providerParam === 'reduniq' ? legacyViewTokenFromDuplicate : (tokenValues[0] || null));

                const res = await fetch('/api/payments/upload-receipt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        bookingId: id,
                        fileData: base64Content,
                        fileName: file.name,
                        fileType: file.type,
                        installmentLabel: effectiveLabel,
                        installmentAmount: effectiveAmountToPay,
                        token: viewToken, // Send token for authentication if present
                        billing: confirmedBilling,
                    })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || (isEn ? 'Upload error' : 'Erro no upload'));

                setUploadSuccess(true);
                // Clean up success message after 5 seconds or keep it until reload
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
            };
        } catch (e: any) {
            alert((isEn ? 'Error sending: ' : 'Erro ao enviar: ') + e.message);
        } finally {
            setUploading(false);
        }
    };

    const paymentPreview = buildPaymentPreview({
        amount: effectiveAmountToPay,
        paymentPlan,
        depositValue,
        paidAmount,
        maxAmount: totalRemaining,
        isEn,
    });

    // Reusable payment panel (used both in desktop sticky aside and in the mobile inline view).
    const paymentPanel = (
        <div className="relative overflow-hidden rounded-3xl bg-[#0d1117] ring-1 ring-white/10">
            {uploadSuccess && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-green-600 p-6 text-white animate-in fade-in zoom-in duration-300">
                    <CheckCircle2 className="mb-4 h-16 w-16 animate-bounce" />
                    <h3 className="text-2xl font-bold">{isEn ? 'Uploaded!' : 'Enviado!'}</h3>
                    <p className="mt-2 max-w-xs text-center text-base text-green-100">{isEn ? 'Your receipt was received. We will validate it shortly.' : 'Comprovativo recebido. Vamos validar em breve.'}</p>
                    <button onClick={() => window.location.reload()} className="mt-6 rounded-xl bg-white px-6 py-3 text-sm font-bold text-green-700 shadow-lg transition-colors hover:bg-green-50">{isEn ? 'Understood' : 'Entendido'}</button>
                </div>
            )}

            {/* ---------- 1. HOW MUCH ---------- */}
            <div className="px-5 pb-6 pt-6 text-center md:px-7">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/35">
                    {effectiveLabel}
                </p>

                <div className="mt-4">
                    {canUseCustomAmount ? (
                        <CustomPaymentAmount
                            suggestedAmount={amountToPay}
                            minAmount={customMinAmount}
                            maxAmount={totalRemaining}
                            minLabel={nextLabel}
                            paymentPlan={paymentPlan}
                            formatPrice={formatEUR}
                            active={useCustomAmount}
                            customAmount={customAmount}
                            onChange={setCustomAmount}
                            belowAmount={
                                <PaymentCurrencyDisplay
                                    amountInEur={effectiveAmountToPay}
                                    label={effectiveLabel}
                                    isEn={isEn}
                                />
                            }
                        />
                    ) : (
                        <>
                            <p className="text-5xl font-black tracking-tight text-white">
                                {formatEUR(effectiveAmountToPay)}
                            </p>
                            <div className="mt-1 flex justify-center">
                                <PaymentCurrencyDisplay
                                    amountInEur={effectiveAmountToPay}
                                    label={effectiveLabel}
                                    isEn={isEn}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ---------- 2. HOW TO PAY ---------- */}
            <div className="border-t border-white/[0.07] px-5 py-5 md:px-7">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-white/35">
                    {isEn ? 'How to pay' : 'Como pagar'}
                </p>

                <div className="space-y-2.5">
                    <button
                        type="button"
                        onClick={() => setPayMethod('card')}
                        aria-pressed={payMethod === 'card'}
                        className={`w-full rounded-2xl border p-4 text-left transition-all ${payMethod === 'card'
                            ? 'border-amber-400/60 bg-amber-400/[0.08]'
                            : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${payMethod === 'card' ? 'border-amber-400' : 'border-white/25'
                                }`}>
                                {payMethod === 'card' && <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />}
                            </span>
                            <span className="min-w-0 flex-1 text-base font-semibold text-white">
                                {isEn ? 'Pay Online' : 'Pagar Online'}
                            </span>
                            <span className="shrink-0 text-sm text-white/40">
                                {isEn ? 'Instant' : 'Imediato'}
                            </span>
                        </div>

                        {/* Everything the gateway accepts */}
                        <div className="mt-3 flex flex-wrap items-center gap-2 pl-8">
                            {paymentOptions.map((opt) => (
                                <span
                                    key={opt.id}
                                    title={opt.label}
                                    className="flex h-8 w-12 items-center justify-center rounded-md bg-white p-1.5"
                                >
                                    {opt.iconSrc ? (
                                        <img
                                            src={opt.iconSrc}
                                            alt={opt.iconAlt || opt.label}
                                            className="max-h-full max-w-full object-contain"
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                    ) : (
                                        <CreditCard className="h-4 w-4 text-slate-700" />
                                    )}
                                </span>
                            ))}
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => setPayMethod('transfer')}
                        aria-pressed={payMethod === 'transfer'}
                        disabled={isVerifying}
                        className={`w-full rounded-2xl border p-4 text-left transition-all disabled:opacity-40 ${payMethod === 'transfer'
                            ? 'border-amber-400/60 bg-amber-400/[0.08]'
                            : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${payMethod === 'transfer' ? 'border-amber-400' : 'border-white/25'
                                }`}>
                                {payMethod === 'transfer' && <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />}
                            </span>
                            <span className="min-w-0 flex-1 text-base font-semibold text-white">
                                {isEn ? 'Bank Transfer' : 'Transferência Bancária'}
                            </span>
                            <span className="shrink-0 text-sm text-white/40">
                                {isEn ? '1–2 days' : '1–2 dias'}
                            </span>
                        </div>
                        <p className="mt-2 pl-8 text-sm text-white/40">
                            <Landmark className="mr-1.5 inline h-4 w-4 align-text-bottom" />
                            {isEn ? 'IBAN + upload receipt' : 'IBAN + envio de comprovativo'}
                        </p>
                    </button>
                </div>
            </div>

            {/* ---------- 3. SUMMARY ---------- */}
            <div className="border-t border-white/[0.07] px-5 py-5 md:px-7">
                {payMethod === 'card' && showReduniqFeePreview ? (
                    <div className="space-y-2.5">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="text-white/45">{isEn ? 'Payment' : 'Pagamento'}</span>
                            <span className="font-medium text-white/70">{formatEUR(reduniqChargePreview.baseAmount)}</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="text-white/45">{isEn ? 'Processing fee' : 'Taxa de processamento'}</span>
                            <span className="font-medium text-white/70">{formatEUR(reduniqChargePreview.feeAmount)}</span>
                        </div>
                        <div className="flex items-baseline justify-between gap-3 border-t border-white/[0.07] pt-3">
                            <span className="text-base font-semibold text-white">{isEn ? 'Total' : 'Total'}</span>
                            <LocalizedPilgrimageAmount
                                amountInEur={reduniqChargePreview.chargedAmount}
                                isEn={isEn}
                                className="items-end text-right"
                                eurClassName="text-xl font-black text-white"
                                convertedClassName="text-white/35"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex items-baseline justify-between gap-3">
                        <span className="text-base font-semibold text-white">{isEn ? 'Total' : 'Total'}</span>
                        <LocalizedPilgrimageAmount
                            amountInEur={effectiveAmountToPay}
                            isEn={isEn}
                            className="items-end text-right"
                            eurClassName="text-xl font-black text-white"
                            convertedClassName="text-white/35"
                        />
                    </div>
                )}

                {paymentPreview && paymentPreview.steps.length > 0 && (
                    <details className="group mt-3">
                        <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-sm text-white/40 transition-colors hover:text-white/70">
                            <span>{isEn ? 'What this settles' : 'O que este valor liquida'}</span>
                            <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                        </summary>
                        <ul className="mt-3 space-y-2 border-l border-white/10 pl-3.5">
                            {paymentPreview.steps.map((step, i) => (
                                <li key={i} className="text-sm leading-snug text-white/60">
                                    {step.settles
                                        ? (isEn
                                            ? `Settles ${step.label} (${formatEUR(step.expected)})`
                                            : `Liquida ${step.label} (${formatEUR(step.expected)})`)
                                        : (isEn
                                            ? `Advances ${formatEUR(step.applied)} of ${step.label} — ${formatEUR(Math.round((step.expected - step.paidAfter) * 100) / 100)} still due`
                                            : `Adianta ${formatEUR(step.applied)} de ${step.label} — falta ${formatEUR(Math.round((step.expected - step.paidAfter) * 100) / 100)}`)}
                                </li>
                            ))}
                            <li className="pt-1 text-sm text-white/40">
                                {isEn
                                    ? `Balance afterwards: ${formatEUR(paymentPreview.balanceAfter)}`
                                    : `Saldo depois: ${formatEUR(paymentPreview.balanceAfter)}`}
                            </li>
                        </ul>
                    </details>
                )}
            </div>

            {/* ---------- 4. PAY ---------- */}
            <div className="px-5 pb-6 md:px-7">
                {isVerifying && payMethod === 'transfer' ? (
                    <div className="flex min-h-[58px] items-center justify-center gap-2 rounded-2xl bg-amber-400/10 px-4 text-sm font-semibold text-amber-300">
                        <Clock className="h-5 w-5 animate-pulse" />
                        <span>{isEn ? 'Receipt under review' : 'Comprovativo em análise'}</span>
                    </div>
                ) : payMethod === 'card' ? (
                    <button
                        onClick={() => requestBillingConfirmation({
                            type: 'reduniq',
                            paymentId: paymentOptions[0].id,
                        })}
                        disabled={processing}
                        className="flex min-h-[58px] w-full items-center justify-center gap-2.5 rounded-2xl bg-amber-400 text-lg font-bold text-slate-950 transition-all hover:bg-amber-300 active:scale-[0.99] disabled:opacity-50"
                    >
                        {processing ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span>{isEn ? 'Opening…' : 'A abrir…'}</span>
                            </>
                        ) : (
                            <span>
                                {isEn ? 'Pay' : 'Pagar'} {formatEUR(showReduniqFeePreview ? reduniqChargePreview.chargedAmount : effectiveAmountToPay)}
                            </span>
                        )}
                    </button>
                ) : (
                    <button
                        onClick={() => requestBillingConfirmation({ type: 'bank_transfer' })}
                        className="flex min-h-[58px] w-full items-center justify-center gap-2.5 rounded-2xl bg-white text-lg font-bold text-slate-950 transition-all hover:bg-white/90 active:scale-[0.99]"
                    >
                        <span>{isEn ? 'View IBAN details' : 'Ver dados do IBAN'}</span>
                    </button>
                )}

                <div className="mt-4 flex items-center justify-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-white/25" />
                    <span className="text-sm text-white/30">
                        {payMethod === 'card'
                            ? (isEn ? 'Secure payment · you pick the method next' : 'Pagamento seguro · escolhes o método a seguir')
                            : (isEn ? 'Reviewed within 1–2 business days' : 'Validamos em 1–2 dias úteis')}
                    </span>
                </div>

                {/* Reduniq feedback */}
                {(reduniqConfirming || reduniqFeedback) && (
                    <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${reduniqConfirming
                        ? 'bg-blue-500/10 text-blue-200'
                        : reduniqFeedback?.kind === 'success'
                            ? 'bg-green-500/10 text-green-200'
                            : reduniqFeedback?.kind === 'info'
                                ? 'bg-amber-500/10 text-amber-200'
                                : 'bg-red-500/10 text-red-200'
                        }`}>
                        <p className="flex items-center gap-2 font-semibold">
                            {reduniqConfirming && <Loader2 className="h-4 w-4 animate-spin" />}
                            {reduniqConfirming ? (isEn ? 'Confirming…' : 'A confirmar…') : reduniqFeedback?.title}
                        </p>
                        <p className="mt-1 leading-relaxed opacity-80">
                            {reduniqConfirming ? (isEn ? 'Please wait while we verify your payment.' : 'Aguarde enquanto verificamos o pagamento.') : reduniqFeedback?.message}
                        </p>
                    </div>
                )}
            </div>

            {/* Hidden file input */}
            <input
                id="receipt-upload"
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleReceiptUpload}
            />
        </div>
    );

    return (
        <VIPLayout allowPublic={true}>
            <PaymentConfirmationModal
                open={showPaymentConfirmation}
                onClose={() => setShowPaymentConfirmation(false)}
                isEn={isEn}
                amountLabel={
                    confirmedPayment
                        ? formatEUR(
                            Number(
                                confirmedPayment.charged_amount
                                ?? confirmedPayment.amount,
                            ),
                        )
                        : null
                }
                fiscalDocument={confirmedPayment?.factpt_document || null}
            />
            <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-700">

                {/* --- 0. ERROR/EMPTY STATE --- */}
                {totalAmount === 0 && !loading && (
                    <div className="rounded-3xl bg-[#0d1117] p-8 text-center ring-1 ring-amber-400/20 md:p-10">
                        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/15 text-amber-400">
                            <AlertCircle className="h-7 w-7" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">{isEn ? 'Waiting for Validation' : 'Aguarde pela Validação'}</h2>
                        <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-white/50">
                            {isEn ? <>Your registration was recorded, but the total amounts are still being calculated by our system.<strong className="text-white/80"> You will receive an email shortly with the payment details.</strong></> : <>A sua inscrição foi registada, mas os valores totais ainda estão a ser calculados pelo nosso sistema.<strong className="text-white/80"> Receberá um email em breve com os dados de pagamento.</strong></>}
                        </p>
                        <button onClick={() => window.location.reload()} className="mt-6 min-h-[52px] rounded-2xl bg-amber-400 px-7 text-base font-bold text-slate-950 transition-colors hover:bg-amber-300">{isEn ? 'Refresh Page' : 'Atualizar Página'}</button>
                    </div>
                )}

                {totalAmount > 0 && (
                    <>
                        {/* --- 1. HEADER --- */}
                        <div className="text-center space-y-4 mb-8">
                            {/* Persistent Quick Access Guide (Desktop) */}
                            <div className="hidden md:flex justify-center mb-6 animate-in fade-in slide-in-from-top duration-700 delay-300">
                                <div className="bg-white/10 border border-white/20 backdrop-blur-md rounded-full px-5 py-2 flex items-center gap-2 text-sm text-amber-100">
                                    <span className="bg-amber-500/20 p-1 rounded-full"><Package className="w-3 h-3 text-amber-500" /></span>
                                    <span>{isEn ? <>To come back here: Menu &gt; <strong>My Registrations</strong></> : <>Para voltares aqui: Menu &gt; <strong>Minhas Inscrições</strong></>}</span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <p className="text-amber-500 font-bold uppercase tracking-[0.2em] text-xs md:text-sm">{isEn ? 'Booking Successfully Registered' : 'Reserva Registada com Sucesso'}</p>
                                <h1 className="text-4xl md:text-6xl font-serif font-bold text-white tracking-tight leading-tight drop-shadow-xl max-w-4xl mx-auto">
                                    {booking.pilgrimage.title}
                                </h1>
                                <p className="text-white/50 font-mono text-sm md:text-base">#{booking.id.slice(0, 8).toUpperCase()}</p>
                            </div>
                        </div>

                        {/* --- 2. MAIN GRID: Payment panel + Schedule --- */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">

                            {/* ============== LEFT: SCHEDULE & PROGRESS ============== */}
                            <section className="lg:col-span-7 order-2 lg:order-1 space-y-6">

                {/* Progress */}
                                <div className="rounded-3xl bg-[#0d1117] ring-1 ring-white/10">
                                    <div className="flex items-start justify-between gap-3 px-5 pt-5 md:px-6">
                                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/35">
                                            {isFullyPaid
                                                ? (isEn ? 'Trip Confirmed' : 'Viagem Confirmada')
                                                : (isEn ? 'Payment Progress' : 'Estado dos Pagamentos')}
                                        </p>
                                        <button
                                            onClick={() => fetchBooking(true)}
                                            disabled={refreshing}
                                            className="-mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                                            aria-label={isEn ? 'Refresh payments' : 'Atualizar pagamentos'}
                                            title={isEn ? 'Refresh' : 'Atualizar'}
                                        >
                                            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>

                                    <div className="px-5 pb-5 pt-3 md:px-6">
                                        {isFullyPaid ? (
                                            <>
                                                <p className="text-3xl font-black tracking-tight text-emerald-400 md:text-4xl">
                                                    {isEn ? 'Fully paid' : 'Tudo pago'}
                                                </p>
                                                <p className="mt-1 text-sm text-white/40">
                                                    {isEn
                                                        ? `${formatEUR(totalAmount)} settled — nothing left to pay.`
                                                        : `${formatEUR(totalAmount)} liquidados — não falta nada.`}
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <LocalizedPilgrimageAmount
                                                    amountInEur={Math.max(0, totalAmount - paidAmount)}
                                                    isEn={isEn}
                                                    eurClassName="text-3xl md:text-4xl font-black tracking-tight text-white"
                                                    convertedClassName="text-white/35"
                                                />
                                                <p className="mt-1 text-sm text-white/40">
                                                    {isEn
                                                        ? `Still to pay · ${percentPaid.toFixed(0)}% complete`
                                                        : `Ainda por pagar · ${percentPaid.toFixed(0)}% concluído`}
                                                </p>
                                            </>
                                        )}

                                        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${isFullyPaid ? 'bg-emerald-400' : 'bg-amber-400'}`}
                                                style={{ width: `${Math.min(100, percentPaid)}%` }}
                                            />
                                        </div>

                                        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-sm">
                                            <span className="text-white/35">
                                                {isEn ? 'Total' : 'Total'}{' '}
                                                <span className="font-semibold text-white/70">{formatEUR(totalAmount)}</span>
                                            </span>
                                            <span className="text-white/35">
                                                {isEn ? 'Paid' : 'Pago'}{' '}
                                                <span className="font-semibold text-emerald-400">{formatEUR(paidAmount)}</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <PilgrimPassPanel
                                    isEn={isEn}
                                    isFullyPaid={isFullyPaid}
                                    passes={passes}
                                    loading={passesLoading}
                                    message={passesMessage}
                                    activeIndex={activePassIndex}
                                    onSelect={setActivePassIndex}
                                    onRefresh={fetchPilgrimPasses}
                                />

                                {/* Schedule list (single source of truth) */}
                {!isFullPaymentFlow && (
                                    <div className="rounded-3xl bg-[#0d1117] ring-1 ring-white/10">
                                        <p className="px-5 pt-5 text-xs font-bold uppercase tracking-[0.16em] text-white/35 md:px-6">
                                            {isEn ? 'Payment Schedule' : 'Calendário de Pagamentos'}
                                        </p>
                                        <ul className="mt-1 divide-y divide-white/[0.06] px-5 md:px-6">
                                            {/* Deposit row */}
                                            <li className="flex items-center gap-3.5 py-4">
                                                <ScheduleMarker state={isDepositPaid ? 'paid' : (isVerifying ? 'verifying' : 'pending')} />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-base font-semibold text-white">{isEn ? 'Registration Deposit' : 'Sinal de Inscrição'}</p>
                                                    <p className="mt-0.5 text-sm text-white/40">
                                                        {isDepositPaid
                                                            ? (isEn ? 'Paid' : 'Pago')
                                                            : (isVerifying ? (isEn ? 'Awaiting validation' : 'A aguardar validação') : (isEn ? 'Pending' : 'Pendente'))}
                                                    </p>
                                                </div>
                                                <LocalizedPilgrimageAmount
                                                    amountInEur={depositValue}
                                                    isEn={isEn}
                                                    className="shrink-0 items-end text-right"
                                                    eurClassName={`text-base font-bold ${isDepositPaid ? 'text-white/45' : 'text-white'}`}
                                                    convertedClassName="text-white/25"
                                                />
                                            </li>
                                            {/* Installment rows */}
                                            {paymentPlan.map((step: any, idx: number) => {
                                                const state = getInstallmentState(idx, Number(step.amount));
                                                return (
                                                    <li key={idx} className="flex items-center gap-3.5 py-4">
                                                        <ScheduleMarker state={state} />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-base font-semibold text-white">{isEn ? 'Installment' : 'Prestação'} {idx + 1}</p>
                                                            <p className="mt-0.5 text-sm text-white/40">
                                                                {state === 'paid' ? (isEn ? 'Paid' : 'Pago') :
                                                                    state === 'verifying' ? (isEn ? 'Awaiting validation' : 'A aguardar validação') :
                                                                        (isEn
                                                                            ? `Due ${format(new Date(step.date), 'dd MMM yyyy', { locale: dateLocale })}`
                                                                            : `Vence ${format(new Date(step.date), "dd 'de' MMM yyyy", { locale: dateLocale })}`)}
                                                            </p>
                                                        </div>
                                                        <LocalizedPilgrimageAmount
                                                            amountInEur={Number(step.amount)}
                                                            isEn={isEn}
                                                            className="shrink-0 items-end text-right"
                                                            eurClassName={`text-base font-bold ${state === 'paid' ? 'text-white/45' : 'text-white'}`}
                                                            convertedClassName="text-white/25"
                                                        />
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                        <div className="h-2" />
                                    </div>
                                )}

                                {/* Full payment summary (when not on installments) */}
                                {isFullPaymentFlow && (
                                    <div className="rounded-3xl bg-[#0d1117] ring-1 ring-white/10">
                                        <p className="px-5 pt-5 text-xs font-bold uppercase tracking-[0.16em] text-white/35 md:px-6">
                                            {isEn ? 'Full Payment' : 'Pagamento Total'}
                                        </p>
                                        <div className="flex items-center gap-3.5 px-5 py-4 md:px-6">
                                            <ScheduleMarker state={isFullyPaid ? 'paid' : (isVerifying ? 'verifying' : 'pending')} />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-base font-semibold text-white">{isEn ? 'Total amount' : 'Valor total'}</p>
                                                <p className="mt-0.5 text-sm text-white/40">
                                                    {isFullyPaid
                                                        ? (isEn ? 'Paid in full' : 'Totalmente pago')
                                                        : (isVerifying ? (isEn ? 'Awaiting validation' : 'A aguardar validação') :
                                                            paidAmount > 0
                                                                ? (isEn ? `Paid ${formatEUR(paidAmount)} of ${formatEUR(totalAmount)}` : `Pago ${formatEUR(paidAmount)} de ${formatEUR(totalAmount)}`)
                                                                : (isEn ? 'Pending' : 'Pendente'))}
                                                </p>
                                            </div>
                                            <LocalizedPilgrimageAmount
                                                amountInEur={totalAmount}
                                                isEn={isEn}
                                                className="shrink-0 items-end text-right"
                                                eurClassName={`text-base font-bold ${isFullyPaid ? 'text-white/45' : 'text-white'}`}
                                                convertedClassName="text-white/25"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Print button */}
                                <div className="pb-4 pt-1 text-center">
                                    <button onClick={() => window.print()} className="mx-auto flex min-h-9 items-center justify-center gap-2 rounded-full px-4 text-sm text-white/30 transition-colors hover:bg-white/[0.05] hover:text-white/70">
                                        <Upload className="h-4 w-4 rotate-180" /> {isEn ? 'Download / Print Summary' : 'Descarregar / Imprimir Resumo'}
                                    </button>
                                </div>
                            </section>

                            {/* ============== RIGHT: PAY NOW — desktop sticky aside ============== */}
                            <aside className="lg:col-span-5 order-1 lg:order-2 hidden lg:block lg:sticky lg:top-6 self-start">
                                {!isFullyPaid && paymentPanel}

                                {isFullyPaid && (
                                    <div className="rounded-3xl bg-[#0d1117] p-7 text-center ring-1 ring-emerald-400/20">
                                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-400">
                                            <CheckCircle2 className="h-7 w-7" />
                                        </div>
                                        <h4 className="text-xl font-bold text-white">{isEn ? 'Registration Confirmed!' : 'Inscrição Confirmada!'}</h4>
                                        <p className="mt-1.5 text-sm text-white/50">{isEn ? 'Your payment was received successfully.' : 'O seu pagamento foi recebido com sucesso.'}</p>
                                        <p className="mt-3 text-sm text-emerald-400/80">{isEn ? 'We wish you an excellent pilgrimage.' : 'Desejamos-lhe uma excelente peregrinação.'}</p>
                                    </div>
                                )}
                            </aside>

                            {/* ============== MOBILE: PAY NOW & banners ============== */}
                            {!isFullyPaid && (
                                <div className="lg:hidden col-span-1 order-1 mb-2">
                                    {paymentPanel}
                                </div>
                            )}

                            {isFullyPaid && (
                                <div className="col-span-1 order-1 rounded-3xl bg-[#0d1117] p-6 text-center ring-1 ring-emerald-400/20 lg:hidden">
                                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-400">
                                        <CheckCircle2 className="h-7 w-7" />
                                    </div>
                                    <h4 className="text-lg font-bold text-white">{isEn ? 'Registration Confirmed!' : 'Inscrição Confirmada!'}</h4>
                                    <p className="mt-1.5 text-sm text-white/50">{isEn ? 'Payment received.' : 'Pagamento recebido.'}</p>
                                </div>
                            )}
                        </div>
                    </>
                )}

            </div>
            {/* Onboarding Modal */}
            <BookingOnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />

            {/* Bank Transfer Modal */}
            <BankTransferModal
                isOpen={showBankModal}
                onClose={() => setShowBankModal(false)}
                totalAmount={effectiveAmountToPay}
                formattedTotal={formatEUR(effectiveAmountToPay)}
                iban={bankTransferDetails.iban}
                beneficiaryName={bankTransferDetails.beneficiary_name}
                bankName={bankTransferDetails.bank_name}
                bicSwift={bankTransferDetails.bic_swift}
                addressStreet={bankTransferDetails.address_street}
                addressPostalCode={bankTransferDetails.address_postal_code}
                addressCity={bankTransferDetails.address_city}
                addressCountry={bankTransferDetails.address_country}
                referenceNote={bankTransferDetails.reference_note}
                supportEmail={bankTransferDetails.support_email}
                onUploadClick={handleManualUpload}
            />

            <BillingDetailsModal
                isOpen={showBillingModal}
                isEnglish={isEn}
                initialValue={confirmedBilling || booking.billing_profile || null}
                submitting={processing}
                onClose={() => {
                    if (processing) return;
                    setShowBillingModal(false);
                    setPendingBillingAction(null);
                }}
                onConfirm={(billing) => {
                    const action = pendingBillingAction;
                    setConfirmedBilling(billing);
                    setShowBillingModal(false);
                    setPendingBillingAction(null);
                    if (action?.type === 'reduniq') {
                        void handleOnlinePayment(action.paymentId, billing);
                    } else if (action?.type === 'bank_transfer') {
                        setShowBankModal(true);
                    }
                }}
            />
        </VIPLayout>
    );
}

/** Small status dot for a schedule row — filled when settled, hollow when still due. */
function ScheduleMarker({ state }: { state: 'paid' | 'verifying' | 'pending' }) {
    if (state === 'paid') {
        return (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-400">
                <Check className="h-4 w-4" />
            </span>
        );
    }
    if (state === 'verifying') {
        return (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-400">
                <Clock className="h-4 w-4" />
            </span>
        );
    }
    return <span className="h-7 w-7 shrink-0 rounded-full border-2 border-white/[0.12]" />;
}

function PilgrimPassPanel({
    isEn,
    isFullyPaid,
    passes,
    loading,
    message,
    activeIndex,
    onSelect,
    onRefresh,
}: {
    isEn: boolean;
    isFullyPaid: boolean;
    passes: PilgrimPass[];
    loading: boolean;
    message: string | null;
    activeIndex: number;
    onSelect: (index: number) => void;
    onRefresh: () => void;
}) {
    const activePass = passes[activeIndex] || passes[0];

    if (!isFullyPaid) {
        return (
            <div className="rounded-3xl bg-[#0d1117] p-5 ring-1 ring-white/10 md:p-6">
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-white/35">
                        <QrCode className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">{isEn ? 'Pilgrim Pass' : 'Passe de Peregrino'}</h2>
                        <p className="mt-1 text-sm leading-relaxed text-white/40">
                            {isEn
                                ? 'Your digital pass will appear here when the registration is fully paid.'
                                : 'O teu passe digital aparece aqui quando a inscrição estiver totalmente paga.'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-3xl bg-[#0d1117] p-5 ring-1 ring-emerald-400/20 md:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-400">
                        <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">
                            {isEn ? 'Confirmed' : 'Confirmada'}
                        </p>
                        <h2 className="text-lg font-bold text-white">{isEn ? 'Pilgrim Pass' : 'Passe de Peregrino'}</h2>
                    </div>
                </div>
                <button
                    onClick={onRefresh}
                    disabled={loading}
                    className="shrink-0 rounded-full px-3 py-1.5 text-sm text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                >
                    {loading ? (isEn ? 'Loading...' : 'A carregar...') : (isEn ? 'Refresh' : 'Atualizar')}
                </button>
            </div>

            {passes.length > 1 && (
                <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-2">
                    {passes.map((pass, index) => (
                        <button
                            key={pass.id}
                            onClick={() => onSelect(index)}
                            className={`min-h-9 shrink-0 rounded-full px-4 text-sm transition-colors ${index === activeIndex
                                ? 'bg-white font-bold text-slate-900'
                                : 'bg-white/[0.07] font-medium text-white/60 hover:bg-white/[0.13] hover:text-white'
                                }`}
                        >
                            {pass.pilgrim.full_name?.split(' ').slice(0, 2).join(' ') || (isEn ? 'Pilgrim' : 'Peregrino')}
                        </button>
                    ))}
                </div>
            )}

            {loading && passes.length === 0 ? (
                <div className="rounded-2xl bg-white/[0.04] p-8 text-center text-sm text-white/40">
                    <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                    {isEn ? 'Preparing your pass...' : 'A preparar o teu passe...'}
                </div>
            ) : activePass ? (
                <div className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[minmax(0,1fr)_190px]">
                    <div className="space-y-4">
                        <div className="relative overflow-hidden rounded-2xl bg-white/[0.04] p-5">
                            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/10" />
                            <div className="relative">
                                <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">
                                    {isEn ? 'Personal identifier' : 'Identificador pessoal'}
                                </p>
                                <h3 className="text-2xl font-black leading-tight text-white">{activePass.pilgrim.full_name}</h3>
                                <div className="mt-4 grid grid-cols-2 gap-3">
                                    <div className="rounded-xl bg-white/[0.05] p-3">
                                        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-white/35">{isEn ? 'Room' : 'Quarto'}</p>
                                        <p className="text-sm font-bold text-white">{activePass.pilgrim.room_type || '-'}</p>
                                    </div>
                                    <div className="rounded-xl bg-white/[0.05] p-3">
                                        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-white/35">{isEn ? 'Flight' : 'Voo'}</p>
                                        <p className="text-sm font-bold text-white">{activePass.pilgrim.flight_option || '-'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 text-sm text-white/40">
                            <Bus className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                            <p>
                                {isEn
                                    ? 'Show this code to the organization when boarding the bus.'
                                    : 'Mostra este código à organização ao entrar no autocarro.'}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-3 mx-auto w-full max-w-[220px]">
                        <div
                            className="w-full aspect-square [&_svg]:w-full [&_svg]:h-full"
                            dangerouslySetInnerHTML={{ __html: activePass.qrSvg }}
                            aria-label={isEn ? 'Pilgrim pass QR Code' : 'QR Code do Passe de Peregrino'}
                        />
                    </div>
                </div>
            ) : (
                <div className="flex gap-3 rounded-2xl bg-amber-400/10 p-5 text-amber-200">
                    <UserRound className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                        <p className="font-bold">{isEn ? 'Pass unavailable' : 'Passe indisponível'}</p>
                        <p className="mt-1 text-sm opacity-80">{message || (isEn ? 'Could not prepare the pass yet.' : 'Ainda não foi possível preparar o passe.')}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
