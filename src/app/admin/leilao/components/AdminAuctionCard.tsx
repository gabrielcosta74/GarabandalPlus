import { Eye, Pencil, Trash2, CheckCircle2, Truck, Clock, AlertCircle, MapPin, FileText, Megaphone } from 'lucide-react';

export const STATUS_CONFIG: Record<string, { label: string; color: string; badge: string }> = {
    draft: { label: 'Rascunho', color: 'bg-slate-50 border-slate-200', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
    active: { label: 'Em Leilão', color: 'bg-white border-yellow-200 shadow-sm', badge: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    ended: { label: 'Encerrado s/ Lances', color: 'bg-stone-50 border-stone-200 opacity-75', badge: 'bg-stone-100 text-stone-600 border-stone-200' },
    awaiting_payment: { label: 'Aguardar Pag.', color: 'bg-white border-orange-200 shadow-sm', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
    paid: { label: 'Pronto a Enviar', color: 'bg-white border-emerald-200 shadow-sm', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    shipped: { label: 'Enviado', color: 'bg-slate-50 border-indigo-200', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    defaulted: { label: 'Não Pago', color: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-800 border-red-200' },
};

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
    total_bids: number;
    ends_at: string;
    status: string;
    winner_email: string | null;
    payment_deadline: string | null;
    created_at: string;
    shipping_info?: {
        name?: string;
        address?: string;
        city?: string;
        postal?: string;
        phone?: string | null;
        submitted_at?: string;
    } | null;
    receipt_url?: string | null;
};

interface AdminAuctionCardProps {
    item: AuctionItem & { announced_at?: string | null };
    onStatusChange: (id: string, newStatus: string) => void;
    onEdit: (item: AuctionItem) => void;
    onDelete: (id: string) => void;
    onShowBids: (id: string, title: string) => void;
    onProcessWinner?: (id: string) => void;
    onAnnounce?: (id: string) => void;
}

export default function AdminAuctionCard({
    item, onStatusChange, onEdit, onDelete, onShowBids, onProcessWinner, onAnnounce
}: AdminAuctionCardProps) {
    const statusInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG['draft'];
    const isOverdue = item.status === 'awaiting_payment' && item.payment_deadline && new Date(item.payment_deadline) < new Date();
    const isTimeExpired = item.status === 'active' && new Date(item.ends_at) < new Date();

    return (
        <div className={`rounded-2xl border transition-all ${statusInfo.color}`}>
            <div className="flex flex-col md:flex-row h-full">

                {/* Thumbnail Side */}
                <div className="w-full md:w-48 h-48 md:h-auto shrink-0 relative p-4 pb-0 md:pr-0 md:pb-4 flex flex-col justify-center">
                    <div className="w-full h-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 relative group aspect-square">
                        {item.images?.[0] ? (
                            <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                <span className="text-xs uppercase font-bold tracking-widest mt-2">S/ Imagem</span>
                            </div>
                        )}
                        <span className={`absolute top-3 left-3 text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-md border backdrop-blur-md ${isTimeExpired ? 'bg-red-100 text-red-800 border-red-200' : statusInfo.badge}`}>
                            {isTimeExpired ? 'Tempo Esgotado' : statusInfo.label}
                        </span>
                    </div>
                </div>

                {/* Content Side */}
                <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
                    <div>
                        <div className="flex items-start justify-between gap-4 mb-1">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 leading-tight truncate" title={item.title}>{item.title}</h3>
                                <p className="text-sm text-slate-500 mt-0.5">{item.artisan_name}</p>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-4">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Inicial / Incr.</div>
                                <div className="font-mono text-sm font-semibold text-slate-700">
                                    {(item.starting_price / 100).toFixed(0)}€ / {(item.min_increment / 100).toFixed(0)}€
                                </div>
                            </div>
                            <div className={`bg-slate-50 p-3 rounded-xl border ${item.current_bid ? 'border-yellow-200 bg-yellow-50' : 'border-slate-100'}`}>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Lance Atual</div>
                                <div className={`font-mono text-sm font-semibold ${item.current_bid ? 'text-yellow-700' : 'text-slate-700'}`}>
                                    {item.current_bid ? `${(item.current_bid / 100).toFixed(0)}€` : 'S/ Lances'}
                                </div>
                            </div>
                            <button
                                onClick={() => onShowBids(item.id, item.title)}
                                className="bg-slate-50 p-3 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-100 transition-colors text-left group"
                            >
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 group-hover:text-slate-500">Total Bids</div>
                                <div className="font-mono text-sm font-semibold text-slate-700 flex items-center justify-between">
                                    {item.total_bids} <Eye className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                                </div>
                            </button>
                            <div className={`bg-slate-50 p-3 rounded-xl border ${isTimeExpired ? 'border-red-200 bg-red-50' : 'border-slate-100'}`}>
                                <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isTimeExpired ? 'text-red-500' : 'text-slate-400'}`}>Término</div>
                                <div className="font-mono text-xs font-semibold text-slate-700 flex flex-col justify-center h-full">
                                    <span className={`flex items-center gap-1.5 whitespace-nowrap ${isTimeExpired ? 'text-red-700' : ''}`}>
                                        <Clock className={`w-3 h-3 ${isTimeExpired ? 'text-red-500' : 'text-slate-400'}`} />
                                        {new Date(item.ends_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Shipping info from winner */}
                        {item.shipping_info?.address && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-2 text-xs space-y-1">
                                <div className="flex items-center gap-1.5 font-bold text-slate-600 uppercase tracking-widest text-[10px]">
                                    <MapPin className="w-3 h-3" /> Morada de envio
                                </div>
                                <div className="text-slate-700">
                                    {item.shipping_info.name} — {item.shipping_info.address}, {item.shipping_info.postal} {item.shipping_info.city}
                                    {item.shipping_info.phone ? <span className="text-slate-500"> · {item.shipping_info.phone}</span> : null}
                                </div>
                            </div>
                        )}

                        {/* Receipt link */}
                        {item.receipt_url && item.receipt_url.startsWith('http') && (
                            <div className="mb-2">
                                <a
                                    href={item.receipt_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                    <FileText className="w-3.5 h-3.5" /> Ver comprovativo
                                </a>
                            </div>
                        )}

                        {/* Winner Info (if any) */}
                        {item.winner_email && (
                            <div className={`
                                flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl border mb-2
                                ${isOverdue ? 'bg-red-50 border-red-200' : 'bg-emerald-50/50 border-emerald-200'}
                            `}>
                                <div className="min-w-0">
                                    <div className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${isOverdue ? 'text-red-500' : 'text-emerald-600'}`}>
                                        Vencedor do Leilão
                                    </div>
                                    <div className="font-semibold text-sm truncate" title={item.winner_email}>
                                        {item.winner_email}
                                    </div>
                                </div>
                                {item.payment_deadline && item.status === 'awaiting_payment' && (
                                    <div className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 ${isOverdue ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                                        <Clock className="w-3 h-3" />
                                        {isOverdue ? 'Prazo Expirado' : `Pagar até: ${new Date(item.payment_deadline).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Actions Bar */}
                    <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100/60">
                        {item.status === 'draft' && (
                            <>
                                <button onClick={() => onStatusChange(item.id, 'active')} className="px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-xl text-xs font-bold hover:bg-green-100 transition-colors flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4" /> Ativar Leilão
                                </button>
                                <button onClick={() => onEdit(item)} className="px-3 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors flex items-center gap-1.5">
                                    <Pencil className="w-4 h-4" />
                                </button>
                            </>
                        )}
                        {item.status === 'active' && (
                            <>
                                {isTimeExpired ? (
                                    <button onClick={() => onProcessWinner ? onProcessWinner(item.id) : onStatusChange(item.id, 'awaiting_payment')} className="px-4 py-2 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-yellow-100 transition-colors">
                                        <CheckCircle2 className="w-4 h-4" /> Processar Vencedor
                                    </button>
                                ) : (
                                    <>
                                        {onAnnounce && (
                                            <button
                                                onClick={() => onAnnounce(item.id)}
                                                title={item.announced_at ? `Já anunciado em ${new Date(item.announced_at).toLocaleString('pt-PT')}` : 'Enviar anúncio por email aos contactos com consentimento'}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border ${item.announced_at
                                                    ? 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                                            >
                                                <Megaphone className="w-4 h-4" />
                                                {item.announced_at ? 'Anunciado · Reenviar' : 'Anunciar por Email'}
                                            </button>
                                        )}
                                        <button onClick={() => onStatusChange(item.id, 'ended')} className="px-3 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors flex items-center gap-1.5">
                                            Terminar Agora
                                        </button>
                                        <button onClick={() => onEdit(item)} className="px-3 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors flex items-center gap-1.5">
                                            <Pencil className="w-4 h-4" /> Editar
                                        </button>
                                    </>
                                )}
                            </>
                        )}
                        {item.status === 'awaiting_payment' && (
                            <>
                                <button onClick={() => onStatusChange(item.id, 'paid')} className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4" /> Confirmar Pagamento Manual
                                </button>
                            </>
                        )}
                        {item.status === 'paid' && (
                            <>
                                <button onClick={() => onStatusChange(item.id, 'shipped')} className="px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold hover:bg-purple-100 transition-colors flex items-center gap-1.5">
                                    <Truck className="w-4 h-4" /> Marcar como Enviado
                                </button>
                            </>
                        )}
                        {item.status === 'shipped' && (
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 w-full">
                                <Truck className="w-4 h-4" /> Peça Enviada
                            </div>
                        )}
                        {item.status === 'defaulted' && (
                            <>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2 w-full">
                                    <AlertCircle className="w-4 h-4" /> Vencedor falhou pagamento
                                </div>
                                <button onClick={() => onStatusChange(item.id, 'ended')} className="px-3 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors flex items-center gap-1.5">
                                    Cancelar Leilão
                                </button>
                            </>
                        )}

                        <div className="flex-1" />
                        <button onClick={() => onDelete(item.id)} className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1.5 ml-auto">
                            <Trash2 className="w-4 h-4" /> {item.status !== 'draft' && 'Apagar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
