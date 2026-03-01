"use client";

import { useEffect, useState, useMemo } from 'react';
import { Plus, Gavel, Loader2, X } from 'lucide-react';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import AuctionFilters, { AuctionFiltersState } from './components/AuctionFilters';
import AdminAuctionCard from './components/AdminAuctionCard';
import BidHistoryModal from './components/BidHistoryModal';

type AuctionItem = {
    id: string;
    title: string;
    description: string | null;
    images: string[];
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
};

export default function AdminAuctionPage() {
    const [items, setItems] = useState<AuctionItem[]>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [filters, setFilters] = useState<AuctionFiltersState>({ search: '', tab: 'all' });
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState<AuctionItem | null>(null);
    const [saving, setSaving] = useState(false);
    const [showBidsFor, setShowBidsFor] = useState<{ id: string, title: string } | null>(null);

    // Form State
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formArtisan, setFormArtisan] = useState('Artesã do Apostolado');
    const [formStartingPrice, setFormStartingPrice] = useState('');
    const [formMinIncrement, setFormMinIncrement] = useState('1');
    const [formEndsAt, setFormEndsAt] = useState('');
    const [formImages, setFormImages] = useState<string[]>([]);
    const [newImageUrl, setNewImageUrl] = useState('');

    const fetchItems = async () => {
        const session = await supabaseBrowser?.auth.getSession();
        const token = session?.data?.session?.access_token;
        if (!token) return;

        try {
            const res = await fetch('/api/admin/auction', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setItems(data.items || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchItems(); }, []);

    // Filter Logic
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            // Search filter
            if (filters.search) {
                const term = filters.search.toLowerCase();
                const matchesTitle = item.title.toLowerCase().includes(term);
                const matchesArtisan = item.artisan_name?.toLowerCase().includes(term);
                const matchesWinner = item.winner_email?.toLowerCase().includes(term);
                if (!matchesTitle && !matchesArtisan && !matchesWinner) return false;
            }

            // Tab filter
            switch (filters.tab) {
                case 'active': return item.status === 'active';
                case 'awaiting_payment': return item.status === 'awaiting_payment';
                case 'paid_shipped': return ['paid', 'shipped'].includes(item.status);
                case 'draft': return item.status === 'draft';
                case 'ended': return ['ended', 'defaulted'].includes(item.status);
                case 'all':
                default:
                    return true;
            }
        });
    }, [items, filters]);

    // Actions
    const handleStatusChange = async (id: string, newStatus: string) => {
        const session = await supabaseBrowser?.auth.getSession();
        const token = session?.data?.session?.access_token;
        if (!token) return;

        await fetch('/api/admin/auction', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ id, status: newStatus })
        });
        fetchItems();
    };

    const handleProcessWinner = async (id: string) => {
        if (!confirm('Isto irá processar o vencedor e enviar o email com 48h para pagar. Confirmar?')) return;

        const session = await supabaseBrowser?.auth.getSession();
        const token = session?.data?.session?.access_token;
        if (!token) return;

        await fetch(`/api/admin/auction/${id}/process-winner`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchItems();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem a certeza que quer apagar permanentemente este leilão? Esta ação não pode ser revertida e fará com que pagamentos pendentes/bids desapareçam.')) return;

        const session = await supabaseBrowser?.auth.getSession();
        const token = session?.data?.session?.access_token;
        if (!token) return;

        await fetch('/api/admin/auction', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ id })
        });
        fetchItems();
    };

    // Form Handlers
    const resetForm = () => {
        setFormTitle('');
        setFormDescription('');
        setFormArtisan('Artesã do Apostolado');
        setFormStartingPrice('');
        setFormMinIncrement('1');
        setFormEndsAt('');
        setFormImages([]);
        setEditingItem(null);
        setShowForm(false);
    };

    const openEdit = (item: AuctionItem) => {
        setEditingItem(item);
        setFormTitle(item.title);
        setFormDescription(item.description || '');
        setFormArtisan(item.artisan_name || 'Artesã do Apostolado');
        setFormStartingPrice((item.starting_price / 100).toString());
        setFormMinIncrement(((item.min_increment || 100) / 100).toString());
        setFormEndsAt(new Date(item.ends_at).toISOString().slice(0, 16));
        setFormImages(item.images || []);
        setShowForm(true);
    };

    const handleSave = async () => {
        setSaving(true);
        const session = await supabaseBrowser?.auth.getSession();
        const token = session?.data?.session?.access_token;
        if (!token) return;

        const payload = {
            ...(editingItem ? { id: editingItem.id } : {}),
            title: formTitle,
            description: formDescription || null,
            artisan_name: formArtisan,
            starting_price: Math.round(parseFloat(formStartingPrice) * 100),
            min_increment: Math.round(parseFloat(formMinIncrement || '1') * 100),
            ends_at: new Date(formEndsAt).toISOString(),
            images: formImages,
        };

        await fetch('/api/admin/auction', {
            method: editingItem ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        resetForm();
        setSaving(false);
        fetchItems();
    };

    const addImageUrl = () => {
        if (newImageUrl.trim()) {
            setFormImages([...formImages, newImageUrl.trim()]);
            setNewImageUrl('');
        }
    };

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto pb-24">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                        <Gavel className="w-6 h-6 text-yellow-600" />
                        Gestão de Leilões
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Gira as peças, analise os lances e acompanhe envios.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold px-5 py-2.5 rounded-xl transition-colors shadow-sm shrink-0 whitespace-nowrap"
                >
                    <Plus className="w-4 h-4" />
                    Adicionar Peça
                </button>
            </div>

            <AuctionFilters filters={filters} onChange={setFilters} />

            {loading ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                    <Loader2 className="w-8 h-8 animate-spin text-yellow-500 mx-auto" />
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                    <Gavel className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium text-lg">Nenhuma peça encontrada</p>
                    <p className="text-slate-400 text-sm mt-1">Tente alterar os filtros de pesquisa.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filteredItems.map(item => (
                        <AdminAuctionCard
                            key={item.id}
                            item={item}
                            onStatusChange={handleStatusChange}
                            onProcessWinner={handleProcessWinner}
                            onEdit={openEdit}
                            onDelete={handleDelete}
                            onShowBids={(id, title) => setShowBidsFor({ id, title })}
                        />
                    ))}
                </div>
            )}

            {/* Modals */}
            {showBidsFor && (
                <BidHistoryModal
                    itemId={showBidsFor.id}
                    itemTitle={showBidsFor.title}
                    onClose={() => setShowBidsFor(null)}
                />
            )}

            {showForm && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="text-lg font-bold text-slate-900">
                                {editingItem ? 'Editar Peça' : 'Nova Peça'}
                            </h2>
                            <button onClick={resetForm} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                            {/* Titulo */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Título *</label>
                                <input
                                    value={formTitle}
                                    onChange={e => setFormTitle(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/10 outline-none transition-colors"
                                    placeholder="Ex: Terço em prata restaurado"
                                />
                            </div>

                            {/* Detalhes */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Artesã</label>
                                    <input
                                        value={formArtisan}
                                        onChange={e => setFormArtisan(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/10 outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Data de Fecho *</label>
                                    <input
                                        type="datetime-local"
                                        value={formEndsAt}
                                        onChange={e => setFormEndsAt(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/10 outline-none transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Preços */}
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Preço Base (€) *</label>
                                    <input
                                        type="number" min="1" step="1"
                                        value={formStartingPrice}
                                        onChange={e => setFormStartingPrice(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/10 outline-none transition-colors"
                                        placeholder="20"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Incremento (€)</label>
                                    <input
                                        type="number" min="1" step="1"
                                        value={formMinIncrement}
                                        onChange={e => setFormMinIncrement(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/10 outline-none transition-colors"
                                        placeholder="1"
                                    />
                                </div>
                            </div>

                            {/* Descricao */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Descrição</label>
                                <textarea
                                    value={formDescription}
                                    onChange={e => setFormDescription(e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-3 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/10 outline-none resize-none transition-colors"
                                    placeholder="Descreva a história e estado da peça..."
                                />
                            </div>

                            {/* Images */}
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Links de Imagens</label>
                                <div className="flex gap-2 mb-3">
                                    <input
                                        value={newImageUrl}
                                        onChange={e => setNewImageUrl(e.target.value)}
                                        className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-yellow-500 outline-none transition-colors"
                                        placeholder="Cole um link https://..."
                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addImageUrl())}
                                    />
                                    <button
                                        type="button"
                                        onClick={addImageUrl}
                                        className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-300 transition-colors"
                                    >
                                        Adicionar
                                    </button>
                                </div>
                                {formImages.length > 0 ? (
                                    <div className="flex gap-2 flex-wrap">
                                        {formImages.map((url, idx) => (
                                            <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 group bg-white">
                                                <img src={url} alt="" className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => setFormImages(formImages.filter((_, i) => i !== idx))}
                                                    className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                                                >
                                                    <X className="w-5 h-5 text-white drop-shadow" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-slate-400 text-center py-4 border-2 border-dashed border-slate-200/50 rounded-xl">
                                        Nenhuma imagem adicionada
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
                            <button onClick={resetForm} className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-xl font-medium transition-colors">
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !formTitle || !formStartingPrice || !formEndsAt}
                                className="px-6 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-slate-900 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {editingItem ? 'Guardar' : 'Criar Rascunho'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
