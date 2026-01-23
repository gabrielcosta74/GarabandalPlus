"use client";

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import AdminTable from './AdminTable';
import { Mail, Phone, Clock, User, Trash2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface WaitlistEntry {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    notes: string;
    created_at: string;
    status: string;
}

export default function WaitlistManager({ pilgrimageId }: { pilgrimageId: string }) {
    const [leads, setLeads] = useState<WaitlistEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchWaitlist = async () => {
        if (!supabaseBrowser) return;
        setLoading(true);
        try {
            const { data, error } = await supabaseBrowser
                .from('pilgrimage_waitlists')
                .select('*')
                .eq('pilgrimage_id', pilgrimageId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setLeads(data || []);
        } catch (err) {
            console.error("Error fetching waitlist:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (pilgrimageId) fetchWaitlist();
    }, [pilgrimageId]);

    const handleDelete = async (id: string) => {
        if (!confirm("Remover da lista de espera?")) return;
        const { error } = await supabaseBrowser!.from('pilgrimage_waitlists').delete().eq('id', id);
        if (!error) setLeads(prev => prev.filter(l => l.id !== id));
    };

    const columns = [
        {
            key: 'name',
            header: 'Interessado',
            render: (row: WaitlistEntry) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                        <User className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="font-bold text-slate-900">{row.full_name}</div>
                        <div className="text-[10px] text-slate-400 font-medium">Entrou em {format(new Date(row.created_at), 'dd/MM/yy HH:mm')}</div>
                    </div>
                </div>
            )
        },
        {
            key: 'contact',
            header: 'Contacto',
            render: (row: WaitlistEntry) => (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Mail className="w-3 h-3" /> {row.email}
                    </div>
                    {row.phone && (
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Phone className="w-3 h-3" /> {row.phone}
                        </div>
                    )}
                </div>
            )
        },
        {
            key: 'notes',
            header: 'Notas',
            render: (row: WaitlistEntry) => (
                <div className="text-xs text-slate-500 max-w-xs truncate italic">
                    {row.notes || 'Sem notas'}
                </div>
            )
        },
        {
            key: 'actions',
            header: '',
            render: (row: WaitlistEntry) => (
                <div className="flex items-center gap-2 justify-end">
                    <button
                        onClick={() => handleDelete(row.id)}
                        className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">Lista de Espera Específica</h3>
                        <p className="text-sm text-slate-500">Pessoas que demonstraram interesse especificamente nesta data.</p>
                    </div>
                    <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 border border-amber-100">
                        <Clock className="w-4 h-4" /> {leads.length} em espera
                    </div>
                </div>

                <AdminTable
                    data={leads}
                    columns={columns}
                    isLoading={loading}
                    searchPlaceholder="Pesquisar interessado..."
                />
            </div>
        </div>
    );
}
