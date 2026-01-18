"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import {
    Plus,
    Search,
    MapPin,
    Calendar,
    Users,
    ChevronRight,
    MoreVertical,
    Plane
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

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
};

export default function AdminPilgrimagesPage() {
    const [pilgrimages, setPilgrimages] = useState<Pilgrimage[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchPilgrimages();
    }, []);

    const fetchPilgrimages = async () => {
        if (!supabaseBrowser) return;
        setLoading(true);
        const { data, error } = await supabaseBrowser
            .from('pilgrimages')
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

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">

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
                    className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl flex items-center gap-2 font-medium shadow-lg hover:shadow-xl transition-all"
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
                    {filtered.map((item) => (
                        <Link
                            href={`/admin/peregrinacoes/${item.id}`}
                            key={item.id}
                            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all group"
                        >
                            <div className="flex flex-col md:flex-row md:items-center gap-6">

                                {/* Image / Date Box */}
                                <div className="w-20 h-20 rounded-xl bg-slate-100 flex flex-col items-center justify-center border border-slate-100 flex-shrink-0 overflow-hidden relative">
                                    {item.cover_image ? (
                                        <img src={item.cover_image} className="w-full h-full object-cover" />
                                    ) : (
                                        <>
                                            <span className="text-xs font-bold text-slate-400 uppercase">{format(new Date(item.start_date), 'MMM', { locale: pt })}</span>
                                            <span className="text-2xl font-bold text-slate-700">{format(new Date(item.start_date), 'dd')}</span>
                                        </>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(item.status)}`}>
                                            {getStatusLabel(item.status)}
                                        </span>
                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {format(new Date(item.start_date), 'd MMM yyyy', { locale: pt })}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-garabandal-gold transition-colors">
                                        {item.title}
                                    </h3>
                                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                                        <span className="flex items-center gap-1.5">
                                            <Users className="w-4 h-4" />
                                            {item.current_vacancies} / {item.total_vacancies} vagas
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <MapPin className="w-4 h-4" />
                                            {item.slug}
                                        </span>
                                    </div>
                                </div>

                                {/* Price & Action */}
                                <div className="text-right flex flex-col items-end gap-1">
                                    <span className="text-sm text-slate-400">Desde</span>
                                    <span className="text-xl font-bold text-slate-900">{item.base_price}€</span>
                                    <div className="mt-2 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
                                        <ChevronRight className="w-4 h-4" />
                                    </div>
                                </div>

                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
