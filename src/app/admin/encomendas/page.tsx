"use client";

import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import AdminStatCard from '../../../components/admin/AdminStatCard';
import AdminTable from '../../../components/admin/AdminTable';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import {
  Package,
  Truck,
  AlertCircle,
  Search,
  Filter,
  Eye,
  CheckCircle,
  X,
  FileText,
  CreditCard,
  User,
  Inbox,
  Clock,
  Copy
} from 'lucide-react';

type OrderItem = {
  order_ref: string;
  product_id: string;
  name: string;
  qty: number;
  unit_price: number;
  total_price: number;
};

type OrderRow = {
  order_ref: string;
  created_at: string;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone?: string | null;
  buyer_nif?: string | null;
  shipping_country: string | null;
  shipping_address1?: string | null;
  shipping_address2?: string | null;
  shipping_city?: string | null;
  shipping_postal_code?: string | null;
  shipping_cost?: number | null;
  shipping_tracking?: string | null;
  status: string;
  shipping_status?: string | null;
  shipped_at?: string | null;
  invoice_sent_at?: string | null;
  has_physical: boolean;
  payment_method?: string | null;
  payment_reference?: string | null;
  total_amount: number;
  currency: string;
  items: OrderItem[];
  // Mapping optional fields to match usage
  billing_address?: string | null;
  billing_city?: string | null;
  billing_postal_code?: string | null;
  billing_country?: string | null;
};

// Adapter for AdminTable
interface OrderTableItem extends OrderRow {
  id: string;
}

