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
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  };
};

export default function AdminLojaPage() {
  const [products, setProducts] = useState<ProductView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ type: 'all', status: 'all', stock: 'all' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProductView | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [movements, setMovements] = useState<
    Array<{ id: string; product_id: string; delta: number; reason: string | null; admin_email: string | null; created_at: string }>
  >([]);

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
      return matchesType && matchesStatus && matchesStock;
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

      const movementsRes = await fetch('/api/admin/stock-movements', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (movementsRes.ok) {
        const movementsPayload = await movementsRes.json();
        setMovements(movementsPayload.movements || []);
      }
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
    if (draft.lowStockThreshold < 0) {
      setFormError('O limite de alerta não pode ser negativo.');
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
      };

      const res = await fetch(`/api/admin/products/${draft.id}`, {
        method: 'PATCH',
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

  const handleCancel = () => {
    setSelectedId(null);
    setFormError(null);
  };

  const handleStockUpdate = async (product: ProductView, e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.type !== 'fisico') return;
    const nextValue = window.prompt('Novo stock', String(product.stock ?? 0));
    if (nextValue === null) return;
    const parsed = Number(nextValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      window.alert('Stock inválido.');
      return;
    }
    const reason =
      window.prompt('Motivo do ajuste', 'Ajuste manual')?.trim() || 'Ajuste manual';

    try {
      if (!supabaseBrowser) throw new Error('Supabase nao configurado no browser.');
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessao invalida. Faz login novamente.');

      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stock: parsed, reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Erro ao atualizar stock.');
      }
      setProducts((prev) =>
        prev.map((item) => (item.id === product.id ? { ...item, stock: parsed } : item))
      );
    } catch (err: any) {
      window.alert(err?.message || 'Erro ao atualizar stock.');
    }
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
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <AdminStatCard
          title="Stock Crítico"
          value={kpis.critical}
          icon={AlertTriangle}
          color="gold"
        />
        <AdminStatCard
          title="Produtos Ativos"
          value={kpis.active}
          icon={CheckCircle}
          color="green"
        />
        <AdminStatCard
          title="Físicos"
          value={kpis.physical}
          icon={Package}
          color="blue"
        />
        <AdminStatCard
          title="Digitais"
          value={kpis.digital}
          icon={Download}
          color="purple"
        />
      </div>

      <div className="space-y-6">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex bg-gray-50 rounded-lg p-1 border border-gray-200">
            <button
              onClick={() => setFilters(f => ({ ...f, type: 'all' }))}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filters.type === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilters(f => ({ ...f, type: 'fisico' }))}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filters.type === 'fisico' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Físicos
            </button>
            <button
              onClick={() => setFilters(f => ({ ...f, type: 'digital' }))}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filters.type === 'digital' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Digitais
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={loadProducts}
              className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 transition-all flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </button>
          </div>
        </div>

        <AdminTable
          data={filteredProducts}
          columns={columns}
          itemsPerPage={10}
          actions={(item) => (
            <div className="flex items-center justify-end gap-2">
              {item.type === 'fisico' && (
                <button
                  onClick={(e) => handleStockUpdate(item, e)}
                  title="Atualizar Stock"
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setSelectedId(item.id)}
                className="p-1.5 text-gray-400 hover:text-garabandal-dark hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          )}
        />
      </div>

      {/* Edit Modal / Slide-over */}
      <AnimatePresence>
        {draft && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancel}
              className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-50 shadow-2xl overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-xl font-bold font-serif text-gray-900">Editar Produto</h2>
                    <p className="text-sm text-gray-500">ID: {draft.id}</p>
                  </div>
                  <button onClick={handleCancel} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Form Fields */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Produto</label>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(e) => setDraft(prev => prev ? { ...prev, name: e.target.value } : prev)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-garabandal-gold focus:border-garabandal-gold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                      <input
                        type="text"
                        value={draft.sku}
                        onChange={(e) => setDraft(prev => prev ? { ...prev, sku: e.target.value } : prev)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-garabandal-gold focus:border-garabandal-gold"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Preço (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={draft.price}
                        onChange={(e) => setDraft(prev => prev ? { ...prev, price: parseFloat(e.target.value) } : prev)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-garabandal-gold focus:border-garabandal-gold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={draft.status}
                      onChange={(e) => setDraft(prev => prev ? { ...prev, status: e.target.value as any } : prev)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-garabandal-gold focus:border-garabandal-gold"
                    >
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </div>

                  {/* Image Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Imagem</label>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0">
                        {draft.image ? (
                          <img src={draft.image} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <ShoppingBag className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="URL da imagem..."
                          value={draft.image}
                          onChange={(e) => setDraft(prev => prev ? { ...prev, image: e.target.value } : prev)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm mb-2"
                        />
                        <label className="flex items-center gap-2 text-sm text-garabandal-gold font-medium cursor-pointer hover:text-garabandal-dark transition-colors">
                          <Upload className="w-4 h-4" />
                          Upload Ficheiro
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
                        </label>
                        {uploading && <p className="text-xs text-blue-500 mt-1">A enviar...</p>}
                      </div>
                    </div>
                  </div>

                  {formError && (
                    <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
                      {formError}
                    </div>
                  )}
                </div>

                <div className="mt-8 flex gap-3">
                  <button
                    onClick={handleCancel}
                    className="flex-1 px-4 py-3 bg-gray-50 text-gray-700 font-medium rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 px-4 py-3 bg-garabandal-dark text-white font-medium rounded-xl hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {saving ? 'A guardar...' : 'Guardar'}
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

