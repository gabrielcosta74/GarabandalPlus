import { Search } from 'lucide-react';

export type AuctionFiltersState = {
    search: string;
    tab: 'all' | 'active' | 'awaiting_payment' | 'paid_shipped' | 'draft' | 'ended';
};

interface AuctionFiltersProps {
    filters: AuctionFiltersState;
    onChange: (filters: AuctionFiltersState) => void;
}

const TABS = [
    { id: 'all', label: 'Todos' },
    { id: 'active', label: 'Ativos' },
    { id: 'awaiting_payment', label: 'Aguarda Pagamento' },
    { id: 'paid_shipped', label: 'Para Envio / Enviados' },
    { id: 'draft', label: 'Rascunhos' },
    { id: 'ended', label: 'Terminados / Não Pagos' },
];

export default function AuctionFilters({ filters, onChange }: AuctionFiltersProps) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Pesquisar peça, artesã ou vencedor..."
                        value={filters.search}
                        onChange={(e) => onChange({ ...filters, search: e.target.value })}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 transition-all"
                    />
                </div>
            </div>

            <div className="flex overflow-x-auto hide-scrollbar">
                {TABS.map(tab => {
                    const isActive = filters.tab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onChange({ ...filters, tab: tab.id as any })}
                            className={`
                                flex-shrink-0 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                                ${isActive ? 'border-yellow-500 text-yellow-700 bg-yellow-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}
                            `}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
