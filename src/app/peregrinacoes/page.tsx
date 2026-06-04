"use client";

import { useEffect, useState } from 'react';
import VIPLayout from '../../components/member/VIPLayout';
import Link from 'next/link';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { MapPin, Calendar, Users, ShieldCheck, Heart, ArrowRight, AlertTriangle } from 'lucide-react';
import { PilgrimageHero } from '../../components/pilgrimage/PilgrimageHero';
import { useLocale } from '../../contexts/LocaleContext';
import { PilgrimageCard } from '../../components/pilgrimage/PilgrimageCard';
import { PastPilgrimagesGallery } from '../../components/pilgrimage/PastPilgrimagesGallery';
import { PilgrimageTestimonials } from '../../components/pilgrimage/PilgrimageTestimonials';
import { getPilgrimagesAction } from './actions';
import { getCivilDateTimestamp, getAvailabilityHighlightLabel, isNovemberCampaignPilgrimage, todayCivilTimestamp } from '../../lib/utils';

type Pilgrimage = {
    id: string;
    title: string;
    slug: string;
    description: string;
    cover_image: string;
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
};

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
                        .select('id,title,slug,description,cover_image,start_date,end_date,base_price,total_vacancies,current_vacancies,confirmed_pax,effective_vacancies,status,meeting_point_text,meeting_end_text,flight_info_text,payment_plan_text,cancellation_policy_text,not_included_items')
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
    const sortedPilgrimages = [...pilgrimages].sort((a, b) => {
        const aCampaign = isNovemberCampaignPilgrimage(a);
        const bCampaign = isNovemberCampaignPilgrimage(b);
        if (aCampaign !== bCampaign) return aCampaign ? -1 : 1;

        const aDate = getCivilDateTimestamp(a.start_date);
        const bDate = getCivilDateTimestamp(b.start_date);
        return (Number.isFinite(aDate) ? aDate : 0) - (Number.isFinite(bDate) ? bDate : 0);
    });
    const novemberPilgrimage = sortedPilgrimages.find((pilgrimage) => isNovemberCampaignPilgrimage(pilgrimage) && isBookable(pilgrimage))
        || sortedPilgrimages.find(isNovemberCampaignPilgrimage);
    const nextPilgrimageWithVacancies = novemberPilgrimage
        || sortedPilgrimages.find(isBookable)
        || pilgrimages.find((pilgrimage) => getRemainingSpots(pilgrimage) > 0)
        || pilgrimages[0];
    const basePilgrimagePath = locale === 'en' ? '/en/pilgrimages' : '/peregrinacoes';
    const donationsPath = locale === 'en' ? '/en/donations' : '/donations';
    const novemberHref = novemberPilgrimage ? `${basePilgrimagePath}/${novemberPilgrimage.slug}` : basePilgrimagePath;

    return (
        <VIPLayout allowPublic={true}>
            <div className="bg-[#f8fafc] min-h-screen md:rounded-[2.5rem] p-0 md:p-10 shadow-sm overflow-hidden relative">

                <PilgrimageHero featuredPilgrimage={nextPilgrimageWithVacancies} />

                <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-0">
                    {/* Testimonials Section - Strategic Position: Social Proof before Product */}
                    <div className="-mx-4 md:mx-0">
                        <PilgrimageTestimonials />
                    </div>

                    {/* Gallery Section */}
                    <div className="mb-8 md:mb-12 -mx-4 md:mx-0">
                        <PastPilgrimagesGallery />
                    </div>

                    {novemberPilgrimage && (
                        <section className="mb-10 md:mb-14 overflow-hidden rounded-3xl border border-yellow-200/80 bg-white shadow-[0_18px_60px_-32px_rgba(15,23,42,0.35)]">
                            <div className="grid gap-0 md:grid-cols-[1fr,0.72fr]">
                                <div className="p-6 md:p-10">
                                    <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-red-900/20 ring-2 ring-red-100">
                                        <AlertTriangle className="h-4 w-4" />
                                        {getAvailabilityHighlightLabel(getRemainingSpots(novemberPilgrimage), locale, novemberPilgrimage)}
                                    </div>
                                    <h2 className="font-serif text-3xl font-bold leading-tight text-slate-950 md:text-4xl">
                                        {locale === 'en' ? 'The available date is November. It usually fills quickly.' : 'A data disponível é novembro. Normalmente esgota rapidamente.'}
                                    </h2>
                                    <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
                                        {locale === 'en'
                                            ? 'First see the full programme, flights, price and spiritual rhythm. Each pilgrimage also supports the House of the Apostolate and the mission of spreading Garabandal.'
                                            : 'Veja primeiro o programa completo, voos, preço e ritmo espiritual. Cada peregrinação ajuda também a erguer a Casa do Apostolado e a missão de dar a conhecer Garabandal.'}
                                    </p>
                                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                                        <Link
                                            href={novemberHref}
                                            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 py-4 text-sm font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-yellow-700/20 ring-1 ring-yellow-200 transition-colors hover:bg-yellow-300"
                                        >
                                            {locale === 'en' ? 'View November pilgrimage' : 'Ver peregrinação de novembro'}
                                            <ArrowRight className="h-4 w-4" />
                                        </Link>
                                        <Link
                                            href={donationsPath}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-50"
                                        >
                                            <Heart className="h-4 w-4 text-red-500" />
                                            {locale === 'en' ? 'Know the mission' : 'Conhecer a missão'}
                                        </Link>
                                    </div>
                                </div>
                                <div className="border-t border-yellow-100 bg-yellow-50/80 p-6 md:border-l md:border-t-0 md:p-8">
                                    <div className="space-y-5">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-yellow-800">{locale === 'en' ? 'Why now' : 'Porque agora'}</p>
                                            <p className="mt-2 text-sm leading-relaxed text-slate-700 md:text-base">
                                                {locale === 'en' ? 'Other departures have already reached capacity or waitlist. This is the date to discern calmly before registration.' : 'As outras partidas já chegaram a esgotado ou lista de espera. Esta é a data para discernir com calma antes da inscrição.'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-yellow-800">{locale === 'en' ? 'Availability' : 'Disponibilidade'}</p>
                                            <p className="mt-2 text-lg font-black text-slate-950">{getAvailabilityHighlightLabel(getRemainingSpots(novemberPilgrimage), locale, novemberPilgrimage)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

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
                    ) : pilgrimages.length === 0 ? (
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
                    {pilgrimages.length > 0 && (
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
