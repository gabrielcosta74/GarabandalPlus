"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import VIPLayout from '../../../components/member/VIPLayout';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { Calendar, ChevronRight, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

export default function MyBookingsPage() {
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasUser, setHasUser] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        const fetchBookings = async () => {
            if (!supabaseBrowser) return;

            const { data: { user } } = await supabaseBrowser.auth.getUser();
            if (!user) {
                setHasUser(false);
                setLoading(false);
                return;
            }
            setHasUser(true);

            const { data, error } = await supabaseBrowser
                .from('bookings')
                .select(`
                    *,
                    pilgrimage:pilgrimages (title, slug, start_date, cover_image)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error(error);
            } else {
                setBookings(data || []);
            }
            setLoading(false);
        };

        fetchBookings();
    }, []);

    if (loading) return <VIPLayout allowPublic requireMember={false}><div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-yellow-600 border-t-transparent rounded-full" /></div></VIPLayout>;

    return (
        <VIPLayout allowPublic requireMember={false}>
            <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-serif font-bold text-slate-900">Minhas Peregrinações</h1>
                    <Link
                        href="/peregrinacoes"
                        className="text-sm font-bold text-slate-600 hover:text-slate-900"
                    >
                        &larr; Ver Todas
                    </Link>
                </div>

                {!hasUser ? (
                    <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                            <AlertCircle className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mb-2">Inicie sessão para ver as suas inscrições</h2>
                        <p className="text-slate-500 mb-6">Precisas de estar autenticado para consultar as tuas peregrinações.</p>
                        <Link
                            href={`/login?next=${encodeURIComponent(pathname || '/peregrinacoes/minhas-inscricoes')}`}
                            className="inline-flex items-center px-6 py-3 bg-slate-900 text-white rounded-full font-bold hover:bg-slate-800 transition-colors"
                        >
                            Entrar na Minha Conta
                        </Link>
                    </div>
                ) : bookings.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                            <Calendar className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mb-2">Sem inscrições ativas</h2>
                        <p className="text-slate-500 mb-6">Ainda não te inscreveste em nenhuma peregrinação.</p>
                        <Link
                            href="/peregrinacoes"
                            className="inline-flex items-center px-6 py-3 bg-slate-900 text-white rounded-full font-bold hover:bg-slate-800 transition-colors"
                        >
                            Ver Próximas Peregrinações
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {bookings.map((booking) => {
                            const percentPaid = Math.min(100, Math.round((booking.paid_amount / booking.total_amount) * 100));
                            const isPaid = percentPaid >= 99;

                            return (
                                <Link
                                    key={booking.id}
                                    href={`/peregrinacoes/inscricao/${booking.id}`}
                                    className="group bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100">
                                            <img src={booking.pilgrimage.cover_image || '/placeholder.jpg'} alt="" className="w-full h-full object-cover" />
                                        </div>
                                        <div className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {isPaid ? 'Confirmada' : 'Pagamento Pendente'}
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-yellow-600 transition-colors line-clamp-1">
                                        {booking.pilgrimage.title}
                                    </h3>
                                    <p className="text-sm text-slate-500 mb-4 flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        {format(new Date(booking.pilgrimage.start_date), "d MMM yyyy", { locale: pt })}
                                    </p>

                                    {/* Progress */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-medium text-slate-500">
                                            <span>Progresso Pagamento</span>
                                            <span className="text-slate-900">{percentPaid}%</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-slate-900 rounded-full" style={{ width: `${percentPaid}%` }} />
                                        </div>
                                    </div>

                                    <div className="mt-6 flex items-center justify-between text-sm font-bold text-indigo-600 group-hover:translate-x-2 transition-transform">
                                        Gerir Inscrição <ChevronRight className="w-4 h-4" />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </VIPLayout>
    );
}
