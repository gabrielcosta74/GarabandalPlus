"use client";

import { useEffect, useMemo, useState } from 'react';
import { Gavel, Trophy, Heart, Clock, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';
import { AuctionCard } from '../../components/auction/AuctionCard';
import { useLocale } from '../../contexts/LocaleContext';

type AuctionItem = {
    id: string;
    title: string;
    images: string[];
    starting_price: number;
    current_bid: number | null;
    total_bids: number;
    ends_at: string;
    status: string;
};

type Filter = 'active' | 'ended';

const COPY = {
    pt: {
        breadcrumb: 'Leilão Solidário',
        heroBadge: 'Causa em ação',
        heroTitle: 'Peças com Alma, Causas com Coração',
        heroLead: 'Cada lance contribui directamente para a construção da Casa do Apostolado de Garabandal e para a missão de evangelização mariana.',
        heroCta: 'Ver leilões em destaque',
        tabsActive: 'A decorrer',
        tabsEnded: 'Encerrados',
        emptyActiveTitle: 'Não há leilões a decorrer neste momento',
        emptyActiveSub: 'Subscreva a newsletter para ser avisado quando começarem novas peças. Entretanto, pode visitar as peregrinações ou apoiar a causa por doação.',
        emptyEndedTitle: 'Ainda sem leilões encerrados',
        emptyEndedSub: 'Quando os leilões terminarem, as peças aparecem aqui com o vencedor.',
        howTitle: 'Como funciona',
        steps: [
            { icon: Gavel, title: '1. Encontre uma peça', text: 'Veja as peças disponíveis. Cada uma tem um valor mínimo e um contador a indicar quanto falta para terminar.' },
            { icon: Sparkles, title: '2. Faça o seu lance', text: 'Inicie sessão e licite. Será notificado por email se alguém ultrapassar o seu lance — tem sempre oportunidade de voltar a licitar.' },
            { icon: Trophy, title: '3. Vença o leilão', text: 'No final, o lance mais alto vence. Recebe um email com os passos seguintes e tem 48 horas para concluir o pagamento.' },
            { icon: Heart, title: '4. Apoia a missão', text: 'O valor reverte para a Casa do Apostolado e para as obras de caridade. Recebe a peça em casa.' },
        ],
        trustTitle: 'Compromissos do leilão',
        trust: [
            { icon: ShieldCheck, label: 'Pagamento seguro', text: 'Reduniq (cartão / MB WAY) ou transferência bancária com envio de comprovativo.' },
            { icon: Clock, label: 'Prazo de 48h', text: 'O vencedor tem 48 horas para concluir o pagamento. Caso contrário a peça vai para o licitador seguinte.' },
            { icon: Heart, label: 'Causa transparente', text: 'Cada euro reverte directamente para a obra do Apostolado. Sem comissões intermediárias.' },
        ],
        ctaTitle: 'Quer doar uma peça?',
        ctaText: 'Aceitamos peças com história — religiosas, artesanato, livros — para futuros leilões.',
        ctaBtn: 'Falar connosco',
        ctaMailSubject: 'Doação de peça para o Leilão Solidário',
        loading: 'A carregar leilões…',
    },
    en: {
        breadcrumb: 'Charity Auction',
        heroBadge: 'Cause in action',
        heroTitle: 'Pieces with Soul, Causes with Heart',
        heroLead: 'Every bid contributes directly to the building of the Apostolate House of Garabandal and to the mission of Marian evangelisation.',
        heroCta: 'See featured auctions',
        tabsActive: 'Live',
        tabsEnded: 'Ended',
        emptyActiveTitle: 'No live auctions right now',
        emptyActiveSub: 'Subscribe to our newsletter to be notified when new pieces are released. In the meantime, visit our pilgrimages or support the mission with a donation.',
        emptyEndedTitle: 'No closed auctions yet',
        emptyEndedSub: 'When auctions end, pieces appear here with the winner.',
        howTitle: 'How it works',
        steps: [
            { icon: Gavel, title: '1. Find a piece', text: 'Browse available pieces. Each has a starting price and a live countdown.' },
            { icon: Sparkles, title: '2. Place your bid', text: 'Sign in and bid. You will be notified by email if someone outbids you — you can always come back and bid again.' },
            { icon: Trophy, title: '3. Win the auction', text: 'At the end, the highest bid wins. You receive an email with the next steps and have 48 hours to complete the payment.' },
            { icon: Heart, title: '4. Support the mission', text: 'Proceeds go to the Apostolate House and charity works. The piece is then sent to you.' },
        ],
        trustTitle: 'Auction commitments',
        trust: [
            { icon: ShieldCheck, label: 'Secure payment', text: 'Reduniq (card / MB WAY) or bank transfer with proof of payment.' },
            { icon: Clock, label: '48h deadline', text: 'The winner has 48 hours to complete the payment. Otherwise the piece goes to the next bidder.' },
            { icon: Heart, label: 'Transparent cause', text: 'Every euro goes directly to the Apostolate. No intermediary fees.' },
        ],
        ctaTitle: 'Would you like to donate a piece?',
        ctaText: 'We accept pieces with history — religious art, crafts, books — for future auctions.',
        ctaBtn: 'Get in touch',
        ctaMailSubject: 'Donating a piece for the Charity Auction',
        loading: 'Loading auctions…',
    },
};

export default function LeilaoClient() {
    const { locale } = useLocale();
    const t = COPY[locale === 'en' ? 'en' : 'pt'];
    const [items, setItems] = useState<AuctionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Filter>('active');

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await fetch('/api/auction/items', { cache: 'no-store' });
                const data = await res.json();
                if (alive) setItems(data.items || []);
            } catch (err) {
                console.error('[Leilao] Failed to load items:', err);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, []);

    const { activeItems, endedItems } = useMemo(() => {
        const now = Date.now();
        const active: AuctionItem[] = [];
        const ended: AuctionItem[] = [];
        for (const item of items) {
            const isActive = item.status === 'active' && new Date(item.ends_at).getTime() > now;
            if (isActive) active.push(item);
            else ended.push(item);
        }
        active.sort((a, b) => new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime());
        ended.sort((a, b) => new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime());
        return { activeItems: active, endedItems: ended };
    }, [items]);

    const shown = filter === 'active' ? activeItems : endedItems;
    const featuredItem = activeItems[0];

    return (
        <main className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-white">
            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(202,138,4,0.10),transparent_55%),radial-gradient(circle_at_80%_30%,rgba(217,119,6,0.08),transparent_60%)]" />
                <div className="container mx-auto px-5 sm:px-8 pt-10 pb-12 sm:pt-20 sm:pb-20 max-w-5xl">
                    <div className="text-center">
                        <div className="inline-flex items-center gap-2 bg-yellow-50 text-yellow-800 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest mb-5 border border-yellow-200/70">
                            <Gavel className="w-3.5 h-3.5" /> {t.heroBadge}
                        </div>
                        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-slate-900 leading-tight tracking-tight mb-4">
                            {t.heroTitle}
                        </h1>
                        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                            {t.heroLead}
                        </p>
                        {featuredItem && (
                            <a
                                href="#listing"
                                className="inline-flex items-center gap-2 mt-7 text-sm font-bold text-yellow-800 bg-yellow-100 hover:bg-yellow-200 transition-colors px-5 py-3 rounded-full border border-yellow-200"
                            >
                                {t.heroCta} <ArrowRight className="w-4 h-4" />
                            </a>
                        )}
                    </div>
                </div>
            </section>

            {/* ── Tabs + Listing ──────────────────────────────────────────── */}
            <section id="listing" className="container mx-auto px-4 sm:px-8 pb-12 sm:pb-20 max-w-6xl scroll-mt-24">
                {/* Mobile-friendly segmented tabs */}
                <div className="flex justify-center mb-8">
                    <div className="inline-flex bg-slate-100/80 border border-slate-200 rounded-full p-1 shadow-sm">
                        <button
                            onClick={() => setFilter('active')}
                            className={`px-4 sm:px-6 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-full transition-all ${filter === 'active'
                                ? 'bg-white text-yellow-800 shadow'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {t.tabsActive}
                            {activeItems.length > 0 && (
                                <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-yellow-100 text-yellow-800">
                                    {activeItems.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setFilter('ended')}
                            className={`px-4 sm:px-6 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-full transition-all ${filter === 'ended'
                                ? 'bg-white text-slate-700 shadow'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {t.tabsEnded}
                            {endedItems.length > 0 && (
                                <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-slate-200 text-slate-700">
                                    {endedItems.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-pulse">
                                <div className="aspect-[4/3] bg-slate-100" />
                                <div className="p-4 space-y-3">
                                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                                    <div className="h-6 bg-slate-100 rounded w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : shown.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                        {shown.map(item => (
                            <AuctionCard key={item.id} item={item} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 px-4 bg-white rounded-2xl border border-dashed border-slate-200">
                        <Gavel className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-bold text-slate-700 mb-2">
                            {filter === 'active' ? t.emptyActiveTitle : t.emptyEndedTitle}
                        </h3>
                        <p className="text-sm text-slate-500 max-w-md mx-auto">
                            {filter === 'active' ? t.emptyActiveSub : t.emptyEndedSub}
                        </p>
                    </div>
                )}
            </section>

            {/* ── How it works ────────────────────────────────────────────── */}
            <section className="bg-gradient-to-b from-stone-50 to-white py-14 sm:py-20 border-y border-stone-100">
                <div className="container mx-auto px-5 sm:px-8 max-w-6xl">
                    <h2 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 text-center mb-10">
                        {t.howTitle}
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                        {t.steps.map((step, i) => {
                            const Icon = step.icon;
                            return (
                                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
                                    <div className="w-11 h-11 rounded-xl bg-yellow-50 border border-yellow-100 flex items-center justify-center mb-4">
                                        <Icon className="w-5 h-5 text-yellow-700" />
                                    </div>
                                    <h3 className="font-bold text-slate-900 text-base mb-1.5">{step.title}</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed">{step.text}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ── Trust strip ─────────────────────────────────────────────── */}
            <section className="container mx-auto px-5 sm:px-8 max-w-6xl py-14 sm:py-20">
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 text-center mb-8">{t.trustTitle}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                    {t.trust.map((row, i) => {
                        const Icon = row.icon;
                        return (
                            <div key={i} className="flex gap-4 bg-white rounded-2xl border border-slate-100 p-5">
                                <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                                    <Icon className="w-5 h-5 text-emerald-700" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-sm mb-1">{row.label}</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed">{row.text}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── CTA: donate a piece ─────────────────────────────────────── */}
            <section className="container mx-auto px-5 sm:px-8 max-w-4xl pb-16 sm:pb-24">
                <div className="bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-50/30 border border-yellow-200/60 rounded-3xl p-7 sm:p-10 text-center">
                    <Heart className="w-9 h-9 text-yellow-600 mx-auto mb-3" />
                    <h3 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 mb-2">
                        {t.ctaTitle}
                    </h3>
                    <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto mb-5">
                        {t.ctaText}
                    </p>
                    <a
                        href={`mailto:geral@apostoladodegarabandal.com?subject=${encodeURIComponent(t.ctaMailSubject)}`}
                        className="inline-flex items-center gap-2 text-sm font-bold text-yellow-900 bg-white hover:bg-yellow-100 transition-colors px-5 py-3 rounded-full border border-yellow-300 shadow-sm"
                    >
                        {t.ctaBtn} <ArrowRight className="w-4 h-4" />
                    </a>
                </div>
            </section>
        </main>
    );
}
