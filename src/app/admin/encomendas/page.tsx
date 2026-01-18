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
  FileText
} from 'lucide-react';
import styles from '../encomendas.module.css'; // Keeping for modal styles for now, or could migrate to Tailwind

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
  shipping_country: string | null;
  shipping_address1?: string | null;
  shipping_address2?: string | null;
  shipping_city?: string | null;
  shipping_postal_code?: string | null;
  shipping_cost?: number | null;
  shipping_origin?: string | null;
  shipping_zone?: string | null;
  status: string;
  shipping_status?: string | null;
  shipping_tracking?: string | null;
  shipped_at?: string | null;
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
  id: string; // Required by AdminTable
}

const formatCurrency = (value: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(value);

const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-PT');

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

const shortRef = (value?: string | null) => {
  if (!value) return '—';
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
};

const originLabel = (origin?: string | null) => {
  if (!origin) return '—';
  const normalized = origin.toUpperCase();
  if (normalized === 'BR') return 'Brasil';
  if (normalized === 'PT') return 'Portugal';
  return normalized;
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
    } catch (err: any) {
      showToast(err?.message || 'Erro ao atualizar envio.');
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
          order.payment_method,
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

  const pendingOrders = useMemo(
    () =>
      filteredOrders.filter(
        (order) => order.has_physical && isPaid(order) && shippingLabel(order.shipping_status) !== 'Enviado',
      ),
    [filteredOrders],
  );
  const sentOrders = useMemo(
    () => filteredOrders.filter((order) => order.has_physical && shippingLabel(order.shipping_status) === 'Enviado'),
    [filteredOrders],
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
      key: 'has_physical', header: 'Tipo', align: 'center' as const, render: (item: OrderTableItem) => (
        <div className="flex flex-col items-center gap-1">
          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${item.has_physical ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
            {getTypeLabel(item)}
          </span>
          {item.has_physical && (
            <span className="text-[10px] font-mono text-gray-500">{(item.shipping_country || 'PT').toUpperCase()}</span>
          )}
        </div>
      )
    },
    {
      key: 'shipping_status', header: 'Logistica', render: (item: OrderTableItem) => (
        <div>
          <p className="text-sm text-gray-900 font-medium">{shippingLabel(item.shipping_status)}</p>
          <p className={`text-xs ${isPaid(item) ? 'text-green-600' : 'text-red-500'}`}>{statusLabel(item.status)}</p>
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
          title="Encomendas Pendentes"
          value={pendingCount}
          icon={Package}
          color="gold"
        />
        <AdminStatCard
          title="Envios Hoje"
          value={todaysShipments}
          icon={Truck}
          color="green"
        />
        <AdminStatCard
          title="Encomendas Brasil"
          value={brazilOrders}
          icon={MapPin}
          color="blue"
        />
        <AdminStatCard
          title="Sem Tracking"
          value={noTracking}
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
            <option value="canceled">Cancelado</option>
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

          <select
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
            value={filters.country}
            onChange={(event) => setFilters((prev) => ({ ...prev, country: event.target.value }))}
          >
            <option value="all">País: Todos</option>
            <option value="pt">PT</option>
            <option value="br">BR</option>
            <option value="outros">Outros</option>
          </select>
        </div>

        <div className="flex items-center gap-2 flex-grow sm:flex-grow-0 min-w-[200px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
            />
          </div>
          <button
            onClick={loadOrders}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            title="Atualizar"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-bold font-serif text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-garabandal-gold" />
            Encomendas Pendentes
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
                  placeholder="Tracking?"
                  value={trackingByOrder[item.order_ref] || ''}
                  onChange={(event) =>
                    setTrackingByOrder((prev) => ({ ...prev, [item.order_ref]: event.target.value }))
                  }
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
                  title="Ver Detalhes"
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
            Histórico de Envios
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

      {selectedOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-bold font-serif text-gray-900">Encomenda #{selectedOrder.order_ref}</h2>
                <p className="text-sm text-gray-500">{formatDate(selectedOrder.created_at)}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Sections matching old modal but styled with standard Tailwind utility classes */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">Cliente</h3>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="font-medium text-gray-900">{selectedOrder.buyer_name || 'Cliente'}</p>
                  <p className="text-sm text-gray-600">{selectedOrder.buyer_email}</p>
                  <p className="text-sm text-gray-600">{selectedOrder.buyer_phone}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">SITUAÇÃO</h3>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Pagamento:</span>
                    <span className="font-medium">{selectedOrder.payment_method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Estado:</span>
                    <span className={`font-medium ${isPaid(selectedOrder) ? 'text-green-600' : 'text-red-500'}`}>{statusLabel(selectedOrder.status)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Envio:</span>
                    <span>{shippingLabel(selectedOrder.shipping_status)}</span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">ITENS NA ENCOMENDA</h3>
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-500">Qtd: {item.qty} · Unit: {formatCurrency(item.unit_price, selectedOrder.currency)}</p>
                        </div>
                      </div>
                      <p className="font-bold text-gray-900">{formatCurrency(item.total_price, selectedOrder.currency)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedOrder.has_physical && (
                <div className="md:col-span-2 space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">MORADA DE ENVIO</h3>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm text-gray-700">
                    <p>{selectedOrder.shipping_address1}</p>
                    {selectedOrder.shipping_address2 && <p>{selectedOrder.shipping_address2}</p>}
                    <p>{selectedOrder.shipping_postal_code} {selectedOrder.shipping_city}</p>
                    <p className="font-bold mt-1">{(selectedOrder.shipping_country || '').toUpperCase()}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 p-6 flex justify-between items-center z-10">
              <span className="text-lg font-bold text-gray-900">Total</span>
              <span className="text-2xl font-serif font-bold text-garabandal-gold">{formatCurrency(selectedOrder.total_amount, selectedOrder.currency)}</span>
            </div>
          </div>
        </div>
      ) : null}

      {toast && (
        <div className="fixed bottom-8 right-8 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 animate-slide-up">
          <CheckCircle className="w-5 h-5 text-green-400" />
          {toast}
        </div>
      )}
    </AdminLayout>
  );
}
