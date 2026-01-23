"use client";

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import AdminTable from './AdminTable';
import { Download, Mail, Phone, AlertCircle, FileText, Settings, X, CreditCard, User, Users, Bed, Plane, Heart, MoreVertical, Search, Filter, Calendar, MapPin, Shield, Info, ClipboardList, CheckCircle2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import BookingInfoModal from './BookingInfoModal';
import PaymentManagementTab from './payment/PaymentManagementTab';

import { Payment } from './payment/PaymentHistory'; // Import shared type

// --- Types ---
interface Pilgrim {
    id: string;
    booking_id: string;
    full_name: string;
    email?: string;
    phone?: string;
    flight_option?: string;
    room_type?: string;
    allergies?: string;
    dietary_restrictions?: string;
    health_notes?: string;
    birth_date?: string;
    sex?: string;
    address?: string;
    postal_code?: string;
    city?: string;
    country?: string;
    whatsapp?: string;
    notes?: string;
    cpf_nif?: string;
}

interface Booking {
    id: string;
    status: string;
    created_at: string;
    // Relations
    pilgrims: Pilgrim[];
    // Finance
    total_amount: number;
    paid_amount: number;
    payment_plan?: any[];
    payments?: Payment[]; // Use imported type
    pilgrimage?: any;
    display_id?: number; // Optional friendly ID
}


// Helper to safely parse payment plan
const safeParsePaymentPlan = (plan: any): any[] => {
    if (!plan) return [];
    if (Array.isArray(plan)) return plan;
    if (typeof plan === 'string') {
        try {
            return JSON.parse(plan);
        } catch (e) {
            console.error("Error parsing payment plan:", e);
            return [];
        }
    }
    return [];
};


export default function BookingsManager({ pilgrimageId }: { pilgrimageId: string }) {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter/Search State (handled by table usually, but we have strict types)
    // We pass data directly to AdminTable

    const fetchBookings = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/admin/bookings/${pilgrimageId}`);
            const json = await response.json();

            if (!response.ok) {
                throw new Error(json.error || 'Failed to fetch');
            }

            const data = json.bookings || [];

            // Clean up data or sort
            // Ensure bookings is an array
            const safeBookings = Array.isArray(data) ? data : [];

            // Sort by created_at desc
            safeBookings.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            // Ensure payments match the required interface (add defaults if missing)
            const processedBookings = safeBookings.map((b: any) => ({
                ...b,
                payments: Array.isArray(b.payments) ? b.payments.map((p: any) => ({
                    ...p,
                    method: p.method || 'manual', // Default for legacy data
                    created_at: p.created_at || new Date().toISOString() // Default if missing
                })) : []
            }));

            setBookings(processedBookings);

        } catch (err) {
            console.error("Error fetching bookings:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (pilgrimageId) fetchBookings();
    }, [pilgrimageId]);


    // -- Modals State --
    const [paymentModalBooking, setPaymentModalBooking] = useState<Booking | null>(null);
    const [infoModalBooking, setInfoModalBooking] = useState<Booking | null>(null);

    // -- Delete --
    const handleDeleteBooking = async (bookingId: string) => {
        if (!confirm("⚠️ Tem a certeza ABSOLUTA que deseja eliminar esta reserva?\n\nIsto irá apagar:\n- Os dados dos peregrinos\n- O histórico de pagamentos\n\nEsta ação é irreversível.")) return;

        try {
            const res = await fetch(`/api/admin/bookings/operate/${bookingId}`, {
                method: 'DELETE'
            });
            const json = await res.json();

            if (!res.ok) throw new Error(json.error || "Erro ao eliminar");

            // Refresh list
            setBookings(prev => prev.filter(b => b.id !== bookingId));

        } catch (err: any) {
            alert("Erro: " + err.message);
        }
    };

    // -- Export --
    const handleExport = () => {
        if (!bookings.length) return;

        // Flatten for CSV (Row per Pilgrim)
        const headers = ["Reserva", "Nome", "Email", "Telemóvel", "Quarto", "Voo", "Sinal Pago", "Total Pago", "Total Devido", "Alergias", "Notas"];
        const csvRows = [headers.join(";")];

        bookings.forEach(b => {
            b.pilgrims?.forEach(p => {
                csvRows.push([
                    b.id.slice(0, 8),
                    p.full_name,
                    p.email || "",
                    p.phone || "",
                    p.room_type || "",
                    p.flight_option || "",
                    b.paid_amount || 0,
                    b.paid_amount || 0,
                    b.total_amount || 0,
                    (p.allergies || "").replace(/;/g, ","),
                    (p.notes || "").replace(/;/g, ",")
                ].join(";"));
            });
        });

        const blob = new Blob(["\ufeff" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `reservas_${pilgrimageId.slice(0, 5)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // -- Columns --
    const columns = [
        {
            key: 'ref',
            header: 'Reserva / Titular',
            sortable: true,
            render: (row: Booking) => {
                const leader = row.pilgrims?.[0];
                return (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 shrink-0 font-bold text-xs border border-slate-200">
                            #{row.id.slice(0, 4).toUpperCase()}
                        </div>
                        <div>
                            <div className="font-bold text-slate-900 leading-tight">{leader?.full_name || 'Sem Titular'}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                {format(new Date(row.created_at), 'dd/MM/yy HH:mm')}
                            </div>
                        </div>
                    </div>
                );
            }
        },
        {
            key: 'pax',
            header: 'Pax',
            render: (row: Booking) => (
                <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span className="font-bold text-slate-700">{row.pilgrims?.length || 0}</span>
                </div>
            )
        },
        {
            key: 'status',
            header: 'Estado',
            render: (row: Booking) => {
                const verifying = row.payments?.some(p => p.status === 'verifying');
                if (verifying) {
                    return (
                        <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 w-fit">
                            <Info className="w-3 h-3" /> Validar
                        </span>
                    );
                }
                const paid = row.paid_amount || 0;
                const total = row.total_amount || 0;
                if (total > 0 && paid >= total) {
                    return (
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" /> Concluído
                        </span>
                    );
                }
                return (
                    <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-full w-fit">
                        Em Curso
                    </span>
                );
            }
        },
        {
            key: 'payment_progress',
            header: 'Pagamento',
            render: (row: Booking) => {
                const total = row.total_amount || 0;
                const paid = row.paid_amount || 0;
                const percent = total > 0 ? Math.round((paid / total) * 100) : 0;
                const remaining = Math.max(0, total - paid);

                return (
                    <div className="flex flex-col gap-1 min-w-[140px]">
                        <div className="flex justify-between items-end text-[11px]">
                            <span className="font-bold text-slate-700">{paid.toFixed(2)}€</span>
                            <span className={remaining > 0 ? 'text-red-500 font-bold' : 'text-emerald-600 font-bold'}>
                                {remaining > 0 ? `-${remaining.toFixed(2)}€` : 'Liquidado'}
                            </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-700 ${percent >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                style={{ width: `${Math.min(100, percent)}%` }}
                            />
                        </div>
                        <div className="text-[10px] text-slate-400 text-right">
                            Total: {total.toFixed(2)}€
                        </div>
                    </div>
                );
            }
        },
        {
            key: 'actions',
            header: '',
            render: (row: Booking) => (
                <div className="flex items-center gap-2 justify-end">
                    <button
                        onClick={() => setInfoModalBooking(row)}
                        className="px-3 py-2 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors border border-transparent hover:border-slate-200 text-xs font-bold flex items-center gap-2"
                        title="Ver Ficha Completa"
                    >
                        <FileText className="w-3.5 h-3.5" /> Info
                    </button>
                    <button
                        onClick={() => setPaymentModalBooking(row)}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <CreditCard className="w-3.5 h-3.5" /> Pagamentos
                    </button>
                    <button
                        onClick={() => handleDeleteBooking(row.id)}
                        className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                        title="Eliminar Reserva"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ];

    // -- Stats Calculation --
    const totalPilgrims = bookings.reduce((acc, b) => acc + (b.pilgrims?.length || 0), 0);
    const totalRevenue = bookings.reduce((acc, b) => acc + (b.paid_amount || 0), 0);
    const totalPending = bookings.reduce((acc, b) => acc + Math.max(0, (b.total_amount || 0) - (b.paid_amount || 0)), 0);
    const validationsCount = bookings.filter(b => b.payments?.some(p => p.status === 'verifying')).length;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-2 h-8 bg-indigo-600 rounded-full" />
                            <h3 className="text-2xl font-bold font-serif text-slate-900 tracking-tight">Painel de Inscrições</h3>
                        </div>
                        <p className="text-slate-500 text-sm ml-5">Controlo logístico e financeiro em tempo real da peregrinação.</p>
                    </div>
                    <div className="flex items-center gap-3 w-full lg:w-auto">
                        <button
                            onClick={handleExport}
                            className="flex-1 lg:flex-none flex items-center justify-center gap-2 text-sm font-bold text-slate-700 bg-white border-2 border-slate-100 px-5 py-3 rounded-2xl hover:bg-slate-50 hover:border-slate-200 transition-all shadow-sm"
                        >
                            <Download className="w-4 h-4 text-indigo-600" /> Exportar Dados (CSV)
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-3xl text-white shadow-lg shadow-indigo-200 flex flex-col justify-between min-h-[140px] relative overflow-hidden group">
                        <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                            <User className="w-32 h-32" />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-wider opacity-80">Total Inscritos</p>
                        <p className="text-4xl font-bold mt-2">{totalPilgrims}</p>
                        <div className="mt-4 flex items-center gap-2 text-[10px] font-bold bg-white/20 w-fit px-2 py-1 rounded-lg">
                            <Info className="w-3 h-3" /> {bookings.length} Reservas
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border-2 border-emerald-50 shadow-sm flex flex-col justify-between min-h-[140px] relative overflow-hidden group hover:border-emerald-100 transition-colors">
                        <div className="absolute -right-4 -bottom-4 text-emerald-500/10 group-hover:scale-110 transition-transform duration-500">
                            <CreditCard className="w-32 h-32" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Receita Coletada</p>
                        <p className="text-4xl font-bold text-emerald-600 mt-2">{totalRevenue}€</p>
                        <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                            Processado
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border-2 border-rose-50 shadow-sm flex flex-col justify-between min-h-[140px] relative overflow-hidden group hover:border-rose-100 transition-colors">
                        <div className="absolute -right-4 -bottom-4 text-rose-500/10 group-hover:scale-110 transition-transform duration-500">
                            <Calendar className="w-32 h-32" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Saldos Pendentes</p>
                        <p className="text-4xl font-bold text-rose-500 mt-2">{totalPending}€</p>
                        <div className="mt-4 text-[10px] font-bold text-rose-400">
                            Aguardando Prestações
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border-2 border-amber-50 shadow-sm flex flex-col justify-between min-h-[140px] relative overflow-hidden group hover:border-amber-100 transition-colors">
                        <div className="absolute -right-4 -bottom-4 text-amber-500/10 group-hover:scale-110 transition-transform duration-500">
                            <Shield className="w-32 h-32" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Validações Críticas</p>
                        <p className="text-4xl font-bold text-amber-600 mt-2">{validationsCount}</p>
                        <div className="mt-4 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                                {validationsCount > 0 ? 'Ações Necessárias' : 'Tudo em dia'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <AdminTable
                data={bookings}
                columns={columns}
                isLoading={loading}
                searchPlaceholder="Pesquisar por titular, referência ou email..."
                itemsPerPage={20}
            // Actions now handled inside columns for better alignment
            />

            {/* Info Modal */}
            {infoModalBooking && (
                <BookingInfoModal
                    booking={infoModalBooking}
                    onClose={() => setInfoModalBooking(null)}
                />
            )}

            {/* Payment Modal (EXISTING - UNTOUCHED INTERNALS) */}
            {paymentModalBooking && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-slate-50 w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="p-6 bg-white border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Gestão de Pagamentos</h3>
                                <p className="text-sm text-slate-500">Ref: <span className="font-bold text-indigo-600">#{paymentModalBooking.id.slice(0, 8)}</span></p>
                            </div>
                            <button
                                onClick={() => setPaymentModalBooking(null)}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                            >
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto">
                            <PaymentManagementTab
                                booking={{
                                    ...paymentModalBooking,
                                    payment_plan: safeParsePaymentPlan(paymentModalBooking.payment_plan),
                                    payments: paymentModalBooking.payments || []
                                }}
                                onUpdate={async () => await fetchBookings()}
                            />
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
                            <button
                                onClick={() => setPaymentModalBooking(null)}
                                className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
