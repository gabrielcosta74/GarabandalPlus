"use client";

import Link from 'next/link';
import DashboardShell from '../../../components/dashboard/DashboardShell';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import {
    Calendar,
    MapPin,
    ChevronRight,
    Ticket,
    Clock,
    CheckCircle2,
    AlertCircle,
    ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { useAuth } from '../../../contexts/AuthContext';

// --- Types ---
type Booking = {
    id: string;
    paid_amount: number;
    total_amount: number;
    status: string;
    created_at: string;
    pilgrimage: {
        title: string;
        slug: string;
        start_date: string;
        end_date: string;
        cover_image: string;
        location?: string;
    };
};

const fetchBookings = async () => {
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    if (!session) throw new Error("No Session");

    const { data, error } = await supabaseBrowser
        .from('bookings')
        .select(`
            *,
            pilgrimage:pilgrimages (title, slug, start_date, end_date, cover_image)
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Booking[];
};

export default function MyBookingsPage() {
    const { user, loading: authLoading } = useAuth();

    const { data: bookings, isLoading: swrLoading } = useSWR(
        user ? 'my-bookings' : null,
        fetchBookings
    );

    const loading = authLoading || (!!user && swrLoading);

    // --- Derived State ---
    const upcomingBookings = bookings?.filter(b => new Date(b.pilgrimage.start_date) > new Date()) || [];
    const pastBookings = bookings?.filter(b => new Date(b.pilgrimage.start_date) <= new Date()) || [];

    // The "Hero" is the most relevant upcoming trip
    const nextTrip = upcomingBookings[0];
    const otherUpcoming = upcomingBookings.slice(1);

    return (
        <DashboardShell
            title="Minhas Peregrinações"
            subtitle="Gere as tuas inscrições e prepara-te para a próxima jornada."
        >
            {loading ? (
                // Loading State
                <div className="py-32 flex flex-col items-center justify-center">
                    <div className="animate-spin w-10 h-10 border-4 border-garabandal-gold border-t-transparent rounded-full mb-4" />
                    <p className="text-gray-400 font-medium animate-pulse">A carregar peregrinações...</p>
                </div>
            ) : bookings?.length === 0 ? (
                // Empty State
                <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <MapPin className="w-10 h-10 text-blue-400" />
                    </div>
                    <h2 className="font-serif text-2xl font-bold text-garabandal-dark mb-2">
                        Ainda não tens peregrinações
                    </h2>
                    <p className="text-gray-500 max-w-md mx-auto mb-8">
                        Junta-te a nós numa jornada de fé inesquecível.
                    </p>
                    <Link
                        href="/peregrinacoes"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-garabandal-dark text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
                    >
                        Ver Próximas Peregrinações <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>
            ) : (
                <div className="space-y-12">

                    {/* --- HERO SECTION: Next Trip --- */}
                    {nextTrip && (
                        <motion.section
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="relative overflow-hidden rounded-3xl shadow-2xl group"
                        >
                            <div className="absolute inset-0">
                                <img
                                    src={nextTrip.pilgrimage.cover_image || '/placeholder.jpg'}
                                    alt="Cover"
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
                            </div>

                            <div className="relative p-8 md:p-12 flex flex-col md:flex-row items-end md:items-center justify-between gap-6">
                                <div className="space-y-4 max-w-2xl text-white">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-garabandal-gold text-garabandal-dark text-xs font-bold uppercase tracking-wider mb-2">
                                        <Ticket className="w-3 h-3" />
                                        Sua Próxima Viagem
                                    </div>
                                    <h2 className="font-serif text-3xl md:text-5xl font-bold leading-tight">
                                        {nextTrip.pilgrimage.title}
                                    </h2>
                                    <p className="text-lg text-white/80 flex items-center gap-3">
                                        <Calendar className="w-5 h-5 text-garabandal-gold" />
                                        {format(new Date(nextTrip.pilgrimage.start_date), "dd 'de' MMMM", { locale: pt })}
                                        <span className="opacity-50">•</span>
                                        {format(new Date(nextTrip.pilgrimage.end_date), "yyyy", { locale: pt })}
                                    </p>
                                </div>

                                <Link
                                    href={`/peregrinacoes/inscricao/${nextTrip.id}`}
                                    className="w-full md:w-auto px-8 py-4 bg-white text-garabandal-dark font-bold rounded-xl hover:bg-garabandal-gold transition-colors flex items-center justify-center gap-2 shadow-lg"
                                >
                                    Gerir Inscrição <ChevronRight className="w-5 h-5" />
                                </Link>
                            </div>
                        </motion.section>
                    )}

                    {/* --- Other Bookings Grid --- */}
                    {(otherUpcoming.length > 0 || pastBookings.length > 0) && (
                        <div className="space-y-6">
                            <h3 className="font-serif text-2xl font-bold text-gray-900 border-b pb-4">
                                Outras Inscrições
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {[...otherUpcoming, ...pastBookings].map((booking) => (
                                    <BookingCard key={booking.id} booking={booking} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </DashboardShell>
    );
}

// --- Sub-Component for Clean Cards ---
function BookingCard({ booking }: { booking: Booking }) {
    const isPast = new Date(booking.pilgrimage.start_date) < new Date();
    const percentPaid = Math.min(100, Math.round((booking.paid_amount / booking.total_amount) * 100));
    const isPaid = percentPaid >= 99;

    return (
        <Link
            href={`/peregrinacoes/inscricao/${booking.id}`}
            className={`
                group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden h-full
                ${isPast ? 'opacity-75 hover:opacity-100 grayscale hover:grayscale-0' : ''}
            `}
        >
            <div className="h-48 relative overflow-hidden bg-gray-100">
                <img
                    src={booking.pilgrimage.cover_image || '/placeholder.jpg'}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-4 right-4">
                    {isPaid ? (
                        <div className="px-3 py-1 bg-white/90 backdrop-blur text-green-700 text-xs font-bold uppercase rounded-full shadow-sm flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3" /> Confirmada
                        </div>
                    ) : (
                        <div className="px-3 py-1 bg-white/90 backdrop-blur text-yellow-700 text-xs font-bold uppercase rounded-full shadow-sm flex items-center gap-1.5 animate-pulse">
                            <Clock className="w-3 h-3" /> Pagamento Pendente
                        </div>
                    )}
                </div>
            </div>

            <div className="p-6 flex-1 flex flex-col">
                <h4 className="font-serif text-xl font-bold text-gray-900 mb-2 line-clamp-1 group-hover:text-garabandal-gold transition-colors">
                    {booking.pilgrimage.title}
                </h4>

                <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {format(new Date(booking.pilgrimage.start_date), "d MMM yyyy", { locale: pt })}
                    </div>
                    {/* Progress Bar */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-gray-400">
                            <span>Pagamento</span>
                            <span>{percentPaid}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${isPaid ? 'bg-green-500' : 'bg-garabandal-gold'}`}
                                style={{ width: `${percentPaid}%` }}
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between text-garabandal-dark font-bold text-sm group-hover:text-garabandal-gold transition-colors">
                    Ver Detalhes
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
            </div>
        </Link>
    );
}
