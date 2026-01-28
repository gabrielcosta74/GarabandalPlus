"use client";

import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import AdminStatCard from '../../../components/admin/AdminStatCard';
import AdminTable from '../../../components/admin/AdminTable';
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
  Upload,
  Save,
  Globe,
  DollarSign,
  Box,
  Image as ImageIcon,
  Search,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { listCountryOptions } from '../../../lib/country-utils';

const COUNTRY_OPTIONS = listCountryOptions();

// Country Group Definitions
const COUNTRY_GROUPS = {
  'PALOP': ['AO', 'BR', 'CV', 'GW', 'MZ', 'PT', 'ST'],
  'Europa (UE)': ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'],
  'North America': ['US', 'CA', 'MX'],
  'South America': ['AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'GY', 'PY', 'PE', 'SR', 'UY', 'VE'],
};

// ... (Helper functions remain the same)
type ProductRow = {
  product_id: string;
  name?: string | null;
  description?: string | null;
  category?: string | null;
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
};

type ProductView = {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  stock: number | null;
  type: 'fisico' | 'digital';
  status: 'ativo' | 'inativo';
  image: string;
  digitalUrl: string;
  tags: string[];
  lowStockThreshold: number;
  allowedCountries: string[];
};

const isLowStock = (stock: number | null, threshold: number) =>
  typeof stock === 'number' && stock > 0 && stock <= threshold;
const isOutOfStock = (stock: number | null) => typeof stock === 'number' && stock === 0;
const formatPrice = (value: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(value);

const normalizeTags = (tags: ProductRow['tags']) => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.filter(Boolean);
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const normalizeProduct = (product: ProductRow): ProductView => {
  const isPhysical = product.is_physical ?? true;
  return {
    id: product.product_id,
    sku: product.sku || product.product_id,
    name: product.name || 'Produto',
    description: product.description || '',
    category: product.category || 'Sem categoria',
    price: Number(product.price ?? 0),
    currency: product.currency || 'EUR',
    stock: typeof product.stock === 'number' ? product.stock : isPhysical ? 0 : null,
    type: isPhysical ? 'fisico' : 'digital',
    status: product.is_active === false ? 'inativo' : 'ativo',
    image: product.image_url || '',
    digitalUrl: product.digital_url || '',
    tags: normalizeTags(product.tags),
    lowStockThreshold: Number(product.low_stock_threshold ?? 3),
    allowedCountries: product.allowed_countries || [],
  };
};

export default function AdminLojaPage() {
  const [products, setProducts] = useState<ProductView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ type: 'all', status: 'all', stock: 'all', search: '' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProductView | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'price' | 'shipping' | 'media'>('general');
  const [countrySearch, setCountrySearch] = useState('');

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesType = filters.type === 'all' || product.type === filters.type;
      const matchesStatus = filters.status === 'all' || product.status === filters.status;
      let matchesStock = true;
      if (filters.stock === 'low') {
        matchesStock = product.type === 'fisico' && isLowStock(product.stock, product.lowStockThreshold);
      } else if (filters.stock === 'out') {
        matchesStock = product.type === 'fisico' && isOutOfStock(product.stock);
      }
      const matchesSearch = !filters.search ||
        product.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        product.sku.toLowerCase().includes(filters.search.toLowerCase());

      return matchesType && matchesStatus && matchesStock && matchesSearch;
    });
  }, [filters, products]);

  const kpis = {
    critical: products.filter(
      (product) =>
        product.type === 'fisico' &&
        (isLowStock(product.stock, product.lowStockThreshold) || isOutOfStock(product.stock))
    ).length,
    active: products.filter((product) => product.status === 'ativo').length,
    digital: products.filter((product) => product.type === 'digital').length,
    physical: products.filter((product) => product.type === 'fisico').length,
  };

  const selectedProduct = products.find((product) => product.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedProduct) {
      setDraft({ ...selectedProduct });
      setFormError(null);
      setActiveTab('general');
    } else {
      setDraft(null);
    }
  }, [selectedProduct]);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!supabaseBrowser) throw new Error('Supabase nao configurado no browser.');
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessao invalida. Faz login novamente.');

      const res = await fetch('/api/admin/products', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Erro ao carregar produtos.');
      }
      const payload = await res.json();
      const normalized = (payload.products || []).map((product: ProductRow) => normalizeProduct(product));
      setProducts(normalized);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar produtos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      setFormError('O nome do produto é obrigatório.');
      return;
    }
    if (!draft.sku.trim()) {
      setFormError('O SKU é obrigatório.');
      return;
    }
    if (!Number.isFinite(draft.price) || draft.price < 0) {
      setFormError('O preço não pode ser negativo.');
      return;
    }
    if (draft.type === 'fisico' && (draft.stock ?? 0) < 0) {
      setFormError('O stock não pode ser negativo.');
      return;
    }
    if (draft.type === 'digital' && !draft.digitalUrl.trim()) {
      setFormError('Produtos digitais precisam de link do ficheiro.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      if (!supabaseBrowser) throw new Error('Supabase nao configurado no browser.');
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessao invalida. Faz login novamente.');

      const payload = {
        name: draft.name.trim(),
        sku: draft.sku.trim(),
        category: draft.category.trim() || null,
        description: draft.description.trim() || null,
        price: draft.price,
        currency: draft.currency,
        is_active: draft.status === 'ativo',
        is_physical: draft.type === 'fisico',
        image_url: draft.image.trim() || null,
        digital_url: draft.type === 'digital' ? draft.digitalUrl.trim() || null : null,
        stock: draft.type === 'fisico' ? draft.stock ?? 0 : null,
        low_stock_threshold: draft.lowStockThreshold,
        tags: draft.tags,
        allowed_countries: draft.type === 'fisico' && draft.allowedCountries.length > 0 ? draft.allowedCountries : null,
      };

      // Correctly using the dynamic ID route
      const endpoint = draft.id ? `/api/admin/products/${draft.id}` : '/api/admin/products';

      const res = await fetch(endpoint, {
        method: draft.id ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Erro ao guardar produto.');
      }

      setProducts((prev) => prev.map((item) => (item.id === draft.id ? { ...draft } : item)));
      setSelectedId(null);
    } catch (err: any) {
      setFormError(err?.message || 'Erro ao guardar produto.');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!supabaseBrowser || !draft) return;
    setUploading(true);
    setFormError(null);
    try {
      const extension = file.name.split('.').pop() || 'jpg';
      const filePath = `products/${draft.id}/${Date.now()}.${extension}`;
      const { error } = await supabaseBrowser.storage.from('store-products').upload(filePath, file, {
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabaseBrowser.storage.from('store-products').getPublicUrl(filePath);
      const publicUrl = data?.publicUrl || '';
      if (!publicUrl) throw new Error('Nao foi possivel obter o URL da imagem.');
      setDraft((prev) => (prev ? { ...prev, image: publicUrl } : prev));
    } catch (err: any) {
      setFormError(err?.message || 'Erro ao fazer upload da imagem.');
    } finally {
      setUploading(false);
    }
  };

  // Helper for Country Selection
  const toggleCountry = (code: string) => {
    setDraft((prev) => {
      if (!prev) return null;
      const current = prev.allowedCountries;
      const next = current.includes(code)
        ? current.filter((c) => c !== code)
        : [...current, code];
      return { ...prev, allowedCountries: next };
    });
  };

  const toggleGroup = (groupName: keyof typeof COUNTRY_GROUPS) => {
    setDraft((prev) => {
      if (!prev) return null;
      const groupCountries = COUNTRY_GROUPS[groupName];
      // Check if all are selected
      const allSelected = groupCountries.every(code => prev.allowedCountries.includes(code));

      let next = [...prev.allowedCountries];
      if (allSelected) {
        // Deselect all
        next = next.filter(code => !groupCountries.includes(code));
      } else {
        // Select all (union)
        const union = new Set([...next, ...groupCountries]);
        next = Array.from(union);
      }
      return { ...prev, allowedCountries: next };
    });
  };

  const clearCountries = () => {
    setDraft(prev => prev ? { ...prev, allowedCountries: [] } : prev);
  };

  const columns = [
    {
      key: 'name', header: 'Produto', render: (item: ProductView) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
            {item.image ? (
              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <Package className="w-full h-full p-2 text-gray-400" />
            )}
          </div>
          <div className="max-w-[200px]">
            <p className="font-medium text-gray-900 truncate">{item.name}</p>
            <p className="text-xs text-gray-500 truncate">{item.category} • {item.sku}</p>
          </div>
        </div>
      )
    },
    {
      key: 'type', header: 'Tipo', align: 'center' as const, render: (item: ProductView) => (
        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${item.type === 'fisico' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
          {item.type === 'fisico' ? 'Físico' : 'Digital'}
        </span>
      )
    },
    {
      key: 'stock', header: 'Stock', align: 'center' as const, render: (item: ProductView) => {
        if (item.type === 'digital') return <span className="text-gray-400 text-xs">—</span>;
        const isLow = isLowStock(item.stock, item.lowStockThreshold);
        const isOut = isOutOfStock(item.stock);
        return (
          <div className="flex items-center justify-center gap-2">
            <span className={`font-mono font-bold ${isOut ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-gray-700'}`}>
              {item.stock}
            </span>
            {isOut && <AlertTriangle className="w-4 h-4 text-red-500" />}
          </div>
        );
      }
    },
    { key: 'price', header: 'Preço', align: 'right' as const, render: (item: ProductView) => <span className="font-medium text-gray-900">{formatPrice(item.price, item.currency)}</span> },
    {
      key: 'status', header: 'Estado', align: 'center' as const, render: (item: ProductView) => (
        <span className={`w-2 h-2 rounded-full inline-block ${item.status === 'ativo' ? 'bg-green-500' : 'bg-gray-300'}`} />
      )
    },
  ];

  return (
    <AdminLayout title="Loja e Stock" isLoading={loading}>
      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <AdminStatCard title="Stock Crítico" value={kpis.critical} icon={AlertTriangle} color="gold" />
        <AdminStatCard title="Produtos Ativos" value={kpis.active} icon={CheckCircle} color="green" />
        <AdminStatCard title="Físicos" value={kpis.physical} icon={Package} color="blue" />
        <AdminStatCard title="Digitais" value={kpis.digital} icon={Download} color="purple" />
      </div>

      <div className="space-y-6">
        {/* Filters Toolbar */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex flex-wrap gap-2 items-center w-full lg:w-auto">
            <div className="relative flex-1 lg:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar produto..."
                value={filters.search}
                onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-garabandal-gold focus:border-garabandal-gold"
              />
            </div>
            <div className="h-6 w-px bg-gray-200 mx-2 hidden lg:block" />
            <div className="flex bg-gray-50 rounded-lg p-1 border border-gray-200">
              {['all', 'fisico', 'digital'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilters(f => ({ ...f, type: type as any }))}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${filters.type === type ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  {type === 'all' ? 'Todos' : type}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={loadProducts}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>

        <AdminTable
          data={filteredProducts}
          columns={columns}
          itemsPerPage={10}
          actions={(item) => (
            <button
              onClick={() => setSelectedId(item.id)}
              className="p-1.5 text-gray-400 hover:text-garabandal-dark hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        />
      </div>

      {/* Modern Slide-over Modal */}
      <AnimatePresence>
        {draft && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedId(null)}
              className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white z-50 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white z-10">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    {draft.type === 'fisico' ? <Package className="w-5 h-5 text-blue-500" /> : <Download className="w-5 h-5 text-purple-500" />}
                    {draft.name || 'Novo Produto'}
                  </h2>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{draft.id}</p>
                </div>
                <button onClick={() => setSelectedId(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-100 px-6">
                {[
                  { id: 'general', label: 'Geral', icon: Edit2 },
                  { id: 'price', label: 'Preço & Stock', icon: DollarSign },
                  { id: 'shipping', label: 'Envio & Disponibilidade', icon: Globe, hidden: draft.type === 'digital' },
                  { id: 'media', label: 'Multimédia', icon: ImageIcon },
                ].filter(t => !t.hidden).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                        ? 'border-garabandal-gold text-garabandal-dark'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                      }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-6">

                  {activeTab === 'general' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Produto</label>
                        <input
                          type="text"
                          value={draft.name}
                          onChange={(e) => setDraft(prev => prev ? { ...prev, name: e.target.value } : prev)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-garabandal-gold/20 focus:border-garabandal-gold transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                          <input
                            type="text"
                            value={draft.sku}
                            onChange={(e) => setDraft(prev => prev ? { ...prev, sku: e.target.value } : prev)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-garabandal-gold/20 focus:border-garabandal-gold transition-all font-mono text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                          <input
                            type="text"
                            value={draft.category}
                            onChange={(e) => setDraft(prev => prev ? { ...prev, category: e.target.value } : prev)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-garabandal-gold/20 focus:border-garabandal-gold transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                        <textarea
                          rows={4}
                          value={draft.description}
                          onChange={(e) => setDraft(prev => prev ? { ...prev, description: e.target.value } : prev)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-garabandal-gold/20 focus:border-garabandal-gold transition-all resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                          value={draft.status}
                          onChange={(e) => setDraft(prev => prev ? { ...prev, status: e.target.value as any } : prev)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-garabandal-gold/20 focus:border-garabandal-gold transition-all"
                        >
                          <option value="ativo">Ativo (Visível na loja)</option>
                          <option value="inativo">Inativo (Oculto)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {activeTab === 'price' && (
                    <div className="space-y-6">
                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-4">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Preço Unitário</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                            <input
                              type="number"
                              step="0.01"
                              value={draft.price}
                              onChange={(e) => setDraft(prev => prev ? { ...prev, price: parseFloat(e.target.value) } : prev)}
                              className="w-full pl-8 pr-3 py-3 text-lg font-bold text-gray-900 border border-gray-200 rounded-xl focus:ring-2 focus:ring-garabandal-gold/20 focus:border-garabandal-gold transition-all bg-white"
                            />
                          </div>
                        </div>
                      </div>

                      {draft.type === 'fisico' && (
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Stock Atual</label>
                            <div className="relative">
                              <Box className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="number"
                                value={draft.stock || 0}
                                onChange={(e) => setDraft(prev => prev ? { ...prev, stock: parseInt(e.target.value) } : prev)}
                                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-garabandal-gold/20 focus:border-garabandal-gold transition-all"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Alerta Stock Baixo</label>
                            <div className="relative">
                              <AlertTriangle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                              <input
                                type="number"
                                value={draft.lowStockThreshold}
                                onChange={(e) => setDraft(prev => prev ? { ...prev, lowStockThreshold: parseInt(e.target.value) } : prev)}
                                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-garabandal-gold/20 focus:border-garabandal-gold transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'shipping' && draft.type === 'fisico' && (
                    <div className="space-y-6">
                      <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3">
                        <Globe className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-bold text-blue-900">Configuração de Envio</h4>
                          <p className="text-xs text-blue-700 mt-1">Se a lista de países estiver vazia, aplicam-se as regras globais da loja. Se selecionar países, o produto será EXCLUSIVO para esses destinos.</p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-gray-900 mb-3">Grupos Rápidos & Filtros</label>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {Object.keys(COUNTRY_GROUPS).map((group) => (
                            <button
                              key={group}
                              onClick={() => toggleGroup(group as any)}
                              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors border border-gray-200"
                            >
                              {group}
                            </button>
                          ))}
                          <button onClick={clearCountries} className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            Limpar Tudo
                          </button>
                        </div>
                        <div className="relative mb-3">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Procurar país..."
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-garabandal-gold/20 focus:border-garabandal-gold"
                          />
                        </div>
                      </div>

                      <div className="border border-gray-200 rounded-xl overflow-hidden flex flex-col h-64">
                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between">
                          <span>País</span>
                          <span>Estado</span>
                        </div>
                        <div className="overflow-y-auto p-2 space-y-0.5">
                          {COUNTRY_OPTIONS
                            .filter(c => !countrySearch || c.label.toLowerCase().includes(countrySearch.toLowerCase()))
                            .map(country => {
                              const isSelected = draft.allowedCountries.includes(country.code);
                              return (
                                <button
                                  key={country.code}
                                  onClick={() => toggleCountry(country.code)}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${isSelected
                                      ? 'bg-garabandal-gold/10 text-garabandal-dark font-medium'
                                      : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-400 font-mono text-xs w-6">{country.code}</span>
                                    {country.label}
                                  </div>
                                  {isSelected && <Check className="w-4 h-4 text-garabandal-gold" />}
                                </button>
                              )
                            })}
                          {COUNTRY_OPTIONS.filter(c => !countrySearch || c.label.toLowerCase().includes(countrySearch.toLowerCase())).length === 0 && (
                            <div className="p-4 text-center text-gray-400 text-sm">Nenhum país encontrado.</div>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>{draft.allowedCountries.length} países selecionados</span>
                        {!draft.allowedCountries.length && <span className="text-amber-600">Usando regras padrão da loja</span>}
                      </div>
                    </div>
                  )}

                  {activeTab === 'media' && (
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Imagem de Capa</label>
                        <div className="flex flex-col md:flex-row gap-6">
                          <div className="w-40 h-40 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl flex items-center justify-center overflow-hidden relative group">
                            {draft.image ? (
                              <img src={draft.image} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-center p-4">
                                <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                <span className="text-xs text-gray-400">Sem imagem</span>
                              </div>
                            )}
                            <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                              <span className="text-white text-xs font-bold flex items-center gap-1">
                                <Upload className="w-3 h-3" /> Alterar
                              </span>
                              <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
                            </label>
                          </div>
                          <div className="flex-1 space-y-4">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">URL da Imagem</label>
                              <input
                                type="text"
                                placeholder="https://..."
                                value={draft.image}
                                onChange={(e) => setDraft(prev => prev ? { ...prev, image: e.target.value } : prev)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                              />
                            </div>
                            {draft.type === 'digital' && (
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">URL do Ficheiro Digital (Download)</label>
                                <input
                                  type="text"
                                  placeholder="https://..."
                                  value={draft.digitalUrl}
                                  onChange={(e) => setDraft(prev => prev ? { ...prev, digitalUrl: e.target.value } : prev)}
                                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono text-purple-600 bg-purple-50/50"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">Este link será enviado automaticamente após a compra.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {formError && (
                    <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100 flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                      <div>{formError}</div>
                    </div>
                  )}

                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-gray-100 bg-white z-10">
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedId(null)}
                    disabled={saving}
                    className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-[2] px-4 py-3 bg-garabandal-dark text-white font-bold rounded-xl hover:bg-gray-900 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-garabandal-dark/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    {saving ? 'A guardar...' : 'Guardar Alterações'}
                  </button>
                </div>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
