"use client";

import { useEffect, useState } from 'react';
import VIPLayout from '../../components/member/VIPLayout';
import Link from 'next/link';
import Image from 'next/image';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { MapPin, Calendar, Users, ShieldCheck, ArrowRight } from 'lucide-react';
import { PilgrimageHero } from '../../components/pilgrimage/PilgrimageHero';
import { useLocale } from '../../contexts/LocaleContext';
import { PilgrimageCard } from '../../components/pilgrimage/PilgrimageCard';
import { PastPilgrimagesGallery } from '../../components/pilgrimage/PastPilgrimagesGallery';
import { PilgrimageTestimonials } from '../../components/pilgrimage/PilgrimageTestimonials';
import { getPilgrimagesAction } from './actions';
import { getCivilDateTimestamp, isNovemberCampaignPilgrimage, isPubliclyListedPilgrimage, todayCivilTimestamp } from '../../lib/utils';

type Pilgrimage = {
    id: string;
    title: string;
    slug: string;
    description: string;
    cover_image: string;
    cover_image_en?: string | null;
    start_date: string;
    end_date: string;
    base_price: number;
    total_vacancies: number;
    current_vacancies?: number;
    confirmed_pax: number;
    effective_vacancies: number;
    status: string;
    meeting_point_text?: string;
    meeting_end_text?: string;
    flight_info_text?: string;
    payment_plan_text?: string;
    cancellation_policy_text?: string;
    not_included_items?: string[];
    pricing_config?: { scarcity_fill_pct?: number; early_access?: unknown } | null;
};

const CAMINHO_MARIANO_2027_POSTER = 'https://pntzzuxzjnzksubbjfvj.supabase.co/storage/v1/object/public/site-content/pilgrimages/covers/1791477898377_p1a9xb.png';
const CAMINHO_MARIANO_2027_POSTER_EN = 'https://pntzzuxzjnzksubbjfvj.supabase.co/storage/v1/object/public/site-content/pilgrimages/covers/1791477958157_w68bsd.png';

