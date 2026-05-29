"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, Gavel, User, Trophy, Shield } from 'lucide-react';
import VIPLayout from '../../../components/member/VIPLayout';
import { AuctionGallery } from '../../../components/auction/AuctionGallery';
import { AuctionCountdown } from '../../../components/auction/AuctionCountdown';
import { BidForm } from '../../../components/auction/BidForm';
import { WinnerPaymentPanel } from '../../../components/auction/WinnerPaymentPanel';
import { supabaseBrowser } from '../../../lib/supabase-browser';

type AuctionItem = {
    id: string;
    title: string;
    description: string | null;
    images: string[];
    videos: string[];
    artisan_name: string;
    starting_price: number;
    min_increment: number;
    current_bid: number | null;
    current_bidder_id: string | null;
    total_bids: number;
    ends_at: string;
    status: string;
    winner_id: string | null;
    payment_deadline: string | null;
};

type Bid = {
    id: string;
    amount: number;
    user_id: string;
    user_email: string;
    created_at: string;
};

export default function AuctionDetailPage() {
    const params = useParams();
    const id = params?.id as string;
    const [item, setItem] = useState<AuctionItem | null>(null);
    const [bids, setBids] = useState<Bid[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        if (!supabaseBrowser) return;
        supabaseBrowser.auth.getSession().then(({ data }) => {
            setCurrentUserId(data?.session?.user?.id || null);
        });
    }, []);

    useEffect(() => {
        if (!id || !supabaseBrowser) return;

        const fetchData = async () => {
            const [itemRes, bidsRes] = await Promise.all([
                supabaseBrowser.from('auction_items').select('*').eq('id', id).single(),
                supabaseBrowser.from('auction_bids').select('id, amount, user_id, user_email, created_at').eq('item_id', id).order('amount', { ascending: false }).limit(10)
            ]);

            if (itemRes.data) setItem(itemRes.data as AuctionItem);
            if (bidsRes.data) setBids(bidsRes.data);
            setLoading(false);
        };

        fetchData();
    }, [id]);

    const isExpired = item ? (item.status !== 'active' || new Date(item.ends_at) <= new Date()) : false;
    const isLeader = !!(currentUserId && item?.current_bidder_id === currentUserId);
    const isWinner = !!(currentUserId && item?.winner_id === currentUserId && ['awaiting_payment', 'paid', 'shipped'].includes(item?.status || ''));

    const anonymizeEmail = (email: string) => {
        const [local, domain] = email.split('@');
        if (!local || !domain) return '***';
        return `${local.slice(0, 2)}***@${domain}`;
    };

    return (
        <VIPLayout allowPublic={true}>
            <div className="bg-[#f8fafc] min-h-screen md:rounded-[2.5rem] p-0 md:p-10 overflow-hidden relative">
                <div className="max-w-5xl mx-auto px-4 md:px-0 py-8 md:py-0">

                    {/* Back Link */}
                    <Link
                        href="/donations"
                        className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors mb-8 group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Voltar às Doações
                    </Link>

                    {loading ? (
                        <div className="text-center py-24">
                            <div className="animate-spin w-10 h-10 border-3 border-yellow-500 border-t-transparent rounded-full mx-auto mb-4" />
                            <p className="text-slate-500 animate-pulse">A carregar...</p>
                        </div>
                    ) : !item ? (
                        <div className="text-center py-24">
                            <Gavel className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">Item não encontrado</h2>
                            <p className="text-slate-500">Este item de leilão pode ter sido removido.</p>
                        </div>
                    ) : (
                        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">

                            {/* Left: Gallery */}
                            <div>
                                <AuctionGallery images={item.images} videos={item.videos} title={item.title} />
                            </div>

                            {/* Right: Details + Bid */}
                            <div className="space-y-6">
                                {/* Title */}
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-yellow-600 mb-2">
                                        Leilão Solidário
                                    </p>
                                    <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 leading-tight">
                                        {item.title}
                                    </h1>
                                    <p className="text-slate-500 mt-2 text-sm">
                                        Peça de <span className="font-semibold text-slate-700">{item.artisan_name}</span>
                                    </p>
                                </div>

                                {/* Price + Timer */}
                                <div className={`rounded-2xl border p-6 shadow-sm space-y-4 ${isLeader ? 'bg-green-50 border-green-200' : 'bg-white border-slate-100'}`}>
                                    {/* Leader Banner */}
                                    {isLeader && !isExpired && (
                                        <div className="flex items-center gap-3 bg-green-100 rounded-xl px-4 py-3 border border-green-200">
                                            <Trophy className="w-5 h-5 text-green-600 shrink-0" />
                                            <div>
                                                <p className="text-green-800 font-bold text-sm">Você está a liderar este leilão!</p>
                                                <p className="text-green-600 text-xs">Se ninguém fizer um lance mais alto, a peça é sua.</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-end justify-between">
                                        <div>
                                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block mb-1">
                                                {item.current_bid ? 'Lance atual' : 'Valor mínimo'}
                                            </span>
                                            <span className={`text-4xl font-bold tracking-tight ${isLeader ? 'text-green-700' : 'text-slate-900'}`}>
                                                {((item.current_bid || item.starting_price) / 100).toFixed(0)}€
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold flex items-center gap-1 justify-end mb-1">
                                                <Clock className="w-3 h-3" />
                                                {isExpired ? 'Encerrado' : 'Termina em'}
                                            </span>
                                            <AuctionCountdown endsAt={item.ends_at} className="text-lg" />
                                        </div>
                                    </div>

                                    {item.total_bids > 0 && (
                                        <p className="text-sm text-slate-500">
                                            {item.total_bids} {item.total_bids === 1 ? 'lance realizado' : 'lances realizados'}
                                        </p>
                                    )}
                                </div>

                                {/* Bid Form or Winner Payment Panel */}
                                {isWinner ? (
                                    <WinnerPaymentPanel
                                        itemId={item.id}
                                        itemTitle={item.title}
                                        winningBid={item.current_bid || item.starting_price}
                                        paymentDeadline={item.payment_deadline}
                                        itemStatus={item.status}
                                    />
                                ) : (
                                    <BidForm
                                        itemId={item.id}
                                        currentBid={item.current_bid}
                                        startingPrice={item.starting_price}
                                        minIncrement={item.min_increment}
                                        isExpired={isExpired}
                                        isLeader={isLeader}
                                    />
                                )}

                                {/* Description */}
                                {item.description && (
                                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                                        <h3 className="font-bold text-slate-900 mb-3">Sobre esta peça</h3>
                                        <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                                            {item.description}
                                        </p>
                                    </div>
                                )}

                                {/* Cause Banner */}
                                <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-5">
                                    <p className="text-sm text-indigo-900 leading-relaxed">
                                        <strong>100% do valor reverte para a construção da Casa do Apostolado.</strong>{' '}
                                        Ao licitar, contribui diretamente para esta obra de fé.
                                    </p>
                                </div>

                                {/* Recent Bids */}
                                {bids.length > 0 && (
                                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                                        <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wider">
                                            Últimos Lances
                                        </h3>
                                        <div className="space-y-3">
                                            {bids.slice(0, 5).map((bid, idx) => {
                                                const isMe = currentUserId && bid.user_id === currentUserId;
                                                return (
                                                    <div
                                                        key={bid.id}
                                                        className={`flex items-center justify-between py-2 ${isMe ? 'text-green-700' : idx === 0 ? 'text-yellow-700' : 'text-slate-600'}`}
                                                    >
                                                        <div className="flex items-center gap-2 text-sm">
                                                            {isMe ? <Shield className="w-4 h-4 text-green-600" /> : <User className="w-4 h-4 opacity-50" />}
                                                            <span className={idx === 0 || isMe ? 'font-bold' : ''}>
                                                                {isMe ? 'Você' : anonymizeEmail(bid.user_email)}
                                                            </span>
                                                            {idx === 0 && (
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${isMe ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>
                                                                    Líder
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className={`font-bold ${idx === 0 ? 'text-lg' : 'text-sm'}`}>
                                                            {(bid.amount / 100).toFixed(0)}€
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </VIPLayout >
    );
}
