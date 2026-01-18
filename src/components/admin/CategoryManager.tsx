"use client";

import { useState, useEffect } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { Plus, X, Trash2, Edit2, Check, Loader2, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Category = {
    id: string;
    name: string;
    slug: string;
};

interface CategoryManagerProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void; // Trigger parent to reload categories
}

export default function CategoryManager({ isOpen, onClose, onUpdate }: CategoryManagerProps) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [newCategory, setNewCategory] = useState('');
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        if (isOpen) loadCategories();
    }, [isOpen]);

    const loadCategories = async () => {
        if (!supabaseBrowser) return;

        setLoading(true);
        const { data } = await supabaseBrowser
            .from('prayer_categories')
            .select('*')
            .order('name');

        if (data) setCategories(data);
        setLoading(false);
    };

    const handleAdd = async () => {
        if (!newCategory.trim()) return;
        if (!supabaseBrowser) return;

        setAdding(true);

        const slug = newCategory.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');

        const { error } = await supabaseBrowser
            .from('prayer_categories')
            .insert({ name: newCategory.trim(), slug });

        if (error) {
            alert('Erro ao criar categoria. Verifique se já existe.');
        } else {
            loadCategories();
            setNewCategory('');
            onUpdate();
        }
        setAdding(false);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Tem a certeza que deseja apagar a categoria "${name}"?`)) return;
        if (!supabaseBrowser) return;

        const { error } = await supabaseBrowser
            .from('prayer_categories')
            .delete()
            .eq('id', id);

        if (error) {
            alert('Erro ao apagar. Pode estar em uso por orações.');
        } else {
            loadCategories();
            onUpdate();
        }
    };

    const startEdit = (cat: Category) => {
        setEditingId(cat.id);
        setEditName(cat.name);
    };

    const saveEdit = async () => {
        if (!editName.trim() || !editingId) return;
        if (!supabaseBrowser) return;

        const slug = editName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');

        const { error } = await supabaseBrowser
            .from('prayer_categories')
            .update({ name: editName.trim(), slug })
            .eq('id', editingId);

        if (error) {
            alert('Erro ao atualizar.');
        } else {
            loadCategories();
            setEditingId(null);
            onUpdate();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
            >
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800">Gerir Categorias</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="p-4 border-b border-slate-100 bg-white">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            placeholder="Nova Categoria..."
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        />
                        <button
                            onClick={handleAdd}
                            disabled={adding || !newCategory.trim()}
                            className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                        >
                            {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="text-center py-8 text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                            Carregando...
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {categories.map(cat => (
                                <div key={cat.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg group transition-colors border border-transparent hover:border-slate-100">
                                    {editingId === cat.id ? (
                                        <div className="flex items-center gap-2 flex-1">
                                            <input
                                                autoFocus
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="flex-1 px-2 py-1 text-sm border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                            <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                                            <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X className="w-4 h-4" /></button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="text-sm font-medium text-slate-700">{cat.name}</span>
                                            <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => startEdit(cat)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => handleDelete(cat.id, cat.name)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
