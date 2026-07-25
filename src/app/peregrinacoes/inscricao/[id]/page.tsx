"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import VIPLayout from '../../../../components/member/VIPLayout';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import { useExchangeRate } from '../../../../hooks/useExchangeRate'; // Import Hook
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
import CustomPaymentAmount from '../../../../components/booking/CustomPaymentAmount';
import { UNIFIED_ONLINE_PAYMENT_OPTIONS } from '../../../../lib/payment-options';
import {
    BANK_TRANSFER_SITE_CONTENT_KEY,
    DEFAULT_BANK_TRANSFER_DETAILS,
    normalizeBankTransferDetails,
} from '../../../../lib/bank-transfer-details';
import { calculatePilgrimageReduniqCharge } from '../../../../lib/pilgrimage-reduniq-fees';
import { useLocale } from '../../../../contexts/LocaleContext';

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
    payments: any[];
    payment_plan?: { date: string; amount: number }[];
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

/* -------------------------------------------------------------------------- */
/*                                  Component                                 */
/* -------------------------------------------------------------------------- */

export default function BookingDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const { locale } = useLocale();
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
    const orderRefParam = searchParams?.get('orderRef');
    const reduniqTokenParam = searchParams?.getAll('token')?.at(-1) || null;
    const statusParam = (searchParams?.get('status') || '').toLowerCase();
    const canceledParam = (searchParams?.get('canceled') || '').toLowerCase();
    const currencyParam = searchParams?.get('currency') === 'BRL' ? 'BRL' : 'EUR';

    // Currency Hook
    const { format: formatPrice, rate: exchangeRate, loading: rateLoading } = useExchangeRate(currencyParam);
    const isConverted = currencyParam !== 'EUR';

    const sessionId = searchParams?.get('session_id');
    const [selectedPaymentId, setSelectedPaymentId] = useState(paymentOptions[0].id);
    const [reduniqConfirming, setReduniqConfirming] = useState(false);
    const [reduniqHandledKey, setReduniqHandledKey] = useState<string | null>(null);
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
                        gotTerminalStatus = true;
                        setReduniqFeedback({
                            kind: 'success',
                            title: isEn ? 'Payment confirmed' : 'Pagamento confirmado',
                            message: isEn ? 'We received your payment. The booking has been updated.' : 'Recebemos o teu pagamento. A reserva foi atualizada.',
                        });
                        await fetchBooking(true);
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
    const fetchBooking = async (isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true);
            console.log('🔄 [Client] Refreshing booking data...');
        }

        try {
            // Check for secure booking view token in URL
            const urlParams = new URLSearchParams(window.location.search);
            const directViewToken = urlParams.get('viewToken');
            const tokenValues = urlParams.getAll('token');
            const legacyViewTokenFromDuplicate = providerParam === 'reduniq' && !directViewToken && tokenValues.length > 1
                ? tokenValues[0]
                : null;
            const legacyToken = providerParam === 'reduniq'
                ? legacyViewTokenFromDuplicate
                : (tokenValues[0] || null);
            const token = directViewToken || legacyToken;

            // Use token if available, otherwise use session
            const url = token
                ? `/api/booking/${id}?token=${token}`
                : `/api/booking/${id}`;

            const res = await fetch(url);
            const data = await res.json();

            if (!res.ok) {
                // Check if it's an auth issue or just not found
                if (res.status === 401) setAuthError(true);
                else throw new Error(data.error || (isEn ? 'Error loading' : 'Erro ao carregar'));
            } else {
                setBooking(data);
                if (isRefresh) {
                    console.log('✅ [Client] Booking refreshed successfully');
                }
            }
        } catch (err: any) {
            console.error("Fetch error:", err);
        } finally {
            if (isRefresh) setRefreshing(false);
            setLoading(false);
        }
    };

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
                        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 max-w-lg w-full">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-6 shadow-sm">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>
                            <h2 className="text-3xl font-bold text-slate-900 mb-2">{isEn ? 'ALMOST THERE!' : 'QUASE LÁ!'}</h2>
                            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 text-left my-6 animate-pulse">
                                <div className="flex items-start gap-4">
                                    <div className="bg-amber-100 p-2 rounded-full text-amber-700 mt-1"><Clock className="w-6 h-6" /></div>
                                    <div>
                                        <h3 className="font-bold text-amber-900 text-lg">{isEn ? '1 Step Left: Validation & Payment' : 'Falta 1 Passo: Validação & Pagamento'}</h3>
                                        <p className="text-amber-800 text-sm mt-1">{isEn ? <>We have just sent you an email. <strong>You must open that email</strong> and click the link to access your account and pay, otherwise the booking will not become valid.</> : <>Enviámos agora mesmo um email para ti. <strong>Tens de abrir esse email</strong> e clicar no link para acederes à tua conta e pagares, senão a reserva não fica válida.</>}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-8 text-left">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{isEn ? 'Reference (save this number)' : 'Referência (Guarda este número)'}</p>
                                <p className="text-2xl font-mono font-bold text-slate-800 tracking-wider">#{id.slice(0, 8).toUpperCase()}</p>
                            </div>

                            <p className="text-sm text-slate-400 mb-6">
                                {isEn ? 'You can access this area later through the secure link we sent to your email.' : 'Podes aceder a esta área mais tarde através do link seguro que enviámos para o teu email.'}
                            </p>

                            <button
                                onClick={() => window.location.href = homePath}
                                className="w-full py-4 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all"
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
                    <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 max-w-md w-full">
                        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 mx-auto mb-6">
                            <Users className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">{isEn ? 'Confirm Your Identity' : 'Confirma a tua Identidade'}</h2>
                        <p className="text-slate-500 mb-6">{isEn ? 'To view your booking details, please sign in with the account you used.' : 'Para veres os detalhes da tua reserva, por favor faz login com a conta que usaste.'}</p>

                        <button
                            onClick={() => window.location.href = `${loginPath}?next=${encodeURIComponent(window.location.pathname)}`}
                            className="w-full py-3 px-6 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl font-bold transition-all"
                        >
                            {isEn ? 'Sign In to My Account' : 'Entrar na Minha Conta'}
                        </button>
                    </div>
                </div>
            </VIPLayout>
        );
    }

    if (loading) return <VIPLayout allowPublic={true}><div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-yellow-600 border-t-transparent rounded-full" /></div></VIPLayout>;

    if (!booking) return (
        <VIPLayout allowPublic={true}>
            <div className="flex justify-center py-20 text-slate-500">{isEn ? 'Booking not found.' : 'Reserva não encontrada.'}</div>
        </VIPLayout>
    );

    const handleOnlinePayment = async (paymentOverrideId?: string) => {
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
                    amountToPay: effectiveAmountToPay,
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
                        token: viewToken // Send token for authentication if present
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

    // Reusable payment panel (used both in desktop sticky aside and in the mobile inline view).
    const paymentPanel = (
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 rounded-[2rem] p-6 md:p-8 shadow-2xl border border-white/10 ring-1 ring-white/5 relative overflow-hidden">
            {uploadSuccess && (
                <div className="absolute inset-0 bg-green-600 flex flex-col items-center justify-center p-6 text-white z-10 animate-in fade-in zoom-in duration-300">
                    <CheckCircle2 className="w-16 h-16 mb-4 animate-bounce" />
                    <h3 className="text-2xl font-bold">{isEn ? 'Uploaded!' : 'Enviado!'}</h3>
                    <p className="text-green-100 text-base mt-2 text-center max-w-xs">{isEn ? 'Your receipt was received. We will validate it shortly.' : 'Comprovativo recebido. Vamos validar em breve.'}</p>
                    <button onClick={() => window.location.reload()} className="mt-6 px-6 py-3 bg-white text-green-700 font-bold rounded-xl shadow-lg text-sm hover:bg-green-50 transition-colors">{isEn ? 'Understood' : 'Entendido'}</button>
                </div>
            )}

            {/* Heading */}
            <div className="text-center mb-6">
                <p className="text-yellow-400 font-bold uppercase tracking-widest text-[11px] md:text-xs mb-1">
                    {isEn ? 'Pay Now' : 'Pagar Agora'} · {effectiveLabel}
                </p>
                {isConverted && exchangeRate && (
                    <p className="text-white/50 text-[11px] mt-1 font-medium">
                        {isEn ? 'Approx.' : 'Aprox.'} {effectiveAmountToPay} € · {isEn ? 'Rate' : 'Taxa'} {exchangeRate}
                    </p>
                )}
            </div>

            {/* Custom amount: input + chips (always visible when applicable) */}
            {canUseCustomAmount ? (
                <div className="mb-6">
                    <CustomPaymentAmount
                        suggestedAmount={amountToPay}
                        minAmount={customMinAmount}
                        maxAmount={totalRemaining}
                        minLabel={nextLabel}
                        paymentPlan={paymentPlan}
                        depositValue={depositValue}
                        paidAmount={paidAmount}
                        formatPrice={formatPrice}
                        active={useCustomAmount}
                        customAmount={customAmount}
                        onChange={setCustomAmount}
                    />
                </div>
            ) : (
                <div className="text-center mb-8">
                    <p className="text-4xl md:text-5xl font-black text-white tracking-tight break-words drop-shadow-sm" title={formatPrice(effectiveAmountToPay)}>
                        {formatPrice(effectiveAmountToPay)}
                    </p>
                </div>
            )}

            {/* Reduniq fee preview */}
            {showReduniqFeePreview && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mb-6 space-y-2 text-left shadow-inner">
                    <div className="flex items-center justify-between text-xs text-amber-50/80">
                        <span>{isEn ? 'Pilgrimage amount' : 'Valor peregrinação'}</span>
                        <span className="font-bold">{formatPrice(reduniqChargePreview.baseAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-amber-50/80">
                        <span>{isEn ? 'Reduniq fee' : 'Taxa Reduniq'}</span>
                        <span className="font-bold">{formatPrice(reduniqChargePreview.feeAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-white pt-2 border-t border-white/10">
                        <span className="font-semibold">{isEn ? 'Total at terminal' : 'Total no terminal'}</span>
                        <span className="font-black text-base">{formatPrice(reduniqChargePreview.chargedAmount)}</span>
                    </div>
                </div>
            )}

            {/* Primary CTA */}
            <button
                onClick={() => handleOnlinePayment(paymentOptions[0].id)}
                disabled={processing}
                className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 text-slate-900 font-black text-lg md:text-xl py-4 md:py-5 rounded-2xl shadow-xl shadow-yellow-500/20 flex items-center justify-center gap-3 transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
            >
                {processing ? (
                    <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span>{isEn ? 'Opening…' : 'A abrir…'}</span>
                    </>
                ) : (
                    <>
                        <CreditCard className="w-6 h-6" />
                        <span>{isEn ? `Pay Online` : `Pagar Online`}</span>
                    </>
                )}
            </button>

            {/* Accepted methods (bigger logos) */}
            <div className="mt-6">
                <p className="text-[11px] uppercase tracking-widest text-white/50 font-semibold text-center mb-3">
                    {isEn ? 'Accepted methods' : 'Métodos aceites'}
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                    {paymentOptions.map((opt) => (
                        <div
                            key={opt.id}
                            title={opt.label}
                            className="h-14 w-20 md:h-16 md:w-24 rounded-xl bg-white flex items-center justify-center p-2.5 shadow-md hover:shadow-lg transition-shadow"
                        >
                            {opt.iconSrc ? (
                                <img
                                    src={opt.iconSrc}
                                    alt={opt.iconAlt || opt.label}
                                    className="max-h-full max-w-full object-contain"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                            ) : (
                                <CreditCard className="w-6 h-6 text-slate-700" />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Reduniq feedback */}
            {(reduniqConfirming || reduniqFeedback) && (
                <div className={`mt-6 rounded-xl border px-4 py-3 text-sm shadow-inner ${reduniqConfirming
                    ? 'border-blue-500/40 bg-blue-500/15 text-blue-100'
                    : reduniqFeedback?.kind === 'success'
                        ? 'border-green-500/40 bg-green-500/15 text-green-100'
                        : reduniqFeedback?.kind === 'info'
                            ? 'border-amber-500/40 bg-amber-500/15 text-amber-100'
                            : 'border-red-500/40 bg-red-500/15 text-red-100'
                    }`}>
                    <p className="font-bold flex items-center gap-2">
                        {reduniqConfirming && <Loader2 className="w-4 h-4 animate-spin" />}
                        {reduniqConfirming ? (isEn ? 'Confirming…' : 'A confirmar…') : reduniqFeedback?.title}
                    </p>
                    <p className="text-[12px] mt-1 opacity-90 leading-relaxed">
                        {reduniqConfirming ? (isEn ? 'Please wait while we verify your payment.' : 'Aguarde enquanto verificamos o pagamento.') : reduniqFeedback?.message}
                    </p>
                </div>
            )}

            {/* Divider */}
            <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                <div className="relative flex justify-center">
                    <span className="bg-slate-950 px-4 text-[11px] text-white/40 uppercase tracking-widest font-bold">
                        {isEn ? 'or pay by' : 'ou pagar por'}
                    </span>
                </div>
            </div>

            {/* Bank transfer — mais destacado */}
            {isVerifying ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300 text-sm font-semibold flex items-center justify-center gap-2 shadow-inner">
                    <Clock className="w-5 h-5 animate-pulse" />
                    <span>{isEn ? 'Receipt under review' : 'Comprovativo em análise'}</span>
                </div>
            ) : (
                <button
                    onClick={() => { setShowMobilePaySheet(false); setShowBankModal(true); }}
                    className="w-full rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all p-4 md:p-5 flex items-center gap-4 text-left group"
                >
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-white shadow-sm group-hover:scale-105 transition-transform">
                        <Landmark className="w-6 h-6 md:w-7 md:h-7" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-base md:text-lg text-white">
                            {isEn ? 'Bank Transfer' : 'Transferência Bancária'}
                        </p>
                        <p className="text-[12px] text-white/55 mt-0.5 font-medium">
                            {isEn ? 'IBAN + upload receipt for validation' : 'IBAN + envio de comprovativo'}
                        </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white transition-colors shrink-0" />
                </button>
            )}

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
            <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-700">

                {/* --- 0. ERROR/EMPTY STATE --- */}
                {totalAmount === 0 && !loading && (
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-4xl p-10 text-center space-y-4 shadow-xl">
                        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mx-auto mb-4">
                            <AlertCircle className="w-10 h-10" />
                        </div>
                        <h2 className="text-3xl font-bold text-amber-900">{isEn ? 'Waiting for Validation' : 'Aguarde pela Validação'}</h2>
                        <p className="text-amber-800 text-lg max-w-xl mx-auto">
                            {isEn ? <>Your registration was recorded, but the total amounts are still being calculated by our system.<strong> You will receive an email shortly with the payment details.</strong></> : <>A sua inscrição foi registada, mas os valores totais ainda estão a ser calculados pelo nosso sistema.<strong> Receberá um email em breve com os dados de pagamento.</strong></>}
                        </p>
                        <button onClick={() => window.location.reload()} className="bg-amber-600 text-white px-8 py-4 rounded-2xl font-bold text-xl hover:bg-amber-700 transition-all">{isEn ? 'Refresh Page' : 'Atualizar Página'}</button>
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

                                {/* Summary chips */}
                                <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-lg md:text-xl font-bold text-slate-900">
                                            {isFullyPaid
                                                ? (isEn ? 'Trip Confirmed' : 'Viagem Confirmada')
                                                : (isEn ? 'Payment Progress' : 'Estado dos Pagamentos')}
                                        </h2>
                                        <button
                                            onClick={() => fetchBooking(true)}
                                            disabled={refreshing}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:text-slate-400 transition-colors"
                                            aria-label={isEn ? 'Refresh payments' : 'Atualizar pagamentos'}
                                        >
                                            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                            )}
                                            <span>{refreshing ? (isEn ? 'Updating' : 'A atualizar') : (isEn ? 'Refresh' : 'Atualizar')}</span>
                                        </button>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="mb-4">
                                        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1.5">
                                            <span>{isEn ? 'Paid' : 'Pago'} {formatPrice(paidAmount)}</span>
                                            <span>{percentPaid.toFixed(0)}%</span>
                                        </div>
                                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${isFullyPaid ? 'bg-green-500' : 'bg-indigo-500'}`}
                                                style={{ width: `${Math.min(100, percentPaid)}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Three chips */}
                                    <div className="grid grid-cols-3 gap-2 md:gap-3">
                                        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
                                            <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-400 mb-0.5">{isEn ? 'Total' : 'Total'}</p>
                                            <p className="text-sm md:text-base font-bold text-slate-900 break-words">{formatPrice(totalAmount)}</p>
                                        </div>
                                        <div className="rounded-xl bg-green-50 border border-green-100 p-3 text-center">
                                            <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-green-600 mb-0.5">{isEn ? 'Paid' : 'Pago'}</p>
                                            <p className="text-sm md:text-base font-bold text-green-700 break-words">{formatPrice(paidAmount)}</p>
                                        </div>
                                        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
                                            <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-amber-600 mb-0.5">{isEn ? 'Outstanding' : 'Em Falta'}</p>
                                            <p className="text-sm md:text-base font-bold text-amber-700 break-words">{formatPrice(Math.max(0, totalAmount - paidAmount))}</p>
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
                                    <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-100">
                                        <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-4">
                                            {isEn ? 'Payment Schedule' : 'Calendário de Pagamentos'}
                                        </h2>
                                        <ul className="divide-y divide-slate-100">
                                            {/* Deposit row */}
                                            <li className="flex items-center gap-3 md:gap-4 py-3 md:py-4">
                                                <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center shrink-0 ${isDepositPaid ? 'bg-green-100 text-green-700' : (isVerifying ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500')}`}>
                                                    {isDepositPaid ? <Check className="w-5 h-5" /> : (isVerifying ? <Clock className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-base text-slate-900">{isEn ? 'Registration Deposit' : 'Sinal de Inscrição'}</p>
                                                    <p className="text-xs md:text-sm text-slate-500">
                                                        {isDepositPaid
                                                            ? (isEn ? 'Paid' : 'Pago')
                                                            : (isVerifying ? (isEn ? 'Awaiting validation' : 'A aguardar validação') : (isEn ? 'Pending' : 'Pendente'))}
                                                    </p>
                                                </div>
                                                <p className="text-base md:text-lg font-bold text-slate-900 shrink-0">{formatPrice(depositValue)}</p>
                                            </li>
                                            {/* Installment rows */}
                                            {paymentPlan.map((step: any, idx: number) => {
                                                const state = getInstallmentState(idx, Number(step.amount));
                                                return (
                                                    <li key={idx} className="flex items-center gap-3 md:gap-4 py-3 md:py-4">
                                                        <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center shrink-0
                                                            ${state === 'paid' ? 'bg-green-100 text-green-700' :
                                                                state === 'verifying' ? 'bg-amber-100 text-amber-700' :
                                                                    'bg-slate-100 text-slate-500'}`}>
                                                            {state === 'paid' ? <Check className="w-5 h-5" /> :
                                                                state === 'verifying' ? <Clock className="w-5 h-5" /> :
                                                                    <CreditCard className="w-5 h-5" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-bold text-base text-slate-900">{isEn ? 'Installment' : 'Prestação'} {idx + 1}</p>
                                                            <p className="text-xs md:text-sm text-slate-500">
                                                                {state === 'paid' ? (isEn ? 'Paid' : 'Pago') :
                                                                    state === 'verifying' ? (isEn ? 'Awaiting validation' : 'A aguardar validação') :
                                                                        (isEn
                                                                            ? `Due ${format(new Date(step.date), 'dd MMM yyyy', { locale: dateLocale })}`
                                                                            : `Vence ${format(new Date(step.date), "dd 'de' MMM yyyy", { locale: dateLocale })}`)}
                                                            </p>
                                                        </div>
                                                        <p className="text-base md:text-lg font-bold text-slate-900 shrink-0">{formatPrice(Number(step.amount))}</p>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}

                                {/* Full payment summary (when not on installments) */}
                                {isFullPaymentFlow && (
                                    <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-100">
                                        <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-4">
                                            {isEn ? 'Full Payment' : 'Pagamento Total'}
                                        </h2>
                                        <ul className="divide-y divide-slate-100">
                                            <li className="flex items-center gap-3 md:gap-4 py-3 md:py-4">
                                                <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center shrink-0 ${isFullyPaid ? 'bg-green-100 text-green-700' : (isVerifying ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500')}`}>
                                                    {isFullyPaid ? <Check className="w-5 h-5" /> : (isVerifying ? <Clock className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-base text-slate-900">{isEn ? 'Total amount' : 'Valor total'}</p>
                                                    <p className="text-xs md:text-sm text-slate-500">
                                                        {isFullyPaid
                                                            ? (isEn ? 'Paid in full' : 'Totalmente pago')
                                                            : (isVerifying ? (isEn ? 'Awaiting validation' : 'A aguardar validação') :
                                                                paidAmount > 0
                                                                    ? (isEn ? `Paid ${formatPrice(paidAmount)} of ${formatPrice(totalAmount)}` : `Pago ${formatPrice(paidAmount)} de ${formatPrice(totalAmount)}`)
                                                                    : (isEn ? 'Pending' : 'Pendente'))}
                                                    </p>
                                                </div>
                                                <p className="text-base md:text-lg font-bold text-slate-900 shrink-0">{formatPrice(totalAmount)}</p>
                                            </li>
                                        </ul>
                                    </div>
                                )}

                                {/* Print button */}
                                <div className="text-center pt-2 pb-4">
                                    <button onClick={() => window.print()} className="text-slate-400 hover:text-slate-600 font-semibold text-sm flex items-center justify-center gap-2 mx-auto transition-colors">
                                        <Upload className="w-4 h-4 rotate-180" /> {isEn ? 'Download / Print Summary' : 'Descarregar / Imprimir Resumo'}
                                    </button>
                                </div>
                            </section>

                            {/* ============== RIGHT: PAY NOW — desktop sticky aside ============== */}
                            <aside className="lg:col-span-5 order-1 lg:order-2 hidden lg:block lg:sticky lg:top-6 self-start">
                                {!isFullyPaid && paymentPanel}

                                {isFullyPaid && (
                                    <div className="bg-green-50 rounded-3xl p-6 md:p-8 text-center border-2 border-green-200 border-dashed">
                                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-4 shadow-sm">
                                            <CheckCircle2 className="w-8 h-8" />
                                        </div>
                                        <h4 className="text-xl font-bold text-green-900">{isEn ? 'Registration Confirmed!' : 'Inscrição Confirmada!'}</h4>
                                        <p className="text-green-700 mt-1 font-medium text-sm">{isEn ? 'Your payment was received successfully.' : 'O seu pagamento foi recebido com sucesso.'}</p>
                                        <p className="text-green-800 mt-3 text-sm">{isEn ? 'We wish you an excellent pilgrimage.' : 'Desejamos-lhe uma excelente peregrinação.'}</p>
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
                                <div className="lg:hidden col-span-1 order-1 bg-green-50 rounded-3xl p-6 text-center border-2 border-green-200 border-dashed">
                                    <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-3 shadow-sm">
                                        <CheckCircle2 className="w-7 h-7" />
                                    </div>
                                    <h4 className="text-lg font-bold text-green-900">{isEn ? 'Registration Confirmed!' : 'Inscrição Confirmada!'}</h4>
                                    <p className="text-green-700 mt-1 font-medium text-sm">{isEn ? 'Payment received.' : 'Pagamento recebido.'}</p>
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
                formattedTotal={formatPrice(effectiveAmountToPay)}
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
        </VIPLayout>
    );
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
            <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-100">
                <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                        <QrCode className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg md:text-xl font-bold text-slate-900">{isEn ? 'Pilgrim Pass' : 'Passe de Peregrino'}</h2>
                        <p className="text-sm text-slate-500 mt-1">
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
        <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-emerald-100 overflow-hidden">
            <div className="flex items-start justify-between gap-4 mb-5">
                <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600 mb-1">
                            {isEn ? 'Confirmed' : 'Confirmada'}
                        </p>
                        <h2 className="text-lg md:text-xl font-bold text-slate-900">{isEn ? 'Pilgrim Pass' : 'Passe de Peregrino'}</h2>
                    </div>
                </div>
                <button
                    onClick={onRefresh}
                    disabled={loading}
                    className="text-xs font-bold text-slate-500 hover:text-slate-900 disabled:opacity-50"
                >
                    {loading ? (isEn ? 'Loading...' : 'A carregar...') : (isEn ? 'Refresh' : 'Atualizar')}
                </button>
            </div>

            {passes.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
                    {passes.map((pass, index) => (
                        <button
                            key={pass.id}
                            onClick={() => onSelect(index)}
                            className={`shrink-0 px-3 py-2 rounded-2xl text-xs font-bold border transition-all ${index === activeIndex
                                ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-white'
                                }`}
                        >
                            {pass.pilgrim.full_name?.split(' ').slice(0, 2).join(' ') || (isEn ? 'Pilgrim' : 'Peregrino')}
                        </button>
                    ))}
                </div>
            )}

            {loading && passes.length === 0 ? (
                <div className="rounded-3xl bg-slate-50 border border-slate-100 p-8 text-center text-slate-500">
                    <div className="animate-spin w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto mb-3" />
                    {isEn ? 'Preparing your pass...' : 'A preparar o teu passe...'}
                </div>
            ) : activePass ? (
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_190px] gap-5 items-center">
                    <div className="space-y-4">
                        <div className="rounded-3xl bg-slate-950 text-white p-5 relative overflow-hidden">
                            <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-emerald-400/10" />
                            <div className="relative">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300 mb-2">
                                    {isEn ? 'Personal identifier' : 'Identificador pessoal'}
                                </p>
                                <h3 className="text-2xl font-black leading-tight">{activePass.pilgrim.full_name}</h3>
                                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                                    <div className="rounded-2xl bg-white/8 p-3">
                                        <p className="text-white/40 uppercase font-bold tracking-wider mb-1">{isEn ? 'Room' : 'Quarto'}</p>
                                        <p className="font-bold">{activePass.pilgrim.room_type || '-'}</p>
                                    </div>
                                    <div className="rounded-2xl bg-white/8 p-3">
                                        <p className="text-white/40 uppercase font-bold tracking-wider mb-1">{isEn ? 'Flight' : 'Voo'}</p>
                                        <p className="font-bold">{activePass.pilgrim.flight_option || '-'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 text-sm text-slate-500">
                            <Bus className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
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
                <div className="rounded-3xl bg-amber-50 border border-amber-100 p-5 flex gap-3 text-amber-800">
                    <UserRound className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold">{isEn ? 'Pass unavailable' : 'Passe indisponível'}</p>
                        <p className="text-sm mt-1">{message || (isEn ? 'Could not prepare the pass yet.' : 'Ainda não foi possível preparar o passe.')}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
