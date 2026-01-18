"use client";

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import AdminTable from './AdminTable';
import { Download, Mail, Phone, AlertCircle } from 'lucide-react';

interface Pilgrim {
    id: string;
    booking_id: string;
    full_name: string;
    email?: string;
    phone?: string;
    flight_option?: string;
    allergies?: string;
    notes?: string;
    cpf_nif?: string;
    booking_status?: string;
    booking_ref?: string;
    created_at?: string;
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
            // Fetch bookings for this pilgrimage + joined pilgrims
            const { data, error } = await supabaseBrowser
                .from('bookings')
                .select(`
                    id,
                    status,
                    created_at,
                    pilgrims (
                        id,
                        full_name,
                        email,
                        phone,
                        flight_option,
                        allergies,
                        notes,
                        cpf_nif
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
                        booking.pilgrims.forEach((p: any) => {
                            flatList.push({
                                ...p,
                                booking_id: booking.id,
                                booking_status: booking.status,
                                booking_ref: booking.id.slice(0, 8), // Short ref
                                created_at: booking.created_at
                            });
                        });
                    }
                });

                setPilgrims(flatList);
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

    const columns = [
        {
            key: 'full_name',
            header: 'Nome',
            sortable: true,
            render: (row: Pilgrim) => (
                <div>
                    <div className="font-bold text-slate-800">{row.full_name}</div>
                    <div className="text-xs text-slate-400 mt-0.5 max-w-[150px] truncate" title={row.booking_id}>Ref: {row.booking_ref}</div>
                </div>
            )
        },
        {
            key: 'contacts',
            header: 'Contactos',
            render: (row: Pilgrim) => (
                <div className="flex flex-col gap-1 text-sm">
                    {row.email && (
                        <div className="flex items-center gap-1.5 text-slate-600">
                            <Mail className="w-3 h-3" /> <span className="truncate max-w-[180px]">{row.email}</span>
                        </div>
                    )}
                    {row.phone && (
                        <div className="flex items-center gap-1.5 text-slate-600">
                            <Phone className="w-3 h-3" /> <span>{row.phone}</span>
                        </div>
                    )}
                </div>
            )
        },
        {
            key: 'flight_option',
            header: 'Voos',
            sortable: true,
            render: (row: Pilgrim) => (
                <span className="text-sm font-medium text-slate-700">
                    {row.flight_option || '-'}
                </span>
            )
        },
        {
            key: 'info',
            header: 'Info Extra',
            render: (row: Pilgrim) => (
                <div className="space-y-1">
                    {row.allergies && row.allergies !== 'Não' && (
                        <div className="flex items-start gap-1 text-xs text-red-600 bg-red-50 p-1 rounded">
                            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                            <span className="font-bold">Alergia: {row.allergies}</span>
                        </div>
                    )}
                    {row.notes && (
                        <div className="text-xs text-slate-500 italic border-l-2 border-slate-300 pl-2">
                            "{row.notes}"
                        </div>
                    )}
                </div>
            )
        },
        {
            key: 'status',
            header: 'Estado',
            render: (row: Pilgrim) => {
                const colors: any = {
                    'confirmed': 'bg-green-100 text-green-700 border-green-200',
                    'pending': 'bg-yellow-100 text-yellow-700 border-yellow-200',
                    'cancelled': 'bg-red-50 text-red-500 border-red-100'
                };
                const status = row.booking_status || 'pending';
                return (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
                        {status === 'confirmed' ? 'Confirmado' : status === 'pending' ? 'Pendente' : status}
                    </span>
                );
            }
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h3 className="text-lg font-bold font-serif text-slate-900">Gestão de Inscrições</h3>
                    <p className="text-slate-500 text-sm">Lista de todos os peregrinos inscritos nesta viagem.</p>
                </div>
                <button className="flex items-center gap-2 text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition-colors">
                    <Download className="w-4 h-4" /> Exportar Excel / CSV
                </button>
            </div>

            <AdminTable
                data={pilgrims}
                columns={columns}
                isLoading={loading}
                searchPlaceholder="Pesquisar por nome, email ou referência..."
                itemsPerPage={20}
            />
        </div>
    );
}
