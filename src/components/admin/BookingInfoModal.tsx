import { X, User, Bed, Plane, FileText, Phone, Mail, Shield, AlertCircle, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Pilgrim {
    id: string;
    full_name: string;
    email?: string;
    phone?: string;
    birth_date?: string;
    sex?: string;
    address?: string;
    postal_code?: string;
    city?: string;
    country?: string;
    flight_option?: string;
    room_type?: string;
    allergies?: string;
    notes?: string;
    cpf_nif?: string;
}

interface Booking {
    id: string;
    status: string;
    created_at: string;
    total_amount: number;
    paid_amount: number;
    pilgrims: Pilgrim[];
    payment_plan?: any;
    payments?: any[];
}

interface BookingInfoModalProps {
    booking: Booking;
    onClose: () => void;
}

export default function BookingInfoModal({ booking, onClose }: BookingInfoModalProps) {
    if (!booking) return null;

    const getFlightLabel = (option?: string) => {
        if (!option) return '-';
        const labels: Record<string, string> = {
            'own': 'Voo Próprio',
            'group': 'Voo de Grupo',
            'agency': 'Agência Parceira'
        };
        return labels[option] || option;
    };

    const getRoomLabel = (type?: string) => {
        if (!type) return '-';
        const labels: Record<string, string> = {
            'single': 'Quarto Individual',
            'double': 'Quarto Duplo',
            'triple': 'Quarto Triplo',
            'family': 'Quarto Familiar'
        };
        return labels[type] || type;
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-slate-50 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 bg-white border-b border-slate-200 flex justify-between items-center sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900">Detalhes da Inscrição</h3>
                            <p className="text-sm text-slate-500 flex items-center gap-2">
                                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs">#{booking.id.slice(0, 8).toUpperCase()}</span>
                                <span>•</span>
                                <span>{format(new Date(booking.created_at), "d 'de' MMMM, yyyy", { locale: pt })}</span>
                                <span>•</span>
                                <span className="font-bold text-slate-700">{booking.pilgrims?.length || 0} Peregrinos</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-8 bg-slate-50/50">
                    {/* Pilgrims List */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <User className="w-5 h-5 text-indigo-600" />
                            <h4 className="font-bold text-slate-900 uppercase tracking-widest text-xs">Peregrinos & Logística</h4>
                        </div>

                        {booking.pilgrims?.map((p, idx) => (
                            <div key={idx} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:border-indigo-200 transition-colors">
                                <div className="flex flex-col md:flex-row gap-6">
                                    {/* Personal Info */}
                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">#{idx + 1}</span>
                                                <h5 className="font-bold text-lg text-slate-900">{p.full_name}</h5>
                                            </div>
                                            <div className="flex flex-wrap gap-4 text-sm text-slate-600 mt-2">
                                                {p.email && (
                                                    <div className="flex items-center gap-1.5" title="Email">
                                                        <Mail className="w-3.5 h-3.5 text-slate-400" /> {p.email}
                                                    </div>
                                                )}
                                                {p.phone && (
                                                    <div className="flex items-center gap-1.5" title="Telemóvel">
                                                        <Phone className="w-3.5 h-3.5 text-slate-400" /> {p.phone}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-500 border-t border-slate-50 pt-3">
                                                <div>
                                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Nascimento</span>
                                                    {p.birth_date ? format(new Date(p.birth_date), 'dd/MM/yyyy') : '-'} ({p.sex})
                                                </div>
                                                <div>
                                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Doc. ID</span>
                                                    {p.cpf_nif || '-'}
                                                </div>
                                            </div>
                                            {p.address && (
                                                <div className="mt-3 text-xs text-slate-500 flex items-start gap-1.5">
                                                    <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                                                    {p.address}, {p.postal_code} {p.city} ({p.country})
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Logistics Info */}
                                    <div className="md:w-64 bg-slate-50 rounded-xl p-4 space-y-4 border border-slate-100">
                                        <div>
                                            <div className="flex items-center gap-2 text-amber-600 mb-1">
                                                <Bed className="w-4 h-4" />
                                                <span className="text-[10px] font-bold uppercase">Alojamento</span>
                                            </div>
                                            <p className="font-bold text-sm text-slate-700">{getRoomLabel(p.room_type)}</p>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 text-sky-600 mb-1">
                                                <Plane className="w-4 h-4" />
                                                <span className="text-[10px] font-bold uppercase">Transporte</span>
                                            </div>
                                            <p className="font-bold text-sm text-slate-700">{getFlightLabel(p.flight_option)}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Notes & Allergies */}
                                {(p.allergies || p.notes) && (
                                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {p.allergies && (
                                            <div className="bg-rose-50 p-3 rounded-lg border border-rose-100 text-xs">
                                                <span className="font-bold text-rose-700 block mb-1">⚠️ Alergias / Saúde</span>
                                                <span className="text-rose-900">{p.allergies}</span>
                                            </div>
                                        )}
                                        {p.notes && (
                                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-xs">
                                                <span className="font-bold text-yellow-700 block mb-1">📝 Observações</span>
                                                <span className="text-yellow-900">{p.notes}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all text-sm"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}
