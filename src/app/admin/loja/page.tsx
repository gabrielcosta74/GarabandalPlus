"use client";

import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import {
  ShoppingBag,
  AlertTriangle,
  CheckCircle,
  Package,
  Download,
  Edit2,
  RefreshCw,
  X,
  Plus,
  Search,
  Trash2,
  Filter,
  DollarSign,
  Globe,
  Image as ImageIcon,
  ChevronRight,
  MoreVertical,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { listCountryOptions } from '../../../lib/country-utils';
import { ProductView, normalizeProduct, isLowStock, isOutOfStock } from './utils'; // Assuming utilities are split or we keep them here? 
// For single-file rewrite, I will include util logic inline if mostly used here, or referencing existing.
// I'll keep the logic inline for safety as I am overwriting the file.

// --- CONSTANTS ---
const TAX_RATES = [
  { value: 0.23, label: 'Normal (23%)' },
  { value: 0.13, label: 'Intermédia (13%)' },
  { value: 0.06, label: 'Reduzida (6%)' },
  { value: 0, label: 'Isento (0%)' },
];

const CATEGORY_TEMPLATES: Record<string, { label: string, fields: { key: string, label: string, type: 'text' | 'number' }[] }> = {
  'livros-fisicos': {
    label: 'Livro Físico',
    fields: [
      { key: 'author', label: 'Autor', type: 'text' },
      { key: 'publisher', label: 'Editora', type: 'text' },
      { key: 'isbn', label: 'ISBN', type: 'text' },
      { key: 'pages', label: 'Nº Páginas', type: 'number' },
    ]
  },
  'livros-digitais': {
    label: 'Livro Digital',
    fields: [
      { key: 'author', label: 'Autor', type: 'text' },
      { key: 'pages', label: 'Nº Páginas', type: 'number' },
      { key: 'file_format', label: 'Formato (PDF/EPUB)', type: 'text' },
    ]
  },
  'vestuario': {
    label: 'Vestuário',
    fields: [
      { key: 'material', label: 'Material', type: 'text' },
      { key: 'gender', label: 'Género (Unisex/M/F)', type: 'text' },
    ]
  },
  'artigos-religiosos': {
    label: 'Artigo Religioso',
    fields: [
      { key: 'material', label: 'Material', type: 'text' },
      { key: 'dimensions', label: 'Dimensões', type: 'text' },
    ]
  },
  'outros': {
    label: 'Outros',
    fields: []
  }
};

const formatPrice = (amount: number, currency = 'EUR') => {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(amount);
};

// --- TYPES ---
export type ProductRow = {
  product_id: string;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  price?: number | null;
  currency?: string | null;
  stock?: number | null;
  is_active?: boolean | null;
  is_physical?: boolean | null;
  image_url?: string | null;
  digital_url?: string | null;
  sku?: string | null;
  tags?: string[] | string | null;
  low_stock_threshold?: number | null;
  allowed_countries?: string[] | null;
  specifications?: any;
  tax_rate?: number | null;
};

// --- COMPONENT ---

export default function AdminLojaPage() {
  // State
  const [products, setProducts] = useState<ProductView[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'fisico' | 'digital'>('all');

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draft, setDraft] = useState<ProductView | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'price' | 'shipping'>('general');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Load Data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    if (!supabaseBrowser) return;

    // Auth Check
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    if (!session) return;

    try {
      // 1. Fetch Categories
      const { data: catData } = await supabaseBrowser.from('categories').select('*').order('name');
      if (catData) setCategories(catData);

      // 2. Fetch Products via API (to get aggregated data if needed) OR Direct Supabase
      // Using API as per previous setup for "computed" fields
      const res = await fetch('/api/admin/products', { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (res.ok) {
        const json = await res.json();
        const norm = (json.products || []).map((p: any) => normalizeProduct(p));
        setProducts(norm);
      }
    } catch (err) {
      console.error("Error loading store data:", err);
    } finally {
      setLoading(false);
    }
  };



  // KPI Calculations
  const kpis = useMemo(() => {
    const total = products.length;
    const lowStock = products.filter(p => p.type === 'fisico' && p.stock <= p.lowStockThreshold).length;
    const active = products.filter(p => p.status === 'ativo').length;
    const revenuePotential = products.reduce((acc, p) => acc + (p.price * (p.type === 'fisico' ? p.stock : 0)), 0);
    return { total, lowStock, active, revenuePotential };
  }, [products]);

  // Filtering
  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = filterType === 'all' || p.type === filterType;
    return matchSearch && matchType;
  });

  // Actions
  const handleCreate = () => {
    setDraft({
      id: '', // New
      name: '',
      sku: '',
      category: '',
      categoryId: null,
      price: 0,
      currency: 'EUR',
      stock: 0,
      type: 'fisico',
      status: 'ativo',
      image: '',
      digitalUrl: '',
      tags: [],
      lowStockThreshold: 5,
      allowedCountries: [],
      specifications: {},
      taxRate: 0.23,
      description: ''
    });
    setActiveTab('general');
    setIsEditorOpen(true);
  };

  const handleEdit = (product: ProductView) => {
    setDraft({ ...product });
    setActiveTab('general');
    setIsEditorOpen(true);
  };

  const handleSave = async () => {
    if (!draft || !supabaseBrowser) return;

    if (!draft.name || !draft.sku) {
      alert("Preencha o nome e SKU."); // Ideally a toast
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session) throw new Error("No Session");

      const payload = {
        name: draft.name,
        sku: draft.sku,
        category_id: draft.categoryId, // Ensure API handles this to category_id
        description: draft.description,
        price: draft.price,
        stock: draft.type === 'fisico' ? draft.stock : null,
        is_physical: draft.type === 'fisico',
        image_url: draft.image,
        digital_url: draft.type === 'digital' ? draft.digitalUrl : null,
        specifications: draft.specifications,
        tax_rate: draft.taxRate,
        is_active: draft.status === 'ativo'
        // Add other fields as needed by API
      };

      const method = draft.id ? 'PATCH' : 'POST';
      const url = draft.id ? `/api/admin/products/${draft.id}` : '/api/admin/products';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to save");

      await fetchData(); // Refresh
      setIsEditorOpen(false);
    } catch (e) {
      console.error(e);
      alert("Erro ao guardar produto.");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !draft || !supabaseBrowser) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `products/${Date.now()}.${ext}`;
      const { error } = await supabaseBrowser.storage.from('store-products').upload(path, file);
      if (error) throw error;

      const { data } = supabaseBrowser.storage.from('store-products').getPublicUrl(path);
      setDraft((prev: ProductView | null) => prev ? ({ ...prev, image: data.publicUrl }) : null);
    } catch (err) {
      console.error(err);
      alert("Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <AdminLayout title="Gestão de Loja">
      <div className="space-y-8 pb-20">

        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-serif font-bold text-slate-900">Catalogo de Produtos</h1>
            <p className="text-slate-500 mt-1">Gere o inventário, preços e variações da loja online.</p>
          </div>
          <button
            onClick={handleCreate}
            className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl flex items-center gap-2 font-medium shadow-lg hover:shadow-xl transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Criar Novo Produto
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Produtos" value={kpis.total} icon={Package} />
          <StatCard label="Stock Crítico" value={kpis.lowStock} icon={AlertTriangle} color="red" />
          <StatCard label="Ativos" value={kpis.active} icon={CheckCircle} color="green" />
          <StatCard label="Valor Inventário" value={formatPrice(kpis.revenuePotential)} icon={DollarSign} color="blue" />
        </div>

        {/* Toolbar */}
        <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar por nome ou SKU..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-transparent outline-none text-sm"
            />
          </div>
          <div className="h-8 w-px bg-slate-100 hidden md:block my-auto" />
          <div className="flex bg-slate-50 p-1 rounded-xl">
            {['all', 'fisico', 'digital'].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t as any)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${filterType === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {t === 'all' ? 'Todos' : t}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid/Table */}
        {loading ? (
          <div className="py-20 flex justify-center"><div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full" /></div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-24 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">Sem resultados</h3>
            <p className="text-slate-500">Tenta ajustar os filtros ou cria um novo produto.</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase font-bold text-slate-400 tracking-wider">
                <tr>
                  <th className="px-6 py-4">Produto</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4 text-center">Stock</th>
                  <th className="px-6 py-4 text-right">Preço</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="group hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => handleEdit(product)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex-shrink-0 overflow-hidden">
                          {product.image ? (
                            <img src={product.image} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon className="w-5 h-5" /></div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-amber-600 transition-colors">{product.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-400 font-mono">{product.sku}</span>
                            {product.type === 'digital' && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase">Digital</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {product.category}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {product.type === 'digital' ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <div className="flex flex-col items-center">
                          <span className={`font-bold ${product.stock <= product.lowStockThreshold ? 'text-red-600' : 'text-slate-700'}`}>
                            {product.stock}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-medium text-slate-700">
                      {formatPrice(product.price)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex w-2.5 h-2.5 rounded-full ${product.status === 'ativo' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* EDITOR SLIDE-OVER */}
      <AnimatePresence>
        {isEditorOpen && draft && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
              onClick={() => setIsEditorOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white z-50 shadow-2xl flex flex-col"
            >
              {/* Editor Header */}
              <div className="px-8 py-6 border-b border-slate-100 bg-white/80 backdrop-blur z-10 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-serif font-bold text-slate-900">
                    {draft.id ? 'Editar Produto' : 'Novo Produto'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {draft.id ? `REF: ${draft.id}` : 'Preencha os detalhes para criar.'}
                  </p>
                </div>
                <button onClick={() => setIsEditorOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex px-8 border-b border-slate-100 gap-6">
                <TabButton label="Geral" active={activeTab === 'general'} onClick={() => setActiveTab('general')} />
                <TabButton label="Preço & Stock" active={activeTab === 'price'} onClick={() => setActiveTab('price')} />
                {draft.type === 'fisico' && <TabButton label="Envio" active={activeTab === 'shipping'} onClick={() => setActiveTab('shipping')} />}
              </div>

              {/* Editor Content */}
              <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                <div className="space-y-6">

                  {/* GENERAL TAB */}
                  {activeTab === 'general' && (
                    <div className="space-y-6">
                      <div className="flex gap-4">
                        {/* Photo Upload */}
                        <div className="w-32 h-32 flex-shrink-0 relative group">
                          <div className="w-full h-full rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden">
                            {draft.image ? (
                              <img src={draft.image} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-8 h-8 text-slate-300" />
                            )}
                          </div>
                          <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded-2xl text-white font-bold text-xs">
                            {uploading ? 'A enviar...' : 'Alterar Foto'}
                            <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                          </label>
                        </div>
                        <div className="flex-1 space-y-4">
                          <FormInput label="Nome do Produto" value={draft.name} onChange={(v: string) => setDraft((prev: ProductView | null) => ({ ...prev!, name: v }))} />
                          <FormInput label="SKU (Referência)" value={draft.sku} onChange={(v: string) => setDraft((prev: ProductView | null) => ({ ...prev!, sku: v }))} className="font-mono text-sm uppercase" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Categoria</label>
                          <select
                            value={draft.categoryId || ''}
                            onChange={e => {
                              const c = categories.find(cat => cat.id === e.target.value);
                              setDraft((prev: ProductView | null) => ({ ...prev!, categoryId: c.id, category: c.name, specifications: {} }));
                            }}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                          >
                            <option value="">Selecione...</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Estado</label>
                          <select
                            value={draft.status}
                            onChange={e => setDraft((prev: ProductView | null) => ({ ...prev!, status: e.target.value }))}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                          >
                            <option value="ativo">Ativo (Visível)</option>
                            <option value="inativo">Inativo (Oculto)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Descrição</label>
                        <textarea
                          rows={4}
                          value={draft.description}
                          onChange={e => setDraft((prev: ProductView | null) => ({ ...prev!, description: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all resize-none"
                        />
                      </div>

                      {/* Dynamic Specifications */}
                      {draft.categoryId && (
                        <div className="bg-white p-6 rounded-2xl border border-slate-200">
                          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Filter className="w-4 h-4 text-amber-500" />
                            Especificações ({draft.category})
                          </h3>
                          <div className="grid grid-cols-2 gap-4">
                            {getSpecsForCategory(draft.categoryId, categories).map(field => (
                              <div key={field.key}>
                                <label className="block text-xs font-bold text-slate-500 mb-1">{field.label}</label>
                                <input
                                  type={field.type}
                                  value={draft.specifications?.[field.key] || ''}
                                  onChange={e => setDraft((prev: ProductView | null) => ({
                                    ...prev!,
                                    specifications: { ...prev!.specifications, [field.key]: e.target.value }
                                  }))}
                                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-amber-500 transition-all text-sm"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* PRICE & STOCK TAB */}
                  {activeTab === 'price' && (
                    <div className="space-y-6">
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <FormInput
                              label="Preço (€)"
                              type="number"
                              value={draft.price}
                              onChange={(v: string) => setDraft((prev: ProductView | null) => ({ ...prev!, price: parseFloat(v) || 0 }))}
                              className="text-lg font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Taxa de IVA</label>
                            <select
                              value={draft.taxRate}
                              onChange={e => setDraft((prev: ProductView | null) => ({ ...prev!, taxRate: parseFloat(e.target.value) }))}
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-medium"
                            >
                              {TAX_RATES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-4">Inventário</h3>

                        <div className="flex gap-4 mb-4">
                          <button
                            onClick={() => setDraft((prev: ProductView | null) => ({ ...prev!, type: 'fisico' }))}
                            className={`flex-1 py-3 px-4 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 ${draft.type === 'fisico' ? 'bg-amber-50 border-amber-500 text-amber-700' : 'bg-white border-slate-200 text-slate-500'}`}
                          >
                            <Package className="w-4 h-4" /> Produto Físico
                          </button>
                          <button
                            onClick={() => setDraft((prev: ProductView | null) => ({ ...prev!, type: 'digital' }))}
                            className={`flex-1 py-3 px-4 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 ${draft.type === 'digital' ? 'bg-purple-50 border-purple-500 text-purple-700' : 'bg-white border-slate-200 text-slate-500'}`}
                          >
                            <Download className="w-4 h-4" /> Produto Digital
                          </button>
                        </div>

                        {draft.type === 'fisico' ? (
                          <div className="grid grid-cols-2 gap-4">
                            <FormInput label="Quantidade em Stock" type="number" value={draft.stock} onChange={(v: string) => setDraft((prev: ProductView | null) => ({ ...prev!, stock: parseInt(v) || 0 }))} />
                            <FormInput label="Alerta de stock baixo" type="number" value={draft.lowStockThreshold} onChange={(v: string) => setDraft((prev: ProductView | null) => ({ ...prev!, lowStockThreshold: parseInt(v) || 0 }))} />
                          </div>
                        ) : (
                          <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                            <FormInput label="Link do Ficheiro (URL)" value={draft.digitalUrl} onChange={(v: string) => setDraft((prev: ProductView | null) => ({ ...prev!, digitalUrl: v }))} placeholder="https://..." />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3 z-10">
                <button onClick={() => setIsEditorOpen(false)} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-8 py-3 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50"
                >
                  {saving ? 'A guardar...' : 'Guardar Produto'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}

// --- SUB-COMPONENTS & HELPERS ---

function StatCard({ label, value, icon: Icon, color = 'slate' }: any) {
  const colors = {
    slate: 'bg-slate-50 text-slate-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600'
  };
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
      <div className={`p-3 rounded-xl ${(colors as any)[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`py-4 text-sm font-bold border-b-2 transition-all ${active ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
    >
      {label}
    </button>
  );
}

function FormInput({ label, value, onChange, type = 'text', className = '', placeholder = '' }: any) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all ${className}`}
      />
    </div>
  );
}

function getSpecsForCategory(catId: string, categories: any[]) {
  const catName = categories.find(c => c.id === catId)?.name || '';
  // Simple matching mapping for now. In real app, templates could be in DB.
  // Normalized to lowercase slug-ish for matching
  const slug = catName.toLowerCase().replace(/ /g, '-').replace(/[áàãâ]/g, 'a').replace(/[í]/g, 'i');

  // Fuzzy match
  if (slug.includes('livro')) {
    if (slug.includes('digital')) return CATEGORY_TEMPLATES['livros-digitais'].fields;
    return CATEGORY_TEMPLATES['livros-fisicos'].fields;
  }
  if (slug.includes('vestuario') || slug.includes('t-shirt') || slug.includes('camisola')) return CATEGORY_TEMPLATES['vestuario'].fields;
  if (slug.includes('religioso') || slug.includes('terco') || slug.includes('imagem')) return CATEGORY_TEMPLATES['artigos-religiosos'].fields;

  return CATEGORY_TEMPLATES['outros'].fields;
}

// Minimal Utils interface

