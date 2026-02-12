import React, { useState } from 'react';
import { Plus, Trash2, Box } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface Variant {
    id?: string;
    product_id?: string;
    name: string; // "S", "M", "L", "Red"
    sku: string;
    stock: number;
    price_override?: number;
    attributes?: Record<string, any>;
}

interface VariantManagerProps {
    variants: Variant[];
    onChange: (variants: Variant[]) => void;
    baseSku: string;
}

export default function VariantManager({ variants, onChange, baseSku }: VariantManagerProps) {
    const [newName, setNewName] = useState('');
    const [newStock, setNewStock] = useState(0);

    const handleAdd = () => {
        if (!newName || !newName.trim()) {
            alert("Nome da variante é obrigatório");
            return;
        }

        const newVariant: Variant = {
            name: newName,
            sku: `${baseSku}-${newName.toUpperCase()}`,
            stock: newStock,
            attributes: {}
        };

        onChange([...variants, newVariant]);
        setNewName('');
        setNewStock(0);
    };

    const handleRemove = (index: number) => {
        const newVars = [...variants];
        newVars.splice(index, 1);
        onChange(newVars);
    };

    const handleUpdate = (index: number, field: keyof Variant, value: any) => {
        const newVars = [...variants];
        newVars[index] = { ...newVars[index], [field]: value };
        onChange(newVars);
    };

    return (
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Box className="w-4 h-4 text-amber-500" />
                Variantes (Tamanhos/Cores)
            </h3>

            {/* List */}
            <div className="space-y-3 mb-6">
                <AnimatePresence>
                    {variants.map((v, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-4 shadow-sm"
                        >
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs">
                                {idx + 1}
                            </div>

                            <div className="flex-1 grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Nome/Tamanho</label>
                                    <input
                                        type="text"
                                        value={v.name}
                                        onChange={e => handleUpdate(idx, 'name', e.target.value)}
                                        className="w-full text-sm font-bold bg-transparent outline-none border-b border-transparent focus:border-amber-500"
                                    />
                                    <div className="text-[10px] text-slate-400 font-mono mt-1">{v.sku}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Stock</label>
                                    <input
                                        type="number"
                                        value={v.stock}
                                        onChange={e => handleUpdate(idx, 'stock', parseInt(e.target.value) || 0)}
                                        className="w-full text-sm font-bold bg-transparent outline-none border-b border-transparent focus:border-amber-500"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => handleRemove(idx)}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {variants.length === 0 && (
                    <div className="text-center py-6 text-slate-400 text-sm">
                        Nenhuma variante adicionada.
                    </div>
                )}
            </div>

            {/* Add New */}
            <div className="flex gap-4 items-end bg-white p-4 rounded-xl border border-dashed border-slate-300">
                <div className="flex-1">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Variante</label>
                    <input
                        type="text"
                        placeholder="Ex: S, XL, Azul..."
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-amber-500"
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    />
                </div>
                <div className="w-24">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Stock</label>
                    <input
                        type="number"
                        placeholder="0"
                        value={newStock}
                        onChange={e => setNewStock(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-amber-500"
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    />
                </div>
                <button
                    onClick={handleAdd}
                    disabled={!newName}
                    className="h-[38px] px-4 bg-slate-900 text-white rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    <Plus className="w-4 h-4" /> Adicionar
                </button>
            </div>
        </div>
    );
}
