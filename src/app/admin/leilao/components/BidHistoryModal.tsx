import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import { X, Loader2, ListOrdered, Calendar } from 'lucide-react';

type Bid = {
    id: string;
    user_id: string;
    user_email: string;
    amount: number;
    created_at: string;
};

interface BidHistoryModalProps {
    itemId: string;
    itemTitle: string;
    onClose: () => void;
}

export default function BidHistoryModal({ itemId, itemTitle, onClose }: BidHistoryModalProps) {
    const [bids, setBids] = useState<Bid[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBids = async () => {
            const session = await supabaseBrowser?.auth.getSession();
            const token = session?.data?.session?.access_token;
            if (!token) return;

            try {
                const res = await fetch(`/api/admin/auction/${itemId}/bids`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                setBids(data.bids || []);
            } catch (err) {
                console.error('Failed to load bids', err);
            } finally {
                setLoading(false);
            }
        };

        fetchBids();
    }, [itemId]);

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <ListOrdered className="w-5 h-5 text-yellow-600" />
                            Histórico de Lances
                        </h2>
                        <p className="text-sm text-slate-500 mt-1 truncate max-w-md" title={itemTitle}>
                            {itemTitle}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="py-12 flex justify-center">
                            <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
                        </div>
                    ) : bids.length === 0 ? (
                        <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <p className="text-slate-500 font-medium">Nenhum lance registado.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                                <div>Valor</div>
                                <div>Licitante</div>
                                <div className="text-right">Data</div>
                            </div>

                            {bids.map((bid, index) => (
                                <div
                                    key={bid.id}
                                    className={`
                                        grid grid-cols-[auto_1fr_auto] gap-4 items-center p-4 rounded-xl border transition-colors
                                        ${index === 0 ? 'bg-yellow-50 border-yellow-200 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-200'}
                                    `}
                                >
                                    <div className="font-mono text-lg font-bold text-slate-900 min-w-24">
                                        {(bid.amount / 100).toFixed(2)}€
                                    </div>
                                    <div className="truncate">
                                        <div className="font-medium text-slate-900 truncate">{bid.user_email}</div>
                                        <div className="text-xs text-slate-500 mt-0.5 max-w-[200px] truncate" title={bid.user_id}>ID: <span className="font-mono">{bid.user_id.split('-')[0]}...</span></div>
                                    </div>
                                    <div className="text-right text-sm text-slate-500 flex items-center gap-1.5 justify-end">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {new Date(bid.created_at).toLocaleString('pt-PT', {
                                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