const formatCurrency = (value: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(value);

const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-PT');
const formatDateTime = (value: string) => new Date(value).toLocaleString('pt-PT');

const statusLabel = (status: string) => {
  const normalized = status?.toLowerCase?.() || '';
  if (normalized === 'paid' || normalized === 'pago') return 'Pago';
  if (normalized === 'pending' || normalized === 'pendente') return 'Pendente';
  if (normalized === 'failed') return 'Falhado';
  if (normalized === 'canceled' || normalized === 'cancelado') return 'Cancelado';
  return status || 'Indefinido';
};

const shippingLabel = (status?: string | null) => {
  const normalized = status?.toLowerCase?.() || '';
  if (normalized === 'enviado') return 'Enviado';
  return 'Por enviar';
};

const getTypeLabel = (order: OrderRow) => {
  if (order.has_physical) return 'Físico';
  return 'Digital';
};

const isPaid = (order: OrderRow) => {
  const normalized = order.status?.toLowerCase?.() || '';
  return normalized === 'paid' || normalized === 'pago';
};

export default function AdminEncomendasPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trackingByOrder, setTrackingByOrder] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);

  // Tab State: 'action_needed' | 'history'
  const [currentTab, setCurrentTab] = useState<'action_needed' | 'history'>('action_needed');

  const [filters, setFilters] = useState({
    status: 'all',
    shipping: 'all',
    invoice: 'all', // New filter
    type: 'all',
    country: 'all',
    period: '30d',
    search: '',
  });

  const loadOrders = async () => {
    setLoading(true);
    try {
      if (!supabaseBrowser) throw new Error('Supabase nao configurado no browser.');
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessao invalida. Faz login novamente.');

      const res = await fetch('/api/admin/orders', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Erro ao carregar encomendas.');
      }
      const payload = await res.json();
      setOrders(payload.orders || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar encomendas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3500);
  };

  const handleMarkShipped = async (order: OrderRow) => {
    try {
      if (!supabaseBrowser) throw new Error('Supabase nao configurado no browser.');
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessao invalida. Faz login novamente.');

      const tracking = trackingByOrder[order.order_ref]?.trim() || '';
      const res = await fetch(`/api/admin/orders/${order.order_ref}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shippingStatus: 'enviado',
          tracking,
        }),
      });
      if (!res.ok) {
        throw new Error('Não foi possível atualizar o envio.');
      }
      showToast('Encomenda marcada como enviada.');
      await loadOrders();
      if (selectedOrder?.order_ref === order.order_ref) {
        setSelectedOrder(prev => prev ? {
          ...prev,
          shipping_status: 'enviado',
          shipping_tracking: tracking,
          shipped_at: new Date().toISOString()
        } : null);
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao atualizar envio.');
    }
  };

  const handleToggleInvoice = async (order: OrderRow) => {
    try {
      if (!supabaseBrowser) throw new Error('Supabase nao configurado no browser.');
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessao invalida. Faz login novamente.');

      const newStatus = !order.invoice_sent_at;
      const res = await fetch(`/api/admin/orders/${order.order_ref}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          invoiceSent: newStatus,
        }),
      });
      if (!res.ok) {
        throw new Error('Erro ao atualizar estado da fatura.');
      }

      const updatedTimestamp = newStatus ? new Date().toISOString() : null;

      setOrders(prev => prev.map(o =>
        o.order_ref === order.order_ref
          ? { ...o, invoice_sent_at: updatedTimestamp }
          : o
      ));

      if (selectedOrder?.order_ref === order.order_ref) {
        setSelectedOrder(prev => prev ? { ...prev, invoice_sent_at: updatedTimestamp } : null);
      }

      showToast(newStatus ? 'Fatura marcada como enviada.' : 'Fatura marcada como pendente.');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao atualizar fatura.');
    }
  };

  const filteredOrders = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const now = new Date();
    // Only apply date filter to History, allow Action Needed to verify everything regardless of date?
    // Good practice: Filter applies to "viewed set". Let's apply filters globally but maybe allow Action Needed to ignore date?
    // For now, consistent behavior:
    const periodDays =
      filters.period === '7d' ? 7 : filters.period === '90d' ? 90 : filters.period === 'all' ? null : 30;
    const limitDate = periodDays ? new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000) : null;

    return orders.filter((order) => {
      if (limitDate && new Date(order.created_at) < limitDate) return false;

      // Filter by Status
      const normalizedStatus = (order.status || '').toLowerCase();
      if (filters.status !== 'all' && normalizedStatus !== filters.status) return false;

      // Filter by Shipping Status
      if (filters.shipping !== 'all' && shippingLabel(order.shipping_status).toLowerCase() !== filters.shipping) {
        return false;
      }

      // Filter by Invoice Status
      if (filters.invoice !== 'all') {
        const sent = !!order.invoice_sent_at;
        if (filters.invoice === 'sent' && !sent) return false;
        if (filters.invoice === 'pending' && sent) return false;
      }

      // Filter by Type
      const typeLabel = getTypeLabel(order).toLowerCase();
      // Remove accents for comparison if needed, but simple includes works for 'fisico'/'digital' usually if matched
      // Let's rely on strict match 'fisico' or 'digital' from dropdown values
      if (filters.type !== 'all') {
        const type = order.has_physical ? 'fisico' : 'digital';
        if (filters.type !== type) return false;
      }

      // Filter by Country
      const country = (order.shipping_country || '').toUpperCase();
      if (filters.country !== 'all') {
        if (filters.country === 'outros' && (country === 'PT' || country === 'BR')) return false;
        if (filters.country === 'pt' && country !== 'PT') return false;
        if (filters.country === 'br' && country !== 'BR') return false;
      }

      // Search
      if (search) {
        const haystack = [
          order.order_ref,
          order.buyer_name,
          order.buyer_email,
          order.buyer_nif,
          order.payment_reference,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      return true;
    });
  }, [orders, filters]);

  // View: Action Needed
  // Criteria:
  // 1. Paid AND Physical AND Not Shipped ("A enviar")
  // 2. Paid AND Not Invoice Sent ("Fatura em falta")
  const actionNeededOrders = useMemo(() => orders.filter(order => {
    // Must be paid to require action
    if (!isPaid(order)) return false;

    // Case 1: Needs Shipping
    const needsShipping = order.has_physical && shippingLabel(order.shipping_status) !== 'Enviado';

    // Case 2: Needs Invoice
    const needsInvoice = !order.invoice_sent_at;

    return needsShipping || needsInvoice;
  }), [orders]); // Use 'orders' raw source for Badge counts, but 'filteredOrders' for table? 
  // IMPORTANT: The "Action Needed" tab usually ignores some filters (like "shipped" or "sent invoice" because... they wouldn't be there).
  // But searching within Action Needed is useful.
  // Let's filter the TAB DATA by the SEARCH term, but maybe ignore status filters that hide them?
  // Simpler approach: Apply filters to the view.

  const actionNeededView = useMemo(() => {
    // Intersection of Global Filters + Action Needed Criteria
    return filteredOrders.filter(order => {
      if (!isPaid(order)) return false;
      const needsShipping = order.has_physical && shippingLabel(order.shipping_status) !== 'Enviado';
      const needsInvoice = !order.invoice_sent_at;
      return needsShipping || needsInvoice;
    });
  }, [filteredOrders]);

  const historyView = useMemo(() => filteredOrders, [filteredOrders]);

  // Statistics from RAW orders (unfiltered) to show badges
  const stats = useMemo(() => {
    const pendingShip = orders.filter(o => isPaid(o) && o.has_physical && shippingLabel(o.shipping_status) !== 'Enviado').length;
    const pendingInv = orders.filter(o => isPaid(o) && !o.invoice_sent_at).length;
    return { pendingShip, pendingInv };
  }, [orders]);

  const displayedOrders = currentTab === 'action_needed' ? actionNeededView : historyView;

  // Generic Columns
  const commonColumns = [
    {
      key: 'order_ref', header: 'Pedido', render: (item: OrderTableItem) => (
        <div className="flex flex-col">
          <span className="font-mono font-bold text-gray-900">#{item.order_ref}</span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mt-0.5">{getTypeLabel(item)}</span>
        </div>
      )
    },
    {
      key: 'created_at', header: 'Data', render: (item: OrderTableItem) => (
        <div className="flex flex-col">
          <span className="text-sm text-gray-900">{formatDate(item.created_at)}</span>
          <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )
    },
    {
      key: 'buyer_name', header: 'Cliente', render: (item: OrderTableItem) => (
        <div>
          <p className="font-medium text-gray-900 text-sm">{item.buyer_name || 'Cliente Sem Nome'}</p>
          <p className="text-xs text-gray-500 truncate max-w-[150px]">{item.buyer_email}</p>
        </div>
      )
    },
    {
      key: 'status_flags', header: 'Estado', render: (item: OrderTableItem) => (
        <div className="flex flex-col gap-1.5 items-start">
          {/* Invoice Badge */}
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleInvoice(item); }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border transition-all ${item.invoice_sent_at
              ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
              : 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
              }`}
          >
            <FileText className="w-3 h-3" />
            {item.invoice_sent_at ? 'Fatura OK' : 'Fatura em Falta'}
          </button>

          {/* Shipping Badge (Only Physical) */}
          {item.has_physical && (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${shippingLabel(item.shipping_status) === 'Enviado'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-orange-50 text-orange-700 border-orange-200'
              }`}>
              <Truck className="w-3 h-3" />
              {shippingLabel(item.shipping_status)}
            </div>
          )}
        </div>
      )
    },
    { key: 'total_amount', header: 'Total', align: 'right' as const, render: (item: OrderTableItem) => <span className="font-bold text-gray-900">{formatCurrency(item.total_amount, item.currency)}</span> },
  ];

  const adminTableData = displayedOrders.map(o => ({ ...o, id: o.order_ref }));

  return (
    <AdminLayout title="Gestão de Encomendas" isLoading={loading}>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        <AdminStatCard
          title="Por Enviar"
          value={stats.pendingShip}
          icon={Package}
          color="gold"
        />
        <AdminStatCard
          title="Faturas em Falta"
          value={stats.pendingInv}
          icon={FileText}
          color="blue"
        />
        {/* Simple total stats */}
        <AdminStatCard
          title="Total Encomendas"
          value={orders.length}
          icon={Inbox}
          color="purple"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setCurrentTab('action_needed')}
          className={`px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${currentTab === 'action_needed'
            ? 'border-garabandal-gold text-garabandal-dark'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
        >
          <AlertCircle className="w-4 h-4" />
          Ação Necessária
          <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full text-xs font-bold">
            {actionNeededOrders.length}
          </span>
        </button>

        <button
          onClick={() => setCurrentTab('history')}
          className={`px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${currentTab === 'history'
            ? 'border-garabandal-gold text-garabandal-dark'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
        >
          <Clock className="w-4 h-4" />
          Histórico Completo
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <select
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-garabandal-gold"
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="all">Status: Todos</option>
            <option value="paid">Pago</option>
            <option value="pending">Pendente</option>
          </select>

          <select
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-garabandal-gold"
            value={filters.invoice}
            onChange={(e) => setFilters((prev) => ({ ...prev, invoice: e.target.value }))}
          >
            <option value="all">Fatura: Todas</option>
            <option value="pending">Pendente (Falta)</option>
            <option value="sent">Enviada</option>
          </select>

          <select
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-garabandal-gold"
            value={filters.shipping}
            onChange={(e) => setFilters((prev) => ({ ...prev, shipping: e.target.value }))}
          >
            <option value="all">Envio: Todos</option>
            <option value="por enviar">Por enviar</option>
            <option value="enviado">Enviado</option>
          </select>

          <select
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-garabandal-gold"
            value={filters.type}
            onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
          >
            <option value="all">Tipo: Todos</option>
            <option value="fisico">Físico</option>
            <option value="digital">Digital</option>
          </select>
        </div>

        <div className="flex items-center gap-2 flex-grow sm:flex-grow-0 min-w-[250px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-garabandal-gold"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {displayedOrders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-gray-900 font-medium text-lg">Tudo limpo!</h3>
            <p className="text-gray-500">Não há encomendas correspondentes aos filtros.</p>
            {currentTab === 'action_needed' && <p className="text-green-600 font-medium mt-2">Bom trabalho! Zero pendências.</p>}
          </div>
        ) : (
          <AdminTable
            data={adminTableData}
            columns={commonColumns}
            itemsPerPage={10}
            actions={(item) => (
              <div className="flex items-center gap-2">
                {/* Invoice Action: Show if pending */}
                {!item.invoice_sent_at && (
                  <button
                    className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors border border-transparent hover:border-yellow-200"
                    onClick={(e) => { e.stopPropagation(); handleToggleInvoice(item); }}
                    title="Marcar Fatura Enviada"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                )}

                {/* Shipping Action: Simple Button */}
                {item.has_physical && shippingLabel(item.shipping_status) !== 'Enviado' && (
                  <button
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-200"
                    onClick={(e) => { e.stopPropagation(); handleMarkShipped(item); }}
                    title="Marcar como Enviado"
                  >
                    <Truck className="w-4 h-4" />
                  </button>
                )}

                <button
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  onClick={() => setSelectedOrder(item)}
                  title="Ver Detalhes"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            )}
          />
        )}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">

            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between z-10">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-xl font-bold font-serif text-gray-900">#{selectedOrder.order_ref}</h2>
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${isPaid(selectedOrder) ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {statusLabel(selectedOrder.status)}
                  </span>
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${selectedOrder.has_physical ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                    {getTypeLabel(selectedOrder)}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{formatDate(selectedOrder.created_at)} · {selectedOrder.payment_method}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* Coluna Esquerda: Dados Cliente + Faturação */}
              <div className="space-y-6">

                {/* Dados Cliente */}
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                    <User className="w-4 h-4" /> Cliente
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500">Nome</p>
                      <p className="font-medium text-gray-900">{selectedOrder.buyer_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="font-medium text-gray-900">{selectedOrder.buyer_email || '—'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Telefone</p>
                        <p className="font-medium text-gray-900">{selectedOrder.buyer_phone || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">NIF</p>
                        <p className="font-medium text-gray-900 bg-yellow-50 inline-block px-2 rounded border border-yellow-100">
                          {selectedOrder.buyer_nif || 'Não preenchido'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dados Faturação */}
                <div className="bg-white p-5 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> Dados de Faturação
                    </h3>

                    <button
                      onClick={() => handleToggleInvoice(selectedOrder)}
                      className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-colors ${selectedOrder.invoice_sent_at
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200'
                        }`}
                    >
                      {selectedOrder.invoice_sent_at ? (
                        <>
                          <CheckCircle className="w-3 h-3" /> Fatura: Enviada
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3" /> Pendente
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-sm space-y-1 text-gray-700">
                    <p>{selectedOrder.billing_address || selectedOrder.shipping_address1 || '—'}</p>
                    <p>
                      {selectedOrder.billing_postal_code || selectedOrder.shipping_postal_code || ''} {selectedOrder.billing_city || selectedOrder.shipping_city || ''}
                    </p>
                    <p className="font-bold text-gray-900 mt-1">
                      {(selectedOrder.billing_country || selectedOrder.shipping_country || 'PT').toUpperCase()}
                    </p>
                  </div>
                </div>

              </div>

              {/* Coluna Direita: Logística + Itens */}
              <div className="space-y-6">

                {/* Logística (Apenas Físico) */}
                {selectedOrder.has_physical && (
                  <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-4 flex items-center gap-2">
                      <Truck className="w-4 h-4" /> Logística de Envio
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-blue-600">Estado:</span>
                        <span className={`font-bold ${shippingLabel(selectedOrder.shipping_status) === 'Enviado' ? 'text-green-600' : 'text-orange-600'
                          }`}>
                          {shippingLabel(selectedOrder.shipping_status)}
                        </span>
                      </div>
                      <div className="text-sm space-y-1 text-blue-900">
                        <p>{selectedOrder.shipping_address1}</p>
                        {selectedOrder.shipping_address2 && <p>{selectedOrder.shipping_address2}</p>}
                        <p>{selectedOrder.shipping_postal_code} {selectedOrder.shipping_city}</p>
                        <p className="font-bold">{(selectedOrder.shipping_country || '').toUpperCase()}</p>
                      </div>

                      {/* Action Button (No Tracking) */}
                      {shippingLabel(selectedOrder.shipping_status) !== 'Enviado' && (
                        <div className="mt-4 pt-4 border-t border-blue-100 flex justify-end">
                          <button
                            onClick={() => handleMarkShipped(selectedOrder)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Marcar como Enviado
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Itens */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                    <Package className="w-4 h-4" /> Itens ({selectedOrder.items.length})
                  </h3>
                  <div className="border border-gray-100 rounded-xl overflow-hidden bg-white">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs font-bold">
                            {item.qty}x
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                            <p className="text-xs text-gray-500">{formatCurrency(item.unit_price, selectedOrder.currency)} un.</p>
                          </div>
                        </div>
                        <p className="font-bold text-gray-900">{formatCurrency(item.total_price, selectedOrder.currency)}</p>
                      </div>
                    ))}
                    <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Total Pago</span>
                      <span className="text-xl font-bold font-serif text-garabandal-gold">{formatCurrency(selectedOrder.total_amount, selectedOrder.currency)}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex justify-end gap-3 z-10">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-6 py-2 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-8 right-8 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 animate-slide-up">
          <CheckCircle className="w-5 h-5 text-green-400" />
          {toast}
        </div>
      )}
    </AdminLayout>
  );
}
