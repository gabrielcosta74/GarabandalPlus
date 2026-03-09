"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import {
    Plus,
    Search,
    MapPin,
    Calendar,
    ChevronRight,
    Plane,
    CheckCircle2,
    Trash2,
    Copy
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { parseCivilDate } from '../../../lib/utils';

type Pilgrimage = {
    id: string;
    title: string;
    slug: string;
    start_date: string;
    end_date: string;
    status: string;
    total_vacancies: number;
    current_vacancies: number;
    base_price: number;
    cover_image: string | null;
    confirmed_pax?: number;
    pending_pax?: number;
    effective_vacancies?: number;
};

import AdminLayout from '../../../components/admin/AdminLayout';

export default function AdminPilgrimagesPage() {
    const [pilgrimages, setPilgrimages] = useState<Pilgrimage[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

    const getSafeTotalVacancies = (item: Pilgrimage) => Math.max(0, Number(item.total_vacancies || 0));
    const getSafeAvailableVacancies = (item: Pilgrimage) => {
        if (Number.isFinite(Number(item.effective_vacancies))) {
            return Math.max(0, Number(item.effective_vacancies));
        }
        if (Number.isFinite(Number(item.current_vacancies))) {
            return Math.max(0, Number(item.current_vacancies));
        }
        const total = getSafeTotalVacancies(item);
        const confirmed = Math.max(0, Number(item.confirmed_pax || 0));
        return Math.max(0, total - confirmed);
    };

    const getSafeOccupiedVacancies = (item: Pilgrimage) => {
        const total = getSafeTotalVacancies(item);
        const available = getSafeAvailableVacancies(item);
        return Math.max(0, total - available);
    };

    useEffect(() => {
        fetchPilgrimages();
    }, []);

    const fetchPilgrimages = async () => {
        if (!supabaseBrowser) return;
        setLoading(true);
        const { data, error } = await supabaseBrowser
            .from('v_pilgrimages_with_occupancy')
            .select('*')
            .order('start_date', { ascending: true });

        if (error) {
            console.error('Error fetching pilgrimages:', error);
        } else {
            setPilgrimages(data || []);
        }
        setLoading(false);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return 'bg-green-100 text-green-700 border-green-200';
            case 'waitlist': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'closed': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'open': return 'Abertas';
            case 'waitlist': return 'Lista de Espera';
            case 'closed': return 'Encerradas';
            default: return status;
        }
    };

    const filtered = pilgrimages.filter(p =>
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDelete = async (id: string, title: string) => {
        if (!supabaseBrowser) return;

        const ok = window.confirm(
            `Tem a certeza que deseja eliminar a peregrinação "${title}"?\n\nEsta ação é irreversível e irá remover reservas, itinerários e dados associados.`
        );
        if (!ok) return;

        setDeletingId(id);
        try {
            const { data: sessionData } = await supabaseBrowser.auth.getSession();
            const token = sessionData.session?.access_token;
            if (!token) {
                alert('Sessão inválida. Faça login novamente.');
                return;
            }

            const res = await fetch(`/api/admin/pilgrimages/${id}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(body?.error || 'Erro ao eliminar peregrinação');
            }

            setPilgrimages((prev) => prev.filter((p) => p.id !== id));
            alert('Peregrinação eliminada com sucesso.');
        } catch (e: any) {
            alert(`Erro ao eliminar: ${e.message}`);
        } finally {
            setDeletingId(null);
        }
    };

    const handleDuplicate = async (id: string, title: string) => {
        if (!supabaseBrowser) return;
        const ok = window.confirm(`Duplicar a peregrinação "${title}"?\n\nSerá criada uma nova versão com status "Encerradas" para edição.`);
        if (!ok) return;

        setDuplicatingId(id);
        try {
            const { data: sessionData } = await supabaseBrowser.auth.getSession();
            const token = sessionData.session?.access_token;
            if (!token) {
                alert('Sessão inválida. Faça login novamente.');
                return;
            }

            const res = await fetch(`/api/admin/pilgrimages/${id}/duplicate`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(body?.error || 'Erro ao duplicar peregrinação');
            }

            await fetchPilgrimages();
            const removedStages = Number(body?.summary?.stages?.skippedDuplicates || 0);
            const removedItinerary = Number(body?.summary?.itinerary?.skippedDuplicates || 0);
            const removedTotal = removedStages + removedItinerary;

            const message = removedTotal > 0
                ? `Peregrinação duplicada com sucesso:\n${body?.pilgrimage?.title || 'Cópia criada'}\n\nDuplicados removidos automaticamente:\n- Roteiro 3D: ${removedStages}\n- Itinerário detalhado: ${removedItinerary}`
                : `Peregrinação duplicada com sucesso:\n${body?.pilgrimage?.title || 'Cópia criada'}`;

            alert(message);
        } catch (e: any) {
            alert(`Erro ao duplicar: ${e.message}`);
        } finally {
            setDuplicatingId(null);
        }
    };

    return (
        <AdminLayout title="Peregrinações" isLoading={loading}>
            <div className="space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-serif font-bold text-slate-900 flex items-center gap-3">
                            <Plane className="w-8 h-8 text-garabandal-gold" />
                            Peregrinações
                        </h1>
                        <p className="text-slate-500 mt-1">Gira as viagens, itinerários e inscrições.</p>
                    </div>

                    <Link
                        href="/admin/peregrinacoes/nova"
                        className="bg-slate-900 hover:bg-slate-800 !text-white font-bold px-5 py-3 rounded-xl flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                        style={{ color: 'white' }}
                    >
                        <Plus className="w-5 h-5" />
                        Criar Nova Viagem
                    </Link>
                </div>

                {/* Filters */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                    <Search className="w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Pesquisar peregrinação..."
                        className="flex-1 bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin w-10 h-10 border-4 border-slate-200 border-t-garabandal-gold rounded-full" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <Plane className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-600">Nenhuma peregrinação encontrada</h3>
                        <p className="text-slate-400">Cria a primeira viagem para começar.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {filtered.map((item) => {
                            const totalVacancies = getSafeTotalVacancies(item);
                            const availableVacancies = getSafeAvailableVacancies(item);
                            const occupiedVacancies = getSafeOccupiedVacancies(item);
                            const confirmedPax = Math.max(0, Number(item.confirmed_pax || 0));
                            const pendingPax = Math.max(0, Number(item.pending_pax || 0));
                            const occupiedPercent = totalVacancies > 0 ? Math.min(100, (occupiedVacancies / totalVacancies) * 100) : 0;
                            const pendingPercent = totalVacancies > 0 ? Math.min(100, (pendingPax / totalVacancies) * 100) : 0;

                            return <div
                                key={item.id}
                                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all"
                            >
                                <div className="flex flex-col md:flex-row md:items-center gap-6">

                                    {/* Image / Date Box */}
                                    <Link href={`/admin/peregrinacoes/${item.id}`} className="w-20 h-20 rounded-xl bg-slate-100 flex flex-col items-center justify-center border border-slate-100 flex-shrink-0 overflow-hidden relative group">
                                        {item.cover_image ? (
                                            <img src={item.cover_image} className="w-full h-full object-cover" />
                                        ) : (
                                            <>
                                                <span className="text-xs font-bold text-slate-400 uppercase">{format(parseCivilDate(item.start_date), 'MMM', { locale: pt })}</span>
                                                <span className="text-2xl font-bold text-slate-700">{format(parseCivilDate(item.start_date), 'dd')}</span>
                                            </>
                                        )}
                                    </Link>

                                    {/* Info */}
                                    <Link href={`/admin/peregrinacoes/${item.id}`} className="flex-1 group">
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(item.status)}`}>
                                                {getStatusLabel(item.status)}
                                            </span>
                                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {format(parseCivilDate(item.start_date), 'd MMM yyyy', { locale: pt })}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-garabandal-gold transition-colors">
                                            {item.title}
                                        </h3>
                                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                                            <div className="flex flex-col gap-1.5 min-w-[200px]">
                                                <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-tight">
                                                    <span className="text-amber-700">
                                                        {occupiedVacancies} Ocupados
                                                    </span>
                                                    <span className="text-emerald-600">
                                                        {availableVacancies} Livres
                                                    </span>
                                                    <span className="text-slate-400">
                                                        {totalVacancies} Total
                                                    </span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200 flex">
                                                    <div
                                                        className="h-full bg-amber-500 transition-all duration-500"
                                                        style={{ width: `${occupiedPercent}%` }}
                                                        title={`${occupiedVacancies} Ocupados`}
                                                    />
                                                    <div
                                                        className="h-full bg-slate-300 transition-all duration-500"
                                                        style={{ width: `${pendingPercent}%` }}
                                                        title={`${pendingPax} Reservados sem pagamento`}
                                                    />
                                                </div>
                                                <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-tight">
                                                    <span className="text-emerald-600 flex items-center gap-1">
                                                        <CheckCircle2 className="w-3 h-3" /> {confirmedPax} Pagos Web
                                                    </span>
                                                    <span className="text-slate-400">
                                                        {pendingPax} Reservados
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="flex items-center gap-1.5">
                                                <MapPin className="w-4 h-4" />
                                                {item.slug}
                                            </span>
                                        </div>
                                    </Link>

                                    {/* Price & Action */}
                                    <div className="text-right flex flex-col items-end gap-1">
                                        <span className="text-sm text-slate-400">Desde</span>
                                        <span className="text-xl font-bold text-slate-900">{item.base_price}€</span>
                                        <div className="mt-2 flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleDuplicate(item.id, item.title)}
                                                disabled={duplicatingId === item.id}
                                                className="h-8 px-3 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center gap-1 hover:bg-indigo-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold"
                                                title="Duplicar peregrinação"
                                            >
                                                <Copy className="w-4 h-4" />
                                                {duplicatingId === item.id ? 'A duplicar...' : 'Duplicar'}
                                            </button>
                                            <Link
                                                href={`/admin/peregrinacoes/${item.id}`}
                                                className="h-8 px-3 rounded-full bg-slate-50 text-slate-700 flex items-center justify-center gap-1 hover:bg-slate-900 hover:text-white transition-colors text-xs font-semibold"
                                                title="Editar"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                                Editar
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(item.id, item.title)}
                                                disabled={deletingId === item.id}
                                                className="h-8 px-3 rounded-full bg-red-50 text-red-700 flex items-center justify-center gap-1 hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold"
                                                title="Eliminar peregrinação"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                {deletingId === item.id ? 'A eliminar...' : 'Eliminar'}
                                            </button>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        })}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
