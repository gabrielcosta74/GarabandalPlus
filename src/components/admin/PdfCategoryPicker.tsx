"use client";

import { useEffect, useState } from 'react';
import { Check, FolderPlus, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { getBrowserAccessToken } from '../../lib/supabase-browser';

type MemberContentCategory = {
    id: string;
    name: string;
    slug: string;
};

interface PdfCategoryPickerProps {
    value: string | null;
    onChange: (value: string | null) => void;
    disabled?: boolean;
    label?: string;
}

export default function PdfCategoryPicker({
    value,
    onChange,
    disabled = false,
    label = 'Categoria do PDF'
}: PdfCategoryPickerProps) {
    const [categories, setCategories] = useState<MemberContentCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        void loadCategories();
    }, []);

    const loadCategories = async () => {
        setLoading(true);
        try {
            const token = await getBrowserAccessToken();
            const res = await fetch('/api/admin/member-content-categories', {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store'
            });
            const data = await res.json().catch(() => null);

            if (!res.ok) {
                throw new Error(data?.error || 'Falha ao carregar categorias');
            }

            setCategories(data?.categories || []);
        } catch (error: any) {
            toast.error(error.message || 'Falha ao carregar categorias');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCategory = async () => {
        const trimmedName = newCategoryName.trim();
        if (!trimmedName) return;

        setCreating(true);
        try {
            const token = await getBrowserAccessToken();
            const res = await fetch('/api/admin/member-content-categories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ name: trimmedName })
            });

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.error || 'Falha ao criar categoria');
            }

            const createdCategory = data?.category as MemberContentCategory;

            setCategories((prev) => {
                const deduped = prev.filter((category) => category.id !== createdCategory.id);
                return [...deduped, createdCategory].sort((a, b) => a.name.localeCompare(b.name, 'pt-PT'));
            });
            setNewCategoryName('');
            setShowCreate(false);
            onChange(createdCategory.id);
            toast.success(data?.created ? 'Categoria criada.' : 'Categoria existente selecionada.');
        } catch (error: any) {
            toast.error(error.message || 'Falha ao criar categoria');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-700">{label}</label>

            <div className="flex flex-col gap-3 md:flex-row">
                <select
                    value={value || ''}
                    onChange={(event) => onChange(event.target.value || null)}
                    disabled={disabled || loading}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-garabandal-dark outline-none transition-all disabled:opacity-60"
                >
                    <option value="">{loading ? 'A carregar categorias...' : 'Sem categoria'}</option>
                    {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                            {category.name}
                        </option>
                    ))}
                </select>

                <button
                    type="button"
                    onClick={() => setShowCreate((current) => !current)}
                    disabled={disabled}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-colors disabled:opacity-60"
                >
                    <FolderPlus className="w-4 h-4" />
                    Nova Categoria
                </button>
            </div>

            {showCreate && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-slate-800">Criar categoria</p>
                        <button
                            type="button"
                            onClick={() => {
                                setShowCreate(false);
                                setNewCategoryName('');
                            }}
                            className="p-1 rounded-full text-slate-400 hover:bg-white hover:text-slate-600 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex flex-col gap-3 md:flex-row">
                        <input
                            value={newCategoryName}
                            onChange={(event) => setNewCategoryName(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void handleCreateCategory();
                                }
                            }}
                            placeholder="Ex: Aparições, Cartas, Formação"
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-garabandal-dark outline-none transition-all"
                        />
                        <button
                            type="button"
                            onClick={() => void handleCreateCategory()}
                            disabled={creating || !newCategoryName.trim()}
                            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors disabled:opacity-60"
                        >
                            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Guardar
                        </button>
                    </div>

                    <p className="text-xs text-slate-500">
                        Se a categoria já existir, ela será selecionada automaticamente.
                    </p>
                </div>
            )}
        </div>
    );
}
