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
    Hotel
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import SpiritMap from '../../../components/pilgrimage/SpiritMap';

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
    // New Fields
    flight_departure_time?: string;
    flight_return_time?: string;
    transport_type?: string;
    transport_description?: string;
    transport_image_url?: string;
    accommodation_rating?: string;
    accommodation_description?: string;
    included_items?: string[];
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

            // 1. Fetch Pilgrimage
            const { data: pData, error: pError } = await supabaseBrowser
                .from('pilgrimages')
                .select('*')
                .eq('slug', slug)
                .single();

            if (pData) {
                setPilgrimage(pData);

                // Check Booking
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
            }

            // 2. Fetch Global Content (Logistics)
            const { data: cData } = await supabaseBrowser
                .from('site_content')
                .select('content')
                .eq('key', 'logistics_global')
                .single();

            if (cData) setGlobalLogistics(cData.content);

            // 3. Fetch Testimonials
            const { data: tData } = await supabaseBrowser
                .from('testimonials')
                .select('*')
                .order('display_order');

            if (tData) setTestimonials(tData);

            // 4. Fetch Stages (Map)
            if (pData) {
                const { data: sData } = await supabaseBrowser
                    .from('pilgrimage_stages')
                    .select('*')
                    .eq('pilgrimage_id', pData.id)
                    .order('display_order');
                if (sData) setStages(sData);

                // 5. Fetch Itinerary Items (List)
                const { data: iData } = await supabaseBrowser
                    .from('pilgrimage_itinerary_items')
                    .select('*')
                    .eq('pilgrimage_id', pData.id)
                    .order('day_number');
                if (iData) setItineraryItems(iData);

                // 6. Fetch Team Members
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

                {/* Hero Header with Image */}
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

                        <div className="flex flex-wrap items-center gap-6 text-white/90 font-medium text-lg">
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

                <div className="container mx-auto px-6 -mt-10 relative z-30">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

                        {/* Main Content (Left) */}
                        <div className="lg:col-span-2 space-y-12">

                            {/* Intro Card */}
                            <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100">
                                <h2 className="text-2xl font-serif font-bold text-slate-900 mb-4">Sobre esta viagem</h2>
                                <p className="text-slate-600 text-lg leading-relaxed whitespace-pre-line">
                                    {pilgrimage.description}
                                </p>
                            </div>

                            {/* Team & Guests Section */}
                            {teamMembers.length > 0 && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                                    {/* Special Guests (High Profile) */}
                                    {teamMembers.some(m => m.is_special_guest) && (
                                        <div className="space-y-4">
                                            <h2 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
                                                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" /> Convidados Especiais
                                            </h2>
                                            <div className="grid gap-6">
                                                {teamMembers.filter(m => m.is_special_guest).map(member => (
                                                    <div key={member.id} className="bg-white p-6 rounded-3xl shadow-lg border border-yellow-100 bg-gradient-to-br from-white to-yellow-50/50 flex flex-col md:flex-row gap-6">
                                                        <div className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0 rounded-full bg-yellow-100 border-4 border-white shadow-md overflow-hidden mx-auto md:mx-0">
                                                            {member.image_url ? (
                                                                <img src={member.image_url} alt={member.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-yellow-300"><Users className="w-10 h-10" /></div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 text-center md:text-left">
                                                            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2 justify-center md:justify-start">
                                                                <h3 className="text-xl font-bold text-slate-900">{member.name}</h3>
                                                                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full uppercase tracking-wider w-fit mx-auto md:mx-0">
                                                                    {member.role}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm font-medium text-slate-400 mb-3 flex items-center justify-center md:justify-start gap-1">
                                                                <MapPin className="w-3 h-3" /> {member.country}
                                                            </p>
                                                            <p className="text-slate-600 leading-relaxed text-sm">
                                                                {member.description}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Regular Team */}
                                    {teamMembers.some(m => !m.is_special_guest) && (
                                        <div className="space-y-4">
                                            <h2 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
                                                <Users className="w-5 h-5 text-slate-400" /> Equipa Técnica & Pastoral
                                            </h2>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                {teamMembers.filter(m => !m.is_special_guest).map(member => (
                                                    <div key={member.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
                                                        <div className="w-16 h-16 rounded-full bg-slate-100 mb-3 overflow-hidden border-2 border-slate-50">
                                                            {member.image_url ? (
                                                                <img src={member.image_url} alt={member.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-slate-300"><Users className="w-6 h-6" /></div>
                                                            )}
                                                        </div>
                                                        <h4 className="font-bold text-slate-900 text-sm">{member.name}</h4>
                                                        <p className="text-xs text-yellow-600 font-bold uppercase tracking-wide mt-1">{member.role}</p>
                                                        <p className="text-xs text-slate-400 mt-1">{member.country}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Itinerary */}
                            <div>
                                <h2 className="text-2xl font-serif font-bold text-slate-900 mb-6 flex items-center gap-2">
                                    <Clock className="w-6 h-6 text-yellow-600" /> Roteiro Espiritual
                                </h2>

                                {/* 3D Map Visualization */}
                                {stages.length > 0 && (
                                    <div className="mb-8">
                                        <SpiritMap stages={stages} height={500} />
                                        <p className="text-center text-xs text-slate-400 mt-2 italic flex items-center justify-center gap-1">
                                            <Plane className="w-3 h-3" /> Mapa Interativo: Usa os controlos para visitar cada local.
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-6">
                                    {itineraryItems.length > 0 ? (
                                        itineraryItems.map((item) => (
                                            <div key={item.id} className="flex gap-4 group">
                                                <div className="flex flex-col items-center">
                                                    <div className="w-10 h-10 rounded-full bg-yellow-100 text-yellow-700 font-bold flex items-center justify-center border-4 border-white shadow-md group-hover:scale-110 transition-transform">
                                                        {item.day_number}
                                                    </div>
                                                    <div className="w-0.5 bg-slate-200 flex-1 my-2 group-last:hidden" />
                                                </div>
                                                <div className="bg-white p-6 rounded-2xl flex-1 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                                                    <h3 className="font-bold text-slate-900 text-lg mb-2">{item.title}</h3>
                                                    <p className="text-slate-600 whitespace-pre-line">{item.description}</p>
                                                    {item.image_url && (
                                                        <div className="mt-4 rounded-xl overflow-hidden h-48 w-full">
                                                            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-slate-500 italic">Roteiro detalhado em breve.</p>
                                    )}
                                </div>
                            </div>

                            {/* Logistics: Transport & Hotel */}
                            {globalLogistics && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Transport */}
                                    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col">
                                        <div className="h-40 bg-slate-100 rounded-xl mb-4 overflow-hidden relative">
                                            {globalLogistics.transport_image ? (
                                                <img src={globalLogistics.transport_image} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-300"><Bus className="w-10 h-10" /></div>
                                            )}
                                            <div className="absolute top-2 right-2 bg-white/90 px-3 py-1 rounded-full text-xs font-bold text-slate-800 shadow-sm flex items-center gap-1">
                                                <Bus className="w-3 h-3" /> Transporte Oficial
                                            </div>
                                        </div>
                                        <h3 className="font-bold text-slate-900 text-lg mb-2">{globalLogistics.transport_title}</h3>
                                        <p className="text-slate-600 text-sm leading-relaxed">{globalLogistics.transport_description}</p>
                                    </div>

                                    {/* Accommodation */}
                                    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col">
                                        <div className="h-40 bg-slate-100 rounded-xl mb-4 overflow-hidden relative">
                                            {globalLogistics.accommodation_image ? (
                                                <img src={globalLogistics.accommodation_image} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-300"><Hotel className="w-10 h-10" /></div>
                                            )}
                                            <div className="absolute top-2 right-2 bg-white/90 px-3 py-1 rounded-full text-xs font-bold text-slate-800 shadow-sm flex items-center gap-1">
                                                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" /> {globalLogistics.accommodation_rating}
                                            </div>
                                        </div>
                                        <h3 className="font-bold text-slate-900 text-lg mb-2">Alojamento Padrão</h3>
                                        <p className="text-slate-600 text-sm leading-relaxed">{globalLogistics.accommodation_description}</p>
                                    </div>
                                </div>
                            )}

                            {/* What's Included */}
                            {globalLogistics && (
                                <div className="bg-slate-900 text-white rounded-3xl p-8 md:p-10 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                                    <h2 className="text-2xl font-serif font-bold mb-6 relative z-10">O que está incluído no Donativo</h2>
                                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                                        {globalLogistics.included_items?.map((item, idx) => (
                                            <li key={idx} className="flex items-start gap-3">
                                                <CheckCircle2 className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                                                <span className="text-slate-300">{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Global Testimonials */}
                            {testimonials.length > 0 && (
                                <div className="space-y-6">
                                    <h2 className="text-2xl font-serif font-bold text-slate-900">O que dizem os nossos peregrinos</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {testimonials.map((t) => (
                                            <div key={t.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                                                <div className="flex gap-4 items-center mb-4">
                                                    <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100">
                                                        {t.image_url ? <img src={t.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-200" />}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 text-sm">{t.author_name}</p>
                                                        <p className="text-slate-500 text-xs">{t.role}</p>
                                                    </div>
                                                </div>
                                                <div className="flex-1">
                                                    <Quote className="w-8 h-8 text-yellow-100 mb-2 rotate-180" />
                                                    <p className="text-slate-600 text-sm italic relative z-10">"{t.text}"</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* FAQs */}
                            <div>
                                <h2 className="text-2xl font-serif font-bold text-slate-900 mb-6">Perguntas Frequentes</h2>
                                <div className="grid gap-4">
                                    {MOCK_FAQS.map((faq, idx) => (
                                        <div key={idx} className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
                                            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                                                <HelpCircle className="w-4 h-4 text-slate-400" /> {faq.q}
                                            </h4>
                                            <p className="text-slate-600 text-sm ml-6">{faq.a}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>

                        {/* Sidebar (Right) - Sticky Booking Card */}
                        <div className="lg:col-span-1">
                            <div className="sticky top-24 space-y-6">
                                <div className="bg-white rounded-3xl p-6 shadow-2xl border border-yellow-500/10 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-yellow-600" />

                                    <div className="mb-6">
                                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Donativo Base</p>
                                        <div className="flex items-end gap-1">
                                            <span className="text-4xl font-bold text-slate-900">{pilgrimage.base_price}€</span>
                                            <span className="text-slate-500 font-medium mb-1">/ pessoa</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4 mb-8">
                                        <div className="flex items-center justify-between py-3 border-b border-slate-100">
                                            <span className="text-slate-600 flex items-center gap-2"><Calendar className="w-4 h-4" /> Partida</span>
                                            <span className="font-bold text-slate-900">{format(startDate, "d MMM", { locale: pt })}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-3 border-b border-slate-100">
                                            <span className="text-slate-600 flex items-center gap-2"><Clock className="w-4 h-4" /> Duração</span>
                                            <span className="font-bold text-slate-900">5 Dias</span>
                                        </div>
                                        <div className="flex items-center justify-between py-3 border-b border-slate-100">
                                            <span className="text-slate-600 flex items-center gap-2"><Users className="w-4 h-4" /> Vagas</span>
                                            <span className="font-bold text-slate-900">{pilgrimage.current_vacancies} lugares</span>
                                        </div>
                                    </div>

                                    {isClosed ? (
                                        <button disabled className="w-full bg-slate-100 text-slate-400 font-bold py-4 rounded-xl cursor-not-allowed">
                                            Inscrições Encerradas
                                        </button>
                                    ) : existingBooking ? (
                                        <Link href={`/peregrinacoes/inscricao/${existingBooking}`} className="w-full bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 transition-all shadow-lg hover:shadow-green-900/20 flex items-center justify-center gap-2 group">
                                            <CheckCircle2 className="w-5 h-5" /> Gerir Minha Inscrição
                                        </Link>
                                    ) : (
                                        <Link
                                            href={`/peregrinacoes/${pilgrimage.slug}/inscrever`}
                                            className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-yellow-600 transition-all shadow-lg hover:shadow-yellow-900/20 flex items-center justify-center gap-2 group"
                                        >
                                            Inscrever Agora <ArrowLeft className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition-transform" />
                                        </Link>
                                    )}

                                    <p className="text-xs text-center text-slate-400 mt-4">
                                        Pagamento seguro via Reduniq ou Transferência.
                                        <br />Possibilidade de pagamento faseado.
                                    </p>
                                </div>

                                <div className="bg-blue-50/50 rounded-2xl p-4 flex items-start gap-3 border border-blue-100">
                                    <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-blue-900">Garantia de Confiança</p>
                                        <p className="text-xs text-blue-700 leading-relaxed mt-1">
                                            Viagem oficial organizada pela Associação sem fins lucrativos. O valor reverte para as despesas e apoio à obra.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </VIPLayout >
    );
}
