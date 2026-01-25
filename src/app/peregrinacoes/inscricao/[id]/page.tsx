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
    FileText,
    ChevronDown,
    ChevronUp,
    MapPin,
    Calendar,
    Users,
    Check,
    Loader2,
    Package,
    Landmark,
    Smartphone,
    QrCode
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import InstallmentTracker from '../../../../components/booking/InstallmentTracker';
import BookingOnboardingModal from '../../../../components/booking/BookingOnboardingModal';
import BankTransferModal from '../../../../components/booking/BankTransferModal'; // Imported BankTransferModal

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

/* -------------------------------------------------------------------------- */
/*                                  Component                                 */
/* -------------------------------------------------------------------------- */

export default function BookingDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [processing, setProcessing] = useState(false);
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const isSuccess = searchParams?.get('success') === 'true';
    const currencyParam = searchParams?.get('currency') === 'BRL' ? 'BRL' : 'EUR';

    // Currency Hook
    const { format: formatPrice, rate: exchangeRate, loading: rateLoading } = useExchangeRate(currencyParam);
    const isConverted = currencyParam !== 'EUR';

    const sessionId = searchParams?.get('session_id');

    useEffect(() => {
        const verifyPayment = async () => {
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
    }, [isSuccess, sessionId, router]);

    const [booking, setBooking] = useState<Booking | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showPilgrims, setShowPilgrims] = useState(false);
    // Determine what to pay next - Moved to top to prevent Hook Error
    const [paymentMode, setPaymentMode] = useState<'deposit' | 'full'>('deposit');

    const [authError, setAuthError] = useState(false);

    const [uploadSuccess, setUploadSuccess] = useState(false);

    // Onboarding State
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [showBankModal, setShowBankModal] = useState(false); // New State for Bank Modal

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
    const depositValue = Number(booking?.pilgrimage?.deposit_value) || 0;
    const totalAmount = booking?.total_amount || 0;
    const paidAmount = booking?.paid_amount || 0;

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

    // Helper to find state of an installment
    const getInstallmentState = (index: number, amount: number) => {
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
    let nextLabel = "Total Restante";

    if (!isDepositPaid) {
        nextAmountToPay = depositValue - paidAmount;
        nextLabel = "Sinal de Inscrição";
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

            nextLabel = `Prestação ${nextIdx + 1} (${format(new Date(paymentPlan[nextIdx].date), 'MMMM', { locale: pt })})`;
        }
    }

    const amountToPay = nextAmountToPay;


    // Fetch Booking Data - Extracted for reuse
    const fetchBooking = async (isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true);
            console.log('🔄 [Client] Refreshing booking data...');
        }

        try {
            // Check for token in URL
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');

            // Use token if available, otherwise use session
            const url = token
                ? `/api/booking/${id}?token=${token}`
                : `/api/booking/${id}`;

            const res = await fetch(url);
            const data = await res.json();

            if (!res.ok) {
                // Check if it's an auth issue or just not found
                if (res.status === 401) setAuthError(true);
                else throw new Error(data.error || "Erro ao carregar");
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

    //  Initial fetch
    useEffect(() => {
        if (id) fetchBooking(false);
    }, [id]);

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
    const hasToken = urlParams?.get('token');

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
                            <h2 className="text-3xl font-bold text-slate-900 mb-2">QUASE LÁ!</h2>
                            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 text-left my-6 animate-pulse">
                                <div className="flex items-start gap-4">
                                    <div className="bg-amber-100 p-2 rounded-full text-amber-700 mt-1"><Clock className="w-6 h-6" /></div>
                                    <div>
                                        <h3 className="font-bold text-amber-900 text-lg">Falta 1 Passo: Validação & Pagamento</h3>
                                        <p className="text-amber-800 text-sm mt-1">Enviámos agora mesmo um email para ti. <strong>Tens de abrir esse email</strong> e clicar no link para acederes à tua conta e pagares, senão a reserva não fica válida.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-8 text-left">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Referência (Guarda este número)</p>
                                <p className="text-2xl font-mono font-bold text-slate-800 tracking-wider">#{id.slice(0, 8).toUpperCase()}</p>
                            </div>

                            <p className="text-sm text-slate-400 mb-6">
                                Podes aceder a esta área mais tarde através do link seguro que enviámos para o teu email.
                            </p>

                            <button
                                onClick={() => window.location.href = `/`}
                                className="w-full py-4 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all"
                            >
                                Voltar à Página Inicial
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
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Confirma a tua Identidade</h2>
                        <p className="text-slate-500 mb-6">Para veres os detalhes da tua reserva, por favor faz login com a conta que usaste.</p>

                        <button
                            onClick={() => window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`}
                            className="w-full py-3 px-6 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl font-bold transition-all"
                        >
                            Entrar na Minha Conta
                        </button>
                    </div>
                </div>
            </VIPLayout>
        );
    }

    if (loading) return <VIPLayout allowPublic={true}><div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-yellow-600 border-t-transparent rounded-full" /></div></VIPLayout>;

    if (!booking) return (
        <VIPLayout allowPublic={true}>
            <div className="flex justify-center py-20 text-slate-500">Reserva não encontrada.</div>
        </VIPLayout>
    );

    // Mock Handlers for buttons (since logic was missing)
    // Stripe Handler
    const handleStripePayment = async () => {
        setProcessing(true);
        try {
            const res = await fetch('/api/payments/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId: id, priceType: paymentMode })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Erro ao iniciar pagamento");

            if (data.url) {
                // Redirect to Stripe
                window.location.href = data.url;
            }
        } catch (e: any) {
            alert("Erro: " + e.message);
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

        setUploading(true);
        try {
            // Read file as base64
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Content = reader.result?.toString().split(',')[1];

                // Get token from URL if present
                const urlParams = new URLSearchParams(window.location.search);
                const viewToken = urlParams.get('token');

                const res = await fetch('/api/payments/upload-receipt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        bookingId: id,
                        fileData: base64Content,
                        fileName: file.name,
                        fileType: file.type,
                        installmentLabel: nextLabel,
                        installmentAmount: amountToPay,
                        token: viewToken // Send token for authentication if present
                    })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Erro no upload");

                setUploadSuccess(true);
                // Clean up success message after 5 seconds or keep it until reload
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
            };
        } catch (e: any) {
            alert("Erro ao enviar: " + e.message);
        } finally {
            setUploading(false);
        }
    };


    return (
        <VIPLayout allowPublic={true}>
            <div className="max-w-4xl mx-auto px-4 py-8 space-y-10 animate-in fade-in duration-700">

                {/* --- 0. ERROR/EMPTY STATE --- */}
                {totalAmount === 0 && !loading && (
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-4xl p-10 text-center space-y-4 shadow-xl">
                        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mx-auto mb-4">
                            <AlertCircle className="w-10 h-10" />
                        </div>
                        <h2 className="text-3xl font-bold text-amber-900">Aguarde pela Validação</h2>
                        <p className="text-amber-800 text-lg max-w-xl mx-auto">
                            A sua inscrição foi registada, mas os valores totais ainda estão a ser calculados pelo nosso sistema.
                            <strong> Receberá um email em breve com os dados de pagamento.</strong>
                        </p>
                        <button onClick={() => window.location.reload()} className="bg-amber-600 text-white px-8 py-4 rounded-2xl font-bold text-xl hover:bg-amber-700 transition-all">Atualizar Página</button>
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
                                    <span>Para voltares aqui: Menu &gt; <strong>Minhas Inscrições</strong></span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <p className="text-amber-500 font-bold uppercase tracking-[0.2em] text-xs md:text-sm">Reserva Registada com Sucesso</p>
                                <h1 className="text-4xl md:text-6xl font-serif font-bold text-white tracking-tight leading-tight drop-shadow-xl max-w-4xl mx-auto">
                                    {booking.pilgrimage.title}
                                </h1>
                                <p className="text-white/50 font-mono text-sm md:text-base">#{booking.id.slice(0, 8).toUpperCase()}</p>
                            </div>
                        </div>

                        {/* --- 2. THE BIG STATUS --- */}
                        <div className="bg-white rounded-[40px] p-8 md:p-12 shadow-2xl border border-slate-100 relative overflow-hidden">

                            <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500" />
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

                                <div className="lg:col-span-7 space-y-8 order-2 lg:order-1">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="space-y-2">
                                            <h3 className="text-3xl font-bold text-slate-900">
                                                {isFullyPaid ? 'VIAGEM CONFIRMADA!' : 'FALTA 1 PASSO: PAGAMENTO'}
                                            </h3>
                                            <p className="text-slate-500 text-xl leading-relaxed">
                                                {isFullyPaid
                                                    ? 'Já recebemos o seu pagamento total. Está pronto para partir!'
                                                    : 'A sua inscrição aguarda o pagamento do sinal para garantir o lugar.'}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0 bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100 hidden sm:block">
                                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Total</p>
                                            <p className="text-xl md:text-2xl font-serif font-bold text-slate-900">{formatPrice(totalAmount)}</p>
                                        </div>
                                    </div>

                                    {/* Payment Roadmap for Seniors */}
                                    <div className="space-y-6 pt-4">
                                        <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">O Seu Plano de Viagem</p>

                                        <div className="space-y-4">
                                            {/* Passo 1 */}
                                            <div className="flex items-center gap-6 group">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg border-2 transition-all ${isDepositPaid ? 'bg-green-500 border-green-400 text-white' : (isVerifying ? 'bg-amber-500 border-amber-400 text-white' : 'bg-red-50 border-red-200 text-red-600 animate-pulse')}`}>
                                                    {isDepositPaid ? <Check className="w-8 h-8" /> : (isVerifying ? <Clock className="w-8 h-8" /> : <CreditCard className="w-8 h-8" />)}
                                                </div>
                                                <div>
                                                    <p className={`font-bold text-xl ${isDepositPaid ? 'text-slate-900' : (isVerifying ? 'text-amber-600' : 'text-red-600')}`}>1. Pagamento do Sinal ({formatPrice(depositValue)})</p>
                                                    <p className="text-slate-500">
                                                        {isDepositPaid ? 'PAGO E CONFIRMADO' : (isVerifying ? 'A AGUARDAR VALIDAÇÃO...' : 'PENDENTE - Pagar Agora')}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Passos das Prestações Dinâmicas */}
                                            {hasPlan ? (
                                                paymentPlan.map((step: any, idx: number) => {
                                                    const state = getInstallmentState(idx, Number(step.amount));
                                                    return (
                                                        <div key={idx} className="space-y-4">
                                                            <div className="ml-7 w-0.5 h-8 bg-slate-100" />
                                                            <div className="flex items-center gap-6">
                                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg border-2 transition-all 
                                                                    ${state === 'paid' ? 'bg-green-500 border-green-400 text-white' :
                                                                        state === 'verifying' ? 'bg-amber-500 border-amber-400 text-white' :
                                                                            'bg-slate-50 border-slate-200 text-slate-400 opacity-50'}`}>
                                                                    {state === 'paid' ? <Check className="w-8 h-8" /> :
                                                                        state === 'verifying' ? <Clock className="w-8 h-8" /> :
                                                                            <CreditCard className="w-8 h-8" />}
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-xl text-slate-900">Prestação {idx + 1} ({formatPrice(Number(step.amount))})</p>
                                                                    <p className="text-slate-400">
                                                                        {state === 'paid' ? 'PAGO' :
                                                                            state === 'verifying' ? 'A AGUARDAR VALIDAÇÃO...' :
                                                                                `Vence a ${format(new Date(step.date), "dd 'de' MMMM", { locale: pt })}`}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <>
                                                    <div className="ml-7 w-0.5 h-8 bg-slate-100" />
                                                    <div className="flex items-center gap-6">
                                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg border-2 transition-all ${isFullyPaid ? 'bg-green-500 border-green-400 text-white' : 'bg-slate-50 border-slate-200 text-slate-400 opacity-50'}`}>
                                                            {isFullyPaid ? <Check className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-xl text-slate-900">2. Mensalidades / Restante</p>
                                                            <p className="text-slate-400">{isFullyPaid ? 'TUDO PAGO' : `Total de ${formatPrice(totalAmount - (isDepositPaid ? depositValue : 0))} à pagar`}</p>
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {/* Linha Conectora Final */}
                                            <div className="ml-7 w-0.5 h-8 bg-slate-100" />

                                            {/* Passo Final */}
                                            <div className="flex items-center gap-6">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg border-2 transition-all ${isFullyPaid ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-50 border-slate-100 text-slate-200'}`}>
                                                    <MapPin className="w-8 h-8" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-xl text-slate-900">{hasPlan ? (paymentPlan.length + 2) : 3}. Peregrinação</p>
                                                    <p className="text-slate-400">{isFullyPaid ? 'Desejamos-lhe uma excelente viagem!' : 'Aguardamos pela conclusão dos pagamentos'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* New Graphical Installment Tracker MOVED HERE to be part of the LEFT column flow */}
                                    <div className="mt-8">
                                        {/* Refresh Button */}
                                        <div className="flex justify-end mb-4">
                                            <button
                                                onClick={() => fetchBooking(true)}
                                                disabled={refreshing}
                                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-medium text-sm transition-all shadow-sm"
                                            >
                                                {refreshing ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        <span>A atualizar...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                        </svg>
                                                        <span>Atualizar Pagamentos</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        <InstallmentTracker
                                            totalAmount={totalAmount}
                                            paidAmount={paidAmount}
                                            depositValue={depositValue}
                                            paymentPlan={paymentPlan}
                                            payments={booking.payments || []}
                                            formatPrice={formatPrice}
                                        />
                                    </div>
                                </div>

                                {/* ACÇÕES DE PAGAMENTO (Direita) - UI OTIMIZADA PARA SENIORES */}
                                <div className="lg:col-span-5 space-y-6 self-start sticky top-8 order-1 lg:order-2">
                                    {!isFullyPaid && (
                                        <div className="bg-slate-950 rounded-[32px] p-6 md:p-8 text-center space-y-8 shadow-2xl border border-white/10 ring-8 ring-slate-100/50 relative overflow-hidden">
                                            {uploadSuccess && (
                                                <div className="absolute inset-0 bg-green-600 flex flex-col items-center justify-center p-6 text-white z-10 animate-in fade-in zoom-in duration-300">
                                                    <CheckCircle2 className="w-16 h-16 mb-4 animate-bounce" />
                                                    <h3 className="text-2xl font-bold">Enviado!</h3>
                                                    <p className="text-green-100 text-sm mt-2">O seu comprovativo foi recebido. Vamos validar e atualizar o estado da sua reserva em breve.</p>
                                                    <button onClick={() => window.location.reload()} className="mt-6 px-6 py-3 bg-white text-green-700 font-bold rounded-xl shadow-lg">Entendido</button>
                                                </div>
                                            )}

                                            <div className="space-y-1">
                                                <p className="text-yellow-500 font-bold uppercase tracking-widest text-xs">Valor a Pagar Agora: {nextLabel}</p>
                                                <p className="text-3xl md:text-5xl font-bold text-white tracking-tight break-words" title={formatPrice(amountToPay)}>
                                                    {formatPrice(amountToPay)}
                                                </p>
                                                {isConverted && exchangeRate && <p className="text-white/50 text-xs">Aprox. {amountToPay} € (Taxa: {exchangeRate})</p>}
                                            </div>

                                            {/* OPÇÃO 1: PAGAMENTO AUTOMÁTICO (Destaque Principal) */}
                                            <div className="space-y-4">
                                                <button
                                                    onClick={handleStripePayment}
                                                    disabled={processing}
                                                    className="w-full py-6 px-6 bg-yellow-500 hover:bg-yellow-400 text-slate-950 rounded-2xl font-extrabold text-2xl transition-all shadow-[0_10px_40px_rgba(234,179,8,0.3)] active:scale-95 disabled:opacity-50 flex flex-col items-center justify-center gap-1 group relative overflow-hidden"
                                                >
                                                    {processing ? (
                                                        <Loader2 className="animate-spin w-8 h-8" />
                                                    ) : (
                                                        <>
                                                            <div className="flex items-center gap-3">
                                                                <CreditCard className="w-6 h-6" />
                                                                <span>PAGAR ONLINE</span>
                                                            </div>
                                                            <p className="text-[10px] font-bold uppercase opacity-60 tracking-widest group-hover:opacity-80 transition-opacity">
                                                                Rápido e Automático
                                                            </p>
                                                        </>
                                                    )}
                                                </button>

                                                {/* Payment Methods Badges - REVISED */}
                                                <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
                                                    {/* Pix - Highlighted */}
                                                    <div className="bg-green-600 text-white px-3 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-green-900/50 scale-105 border border-green-400 relative group cursor-help transition-transform hover:scale-110" title="Disponível para contas do Brasil">
                                                        <QrCode className="w-5 h-5 text-white" />
                                                        <span className="font-bold text-sm tracking-wide">Pix (Brasil)</span>
                                                        <span className="absolute -top-2 -right-2 flex h-3 w-3">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                                        </span>
                                                    </div>

                                                    {/* MBWay - White BG fix */}
                                                    <div className="bg-white px-2 py-1.5 rounded-lg flex items-center gap-1.5 opacity-90 hover:opacity-100 transition-opacity" title="MBWay">
                                                        <img src="/payment-icons/mbway.svg" alt="MBWay" className="h-6 w-auto" />
                                                    </div>

                                                    {/* Cards - Explicit Logos */}
                                                    <div className="bg-white px-3 py-1.5 rounded-lg flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity">
                                                        <img src="https://upload.wikimedia.org/wikipedia/commons/4/41/Visa_Logo.png" alt="Visa" className="h-4 w-auto object-contain" />
                                                        <div className="w-[1px] h-4 bg-slate-200" />
                                                        <img src="https://upload.wikimedia.org/wikipedia/commons/b/b7/MasterCard_Logo.svg" alt="Mastercard" className="h-4 w-auto object-contain" />
                                                    </div>

                                                    {/* Apple Pay */}
                                                    <div className="bg-white text-black px-3 py-1.5 rounded-lg flex items-center gap-1.5 opacity-90 hover:opacity-100 transition-opacity" title="Apple Pay">
                                                        <span className="text-black text-sm font-bold font-sans">Pay</span>
                                                    </div>
                                                </div>
                                                <p className="text-white/40 text-[10px] font-medium uppercase tracking-widest mt-3">
                                                    Processamento Seguro e Imediato
                                                </p>
                                            </div>

                                            {/* SEPARATOR "OR" */}
                                            <div className="relative py-2">
                                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                                                <div className="relative flex justify-center"><span className="bg-slate-950 px-4 text-[10px] text-white/50 uppercase tracking-widest font-bold">OU ENTÃO</span></div>
                                            </div>

                                            {/* OPÇÃO 2: TRANSFERÊNCIA BANCÁRIA (Secundário) */}
                                            <div className="space-y-4">
                                                {isVerifying ? (
                                                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 text-sm font-bold flex flex-col items-center gap-2">
                                                        <Clock className="w-6 h-6" />
                                                        <p>Comprovativo em análise</p>
                                                        <p className="text-[10px] font-medium opacity-70">Aguarde a validação da nossa equipa.</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => setShowBankModal(true)}
                                                            className="w-full py-4 px-6 bg-white/5 hover:bg-white/10 border-2 border-dashed border-white/20 hover:border-white/40 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-3 group"
                                                        >
                                                            <Landmark className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                                                            <span>ou Transferência Bancária</span>
                                                        </button>
                                                        <p className="text-[10px] text-white/30 italic max-w-xs mx-auto">
                                                            Pode transferir pelo Multibanco ou Homebanking e enviar o comprovativo.
                                                        </p>
                                                    </>
                                                )}
                                            </div>

                                            {/* Hidden File Input for Modal Callback */}
                                            <input
                                                id="receipt-upload"
                                                type="file"
                                                accept="image/*,.pdf"
                                                className="hidden"
                                                onChange={handleReceiptUpload}
                                            />
                                        </div>
                                    )}

                                    {isFullyPaid && (
                                        <div className="bg-green-50 rounded-[32px] p-10 text-center border-4 border-green-200 border-dashed animate-in zoom-in duration-500">
                                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-6 shadow-sm">
                                                <CheckCircle2 className="w-10 h-10" />
                                            </div>
                                            <h4 className="text-2xl font-bold text-green-900">Inscrição Confirmada!</h4>
                                            <p className="text-green-700 mt-2 font-medium">O seu pagamento foi recebido com sucesso.</p>
                                            <div className="mt-6 p-4 bg-white/50 rounded-xl text-sm text-green-800">
                                                <p>Desejamos-lhe uma excelente peregrinação.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* --- 3. PLANO DE MENSALIDADES (Se aplicável) --- */}
                        {booking.payment_plan && booking.payment_plan.length > 0 && !isFullyPaid && (
                            <div className="bg-slate-50 rounded-4xl p-10 border border-slate-200">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                                    <div>
                                        <h3 className="text-2xl font-bold text-slate-900">Plano de Pagamentos Selecionado</h3>
                                        <p className="text-slate-500">Agendamento das suas próximas mensalidades (Dia 10 de cada mês)</p>
                                    </div>
                                    <div className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl font-bold">
                                        Total Restante: {formatPrice(totalAmount - paidAmount)}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {paymentPlan.map((inst: any, idx: number) => (
                                        <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex justify-between items-center group hover:border-indigo-200 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center font-bold text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                                                    {idx + 1}ª
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 capitalize">{format(new Date(inst.date), "MMMM yyyy", { locale: pt })}</p>
                                                    <p className="text-xs text-slate-400">Vencimento: Dia 10</p>
                                                </div>
                                            </div>
                                            <p className="text-2xl font-bold text-slate-900">{formatPrice(Number(inst.amount))}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}


                        <div className="text-center pb-12">
                            <button onClick={() => window.print()} className="text-slate-400 hover:text-slate-600 font-bold flex items-center justify-center gap-2 mx-auto transition-colors">
                                <Upload className="w-4 h-4 rotate-180" /> Descarregar / Imprimir Resumo
                            </button>
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
                totalAmount={amountToPay}
                formattedTotal={formatPrice(amountToPay)}
                iban="PT50 0033 0000 0000 0000 0000 0"
                onUploadClick={handleManualUpload}
            />
        </VIPLayout>
    );
}
