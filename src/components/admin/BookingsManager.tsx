"use client";

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import AdminTable from './AdminTable';
import { Download, Mail, Phone, AlertCircle, FileText, Settings, X, CreditCard, User, Bed, Plane, Heart, MoreVertical, Search, Filter, Calendar, MapPin, Shield, Info, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

const DetailItem = ({ label, value, capitalize = false }: { label: string; value?: string | number | null; capitalize?: boolean }) => (
    <div className="space-y-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-bold text-slate-700 ${capitalize ? 'capitalize' : ''}`}>
            {value || '-'}
        </p>
    </div>
);
import PaymentManagementTab from './payment/PaymentManagementTab';

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
    booking_status?: string;
    booking_ref?: string;
    created_at?: string;
    receipt_url?: string;
    paid_amount?: number;
    payment_id?: string;
    payment_status?: string;
    total_amount?: number;
    payment_plan?: any[];
}

export default function BookingsManager({ pilgrimageId }: { pilgrimageId: string }) {
    const [pilgrims, setPilgrims] = useState<Pilgrim[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchBookings = async () => {
        if (!supabaseBrowser) {
            console.error("Supabase client not initialized");
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            // Fetch bookings for this pilgrimage + joined pilgrims + payments
            const { data, error } = await supabaseBrowser
                .from('bookings')
                .select(`
                    id,
                    status,
                    created_at,
                    paid_amount,
                    total_amount,
                    payment_plan,
                    pilgrims (
                        id,
                        full_name,
                        email,
                        phone,
                        flight_option,
                        room_type,
                        allergies,
                        dietary_restrictions,
                        health_notes,
                        birth_date,
                        sex,
                        address,
                        postal_code,
                        city,
                        country,
                        notes,
                        cpf_nif
                    ),
                    payments: pilgrimage_payments (
                        id,
                        amount,
                        method,
                        status,
                        receipt_url,
                        notes,
                        created_at,
                        verified_at
                    ),
                    pilgrimage:pilgrimages (
                        id,
                        title,
                        deposit_value,
                        base_price
                    )
                `)
                .eq('pilgrimage_id', pilgrimageId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                // Flatten the structure: We want a row per pilgrim
                const flatList: Pilgrim[] = [];

                data.forEach((booking: any) => {
                    if (booking.pilgrims && Array.isArray(booking.pilgrims)) {
                        const verifyingPayment = booking.payments?.find((pay: any) => pay.status === 'verifying');

                        booking.pilgrims.forEach((p: any) => {
                            flatList.push({
                                ...p,
                                booking_id: booking.id,
                                booking_status: booking.status,
                                booking_ref: booking.id.slice(0, 8),
                                created_at: booking.created_at,
                                paid_amount: booking.paid_amount,
                                receipt_url: verifyingPayment?.receipt_url,
                                payment_id: verifyingPayment?.id,
                                payment_status: verifyingPayment?.status,
                                total_amount: booking.total_amount,
                                payment_plan: booking.payment_plan,
                                // Store full booking data for payment tab
                                _booking: booking
                            });
                        });
                    }
                });

                setPilgrims(flatList);

                // Refresh selectedBooking if one is open
                if (selectedBooking) {
                    const updated = flatList.find(p => p.id === selectedBooking.id);
                    if (updated) setSelectedBooking(updated);
                }
            }
        } catch (err) {
            console.error("Error fetching bookings:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (pilgrimageId) fetchBookings();
    }, [pilgrimageId]);

    // Helper: Convert Pilgrim data to booking format for PaymentManagementTab
    const pilgrimToBooking = (pilgrim: Pilgrim) => {
        const booking = (pilgrim as any)._booking;

        console.log('🔍 [pilgrimToBooking] Input:', {
            booking_id: pilgrim.booking_id,
            has_booking: !!booking,
            payments_in_booking: booking?.payments?.length || 0
        });

        // Parse payment_plan to ensure it's always an array
        let parsedPaymentPlan: any[] = [];
        try {
            if (Array.isArray(pilgrim.payment_plan)) {
                parsedPaymentPlan = pilgrim.payment_plan;
            } else if (typeof pilgrim.payment_plan === 'string') {
                parsedPaymentPlan = JSON.parse(pilgrim.payment_plan);
            }
        } catch (e) {
            console.error('Error parsing payment_plan:', e);
            parsedPaymentPlan = [];
        }

        const result = {
            id: pilgrim.booking_id || '',
            total_amount: pilgrim.total_amount || 0,
            paid_amount: pilgrim.paid_amount || 0,
            payment_plan: parsedPaymentPlan,
            payments: booking?.payments || [],
            pilgrimage: booking?.pilgrimage || { deposit_value: 0 }
        };

        console.log('🔍 [pilgrimToBooking] Output:', {
            payments_count: result.payments.length
        });

        return result;
    };

    const handleExport = () => {
        if (!pilgrims.length) return;

        // Define columns for export
        const headers = ["Nome", "Email", "Telemóvel", "Quarto", "Voo", "Sinal Pago", "Total Pago", "Total Devido", "Alergias", "Notas"];
        const csvRows = [
            headers.join(";"),
            ...pilgrims.map(p => [
                p.full_name,
                p.email || "",
                p.phone || "",
                p.room_type || "",
                p.flight_option || "",
                p.paid_amount || 0,
                p.paid_amount || 0, // Placeholder if same
                p.total_amount || 0,
                (p.allergies || "").replace(/;/g, ","),
                (p.notes || "").replace(/;/g, ",")
            ].join(";"))
        ];

        const blob = new Blob(["\ufeff" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `inscricoes_${pilgrimageId.slice(0, 5)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const [selectedBooking, setSelectedBooking] = useState<Pilgrim | null>(null);
    const [viewDetailPilgrim, setViewDetailPilgrim] = useState<Pilgrim | null>(null);
    const [activeDetailTab, setActiveDetailTab] = useState<'personal' | 'logistics' | 'finance'>('personal');

    const getFlightLabel = (option?: string) => {
        if (!option) return '-';
        const labels: Record<string, string> = {
            'own': 'Voo Próprio (Reserva pelo peregrino)',
            'group': 'Voo de Grupo (Incluído)',
            'agency': 'Agência Parceira'
        };
        return labels[option] || option;
    };

    const handleVerify = async (paymentId: string, bookingId: string) => {
        if (!confirm("Confirmar que este pagamento foi recebido?")) return;

        try {
            const res = await fetch('/api/admin/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentId, bookingId })
            });

            if (!res.ok) throw new Error("Erro ao validar");

            alert("Pagamento validado com sucesso!");
            fetchBookings();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const columns = [
        {
            key: 'full_name',
            header: 'Peregrino',
            sortable: true,
            render: (row: Pilgrim) => (
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 shrink-0">
                        <User className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="font-bold text-slate-900 leading-tight">{row.full_name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                            <span className="bg-slate-100 px-1 rounded">REF: {row.booking_ref}</span>
                            <span>•</span>
                            <span>{format(new Date(row.created_at!), 'dd/MM/yy')}</span>
                        </div>
                    </div>
                </div>
            )
        },
        {
            key: 'contacts',
            header: 'Contactos',
            render: (row: Pilgrim) => (
                <div className="flex flex-col gap-0.5">
                    {row.phone && (
                        <a href={`tel:${row.phone}`} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-indigo-600 transition-colors">
                            <Phone className="w-3 h-3" /> {row.phone}
                        </a>
                    )}
                    {row.email && (
                        <a href={`mailto:${row.email}`} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-600 transition-colors">
                            <Mail className="w-3 h-3" /> <span className="truncate max-w-[120px]">{row.email}</span>
                        </a>
                    )}
                </div>
            )
        },
        {
            key: 'payment_progress',
            header: 'Pagamento',
            render: (row: Pilgrim) => {
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
            render: (row: Pilgrim) => (
                <button
                    onClick={() => {
                        setViewDetailPilgrim(row);
                        setActiveDetailTab('personal');
                    }}
                    className="p-2 hover:bg-slate-100/80 rounded-full text-slate-400 hover:text-indigo-600 transition-all active:scale-95 group relative"
                >
                    <Info className="w-4 h-4" />
                    <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Ver Detalhes Completos
                    </span>
                </button>
            )
        }
    ];

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
                        <p className="text-4xl font-bold mt-2">{pilgrims.length}</p>
                        <div className="mt-4 flex items-center gap-2 text-[10px] font-bold bg-white/20 w-fit px-2 py-1 rounded-lg">
                            <Info className="w-3 h-3" /> Atualizado agora
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border-2 border-emerald-50 shadow-sm flex flex-col justify-between min-h-[140px] relative overflow-hidden group hover:border-emerald-100 transition-colors">
                        <div className="absolute -right-4 -bottom-4 text-emerald-500/10 group-hover:scale-110 transition-transform duration-500">
                            <CreditCard className="w-32 h-32" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Receita Coletada</p>
                        <p className="text-4xl font-bold text-emerald-600 mt-2">
                            {pilgrims.reduce((acc, p) => acc + (p.paid_amount || 0), 0)}€
                        </p>
                        <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                            Processado Via Stripe/Manual
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border-2 border-rose-50 shadow-sm flex flex-col justify-between min-h-[140px] relative overflow-hidden group hover:border-rose-100 transition-colors">
                        <div className="absolute -right-4 -bottom-4 text-rose-500/10 group-hover:scale-110 transition-transform duration-500">
                            <Calendar className="w-32 h-32" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Saldos Pendentes</p>
                        <p className="text-4xl font-bold text-rose-500 mt-2">
                            {pilgrims.reduce((acc, p) => acc + Math.max(0, (p.total_amount || 0) - (p.paid_amount || 0)), 0)}€
                        </p>
                        <div className="mt-4 text-[10px] font-bold text-rose-400">
                            Aguardando Prestações
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border-2 border-amber-50 shadow-sm flex flex-col justify-between min-h-[140px] relative overflow-hidden group hover:border-amber-100 transition-colors">
                        <div className="absolute -right-4 -bottom-4 text-amber-500/10 group-hover:scale-110 transition-transform duration-500">
                            <Shield className="w-32 h-32" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Validações Críticas</p>
                        <p className="text-4xl font-bold text-amber-600 mt-2">
                            {pilgrims.filter(p => p.payment_status === 'verifying').length}
                        </p>
                        <div className="mt-4 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                                Ações Necessárias
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <AdminTable
                data={pilgrims}
                columns={columns}
                isLoading={loading}
                searchPlaceholder="Pesquisar por nome, email ou referência..."
                itemsPerPage={20}
                actions={(row) => (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewDetailPilgrim(row)}
                            className="p-2 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                            title="Ver Ficha Completa"
                        >
                            <User className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setSelectedBooking(row)}
                            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-all shadow-sm"
                        >
                            <CreditCard className="w-3.5 h-3.5" /> Pagamentos
                        </button>
                    </div>
                )}
            />

            {/* Detail Drawer (View Full Info) */}
            {viewDetailPilgrim && (
                <div className="fixed inset-0 z-50 overflow-hidden">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => { setViewDetailPilgrim(null); setActiveDetailTab('personal'); }} />
                    <div className={`fixed inset-y-0 right-0 w-full md:w-[600px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 overflow-y-auto ${viewDetailPilgrim ? 'translate-x-0' : 'translate-x-full'}`}>
                        {/* Drawer Header */}
                        <div className="p-8 border-b border-slate-100 flex justify-between items-start bg-gradient-to-r from-slate-50 to-white rounded-tl-[40px]">
                            <div className="flex items-center gap-5">
                                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-slate-200 shrink-0 transform -rotate-3 hover:rotate-0 transition-transform">
                                    <User className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{viewDetailPilgrim.full_name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-sm text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-lg">#{viewDetailPilgrim.booking_ref}</span>
                                        <span className="text-slate-300">•</span>
                                        <p className="text-xs text-slate-500 font-medium italic">Inscrito em {format(new Date(viewDetailPilgrim.created_at!), 'dd MMM yyyy', { locale: pt })}</p>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => { setViewDetailPilgrim(null); setActiveDetailTab('personal'); }}
                                className="p-3 hover:bg-white rounded-2xl transition-all border border-transparent hover:border-slate-200 group"
                            >
                                <X className="w-6 h-6 text-slate-300 group-hover:text-slate-900" />
                            </button>
                        </div>

                        {/* Drawer Tabs Navigation */}
                        <div className="flex px-8 border-b border-slate-100 bg-white sticky top-0 z-10">
                            {[
                                { id: 'personal', label: 'Dados Pessoais', icon: Shield },
                                { id: 'logistics', label: 'Logística & Voo', icon: Plane },
                                { id: 'finance', label: 'Financeiro', icon: CreditCard }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveDetailTab(tab.id as any)}
                                    className={`flex items-center gap-2 px-4 py-4 text-xs font-bold transition-all border-b-2 ${activeDetailTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Drawer Body */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/30">

                            {activeDetailTab === 'personal' && (
                                <div className="space-y-8 animate-in fade-in duration-300">
                                    <section>
                                        <div className="flex items-center gap-2 mb-4 text-slate-800">
                                            <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                                            <h4 className="font-bold uppercase tracking-widest text-[10px]">Identificação Civil</h4>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                                            <DetailItem label="NIF / BI / CC" value={viewDetailPilgrim.cpf_nif} />
                                            <DetailItem label="Data Nascimento" value={viewDetailPilgrim.birth_date ? format(new Date(viewDetailPilgrim.birth_date), 'dd/MM/yyyy') : '-'} />
                                            <DetailItem label="Sexo" value={viewDetailPilgrim.sex} capitalize />
                                            <DetailItem label="Nacionalidade" value={viewDetailPilgrim.country} />
                                        </div>
                                    </section>

                                    <section>
                                        <div className="flex items-center gap-2 mb-4 text-slate-800">
                                            <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                                            <h4 className="font-bold uppercase tracking-widest text-[10px]">Contactos & Localização</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                                            <DetailItem label="Email Principal" value={viewDetailPilgrim.email} />
                                            <DetailItem label="Telemóvel" value={viewDetailPilgrim.phone} />
                                            <DetailItem label="WhatsApp" value={viewDetailPilgrim.whatsapp || viewDetailPilgrim.phone} />
                                            <div className="col-span-full border-t border-slate-50 mt-2 pt-4">
                                                <DetailItem label="Morada Completa" value={viewDetailPilgrim.address} />
                                                <div className="grid grid-cols-3 gap-4 mt-4">
                                                    <DetailItem label="Cod. Postal" value={viewDetailPilgrim.postal_code} />
                                                    <DetailItem label="Cidade" value={viewDetailPilgrim.city} />
                                                    <DetailItem label="País" value={viewDetailPilgrim.country} />
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}

                            {activeDetailTab === 'logistics' && (
                                <div className="space-y-8 animate-in fade-in duration-300">
                                    <section>
                                        <div className="flex items-center gap-2 mb-4 text-slate-800">
                                            <div className="w-1.5 h-4 bg-amber-500 rounded-full" />
                                            <h4 className="font-bold uppercase tracking-widest text-[10px]">Alojamento & Quartos</h4>
                                        </div>
                                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-6">
                                            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                                                <Bed className="w-7 h-7" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Configuração de Quarto</p>
                                                <p className="text-xl font-bold text-slate-900 capitalize">{viewDetailPilgrim.room_type || 'Duplo (Shared)'}</p>
                                            </div>
                                        </div>
                                    </section>

                                    <section>
                                        <div className="flex items-center gap-2 mb-4 text-slate-800">
                                            <div className="w-1.5 h-4 bg-sky-500 rounded-full" />
                                            <h4 className="font-bold uppercase tracking-widest text-[10px]">Opções de Voo</h4>
                                        </div>
                                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-600">
                                                    <Plane className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Preferência Selecionada</p>
                                                    <p className="text-lg font-bold text-slate-900">{getFlightLabel(viewDetailPilgrim.flight_option)}</p>
                                                </div>
                                            </div>
                                            {viewDetailPilgrim.flight_option === 'own' && (
                                                <div className="text-xs font-medium text-orange-700 bg-orange-50 p-3 rounded-xl border border-orange-100 flex items-start gap-2">
                                                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                                    <p>O peregrino optou por reservar o seu próprio voo. O transfer não está incluído automaticamente.</p>
                                                </div>
                                            )}
                                        </div>
                                    </section>

                                    <section>
                                        <div className="flex items-center gap-2 mb-4 text-rose-600">
                                            <div className="w-1.5 h-4 bg-rose-500 rounded-full" />
                                            <h4 className="font-bold uppercase tracking-widest text-[10px]">Restrições & Saúde</h4>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="bg-rose-50/50 p-6 rounded-3xl border border-rose-100">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                                                        <Heart className="w-5 h-5 fill-rose-600" />
                                                    </div>
                                                    <p className="text-xs font-bold text-rose-900 uppercase tracking-wider">Alergias Alimentares</p>
                                                </div>
                                                <p className="text-sm font-medium text-rose-800 bg-white p-4 rounded-xl border border-rose-100">
                                                    {viewDetailPilgrim.allergies || 'Nenhuma alergia reportada.'}
                                                </p>
                                            </div>


                                            <div className="bg-slate-100/50 p-6 rounded-3xl border border-slate-200">
                                                <div className="flex items-center gap-3 mb-3 text-slate-500">
                                                    <FileText className="w-5 h-5" />
                                                    <p className="text-xs font-bold uppercase tracking-wider">Notas Adicionais</p>
                                                </div>
                                                <p className="text-sm text-slate-600 italic px-4">
                                                    "{viewDetailPilgrim.notes || 'Sem observações extras do peregrino.'}"
                                                </p>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}

                            {activeDetailTab === 'finance' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-xl shadow-slate-200/50">
                                        <PaymentManagementTab
                                            booking={pilgrimToBooking(viewDetailPilgrim)}
                                            onUpdate={async () => await fetchBookings()}
                                        />
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Drawer Footer */}
                        <div className="p-8 border-t border-slate-100 bg-white flex items-center justify-between gap-4">
                            <button
                                onClick={() => { setViewDetailPilgrim(null); setActiveDetailTab('personal'); }}
                                className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                            >
                                Fechar Ficha
                            </button>
                            <button
                                onClick={() => { setSelectedBooking(viewDetailPilgrim); setViewDetailPilgrim(null); }}
                                className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                            >
                                <CreditCard className="w-5 h-5" /> Gerir Pagamentos
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Management Modal */}
            {selectedBooking && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-slate-50 w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="p-6 bg-white border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Gestão de Pagamentos</h3>
                                <p className="text-sm text-slate-500">Peregrino: <span className="font-bold text-indigo-600">{selectedBooking.full_name}</span> (Ref: #{selectedBooking.booking_ref})</p>
                            </div>
                            <button
                                onClick={() => setSelectedBooking(null)}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                            >
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto">
                            <PaymentManagementTab
                                booking={pilgrimToBooking(selectedBooking)}
                                onUpdate={async () => await fetchBookings()}
                            />
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
                            <button
                                onClick={() => setSelectedBooking(null)}
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
