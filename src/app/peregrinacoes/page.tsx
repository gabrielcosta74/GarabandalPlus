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
    const nextPilgrimageWithVacancies = italyPilgrimage
        || sortedPilgrimages.find(isBookable)
        || visiblePilgrimages.find((pilgrimage) => getRemainingSpots(pilgrimage) > 0)
        || visiblePilgrimages[0];
    const earlyAccessPath = locale === 'en' ? '/en/early-access' : '/acesso-antecipado';

    return (
        <VIPLayout allowPublic={true}>
            <div className="bg-[#f8fafc] min-h-screen pb-12 shadow-sm overflow-hidden relative -mx-4 -mt-24 md:-mx-8 -mb-12">

                <PilgrimageHero featuredPilgrimage={italyPilgrimage || nextPilgrimageWithVacancies} />

                <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 lg:px-12">
                    {/* Testimonials Section - Strategic Position: Social Proof before Product */}
                    <div className="-mx-4 md:mx-0">
                        <PilgrimageTestimonials />
                    </div>

                    {/* Gallery Section */}
                    <div className="mb-8 md:mb-12 -mx-4 md:mx-0">
                        <PastPilgrimagesGallery />
                    </div>

                    {/* Acesso antecipado ao Caminho Mariano 2027. Substitui o antigo
                        aviso de "esgotado" da Itália: em vez de fechar a porta, manda
                        quem chega agora para a lista prioritária. */}
                    <section className="relative mb-12 md:mb-16 -mx-4 overflow-hidden bg-[#0a0a0c] text-[#f4f1e9] md:mx-0 md:rounded-[2rem]">
                        {/* Mesma fotografia da landing de acesso antecipado. Aqui o
                            recorte é largo e o texto fica centrado por cima do rosto,
                            por isso o escurecimento é bem mais fundo do que na landing. */}
                        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                            <Image
                                src="/images/early-access-nossa-senhora.webp"
                                alt=""
                                fill
                                sizes="(max-width: 768px) 100vw, 1152px"
                                className="object-cover object-[center_30%]"
                            />
                            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,8,0.86)_0%,rgba(8,8,8,0.74)_45%,rgba(8,8,8,0.9)_100%)]" />
                        </div>
                        <div className="pointer-events-none absolute left-1/2 top-0 h-[380px] w-[380px] -translate-x-1/2 -translate-y-2/3 rounded-full bg-amber-300/[0.09] blur-[90px]" />
                        <div className="relative mx-auto max-w-2xl px-6 py-16 text-center sm:px-10 md:py-24">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-200/75">
                                {locale === 'en' ? 'Early access' : 'Acesso antecipado'}
                            </p>

                            <h2 className="mt-7 font-serif text-[2rem] font-semibold leading-[1.12] tracking-tight text-white sm:text-4xl md:text-5xl">
                                {locale === 'en' ? 'Marian Way 2027' : 'Caminho Mariano 2027'}
                            </h2>

                            <div className="mx-auto mt-8 h-px w-16 bg-gradient-to-r from-transparent via-amber-200/45 to-transparent" />

                            <p className="mx-auto mt-8 max-w-md text-base leading-[1.85] text-[#f4f1e9]/70 sm:text-lg">
                                {locale === 'en'
                                    ? 'Registration opens for the private list first. You receive the link 48 hours before everyone else.'
                                    : 'As inscrições abrem primeiro para a lista privada. Recebe o link 48 horas antes de todos.'}
                            </p>

                            <div className="mx-auto mt-12 grid max-w-sm grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/[0.07]">
                                {[
                                    {
                                        value: locale === 'en' ? '13 Oct' : '13 Out',
                                        label: locale === 'en' ? 'Private access' : 'Acesso privado',
                                        accent: true,
                                    },
                                    {
                                        value: locale === 'en' ? '15 Oct' : '15 Out',
                                        label: locale === 'en' ? 'Public opening' : 'Abertura pública',
                                        accent: false,
                                    },
                                ].map((item) => (
                                    <div key={item.label} className="bg-[#0a0a0c]/70 px-4 py-6 backdrop-blur-sm">
                                        <p className={`font-serif text-2xl font-semibold ${item.accent ? 'text-amber-200' : 'text-white/55'}`}>
                                            {item.value}
                                        </p>
                                        <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-[#f4f1e9]/45">
                                            {item.label}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <Link
                                href={earlyAccessPath}
                                className="group mt-12 inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[#f4f1e9] px-9 text-sm font-semibold tracking-wide text-[#0a0a0c] transition-colors hover:bg-white"
                            >
                                {locale === 'en' ? 'Join the private list' : 'Entrar na lista privada'}
                                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                            </Link>

                            <p className="mt-6 text-xs leading-relaxed text-[#f4f1e9]/40">
                                {locale === 'en'
                                    ? 'Free. Only an email, so we can send the link on the day.'
                                    : 'Sem custo. Apenas um email, para enviarmos o link no dia.'}
                            </p>
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
