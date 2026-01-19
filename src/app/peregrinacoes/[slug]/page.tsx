"use client";

import { useEffect, useState } from 'react';
import VIPLayout from '../../../components/member/VIPLayout';
import Link from 'next/link';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { notFound, useParams } from 'next/navigation';
import {
    Calendar,
    MapPin,
    Users,
    CheckCircle2,
    HelpCircle,
    ArrowLeft,
    Clock,
    ShieldCheck,
    Plane,
    Quote,
    Star,
    Bus,
    Hotel,
    FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import SpiritMap from '../../../components/pilgrimage/SpiritMap';
import UniversalStickyBar from '../../../components/pilgrimage/UniversalStickyBar';
import ExitIntentPopup from '../../../components/pilgrimage/ExitIntentPopup';
import { BrochureDownloadModal } from '../../../components/pilgrimage/BrochureDownloadModal';
import FixedWhatsAppFab from '../../../components/pilgrimage/FixedWhatsAppFab';

type Pilgrimage = {
    id: string;
    title: string;
    slug: string;
    description: string;
    cover_image: string;
    start_date: string;
    end_date: string;
    total_vacancies: number;
    current_vacancies: number;
    base_price: number;
    status: string;
    flight_departure_time?: string;
    flight_return_time?: string;
    transport_type?: string;
    transport_description?: string;
    transport_image_url?: string;
    accommodation_rating?: string;
    accommodation_description?: string;
    included_items?: string[];
    deposit_value?: number;
    min_deposit?: number;
    pricing_config?: {
        room_supplements?: {
            single?: number;
            double?: number;
            triple?: number;
            quadruple?: number;
        };
    };
};

type GlobalLogistics = {
    transport_title: string;
    transport_description: string;
    transport_image: string;
    accommodation_rating: string;
    accommodation_description: string;
    accommodation_image: string;
    included_items: string[];
};

type Stage = {
    id: string;
    title: string;
    description: string;
    lat: number;
    lng: number;
    image_url: string;
    display_order: number;
};

type ItineraryItem = {
    id: string;
    day_number: number;
    title: string;
    description: string;
    image_url: string;
};

type Testimonial = {
    id: string;
    author_name: string;
    role: string;
    text: string;
    image_url: string;
};

type TeamMember = {
    id: string;
    name: string;
    role: string;
    country: string;
    image_url: string;
    is_special_guest: boolean;
    description: string;
    display_order: number;
};

const MOCK_FAQS = [
    { q: 'É preciso passaporte?', a: 'Para cidadãos da UE, apenas Cartão de Cidadão válido is suficiente.' },
    { q: 'O caminho é difícil?', a: 'A subida aos Pinheiros é íngreme, mas faz-se com calma. Existem acessos para quem tem mobilidade reduzida.' },
    { q: 'Como funcionam os quartos?', a: 'O preço base é para quarto partilhado (duplo). Quarto individual tem suplemento mediante disponibilidade.' }
];

export default function PilgrimageDetailPage() {
    const params = useParams();
    const slug = params.slug as string;
    const [pilgrimage, setPilgrimage] = useState<Pilgrimage | null>(null);
    const [globalLogistics, setGlobalLogistics] = useState<GlobalLogistics | null>(null);
    const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
    const [stages, setStages] = useState<Stage[]>([]);
    const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
    const [existingBooking, setExistingBooking] = useState<string | null>(null);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAllData = async () => {
            if (!slug || !supabaseBrowser) return;

            const { data: pData } = await supabaseBrowser
                .from('pilgrimages')
                .select('*')
                .eq('slug', slug)
                .single();

            if (pData) {
                setPilgrimage(pData);
                const { data: { user } } = await supabaseBrowser.auth.getUser();
                if (user) {
                    setUser(user);
                    const { data: bData } = await supabaseBrowser
                        .from('bookings')
                        .select('id')
                        .eq('pilgrimage_id', pData.id)
                        .eq('user_id', user.id)
                        .maybeSingle();
                    if (bData) setExistingBooking(bData.id);
                }

                const { data: cData } = await supabaseBrowser
                    .from('site_content')
                    .select('content')
                    .eq('key', 'logistics_global')
                    .single();
                if (cData) setGlobalLogistics(cData.content);

                const { data: tData } = await supabaseBrowser
                    .from('testimonials')
                    .select('*')
                    .order('display_order');
                if (tData) setTestimonials(tData);

                const { data: sData } = await supabaseBrowser
                    .from('pilgrimage_stages')
                    .select('*')
                    .eq('pilgrimage_id', pData.id)
                    .order('display_order');
                if (sData) setStages(sData);

                const { data: iData } = await supabaseBrowser
                    .from('pilgrimage_itinerary_items')
                    .select('*')
                    .eq('pilgrimage_id', pData.id)
                    .order('day_number');
                if (iData) setItineraryItems(iData);

                const { data: teamData } = await supabaseBrowser
                    .from('pilgrimage_team_members')
                    .select('*')
                    .eq('pilgrimage_id', pData.id)
                    .order('display_order');
                if (teamData) setTeamMembers(teamData);
            }
            setLoading(false);
        };
        fetchAllData();
    }, [slug]);

    if (loading) {
        return (
            <VIPLayout allowPublic={true}>
                <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                    <div className="animate-spin w-10 h-10 border-4 border-yellow-600 border-t-transparent rounded-full" />
                </div>
            </VIPLayout>
        );
    }

    if (!pilgrimage) {
        return (
            <VIPLayout allowPublic={true}>
                <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center p-8">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Viagem não encontrada</h1>
                    <Link href="/peregrinacoes" className="text-yellow-600 hover:underline">voltar à lista</Link>
                </div>
            </VIPLayout>
        );
    }

    const startDate = new Date(pilgrimage.start_date);
    const endDate = new Date(pilgrimage.end_date);
    const isClosed = pilgrimage.status === 'closed';

    return (
        <VIPLayout allowPublic={true}>
            <div className="bg-slate-50 min-h-screen relative pb-20">
                {/* Hero Header */}
                <div className="relative h-[60vh] w-full overflow-hidden">
                    <div className="absolute inset-0 bg-slate-900/40 z-10" />
                    {pilgrimage.cover_image && (
                        <img
                            src={pilgrimage.cover_image}
                            alt={pilgrimage.title}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                    )}
                    <div className="absolute inset-0 z-20 container mx-auto px-6 h-full flex flex-col justify-end pb-12">
                        <Link href="/member/peregrinacoes" className="inline-flex items-center text-white/80 hover:text-white mb-6 transition-colors">
                            <ArrowLeft className="w-5 h-5 mr-2" /> Voltar à lista
                        </Link>
                        <div className="flex items-center gap-3 text-yellow-300 font-bold uppercase tracking-wider text-sm mb-3">
                            <Plane className="w-5 h-5" />
                            Peregrinação Oficial
                        </div>
                        <h1 className="text-4xl md:text-6xl font-serif font-bold text-white mb-4 leading-tight shadow-sm">
                            {pilgrimage.title}
                        </h1>
                        <div className="flex flex-col md:flex-row md:items-center gap-6">
                            <div className="flex wrap items-center gap-6 text-white/90 font-medium text-lg">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-yellow-400" />
                                    {format(startDate, "d 'de' MMMM", { locale: pt })} a {format(endDate, "d 'de' MMMM, yyyy", { locale: pt })}
                                </div>
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-5 h-5 text-yellow-400" />
                                    Garabandal, Espanha
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="container mx-auto px-6 -mt-10 relative z-30">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                        {/* Column Left */}
                        <div className="lg:col-span-2 space-y-12">
                            <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100">
                                <h2 className="text-2xl font-serif font-bold text-slate-900 mb-4">Sobre esta viagem</h2>
                                <p className="text-slate-600 text-lg leading-relaxed whitespace-pre-line">{pilgrimage.description}</p>
                            </div>

                            {/* Testimonials */}
                            {testimonials.length > 0 && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-xl font-serif font-bold text-slate-900">O que dizem os peregrinos</h2>
                                        <div className="flex items-center gap-1 text-yellow-500 bg-yellow-50 px-3 py-1 rounded-full border border-yellow-100">
                                            <Star className="w-4 h-4 fill-current" />
                                            <span className="text-xs font-bold text-yellow-700">Experiências Reais</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {testimonials.slice(0, 4).map((t) => (
                                            <div key={t.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow">
                                                <div className="flex gap-3 items-center mb-3">
                                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 border border-slate-50">
                                                        {t.image_url ? <img src={t.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-200" />}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 text-sm">{t.author_name}</p>
                                                        <p className="text-slate-500 text-[10px] uppercase tracking-wider">{t.role}</p>
                                                    </div>
                                                </div>
                                                <div className="flex-1 relative">
                                                    <Quote className="w-6 h-6 text-yellow-400 absolute -top-1 -left-1 opacity-20 rotate-180" />
                                                    <p className="text-slate-600 text-sm italic relative z-10 pl-2">"{t.text}"</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Team */}
                            {teamMembers.length > 0 && (
                                <div className="space-y-8">
                                    {teamMembers.some(m => m.is_special_guest) && (
                                        <div className="space-y-4">
                                            <h2 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
                                                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" /> Convidados Especiais
                                            </h2>
                                            <div className="grid gap-6">
                                                {teamMembers.filter(m => m.is_special_guest).map(member => (
                                                    <div key={member.id} className="bg-white p-6 rounded-3xl shadow-lg border border-yellow-100 bg-gradient-to-br from-white to-yellow-50/50 flex flex-col md:flex-row gap-6">
                                                        <div className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0 rounded-full bg-yellow-100 border-4 border-white shadow-md overflow-hidden mx-auto md:mx-0">
                                                            {member.image_url ? <img src={member.image_url} alt={member.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-yellow-300"><Users className="w-10 h-10" /></div>}
                                                        </div>
                                                        <div className="flex-1 text-center md:text-left">
                                                            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2 justify-center md:justify-start">
                                                                <h3 className="text-xl font-bold text-slate-900">{member.name}</h3>
                                                                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full uppercase tracking-wider w-fit mx-auto md:mx-0">{member.role}</span>
                                                            </div>
                                                            <p className="text-sm font-medium text-slate-400 mb-3 flex items-center justify-center md:justify-start gap-1"><MapPin className="w-3 h-3" /> {member.country}</p>
                                                            <p className="text-slate-600 leading-relaxed text-sm">{member.description}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Itinerary */}
                            <div>
                                <h2 className="text-2xl font-serif font-bold text-slate-900 mb-6 flex items-center gap-2"><Clock className="w-6 h-6 text-yellow-600" /> Roteiro Espiritual</h2>
                                {stages.length > 0 && <div className="mb-8"><SpiritMap stages={stages} height={500} /></div>}
                                <div className="space-y-6">
                                    {itineraryItems.length > 0 ? itineraryItems.map((item) => (
                                        <div key={item.id} className="flex gap-4 group">
                                            <div className="flex flex-col items-center">
                                                <div className="w-10 h-10 rounded-full bg-yellow-100 text-yellow-700 font-bold flex items-center justify-center border-4 border-white shadow-md group-hover:scale-110 transition-transform">{item.day_number}</div>
                                                <div className="w-0.5 bg-slate-200 flex-1 my-2 group-last:hidden" />
                                            </div>
                                            <div className="bg-white p-6 rounded-2xl flex-1 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                                                <h3 className="font-bold text-slate-900 text-lg mb-2">{item.title}</h3>
                                                <p className="text-slate-600 whitespace-pre-line">{item.description}</p>
                                                {item.image_url && <div className="mt-4 rounded-xl overflow-hidden h-48 w-full"><img src={item.image_url} alt={item.title} className="w-full h-full object-cover" /></div>}
                                            </div>
                                        </div>
                                    )) : <p className="text-slate-500 italic">Roteiro detalhado em breve.</p>}
                                </div>
                            </div>
                        </div>

                        {/* Column Right (Sidebar) */}
                        <div className="lg:col-span-1">
                            <div className="sticky top-24 space-y-6">
                                <div className="bg-white rounded-3xl p-6 shadow-2xl border border-yellow-500/10 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-yellow-600" />
                                    <div className="mb-6 space-y-4">
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Resumo de Valores</p>
                                            <div className="space-y-3 text-sm">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-900 font-bold">Donativo Base</span>
                                                    <span className="font-extrabold text-slate-900 px-2 py-1 bg-white rounded-lg shadow-sm border border-slate-100">{pilgrimage.base_price}€</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-900 font-bold">Taxa de Inscrição (Sinal)</span>
                                                    <span className="font-extrabold text-slate-900 px-2 py-1 bg-white rounded-lg shadow-sm border border-slate-100">{pilgrimage.deposit_value}€</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="px-4">
                                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total a partir de</p>
                                            <div className="flex items-end gap-1"><span className="text-4xl font-bold text-slate-900">{(pilgrimage.base_price || 0) + (pilgrimage.deposit_value || 0)}€</span><span className="text-slate-500 font-medium mb-1">/ pessoa</span></div>
                                        </div>
                                    </div>
                                    <div className="space-y-4 mb-8">
                                        <div className="flex justify-between py-3 border-b text-slate-600 font-medium"><span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Partida</span><span className="text-slate-900 font-bold">{format(startDate, "d MMM", { locale: pt })}</span></div>
                                        <div className="flex justify-between py-3 border-b text-slate-600 font-medium"><span className="flex items-center gap-2"><Users className="w-4 h-4" /> Vagas</span><span className="text-slate-900 font-bold">{pilgrimage.current_vacancies} lugares</span></div>
                                    </div>
                                    {isClosed ? (
                                        <button disabled className="w-full bg-slate-100 text-slate-400 font-bold py-4 rounded-xl">Encerradas</button>
                                    ) : existingBooking ? (
                                        <Link href={`/peregrinacoes/inscricao/${existingBooking}`} className="w-full bg-green-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg"><CheckCircle2 className="w-5 h-5" /> Gerir Inscrição</Link>
                                    ) : (
                                        <Link href={`/peregrinacoes/${pilgrimage.slug}/inscrever`} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg">Inscrever Agora <ArrowLeft className="w-4 h-4 rotate-180" /></Link>
                                    )}
                                </div>
                                <div className="bg-blue-50/50 rounded-2xl p-4 flex items-start gap-3 border border-blue-100">
                                    <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-blue-900">Garantia de Confiança</p>
                                        <p className="text-xs text-blue-700 leading-relaxed mt-1">Viagem oficial organizada pela Associação sem fins lucrativos.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Portaled Components */}
                <div className="pb-24 lg:pb-0">
                    <UniversalStickyBar
                        price={pilgrimage.base_price}
                        deposit={pilgrimage.deposit_value || pilgrimage.min_deposit || 0}
                        link={`/peregrinacoes/${pilgrimage.slug}/inscrever`}
                        isClosed={pilgrimage.status === 'closed' || pilgrimage.status === 'deleted'}
                        pilgrimageId={pilgrimage.id}
                        buttonText={existingBooking ? 'Gerir Inscrição' : 'Inscrever'}
                    />
                </div>
            </div>
            <FixedWhatsAppFab pilgrimageId={pilgrimage.id} />
            <ExitIntentPopup pilgrimageId={pilgrimage.id} />
        </VIPLayout>
    );
}
