"use client";

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import AdminLayout from '../../../components/admin/AdminLayout';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import {
  ShoppingBag,
  AlertTriangle,
  CheckCircle,
  Package,
  Download,
  Edit2,
  X,
  Plus,
  Search,
  Trash2,
  Filter,
  DollarSign,
  Image as ImageIcon,
  ChevronRight,
  Tag,
  Wand2,
  ArrowLeft,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProductView, normalizeProduct, PRODUCT_DEFINITIONS, ProductTypeDefinition } from './utils';
import CustomSelect from '../../../components/admin/ui/CustomSelect';
import VariantManager, { Variant } from '../../../components/admin/store/VariantManager';
import { listCountryOptions } from '../../../lib/country-utils';
import BilingualField, { TranslateAllButton } from '../../../components/admin/BilingualField';

// --- COMPONENTS ---

const FormInput = ({ label, value, onChange, type = "text", className, placeholder, button, suffix, disabled }: any) => (
  <div className="w-full">
    {label && <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">{label}</label>}
    <div className="relative flex items-center">
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all ${className} ${suffix ? 'pr-10' : ''} ${disabled ? 'bg-slate-100 text-slate-400' : ''}`}
      />
      {suffix && <span className="absolute right-4 text-slate-400 font-bold text-sm">{suffix}</span>}
      {button}
    </div>
  </div>
);

const TabButton = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`pb-4 px-2 text-sm font-bold transition-all relative ${active ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
  >
    {label}
    {active && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 rounded-full" />}
  </button>
);

const StatCard = ({ label, value, icon: Icon, color = "amber" }: any) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color === 'red' ? 'bg-red-50 text-red-600' : color === 'green' ? 'bg-emerald-50 text-emerald-600' : color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">{label}</p>
      <p className="text-2xl font-serif font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

// --- MAIN PAGE ---

export default function AdminLojaPage() {
  const VALID_PRODUCT_TYPE_IDS = new Set(['book_digital', 'book_physical', 'clothing', 'event_ticket', 'religious_article']);
  const [products, setProducts] = useState<ProductView[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'fisico' | 'digital'>('all');

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draft, setDraft] = useState<ProductView | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'details' | 'price'>('general');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const countryOptions = useMemo(() => listCountryOptions(), []);

  const parseDecimalInput = (value: string, fallback: number) => {
    const normalized = value.replace(',', '.').trim();
    if (!normalized) return fallback;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const parseIntegerInput = (value: string, fallback: number) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  // Load Data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    if (!supabaseBrowser) return;

    const { data: { session } } = await supabaseBrowser.auth.getSession();
    if (!session) return;

    try {
      const { data: catData } = await supabaseBrowser.from('categories').select('*').order('name');
      if (catData) setCategories(catData);

      const res = await fetch('/api/admin/products', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();

      const mapped = (json.products || []).map((p: any) => normalizeProduct(p));
      setProducts(mapped);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  };

  const kpis = useMemo(() => {
    const total = products.length;
    const lowStock = products.filter(p => p.type === 'fisico' && typeof p.stock === 'number' && p.stock <= p.lowStockThreshold).length;
    const active = products.filter(p => p.status === 'ativo').length;
    const revenuePotential = products.reduce((acc, p) => acc + (p.price * (p.type === 'fisico' && typeof p.stock === 'number' ? p.stock : 0)), 0);
    return { total, lowStock, active, revenuePotential };
  }, [products]);

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = filterType === 'all' || p.type === filterType;
    return matchSearch && matchType;
  });

  // --- ACTIONS ---

  const handleCreate = () => {
    setDraft({
      id: '',
      name: '',
      sku: '',
      category: '',
      categoryId: null,
      price: 0,
      currency: 'EUR',
      stock: 0,
      type: 'fisico',
      typeId: '',
      metadata: {},
      status: 'ativo',
      image: '',
      digitalUrl: '',
      tags: [],
      lowStockThreshold: 5,
      allowedCountries: [],
      specifications: {},
      taxRate: 0.23,
      description: '',
      variants: []
    });
    setActiveTab('general');
    setIsEditorOpen(true);
  };

  const handleEdit = (product: ProductView) => {
    setDraft({ ...product });
    setActiveTab('general');
    setIsEditorOpen(true);
  };

  const handleTypeSelect = (typeId: string) => {
    if (!draft) return;
    const def = PRODUCT_DEFINITIONS[typeId];
    if (!def) return;

    const defaultCat = categories.find(c => c.slug === def.defaultCategorySlug);

    setDraft({
      ...draft,
      typeId: typeId,
      type: def.isPhysical ? 'fisico' : 'digital',
      categoryId: defaultCat?.id || draft.categoryId,
      category: defaultCat?.name || draft.category,
      metadata: {},
      // Keep variants if switching between variants-compatible types? No, simpler to clear.
      variants: []
    });
  };

  const generateSKU = () => {
    if (!draft) return;
    const cat = categories.find(c => c.id === draft.categoryId);
    const prefix = cat ? cat.slug.substring(0, 3).toUpperCase() : 'PRO';
    const random = Math.floor(Math.random() * 9000) + 1000;
    setDraft({ ...draft, sku: `${prefix}-${random}` });
  };

  const categoryLooksDigital = (categoryId?: string | null) => {
    if (!categoryId) return false;
    const selectedCategory = categories.find((c) => c.id === categoryId);
    const slug = String(selectedCategory?.slug || '').toLowerCase();
    const name = String(selectedCategory?.name || '').toLowerCase();
    return (
      slug.includes('digital') ||
      name.includes('digital') ||
      name.includes('e-book') ||
      name.includes('ebook') ||
      name.includes('pdf')
    );
  };

  const handleSave = async () => {
    if (!draft || !supabaseBrowser) return;
    if (!draft.name || !draft.sku) {
      toast.error("Preencha o nome e SKU.");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session) throw new Error("No Session");

      const categoryIsDigital = categoryLooksDigital(draft.categoryId);
      const shouldBeDigital = draft.type === 'digital' || categoryIsDigital;
      const isPhysical = !shouldBeDigital;
      const normalizedTypeId = (() => {
        const draftTypeId = String(draft.typeId || '').trim();
        const def = PRODUCT_DEFINITIONS[draftTypeId];
        const candidate = shouldBeDigital
          ? (def && !def.isPhysical ? draftTypeId : 'book_digital')
          : (def && def.isPhysical ? draftTypeId : 'religious_article');
        if (VALID_PRODUCT_TYPE_IDS.has(candidate)) return candidate;
        return shouldBeDigital ? 'book_digital' : 'religious_article';
      })();
      const selectedCategory = categories.find((c) => c.id === draft.categoryId);

      const def = PRODUCT_DEFINITIONS[normalizedTypeId];
      // Calculate total stock from variants if we are using them
      const shouldUseVariants = def?.hasVariants;
      const finalStock = (shouldUseVariants && draft.variants.length > 0)
        ? draft.variants.reduce((sum, v) => sum + v.stock, 0)
        : draft.stock;

      const payload = {
        name: draft.name,
        name_en: draft.name_en || null,
        sku: draft.sku,
        category_id: draft.categoryId,
        category_name: selectedCategory?.name || null,
        description: draft.description,
        description_en: draft.description_en || null,
        price: Number.isFinite(draft.price) ? draft.price : 0,
        stock: isPhysical ? finalStock : null,
        is_active: draft.status === 'ativo',
        image_url: draft.image,
        digital_url: shouldBeDigital ? (draft.digitalUrl || null) : null,
        type_id: normalizedTypeId,
        metadata: draft.metadata,
        is_physical: isPhysical,
        specifications: draft.specifications,
        tax_rate: Number.isFinite(draft.taxRate) ? draft.taxRate : 0.23,
        allowed_countries: isPhysical ? (draft.allowedCountries || []) : [],
        variants: isPhysical && shouldUseVariants ? draft.variants : []
      };

      const method = draft.id ? 'PATCH' : 'POST';
      const url = draft.id ? `/api/admin/products/${draft.id}` : '/api/admin/products';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to save");

      toast.success("Produto guardado com sucesso");
      await fetchData();
      setIsEditorOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao guardar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft?.id || !supabaseBrowser) return;
    if (!window.confirm("Tem a certeza que deseja eliminar este produto? Esta ação é irreversível e removerá todo o stock e variantes associados.")) return;

    setSaving(true);
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session) throw new Error("No Session");

      const res = await fetch(`/api/admin/products/${draft.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (!res.ok) throw new Error("Failed to delete");

      toast.success("Produto eliminado");
      await fetchData();
      setIsEditorOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao eliminar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !draft || !supabaseBrowser) return;
    setUploading(true);
    try {
      const extension = file.name.split('.').pop() || 'jpg';
      const fileName = draft.id ? `${draft.id}.${extension}` : `temp-${Date.now()}.${extension}`;

      console.log("Uploading start:", fileName);
      const { data, error } = await supabaseBrowser.storage.from('store-products').upload(fileName, file, { upsert: true });

      if (error) {
        console.error("Supabase Storage Error:", error);
        throw error;
      }

      const { data: publicURLData } = supabaseBrowser.storage.from('store-products').getPublicUrl(fileName);
      const finalUrl = `${publicURLData.publicUrl}?v=${Date.now()}`;
      console.log("Upload success, URL:", finalUrl);

      setDraft(prev => prev ? ({ ...prev, image: finalUrl }) : null);
      toast.success("Imagem carregada!");
    } catch (err: any) {
      console.error("Upload Catch:", err);
      toast.error(`Erro no upload: ${err.message || 'Tente novamente'}`);
    } finally {
      setUploading(false);
      // Reset input so same file can be selected again if needed
      e.target.value = '';
    }
  };

  const currentDef = draft?.typeId ? PRODUCT_DEFINITIONS[draft.typeId] : null;
  const toggleAllowedCountry = (countryCode: string) => {
    if (!draft) return;
    const current = Array.isArray(draft.allowedCountries) ? draft.allowedCountries : [];
    const next = current.includes(countryCode)
      ? current.filter((code) => code !== countryCode)
      : [...current, countryCode];
    setDraft({ ...draft, allowedCountries: next });
  };

  return (
    <AdminLayout title="Gestão de Loja">
      <div className="space-y-8 pb-20">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-serif font-bold text-slate-900">Catálogo de Produtos</h1>
            <p className="text-slate-500 mt-1">Gerir inventário e tipos de produtos.</p>
          </div>
          <button onClick={handleCreate} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl flex items-center gap-2 font-medium shadow-lg hover:shadow-xl transition-all active:scale-95">
            <Plus className="w-5 h-5" /> Novo Produto
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total" value={kpis.total} icon={Package} />
          <StatCard label="Stock Baixo" value={kpis.lowStock} icon={AlertTriangle} color="red" />
          <StatCard label="Ativos" value={kpis.active} icon={CheckCircle} color="green" />
          <StatCard label="Valor" value={`${kpis.revenuePotential.toFixed(2)}€`} icon={DollarSign} color="blue" />
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-transparent outline-none text-sm" />
          </div>
          <div className="flex bg-slate-50 p-1 rounded-xl">
            {['all', 'fisico', 'digital'].map(t => (
              <button key={t} onClick={() => setFilterType(t as any)} className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${filterType === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>
                {t === 'all' ? 'Todos' : t}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase font-bold text-slate-400">
              <tr>
                <th className="px-6 py-4">Produto</th>
                <th className="px-6 py-4">Tipo / Categoria</th>
                <th className="px-6 py-4 text-center">Stock</th>
                <th className="px-6 py-4 text-right">Preço</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map(p => {
                const def = PRODUCT_DEFINITIONS[p.typeId];
                return (
                  <tr key={p.id} onClick={() => handleEdit(p)} className="hover:bg-slate-50 cursor-pointer transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden">
                          {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon className="w-5 h-5" /></div>}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-amber-600 transition-colors">{p.name}</div>
                          <div className="text-xs text-slate-400 font-mono">{p.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-bold text-slate-700">{def?.label || p.typeId}</div>
                      <div className="text-xs text-slate-400">{p.category}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {p.type === 'digital' ? <span className="font-bold text-emerald-600">Infinito</span> : (
                        <span className={`font-bold ${typeof p.stock === 'number' && p.stock <= p.lowStockThreshold ? 'text-red-500' : 'text-slate-700'}`}>{p.stock ?? 0}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-700">{p.price.toFixed(2)}€</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex w-2.5 h-2.5 rounded-full ${p.status === 'ativo' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

      {/* Editor Slide-Over */}
      <AnimatePresence>
        {isEditorOpen && draft && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditorOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white z-50 shadow-2xl flex flex-col">

              {/* Toolbar */}
              <div className="px-8 py-6 border-b border-slate-100 bg-white/80 backdrop-blur z-10 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  {draft.typeId === '' && (
                    <h2 className="text-2xl font-serif font-bold text-slate-900">Novo Produto</h2>
                  )}
                  {draft.typeId !== '' && (
                    <div>
                      <button onClick={() => setDraft({ ...draft, typeId: '' })} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-amber-600 mb-1 transition-colors">
                        <ArrowLeft className="w-3 h-3" /> Alterar Tipo
                      </button>
                      <h2 className="text-2xl font-serif font-bold text-slate-900">{draft.id ? 'Editar Produto' : PRODUCT_DEFINITIONS[draft.typeId]?.label}</h2>
                    </div>
                  )}
                </div>
                <button onClick={() => setIsEditorOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900"><X className="w-6 h-6" /></button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto bg-slate-50">
                {/* STEP 1: TYPE SELECTION */}
                {draft.typeId === '' ? (
                  <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.values(PRODUCT_DEFINITIONS).map(def => (
                      <button
                        key={def.id}
                        onClick={() => handleTypeSelect(def.id)}
                        className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-amber-500 hover:shadow-lg transition-all text-left flex flex-col gap-3 group"
                      >
                        <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-amber-50 text-slate-400 group-hover:text-amber-600 flex items-center justify-center transition-colors">
                          {def.isPhysical ? <Package className="w-5 h-5" /> : <Download className="w-5 h-5" />}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900">{def.label}</h3>
                          <p className="text-xs text-slate-500 mt-1">
                            {def.isPhysical ? 'Produto físico com stock' : 'Produto digital para download'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  /* STEP 2: DETAILS FORM */
                  <div className="p-8 space-y-8">

                    {/* Tabs */}
                    <div className="flex border-b border-slate-200 gap-6 mb-6">
                      <TabButton label="Geral" active={activeTab === 'general'} onClick={() => setActiveTab('general')} />
                      <TabButton label="Detalhes" active={activeTab === 'details'} onClick={() => setActiveTab('details')} />
                      <TabButton label="Preço & Stock" active={activeTab === 'price'} onClick={() => setActiveTab('price')} />
                    </div>

                    {/* GENERAL TAB */}
                    {activeTab === 'general' && (
                      <div className="space-y-6">
                        <div className="flex gap-6">
                          <div className="w-32 h-32 flex-shrink-0 relative group">
                            <div className="w-full h-full rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden">
                              {draft.image ? <img src={draft.image} className="w-full h-full object-cover" /> : <ImageIcon className="w-8 h-8 text-slate-300" />}
                            </div>
                            <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded-2xl text-white font-bold text-xs">
                              {uploading ? '...' : 'Alterar'}
                              <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                            </label>
                          </div>
                          <div className="flex-1 space-y-4">
                            <FormInput
                              label="SKU"
                              value={draft.sku}
                              onChange={(v: string) => setDraft({ ...draft, sku: v })}
                              className="font-mono uppercase"
                              button={<button onClick={generateSKU} className="absolute right-2 p-1.5 text-slate-400 hover:text-amber-500"><Wand2 className="w-4 h-4" /></button>}
                            />
                          </div>
                        </div>

                        <BilingualField
                          label="Nome do Produto"
                          ptValue={draft.name}
                          enValue={draft.name_en ?? ''}
                          onChangePt={v => setDraft({ ...draft, name: v })}
                          onChangeEn={v => setDraft({ ...draft, name_en: v })}
                          placeholder="Nome do produto"
                          placeholderEn="Product name"
                          required
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <CustomSelect
                            label="Categoria"
                            value={draft.categoryId ?? ''}
                            options={categories.map(c => ({ value: c.id, label: c.name }))}
                            onChange={(val) => {
                              const selectedCategory = categories.find(c => c.id === val);
                              const slug = String(selectedCategory?.slug || '').toLowerCase();
                              const name = String(selectedCategory?.name || '').toLowerCase();
                              const isDigitalCategory =
                                slug.includes('digital') ||
                                name.includes('digital') ||
                                name.includes('e-book') ||
                                name.includes('ebook') ||
                                name.includes('pdf');

                              if (isDigitalCategory) {
                                setDraft({
                                  ...draft,
                                  categoryId: val,
                                  type: 'digital',
                                  typeId: PRODUCT_DEFINITIONS[draft.typeId]?.isPhysical ? 'book_digital' : (draft.typeId || 'book_digital'),
                                  stock: null,
                                  variants: []
                                });
                              } else {
                                const looksLikeBookPhysical =
                                  slug.includes('livro') || name.includes('livro');
                                const nextPhysicalTypeId = looksLikeBookPhysical ? 'book_physical' : 'religious_article';
                                setDraft({
                                  ...draft,
                                  categoryId: val,
                                  type: 'fisico',
                                  typeId: PRODUCT_DEFINITIONS[draft.typeId]?.isPhysical ? draft.typeId : nextPhysicalTypeId,
                                  stock: typeof draft.stock === 'number' ? draft.stock : 0
                                });
                              }
                            }}
                          />
                          <CustomSelect
                            label="Estado"
                            value={draft.status}
                            options={[{ value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }]}
                            onChange={(val) => setDraft({ ...draft, status: val })}
                          />
                        </div>

                        <BilingualField
                          label="Descrição"
                          ptValue={draft.description}
                          enValue={draft.description_en ?? ''}
                          onChangePt={v => setDraft({ ...draft, description: v })}
                          onChangeEn={v => setDraft({ ...draft, description_en: v })}
                          type="textarea"
                          rows={4}
                          placeholder="Descrição completa do produto..."
                          placeholderEn="Full product description..."
                        />
                      </div>
                    )}

                    {/* DETAILS TAB (Dynamic) */}
                    {activeTab === 'details' && (
                      <div className="space-y-6">
                        {currentDef?.metadataFields && currentDef.metadataFields.length > 0 ? (
                          <div className="bg-white p-6 rounded-2xl border border-slate-200">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Tag className="w-4 h-4 text-amber-500" /> Atributos do Produto</h3>
                            <div className="grid grid-cols-2 gap-4">
                              {currentDef.metadataFields.map(field => (
                                <div key={field.key} className={field.type === 'text' ? 'col-span-2 sm:col-span-1' : ''}>
                                  {field.type === 'select' ? (
                                    <CustomSelect
                                      label={field.label}
                                      value={draft.metadata?.[field.key] || ''}
                                      options={(field.options || []).map(o => ({ value: o, label: o }))}
                                      onChange={(val) => setDraft({ ...draft, metadata: { ...draft.metadata, [field.key]: val } })}
                                    />
                                  ) : (
                                    <FormInput
                                      label={field.label}
                                      value={draft.metadata?.[field.key] || ''}
                                      onChange={(val: string) => setDraft({ ...draft, metadata: { ...draft.metadata, [field.key]: val } })}
                                      placeholder={field.placeholder}
                                      suffix={field.suffix}
                                      type={field.type === 'number' ? 'number' : 'text'}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-10 text-slate-400 italic">Sem detalhes específicos configurados para este tipo.</div>
                        )}

                        {/* File Upload for Digital */}
                        {draft.type === 'digital' && (
                          <div className="bg-slate-100 p-6 rounded-2xl border border-slate-200">
                            <h3 className="font-bold text-slate-900 mb-2">Ficheiro Digital</h3>
                            <FormInput
                              label="URL do Arquivo (Ex: Google Drive link ou Upload direto futura)"
                              value={draft.digitalUrl}
                              onChange={(v: string) => setDraft({ ...draft, digitalUrl: v })}
                              placeholder="https://..."
                            />
                          </div>
                        )}

                        {draft.type === 'fisico' && (
                          <div className="bg-white p-6 rounded-2xl border border-slate-200">
                            <div className="flex items-center justify-between gap-4 mb-4">
                              <div>
                                <h3 className="font-bold text-slate-900">Países com Stock/Envio disponível</h3>
                                <p className="text-xs text-slate-500 mt-1">
                                  Se não selecionares nenhum país, o produto fica disponível para envio mundial.
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setDraft({ ...draft, allowedCountries: ['PT', 'BR'] })}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                                >
                                  PT + BR
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDraft({ ...draft, allowedCountries: [] })}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                >
                                  Limpar
                                </button>
                              </div>
                            </div>
                            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50">
                              {countryOptions.map((country) => {
                                const selected = (draft.allowedCountries || []).includes(country.code);
                                return (
                                  <label
                                    key={country.code}
                                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer border transition-colors ${
                                      selected
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => toggleAllowedCountry(country.code)}
                                      className="accent-emerald-600"
                                    />
                                    <span className="text-xs font-mono text-slate-400">{country.code}</span>
                                    <span className="text-xs font-medium">{country.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* PRICE TAB */}
                    {activeTab === 'price' && (
                      <div className="space-y-6">
                        <div className="p-6 bg-white rounded-2xl border border-slate-200">
                          <div className="grid grid-cols-2 gap-4">
                            <FormInput
                              label="Preço (€)"
                              type="number"
                              value={draft.price}
                              onChange={(v: string) => setDraft({ ...draft, price: parseDecimalInput(v, draft.price) })}
                              className="text-lg font-bold"
                            />
                            <FormInput
                              label="Taxa IVA (%)"
                              type="number"
                              value={draft.taxRate * 100}
                              onChange={(v: string) => {
                                const percent = parseDecimalInput(v, draft.taxRate * 100);
                                const clampedPercent = Math.min(100, Math.max(0, percent));
                                setDraft({ ...draft, taxRate: clampedPercent / 100 });
                              }}
                              suffix="%"
                            />
                          </div>
                        </div>

                        {draft.type === 'fisico' && (
                          <div className="p-6 bg-white rounded-2xl border border-slate-200">
                            <div className="flex justify-between items-center mb-4">
                              <h3 className="font-bold text-slate-900">Inventário</h3>
                              {currentDef?.hasVariants && <span className="text-xs bg-amber-50 text-amber-600 px-2 py-1 rounded-lg font-bold">Gerido por Variantes</span>}
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <FormInput
                                label="Stock Total"
                                type="number"
                                value={currentDef?.hasVariants && draft.variants.length > 0
                                  ? draft.variants.reduce((acc, v) => acc + (v.stock || 0), 0)
                                  : draft.stock}
                                onChange={(v: string) => !currentDef?.hasVariants && setDraft({ ...draft, stock: parseIntegerInput(v, typeof draft.stock === 'number' ? draft.stock : 0) })}
                                disabled={currentDef?.hasVariants && draft.variants.length > 0}
                              />
                              <FormInput
                                label="Alerta Stock Baixo"
                                type="number"
                                value={draft.lowStockThreshold}
                                onChange={(v: string) => setDraft({ ...draft, lowStockThreshold: parseIntegerInput(v, draft.lowStockThreshold) })}
                              />
                            </div>

                            {currentDef?.hasVariants && (
                              <VariantManager
                                variants={draft.variants}
                                onChange={newVars => setDraft({ ...draft, variants: newVars })}
                                baseSku={draft.sku}
                              />
                            )}
                          </div>
                        )}

                        {draft.type === 'digital' && (
                          <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                            <h3 className="font-bold text-emerald-900 mb-1">Stock Digital</h3>
                            <p className="text-sm text-emerald-700">
                              Produtos digitais têm stock infinito. Não é necessário gerir variantes nem inventário.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )}
              </div>

              {/* Footer Actions */}
              {draft.typeId !== '' && (
                <div className="p-6 border-t border-slate-100 bg-white z-10 flex justify-between gap-3">
                  {draft.id ? (
                    <button
                      onClick={handleDelete}
                      disabled={saving}
                      className="px-5 py-2.5 rounded-xl font-bold text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> Eliminar
                    </button>
                  ) : <div />}

                  <div className="flex gap-3">
                    <button onClick={() => setIsEditorOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:text-slate-900 transition-colors">Cancelar</button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                      {saving ? 'A guardar...' : <><Save className="w-4 h-4" /> Guardar Produto</>}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
