"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import VIPLayout from '../../../../components/member/VIPLayout';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import {
    CreditCard,
    Upload,
    CheckCircle2,
    Clock,
    AlertCircle,
    FileText,
    ChevronDown,
    ChevronUp,
    MapPin,
    Calendar,
    Users
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

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
    };
    payments: any[];
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
    const [uploading, setUploading] = useState(false);
    const [showPilgrims, setShowPilgrims] = useState(false);
    // Determine what to pay next - Moved to top to prevent Hook Error
    const [paymentMode, setPaymentMode] = useState<'deposit' | 'full'>('deposit');

    const [authError, setAuthError] = useState(false);

    // -- Derived State (Moved to Top) --
    const depositValue = booking?.pilgrimage?.deposit_value || 0;
    const totalAmount = booking?.total_amount || 0;
    const paidAmount = booking?.paid_amount || 0;

    const isFullyPaid = paidAmount >= totalAmount;
    const isDepositPaid = paidAmount >= depositValue;
    const percentPaid = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

    const amountToPay = paymentMode === 'full'
        ? (totalAmount - paidAmount)
        : (depositValue - paidAmount > 0 ? depositValue - paidAmount : totalAmount - paidAmount);


    // Fetch Booking Data
    useEffect(() => {
        const fetchBooking = async () => {
            if (!supabaseBrowser) return;

            // Try to get session, but don't block
            const { data: { session } } = await supabaseBrowser.auth.getSession();

            const { data, error } = await supabaseBrowser
                .from('bookings')
                .select(`
                    *,
                    pilgrims (*),
                    pilgrimage:pilgrimages (title, start_date, end_date, cover_image, deposit_value),
                    payments:pilgrimage_payments (*)
                `)
                .eq('id', id)
                .single();

            if (error) {
                console.error(error);
                // If error is permission denied (401/403) and we have no session, show auth prompt
                if (!session || error.code === 'PGRST301' || error.code === '401') {
                    setAuthError(true);
                }
            } else {
                setBooking(data);
            }
            setLoading(false);
        };

        if (id) fetchBooking();
    }, [id]);

    // ... (rest of logic)

    // Inline Login Prompt if Auth Failed
    if (authError && !booking) {
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
        alert("Upload manual em desenvolvimento.");
    };


    return (
        <VIPLayout allowPublic={true}>
            <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

                {/* Header Card */}
                <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 flex flex-col md:flex-row gap-8 items-center md:items-start relative overflow-hidden">
                    {/* Event Image */}
                    <div className="w-full md:w-1/3 h-48 rounded-2xl overflow-hidden relative shadow-md">
                        <img src={booking.pilgrimage.cover_image || '/placeholder.jpg'} alt="Cover" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/10" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 w-full text-center md:text-left z-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold uppercase tracking-wider mb-2">
                            Inscrição #{booking.id.slice(0, 8)}
                        </div>
                        <h1 className="text-3xl font-serif font-bold text-slate-900 mb-2">{booking.pilgrimage.title}</h1>
                        <p className="text-slate-500 mb-6 flex flex-wrap gap-4 justify-center md:justify-start">
                            <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {format(new Date(booking.pilgrimage.start_date), "d MMM yyyy", { locale: pt })}</span>
                            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {booking.pilgrims.length} Peregrinos</span>
                        </p>

                        {/* Progress Bar */}
                        <div className="bg-slate-100 rounded-full h-4 w-full overflow-hidden mb-2 relative">
                            {/* Deposit Marker */}
                            <div className="absolute top-0 bottom-0 border-r-2 border-white/50 z-20 flex flex-col justify-center items-end pr-1" style={{ left: `${(booking.pilgrimage.deposit_value / booking.total_amount) * 100}%` }}>
                                {/* <span className="text-[9px] font-bold text-slate-400 -mt-6">Sinal</span> */}
                            </div>
                            <div
                                className={`h-full transition-all duration-1000 relative z-10 ${isFullyPaid ? 'bg-green-500' : isDepositPaid ? 'bg-indigo-500' : 'bg-yellow-500'}`}
                                style={{ width: `${percentPaid}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-sm font-medium">
                            <span className="text-slate-500">Pago: <span className="text-slate-900">{booking.paid_amount}€</span></span>
                            <span className="text-slate-500">Total: <span className="text-slate-900">{booking.total_amount}€</span></span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: Payments */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Payment Actions */}
                        {!isDepositPaid && !isFullyPaid && (
                            <div className="bg-red-50 border border-red-100 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-4 text-center md:text-left animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <div className="p-3 bg-red-100 rounded-full text-red-600 flex-shrink-0">
                                    <AlertCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-red-900 text-lg">Lugar não garantido!</h3>
                                    <p className="text-red-700 text-sm">A tua inscrição só fica confirmada após o pagamento do sinal de <strong>{Math.max(0, depositValue - paidAmount)}€</strong>.</p>
                                </div>
                            </div>
                        )}

                        {/* Payment Actions */}
                        {!isFullyPaid && (
                            <div className="bg-white rounded-3xl p-8 shadow-lg border border-slate-100">
                                <h2 className="text-xl font-bold text-slate-900 mb-6">Fazer Pagamento</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button
                                        onClick={handleStripePayment}
                                        disabled={processing}
                                        className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed w-full"
                                    >
                                        {processing ? (
                                            <div className="w-12 h-12 flex items-center justify-center mb-3">
                                                <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
                                            </div>
                                        ) : (
                                            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-3 group-hover:scale-110 transition-transform">
                                                <CreditCard className="w-6 h-6" />
                                            </div>
                                        )}
                                        <h3 className="font-bold text-slate-900 text-lg">{processing ? 'A processar...' : `${amountToPay.toFixed(2)}€`}</h3>
                                        <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">Pagar com Cartão / MBWay</p>
                                    </button>

                                    {!isDepositPaid && (
                                        <div className="col-span-1 md:col-span-2 flex justify-center gap-4 mt-2">
                                            <button
                                                onClick={() => setPaymentMode('deposit')}
                                                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${paymentMode === 'deposit' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                            >
                                                Pagar Taxa de Inscrição ({depositValue}€)
                                            </button>
                                            <button
                                                onClick={() => setPaymentMode('full')}
                                                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${paymentMode === 'full' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                            >
                                                Pagar Totalidade
                                            </button>
                                        </div>
                                    )}

                                    <label className="cursor-pointer flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-slate-100 hover:border-yellow-600 hover:bg-yellow-50 transition-all group relative">
                                        <input type="file" className="hidden" onChange={handleManualUpload} accept="image/*,application/pdf" disabled={uploading} />
                                        {uploading ? (
                                            <div className="animate-spin w-8 h-8 border-2 border-yellow-600 border-t-transparent rounded-full" />
                                        ) : (
                                            <>
                                                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 mb-3 group-hover:scale-110 transition-transform">
                                                    <Upload className="w-6 h-6" />
                                                </div>
                                                <h3 className="font-bold text-slate-900">Enviar Comprovativo</h3>
                                                <p className="text-xs text-slate-500 mt-1">Transferência Bancária</p>
                                            </>
                                        )}
                                    </label>
                                </div>
                                <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <p className="text-sm text-slate-600 font-medium mb-1">Dados para Transferência:</p>
                                    <p className="text-sm text-slate-500 font-mono">IBAN: PT50 0000 0000 0000 0000 0000 0</p>
                                    <p className="text-sm text-slate-500 mt-1">Titular: Apostolado de Garabandal</p>
                                </div>
                            </div>
                        )}

                        {/* Payment History */}
                        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                            <h2 className="text-xl font-bold text-slate-900 mb-6">Histórico de Pagamentos</h2>
                            {booking.payments.length === 0 ? (
                                <p className="text-slate-400 text-center py-4">Ainda não existem pagamentos registados.</p>
                            ) : (
                                <div className="space-y-4">
                                    {booking.payments.map((payment) => (
                                        <div key={payment.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                                            <div className="flex items-center gap-3">
                                                {payment.status === 'verified' ? (
                                                    <div className="bg-green-100 p-2 rounded-full text-green-600"><CheckCircle2 className="w-5 h-5" /></div>
                                                ) : (
                                                    <div className="bg-yellow-100 p-2 rounded-full text-yellow-600"><Clock className="w-5 h-5" /></div>
                                                )}
                                                <div>
                                                    <p className="font-bold text-slate-900 capitalize">{payment.method.replace('_', ' ')}</p>
                                                    <p className="text-xs text-slate-500">{format(new Date(payment.created_at), "d MMM yyyy HH:mm")}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-slate-900">{payment.amount}€</p>
                                                <p className={`text-xs font-bold uppercase tracking-wider ${payment.status === 'verified' ? 'text-green-600' : 'text-yellow-600'}`}>
                                                    {payment.status === 'verified' ? 'Confirmado' : 'Em Análise'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Right Column: Support & Summary */}
                    <div className="space-y-6">
                        {/* Status Card */}
                        <div className={`rounded-3xl p-6 border shadow-lg ${isFullyPaid ? 'bg-green-50 border-green-100' : 'bg-slate-900 text-white border-white/10'}`}>
                            <div className="flex items-start gap-4">
                                <AlertCircle className={`w-6 h-6 flex-shrink-0 ${isFullyPaid ? 'text-green-600' : 'text-yellow-500'}`} />
                                <div>
                                    <h3 className={`font-bold text-lg mb-1 ${isFullyPaid ? 'text-green-900' : 'text-white'}`}>
                                        {isFullyPaid ? 'Inscrição Confirmada' : 'Pagamento Pendente'}
                                    </h3>
                                    <p className={`text-sm leading-relaxed ${isFullyPaid ? 'text-green-700' : 'text-slate-400'}`}>
                                        {isFullyPaid
                                            ? "Tudo pronto! O pagamento total foi recebido. Em breve receberás mais informações sobre a viagem."
                                            : "Para garantir o teu lugar, regulariza o sinal ou o valor total o mais brevemente possível."
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Pilgrims Review Toggle */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                            <button
                                onClick={() => setShowPilgrims(!showPilgrims)}
                                className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
                            >
                                <span className="font-bold text-slate-900 flex items-center gap-2"><Users className="w-4 h-4 text-slate-400" /> Peregrinos Inscritos</span>
                                {showPilgrims ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </button>

                            {showPilgrims && (
                                <div className="px-6 pb-6 space-y-4 border-t border-slate-100 pt-4 bg-slate-50/50">
                                    {booking.pilgrims.map((p, idx) => (
                                        <div key={idx} className="flex items-center gap-3 text-sm">
                                            <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-500 text-xs">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">{p.full_name}</p>
                                                <p className="text-xs text-slate-500">{p.room_type === 'single' ? 'Quarto Individual' : 'Quarto Duplo'}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </VIPLayout>
    );
}
