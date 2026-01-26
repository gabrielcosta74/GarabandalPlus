"use client";

import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import AdminStatCard from '../../../components/admin/AdminStatCard';
import AdminTable from '../../../components/admin/AdminTable';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import {
  Package,
  Truck,
  MapPin,
  AlertCircle,
  Search,
  Filter,
  Eye,
  CheckCircle,
  X,
  FileText,
  Mail,
  CreditCard,
  User
} from 'lucide-react';
import styles from '../encomendas.module.css';

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
  shipping_origin?: string | null;
  shipping_zone?: string | null;
  billing_address?: string | null;
  billing_city?: string | null;
  billing_postal_code?: string | null;
  billing_country?: string | null;
  status: string;
  shipping_status?: string | null;
  shipping_tracking?: string | null;
  shipped_at?: string | null;
  invoice_sent_at?: string | null;
  has_physical: boolean;
  payment_method?: string | null;
  payment_provider?: string | null;
  payment_reference?: string | null;
  total_amount: number;
  currency: string;
  items: OrderItem[];
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
  if (order.has_physical) return 'Fisico';
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
  const [filters, setFilters] = useState({
    status: 'all',
    shipping: 'all',
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
        cache: 'no-store', // Disable caching to ensure fresh data
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
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Não foi possível atualizar o envio.');
      }
      showToast('Encomenda marcada como enviada. Email enviado ao cliente.');
      await loadOrders();
      if (selectedOrder?.order_ref === order.order_ref) {
        setSelectedOrder(prev => prev ? { ...prev, shipping_status: 'enviado', shipping_tracking: tracking, shipped_at: new Date().toISOString() } : null);
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
    const periodDays =
      filters.period === '7d' ? 7 : filters.period === '90d' ? 90 : filters.period === 'all' ? null : 30;
    const limitDate = periodDays ? new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000) : null;

    return orders.filter((order) => {
      if (limitDate && new Date(order.created_at) < limitDate) return false;

      const normalizedStatus = (order.status || '').toLowerCase();
      if (filters.status !== 'all' && normalizedStatus !== filters.status) return false;

      if (filters.shipping !== 'all' && shippingLabel(order.shipping_status).toLowerCase() !== filters.shipping) {
        return false;
      }

      const typeLabel = getTypeLabel(order).toLowerCase();
      if (filters.type !== 'all' && typeLabel !== filters.type) return false;

      const country = (order.shipping_country || '').toUpperCase();
      if (filters.country !== 'all') {
        if (filters.country === 'outros' && (country === 'PT' || country === 'BR')) return false;
        if (filters.country === 'pt' && country !== 'PT') return false;
        if (filters.country === 'br' && country !== 'BR') return false;
      }

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

  // "Encomendas a Preparar": Physical + Paid + Not Shipped
  const pendingOrders = useMemo(
    () =>
      filteredOrders.filter(
        (order) => order.has_physical && isPaid(order) && shippingLabel(order.shipping_status) !== 'Enviado',
      ),
    [filteredOrders],
  );

  // "Histórico e Digitais": 
  // 1. Digital orders (always show here)
  // 2. Physical orders that are Shipped
  // 3. Physical orders that are NOT paid (failed/canceled/pending payment) - usually we don't prep these yet
  const sentOrders = useMemo(
    () => filteredOrders.filter((order) => {
      if (!order.has_physical) return true; // Show all digital
      if (shippingLabel(order.shipping_status) === 'Enviado') return true; // Show shipped physical
      if (!isPaid(order)) return true; // Show failed/canceled physical (optional, but good for history)
      return false;
    }),
    [filteredOrders],
  );

  /* Restored pendingInvoice logic */
  const pendingInvoice = useMemo(
    () => filteredOrders.filter((order) => isPaid(order) && !order.invoice_sent_at),
    [filteredOrders]
  );

  const pendingCount = pendingOrders.length;
  const todaysShipments = sentOrders.filter((order) => {
    if (!order.shipped_at) return false;
    const shippedDate = new Date(order.shipped_at);
    const today = new Date();
    return shippedDate.toDateString() === today.toDateString();
  }).length;
  const brazilOrders = filteredOrders.filter((order) => (order.shipping_country || '').toUpperCase() === 'BR').length;
  const noTracking = sentOrders.filter((order) => !order.shipping_tracking).length;

  // Transform for AdminTable
  const pendingOrdersData: OrderTableItem[] = pendingOrders.map(o => ({ ...o, id: o.order_ref }));
  const sentOrdersData: OrderTableItem[] = sentOrders.map(o => ({ ...o, id: o.order_ref }));

  const pendingColumns = [
    { key: 'order_ref', header: 'Pedido', render: (item: OrderTableItem) => <span className="font-mono font-medium">#{item.order_ref}</span> },
    { key: 'created_at', header: 'Data', render: (item: OrderTableItem) => formatDate(item.created_at) },
    {
      key: 'buyer_name', header: 'Cliente', render: (item: OrderTableItem) => (
        <div>
          <p className="font-medium text-gray-900">{item.buyer_name || item.buyer_email || 'Cliente'}</p>
          <p className="text-xs text-gray-500 truncate max-w-[150px]">{item.buyer_email}</p>
        </div>
      )
    },
    {
      key: 'invoice_sent_at', header: 'Fatura', align: 'center' as const, render: (item: OrderTableItem) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleToggleInvoice(item); }}
          className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${item.invoice_sent_at ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
          title={item.invoice_sent_at ? `Enviada em ${formatDateTime(item.invoice_sent_at)}` : 'Marcar fatura como enviada'}
        >
          <FileText className="w-4 h-4" />
        </button>
      )
    },
    {
      key: 'shipping_status', header: 'Logistica', render: (item: OrderTableItem) => (
        <div>
          <p className="text-sm text-gray-900 font-medium">{shippingLabel(item.shipping_status)}</p>
          <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{(item.shipping_country || 'PT').toUpperCase()}</span>
        </div>
      )
    },
    { key: 'total_amount', header: 'Total', align: 'right' as const, render: (item: OrderTableItem) => <span className="font-bold text-gray-900">{formatCurrency(item.total_amount, item.currency)}</span> },
  ];

  const sentColumns = [
    { key: 'order_ref', header: 'Pedido', render: (item: OrderTableItem) => <span className="font-mono font-medium">#{item.order_ref}</span> },
    { key: 'shipped_at', header: 'Enviado em', render: (item: OrderTableItem) => item.shipped_at ? formatDate(item.shipped_at) : formatDate(item.created_at) },
    { key: 'buyer_name', header: 'Cliente', render: (item: OrderTableItem) => item.buyer_name || 'Cliente' },
    {
      key: 'invoice_sent_at', header: 'Fatura', align: 'center' as const, render: (item: OrderTableItem) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleToggleInvoice(item); }}
          className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${item.invoice_sent_at ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
        >
          <FileText className="w-4 h-4" />
        </button>
      )
    },
    {
      key: 'shipping_tracking', header: 'Tracking', render: (item: OrderTableItem) => (
        <span className="font-mono text-sm text-gray-600">{item.shipping_tracking || '—'}</span>
      )
    },
    { key: 'total_amount', header: 'Total', align: 'right' as const, render: (item: OrderTableItem) => formatCurrency(item.total_amount, item.currency) },
  ];

  return (
    <AdminLayout title="Encomendas e Logística" isLoading={loading}>
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <AdminStatCard
          title="Por Enviar (Físico)"
          value={pendingCount}
          icon={Package}
          color="gold"
        />
        <AdminStatCard
          title="Faturas Pendentes"
          value={pendingInvoice.length}
          icon={FileText}
          color="blue"
        />
        <AdminStatCard
          title="Envios Hoje"
          value={todaysShipments}
          icon={Truck}
          color="green"
        />
        <AdminStatCard
          title="Sem Tracking"
          value={sentOrders.filter(o => !o.shipping_tracking).length}
          icon={AlertCircle}
          color="purple"
        />
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <select
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="all">Status: Todos</option>
            <option value="paid">Pago</option>
            <option value="pending">Pendente</option>
            <option value="failed">Falhado</option>
          </select>
          <select
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
            value={filters.shipping}
            onChange={(event) => setFilters((prev) => ({ ...prev, shipping: event.target.value }))}
          >
            <option value="all">Envio: Todos</option>
            <option value="por enviar">Por enviar</option>
            <option value="enviado">Enviado</option>
          </select>
        </div>

        <div className="flex items-center gap-2 flex-grow sm:flex-grow-0 min-w-[200px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Nome, email, NIF, Ref..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
            />
          </div>
          <button onClick={loadOrders} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-bold font-serif text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-garabandal-gold" />
            Encomendas a Preparar (Físico)
          </h2>
          <AdminTable
            data={pendingOrdersData}
            columns={pendingColumns}
            itemsPerPage={5}
            actions={(item) => (
              <div className="flex items-center gap-2">
                <input
                  className="w-24 px-2 py-1 text-xs border border-gray-200 rounded focus:border-garabandal-gold focus:outline-none"
                  type="text"
                  placeholder="Tracking code"
                  value={trackingByOrder[item.order_ref] || ''}
                  onChange={(e) => setTrackingByOrder((prev) => ({ ...prev, [item.order_ref]: e.target.value }))}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  onClick={(e) => { e.stopPropagation(); handleMarkShipped(item); }}
                  title="Marcar Enviado"
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 text-gray-400 hover:text-garabandal-dark hover:bg-gray-100 rounded-lg transition-colors"
                  onClick={() => setSelectedOrder(item)}
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            )}
          />
        </div>

        <div>
          <h2 className="text-lg font-bold font-serif text-gray-900 mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-gray-400" />
            Histórico e Digitais
          </h2>
          <AdminTable
            data={sentOrdersData}
            columns={sentColumns}
            itemsPerPage={5}
            actions={(item) => (
              <button
                className="p-1.5 text-gray-400 hover:text-garabandal-dark hover:bg-gray-100 rounded-lg transition-colors"
                onClick={() => setSelectedOrder(item)}
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
          />
        </div>
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
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                        }`}
                    >
                      {selectedOrder.invoice_sent_at ? (
                        <>
                          <CheckCircle className="w-3 h-3" /> Fatura: Enviada
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3" /> Fatura: Pendente
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
                        <span className="font-bold text-blue-900">{shippingLabel(selectedOrder.shipping_status)}</span>
                      </div>
                      <div className="text-sm space-y-1 text-blue-900">
                        <p>{selectedOrder.shipping_address1}</p>
                        {selectedOrder.shipping_address2 && <p>{selectedOrder.shipping_address2}</p>}
                        <p>{selectedOrder.shipping_postal_code} {selectedOrder.shipping_city}</p>
                        <p className="font-bold">{(selectedOrder.shipping_country || '').toUpperCase()}</p>
                      </div>

                      {/* Tracking Action Inline */}
                      <div className="mt-4 pt-4 border-t border-blue-100">
                        <label className="text-xs text-blue-500 font-medium mb-1 block">Tracking Number</label>
                        <div className="flex gap-2">
                          <input
                            className="flex-1 px-3 py-2 text-sm border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none"
                            placeholder="Inserir código..."
                            value={trackingByOrder[selectedOrder.order_ref] || selectedOrder.shipping_tracking || ''}
                            onChange={(e) => setTrackingByOrder(prev => ({ ...prev, [selectedOrder.order_ref]: e.target.value }))}
                          />
                          <button
                            onClick={() => handleMarkShipped(selectedOrder)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
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