export default function PilgrimagesPage() {
    const { locale, t } = useLocale();
    const p = t.pilgrimages;
    const [pilgrimages, setPilgrimages] = useState<Pilgrimage[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const fetchPilgrimages = async () => {
            console.log("🚀 [Peregrinacoes] Fetching pilgrimages...");
            try {
                // Prefer server action to avoid client-side auth/rpc stalls
                const actionResult = await getPilgrimagesAction();
                if (!mounted) return;
                if (actionResult?.data) {
                    setPilgrimages(actionResult.data as Pilgrimage[]);
                    return;
                }
                console.warn("⚠️ [Peregrinacoes] Server action failed:", actionResult?.error);

                if (!supabaseBrowser) {
                    console.warn("⚠️ [Peregrinacoes] Supabase client missing");
                    return;
                }

                // Use RPC for better performance and bypassed RLS for aggregates
                const { data, error } = await supabaseBrowser
                    .rpc('get_pilgrimage_list', {});

                if (error) {
                    console.error("❌ [Peregrinacoes] Fetch error:", error);
                    // Fallback to direct table access — only the columns the page renders.
                    const { data: fallbackData } = await supabaseBrowser
                        .from('pilgrimages')
                        .select('id,title,slug,description,cover_image,cover_image_en,start_date,end_date,base_price,total_vacancies,current_vacancies,confirmed_pax,effective_vacancies,status,meeting_point_text,meeting_end_text,flight_info_text,payment_plan_text,cancellation_policy_text,not_included_items,pricing_config')
                        .order('start_date', { ascending: true });
                    if (fallbackData && mounted) setPilgrimages(fallbackData as Pilgrimage[]);
                } else {
                    console.log("✅ [Peregrinacoes] Fetched:", data?.length);
                    if (data && mounted) setPilgrimages(data);
                }
            } catch (err) {
                console.error("❌ [Peregrinacoes] Unexpected error:", err);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchPilgrimages();
        return () => {
            mounted = false;
        };
    }, []);

    const getRemainingSpots = (pilgrimage: Pilgrimage) => {
        const effectiveRaw = Number(pilgrimage.effective_vacancies);
        const currentRaw = Number(pilgrimage.current_vacancies);
        const confirmedRaw = Number(pilgrimage.confirmed_pax || 0);
        const totalRaw = Number(pilgrimage.total_vacancies || 0);

        if (Number.isFinite(effectiveRaw)) return Math.max(0, effectiveRaw);
        if (Number.isFinite(currentRaw)) return Math.max(0, currentRaw);
        return Math.max(0, totalRaw - confirmedRaw);
    };

    const isBookable = (pilgrimage: Pilgrimage) => {
        const remaining = getRemainingSpots(pilgrimage);
        const startsAt = getCivilDateTimestamp(pilgrimage.start_date);
        const isFuture = Number.isFinite(startsAt) && startsAt >= todayTs;
        const isAvailableStatus = pilgrimage.status !== 'closed' && pilgrimage.status !== 'waitlist';
        return isFuture && isAvailableStatus && remaining > 0;
    };

    const todayTs = todayCivilTimestamp();
    // Defesa no cliente (o caminho de fallback busca direto ao Supabase, sem
    // passar pela action filtrada). Rascunhos/teste nunca renderizam.
    const visiblePilgrimages = pilgrimages.filter(isPubliclyListedPilgrimage);
    const sortedPilgrimages = [...visiblePilgrimages].sort((a, b) => {
        const aCampaign = isNovemberCampaignPilgrimage(a);
        const bCampaign = isNovemberCampaignPilgrimage(b);
        if (aCampaign !== bCampaign) return aCampaign ? -1 : 1;

        const aDate = getCivilDateTimestamp(a.start_date);
        const bDate = getCivilDateTimestamp(b.start_date);
        return (Number.isFinite(aDate) ? aDate : 0) - (Number.isFinite(bDate) ? bDate : 0);
    });
    const isItalyPilgrimage = (pilgrimage: Pilgrimage) =>
        /it[áa]lia|medjugorje/i.test(`${pilgrimage.slug || ''} ${pilgrimage.title || ''}`);
    const italyPilgrimage = sortedPilgrimages.find((pilgrimage) => isItalyPilgrimage(pilgrimage) && isBookable(pilgrimage))
        || sortedPilgrimages.find(isItalyPilgrimage);
    const marianPilgrimage = sortedPilgrimages.find((pilgrimage) => pilgrimage.slug === 'peregrinacao-mariana-2027');
    const nextPilgrimageWithVacancies = italyPilgrimage
        || sortedPilgrimages.find(isBookable)
        || visiblePilgrimages.find((pilgrimage) => getRemainingSpots(pilgrimage) > 0)
        || visiblePilgrimages[0];
    const marianPath = locale === 'en'
        ? '/en/pilgrimages/peregrinacao-mariana-2027'
        : '/peregrinacoes/peregrinacao-mariana-2027';
    const marianPoster = locale === 'en'
        ? marianPilgrimage?.cover_image_en || marianPilgrimage?.cover_image || CAMINHO_MARIANO_2027_POSTER_EN
        : marianPilgrimage?.cover_image || CAMINHO_MARIANO_2027_POSTER;

    return (
        <VIPLayout allowPublic={true}>
            <div className="bg-[#f8fafc] min-h-screen pb-12 shadow-sm overflow-hidden relative -mx-4 -mt-24 md:-mx-8 -mb-12">

                <PilgrimageHero featuredPilgrimage={marianPilgrimage || nextPilgrimageWithVacancies} />

                <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 lg:px-12">
                    {/* Testimonials Section - Strategic Position: Social Proof before Product */}
                    <div className="-mx-4 md:mx-0">
                        <PilgrimageTestimonials />
                    </div>

                    {/* Gallery Section */}
                    <div className="mb-8 md:mb-12 -mx-4 md:mx-0">
                        <PastPilgrimagesGallery />
                    </div>

                    <section className="relative mb-12 overflow-hidden bg-[#071936] text-white md:mb-16 md:rounded-[2rem]">
                        <div className="grid items-center gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-12 lg:p-12">
                            <Link href={marianPath} className="block overflow-hidden rounded-2xl border border-amber-200/25 shadow-2xl" aria-label={locale === 'en' ? 'See the Marian Way 2027 pilgrimage poster and details' : 'Ver o cartaz e os detalhes do Caminho Mariano 2027'}>
                                <Image
                                    src={marianPoster}
                                    alt={locale === 'en' ? 'Marian Way 2027 pilgrimage poster, 11–24 October' : 'Cartaz da peregrinação Caminho Mariano 2027, de 11 a 24 de outubro'}
                                    width={1198}
                                    height={1313}
                                    sizes="(max-width: 1024px) 100vw, 500px"
                                    className="h-auto w-full"
                                />
                            </Link>
                            <div className="px-1 pb-5 text-center lg:pb-0 lg:text-left">
                                <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-300">
                                    {locale === 'en' ? 'Registration open' : 'Inscrições abertas'}
                                </p>
                                <h2 className="mt-5 font-serif text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
                                    {locale === 'en' ? 'Marian Way 2027' : 'Caminho Mariano 2027'}
                                </h2>
                                <p className="mt-5 text-lg font-semibold text-amber-100">
                                    {locale === 'en' ? '11–24 October 2027' : '11 a 24 de outubro de 2027'}
                                </p>
                                <p className="mx-auto mt-6 max-w-md text-base leading-7 text-white/75 lg:mx-0">
                                    {locale === 'en'
                                        ? 'Explore the itinerary, flight options and pilgrimage details, then register directly on the trip page.'
                                        : 'Conheça o itinerário, as opções de voo e todos os detalhes da peregrinação. Pode inscrever-se diretamente na página da viagem.'}
                                </p>
                                <Link href={marianPath} className="group mt-8 inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-amber-300 px-8 text-sm font-bold text-[#071936] transition-colors hover:bg-amber-200">
                                    {locale === 'en' ? 'See the pilgrimage and register' : 'Ver peregrinação e inscrever-me'}
                                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                </Link>
                            </div>
                        </div>
                    </section>

                    {/* Trust Indicators / Value Prop */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] flex items-start gap-4 hover:transform hover:-translate-y-1 transition-all duration-300">
                            <div className="w-12 h-12 rounded-2xl bg-yellow-50 flex items-center justify-center text-yellow-600 shrink-0">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 mb-1">{p.hero.trustSmallGroups}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{p.hero.trustSmallGroupsDesc}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] flex items-start gap-4 hover:transform hover:-translate-y-1 transition-all duration-300">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 mb-1">{p.hero.trustOrganized}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{p.hero.trustOrganizedDesc}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] flex items-start gap-4 hover:transform hover:-translate-y-1 transition-all duration-300">
                            <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 mb-1">{p.hero.trustSpiritual}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{p.hero.trustSpiritualDesc}</p>
                            </div>
                        </div>
                    </div>

                    <section className="mb-14 md:mb-16 px-2">
                        <div className="max-w-3xl">
                            <p className="text-xs font-black uppercase tracking-widest text-yellow-700">
                                {locale === 'en' ? 'Catholic Marian pilgrimages' : 'Peregrinações marianas católicas'}
                            </p>
                            <h2 className="mt-3 font-serif text-3xl font-bold leading-tight text-slate-950 md:text-4xl">
                                {locale === 'en'
                                    ? 'Pilgrimages to Garabandal, Fatima and Iberian Catholic shrines'
                                    : 'Peregrinações a Garabandal, Fátima e santuários católicos ibéricos'}
                            </h2>
                            <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">
                                {locale === 'en'
                                    ? 'The Apostolate of Garabandal organises Catholic Marian pilgrimages for pilgrims from Portugal, Brazil and the Portuguese-speaking world, combining prayer, Mass, spiritual guidance, community and clear travel logistics.'
                                    : 'O Apostolado de Garabandal organiza peregrinações marianas católicas para peregrinos de Portugal, do Brasil e do mundo lusófono, unindo oração, Santa Missa, acompanhamento espiritual, vida em comunidade e logística clara de viagem.'}
                            </p>
                        </div>
                        <div className="mt-8 grid gap-4 md:grid-cols-3">
                            {[
                                {
                                    title: locale === 'en' ? 'Spiritual programme' : 'Programa espiritual',
                                    text: locale === 'en' ? 'Prayer, Mass and Marian devotion throughout the journey.' : 'Oração, Santa Missa e devoção mariana ao longo de toda a viagem.',
                                },
                                {
                                    title: locale === 'en' ? 'Organised logistics' : 'Logística organizada',
                                    text: locale === 'en' ? 'Dates, meeting points, accommodation and registration in one place.' : 'Datas, pontos de encontro, alojamento e inscrição reunidos num só lugar.',
                                },
                                {
                                    title: locale === 'en' ? 'Garabandal mission' : 'Missão Garabandal',
                                    text: locale === 'en' ? 'A journey connected to the mission of spreading Our Lady of Garabandal.' : 'Uma viagem ligada à missão de divulgar Nossa Senhora de Garabandal.',
                                },
                            ].map((item) => (
                                <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <h3 className="font-bold text-slate-950">{item.title}</h3>
                                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Listings Header */}
                    <div className="flex items-end justify-between mb-8 px-2">
                        <div>
                            <h2 className="text-3xl font-serif font-bold text-slate-900">{p.upcoming}</h2>
                            <p className="text-slate-500 mt-1">{p.upcomingSubtitle}</p>
                        </div>
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div className="text-center py-24">
                            <div className="animate-spin w-10 h-10 border-3 border-yellow-500 border-t-transparent rounded-full mx-auto mb-6" />
                            <p className="text-slate-500 font-medium animate-pulse">{p.loading}</p>
                        </div>
                    ) : sortedPilgrimages.length === 0 ? (
                        <div className="bg-white rounded-[2rem] border-2 border-dashed border-slate-200 p-16 text-center shadow-sm">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                                <MapPin className="w-10 h-10" />
                            </div>
                            <h3 className="text-2xl font-serif font-bold text-slate-900 mb-3">{p.noActive}</h3>
                            <p className="text-slate-500 max-w-md mx-auto leading-relaxed">{p.noActiveDesc}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-8">
                            {sortedPilgrimages.map((pilgrimage, idx) => (
                                <PilgrimageCard key={pilgrimage.id} pilgrimage={pilgrimage} index={idx} />
                            ))}
                        </div>
                    )}

                    {/* Spiritual Mission Section */}
                    {sortedPilgrimages.length > 0 && (
                        <div className="mt-12 bg-indigo-900/5 border border-indigo-900/10 rounded-3xl p-8 md:p-10 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                            <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center">
                                <div className="w-16 h-16 rounded-2xl bg-indigo-100/50 flex items-center justify-center text-indigo-700 shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /><path d="M12 5 9.04 11H6a5.5 5.5 0 0 0 5.5 5.5l.5.5" /></svg>
                                </div>
                                <div>
                                    <h3 className="text-xl md:text-2xl font-serif font-bold text-indigo-950 mb-3">{p.missionTitle}</h3>
                                    <div className="space-y-4 text-indigo-900/80 leading-relaxed max-w-2xl">
                                        <p>{p.missionDesc}</p>
                                        <p>
                                            <span className="font-semibold text-indigo-900">{p.missionDonation}</span>
                                        </p>
                                        <p className="text-sm italic opacity-90">{p.missionDonationDesc}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Newsletter / Waitlist CTA */}

                    <div className="mt-20 bg-slate-900 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-yellow-500/10 rounded-full blur-[80px] translate-x-1/2 -translate-y-1/2" />
                        <div className="relative z-10 max-w-2xl mx-auto">
                            <h3 className="text-2xl md:text-3xl font-serif font-bold text-white mb-4">{p.waitlistTitle}</h3>
                            <p className="text-slate-400 mb-8">{p.waitlistDesc}</p>
                            <GeneralWaitlistForm />
                        </div>
                    </div>

                </div>
            </div>
        </VIPLayout>
    );
}

function GeneralWaitlistForm() {
    const { locale, t } = useLocale();
    const isEn = locale === 'en';
    const p = t.pilgrimages;
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setLoading(true);
        try {
            const res = await fetch('/api/leads/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    type: 'general_waitlist',
                    channel_preference: 'email',
                    locale
                })
            });

            if (res.ok) {
                setStatus('success');
                setEmail('');
            } else {
                setStatus('error');
            }
        } catch {
            setStatus('error');
        } finally {
            setLoading(false);
        }
    };

    if (status === 'success') {
        return (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 max-w-md mx-auto animate-fade-in text-center">
                <p className="text-green-400 font-medium mb-1">{p.waitlistConfirmed}</p>
                <p className="text-green-400/80 text-sm">{p.waitlistConfirmedDesc}</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto relative">
            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={p.waitlistPlaceholder}
                disabled={loading}
                className="w-full sm:flex-1 h-16 shrink-0 text-lg rounded-xl px-4 bg-white/10 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 disabled:opacity-50 appearance-none"
            />
            <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto h-16 shrink-0 px-8 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold rounded-xl transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px] text-lg"
            >
                {loading ? <div className="animate-spin w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full" /> : p.waitlistButton}
            </button>
            {status === 'error' && (
                <div className="absolute -bottom-8 left-0 w-full text-center">
                    <p className="text-red-400 text-sm">{isEn ? 'An error occurred. Please try again.' : 'Ocorreu um erro. Tente novamente.'}</p>
                </div>
            )}
        </form>
    );
}
