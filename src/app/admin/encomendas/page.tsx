"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import AdminStatCard from '../../../components/admin/AdminStatCard';
import AdminTable from '../../../components/admin/AdminTable';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import {
  Package,
  Truck,
  AlertCircle,
  FileText,
  Inbox,
  Clock,
  CheckCircle,
  Eye
} from 'lucide-react';
import OrderFilters, { OrderFiltersState } from './components/OrderFilters';
import OrderDetailsModal, { OrderDetailRow } from './components/OrderDetailsModal';

// Shared Types (ideally move to types.ts)
export type OrderItem = {
  order_ref: string;
  product_id: string;
  name: string;
  qty: number;
  unit_price: number;
  total_price: number;
};

// We need to match this with OrderDetailsModal's expectation or cast it
// The properties are largely the same.
export type OrderRow = OrderDetailRow;

// --- Helpers ---
const formatCurrency = (value: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(value);

const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-PT');

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
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

const withTimeout = async <T,>(promise: Promise<T>, ms: number, message: string) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export default function AdminEncomendasPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);

  // Tab State
  const [currentTab, setCurrentTab] = useState<'action_needed' | 'history'>('action_needed');

  // Filters State
  const [filters, setFilters] = useState<OrderFiltersState>({
    status: 'all',
    shipping: 'all',
    invoice: 'all',
    type: 'all',
    country: 'all',
    search: '',
  });

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (supabaseBrowser) {
        try {
          const { data: sessionData } = await withTimeout(
            supabaseBrowser.auth.getSession(),
            4000,
            'Timeout ao verificar sessão.',
          );
          const token = sessionData.session?.access_token;
          if (token) headers.Authorization = `Bearer ${token}`;
        } catch {
          // Proceed
        }
      }

      const res = await withTimeout(
        fetch('/api/admin/orders', { headers, cache: 'no-store' }),
        20000,
        'Timeout ao carregar encomendas.',
      );
      if (!res.ok) throw new Error('Erro ao carregar encomendas.');
      const payload = await res.json();
      setOrders(payload.orders || []);
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Erro ao carregar encomendas.'));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadOrders();
    // Refresh loop every 60s
    const interval = setInterval(loadOrders, 60000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  // --- Actions ---
  const getAdminAccessToken = async () => {
    if (!supabaseBrowser) throw new Error('Supabase erro.');
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      throw new Error('Sessão expirada. Inicie sessão novamente.');
    }
    return token;
  };

  const handleMarkShipped = async (order: OrderRow, options?: { alreadyUpdated?: boolean }) => {
    try {
      const shippedAt = order.shipped_at || new Date().toISOString();
      let updatedOrder: OrderRow = { ...order, shipping_status: 'enviado', shipped_at: shippedAt };

      if (!options?.alreadyUpdated) {
        const token = await getAdminAccessToken();
        const res = await fetch(`/api/admin/orders/${encodeURIComponent(order.order_ref)}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ shippingStatus: 'enviado' }),
        });
        if (!res.ok) throw new Error('Falha ao atualizar envio.');
        const savedOrder = await res.json() as OrderRow;
        updatedOrder = { ...updatedOrder, ...savedOrder };
      }

      const newOrders = orders.map(o => o.order_ref === order.order_ref ? { ...o, ...updatedOrder } : o);
      setOrders(newOrders);
      if (selectedOrder?.order_ref === order.order_ref) {
        setSelectedOrder(prev => prev ? { ...prev, ...updatedOrder } : null);
      }
      showToast('Encomenda marcada como enviada! 📦 ✈️');
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Falha ao atualizar envio.'));
    }
  };

  const handleToggleInvoice = async (order: OrderRow) => {
    try {
      const token = await getAdminAccessToken();

      const newStatus = !order.invoice_sent_at;
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(order.order_ref)}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoiceSent: newStatus }),
      });
      if (!res.ok) throw new Error('Falha ao atualizar fatura.');

      const updatedDate = newStatus ? new Date().toISOString() : null;
      const newOrders = orders.map(o => o.order_ref === order.order_ref ? { ...o, invoice_sent_at: updatedDate } : o);
      setOrders(newOrders);
      if (selectedOrder?.order_ref === order.order_ref) {
        setSelectedOrder(prev => prev ? { ...prev, invoice_sent_at: updatedDate } : null);
      }
      showToast(newStatus ? 'Fatura marcada como enviada! 📄✅' : 'Fatura marcada como pendente. ⏳');
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Falha ao atualizar fatura.'));
    }
  };

  // --- Filtering & Views ---
  const filteredOrders = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return orders.filter((order) => {
      // Search
      if (search) {
        const haystack = [
          order.order_ref,
          order.buyer_name,
          order.buyer_email,
          order.buyer_nif,
          order.payment_reference,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      // Status
      const statusFn = (order.status || '').toLowerCase();
      if (filters.status !== 'all' && statusFn !== filters.status) return false;

      // Shipping
      if (filters.shipping !== 'all') {
        const shipLabel = shippingLabel(order.shipping_status).toLowerCase();
        if (filters.shipping !== shipLabel) return false;
      }

      // Invoice
      if (filters.invoice !== 'all') {
        const sent = !!order.invoice_sent_at;
        if (filters.invoice === 'sent' && !sent) return false;
        if (filters.invoice === 'pending' && sent) return false;
      }

      // Type
      if (filters.type !== 'all') {
        const t = order.has_physical ? 'fisico' : 'digital';
        if (filters.type !== t) return false;
      }

      return true;
    });
  }, [orders, filters]);

  // "Action Needed" Logic
  const actionNeededSet = useMemo(() => {
    return filteredOrders.filter(order => {
      const statusFn = (order.status || '').toLowerCase();
      if (statusFn === 'canceled' || statusFn === 'failed' || statusFn === 'pending' || statusFn === 'pendente') return false;

      const needsInvoice = !order.invoice_sent_at;
      // An invoice and shipping is only needed if paid.
      const needsShipping = isPaid(order) && order.has_physical && shippingLabel(order.shipping_status) !== 'Enviado';

      return needsShipping || needsInvoice;
    });
  }, [filteredOrders]);

  // View switch
  const displayedOrders = currentTab === 'action_needed' ? actionNeededSet : filteredOrders;

  // Stats for Cards (Always calculated from clean list to be useful)
  const stats = useMemo(() => {
    const pendingShip = orders.filter(o => isPaid(o) && o.has_physical && shippingLabel(o.shipping_status) !== 'Enviado').length;
    // Faturas em falta now counts only paid orders without an invoice
    const pendingInv = orders.filter(o => isPaid(o) && !o.invoice_sent_at).length;
    return { pendingShip, pendingInv, total: orders.length };
  }, [orders]);

  // Table Columns
  const columns = [
    {
      key: 'order_ref', header: 'Pedido', render: (item: OrderRow) => (
        <div className="flex flex-col">
          <span className="font-mono font-bold text-gray-900">#{item.order_ref}</span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mt-0.5">{getTypeLabel(item)}</span>
        </div>
      )
    },
    {
      key: 'created_at', header: 'Data', render: (item: OrderRow) => (
        <div className="flex flex-col">
          <span className="text-sm text-gray-900">{formatDate(item.created_at)}</span>
          <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )
    },
    {
      key: 'buyer_name', header: 'Cliente', render: (item: OrderRow) => (
        <div>
          <p className="font-medium text-gray-900 text-sm truncate max-w-[180px]">{item.buyer_name || '—'}</p>
          <p className="text-xs text-gray-500 truncate max-w-[180px]">{item.buyer_email}</p>
        </div>
      )
    },
    {
      key: 'status_flags', header: 'Estado', render: (item: OrderRow) => (
        <div className="flex flex-col gap-1.5 items-start">
          {!item.invoice_sent_at ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-yellow-50 text-yellow-700 border border-yellow-200">
              <AlertCircle className="w-3 h-3" /> Fatura
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-green-50 text-green-700 border border-green-200 opacity-60">
              <FileText className="w-3 h-3" /> OK
            </span>
          )}

          {item.has_physical && (
            shippingLabel(item.shipping_status) !== 'Enviado' ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-orange-50 text-orange-700 border border-orange-200">
                <Truck className="w-3 h-3" /> Envio
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-200 opacity-60">
                <Truck className="w-3 h-3" /> Enviado
              </span>
            )
          )}
        </div>
      )
    },
    { key: 'total_amount', header: 'Total', align: 'right' as const, render: (item: OrderRow) => <span className="font-bold text-gray-900">{formatCurrency(item.total_amount, item.currency)}</span> },
  ];

  const tableData = displayedOrders.map(o => ({ ...o, id: o.order_ref }));

  return (
    <AdminLayout title="Gestão de Encomendas" isLoading={loading}>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <AdminStatCard title="Por Enviar" value={stats.pendingShip} icon={Package} color="gold" />
        <AdminStatCard title="Faturas em Falta" value={stats.pendingInv} icon={FileText} color="blue" />
        <AdminStatCard title="Total Encomendas" value={stats.total} icon={Inbox} color="purple" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setCurrentTab('action_needed')}
          className={`px-6 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-all ${currentTab === 'action_needed'
            ? 'border-garabandal-gold text-garabandal-dark bg-amber-50/50'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
        >
          <AlertCircle className="w-4 h-4" />
          Ação Necessária
          <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs font-bold shadow-sm">
            {actionNeededSet.length}
          </span>
        </button>

        <button
          onClick={() => setCurrentTab('history')}
          className={`px-6 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-all ${currentTab === 'history'
            ? 'border-garabandal-gold text-garabandal-dark'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
        >
          <Clock className="w-4 h-4" />
          Histórico
        </button>
      </div>

      {/* Modern Filters */}
      <div className="mb-6">
        <OrderFilters filters={filters} setFilters={setFilters} />
      </div>

      {/* Table Area */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
        {displayedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 h-64">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-gray-900 font-medium text-lg">Tudo limpo!</h3>
            <p className="text-gray-500">Nenhuma encomenda encontrada com estes filtros.</p>
          </div>
        ) : (
          <AdminTable
            data={tableData}
            columns={columns}
            itemsPerPage={15}
            actions={(item) => (
              <button
                onClick={() => setSelectedOrder(item)}
                className="p-2 text-gray-400 hover:text-garabandal-dark hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Eye className="w-5 h-5" />
              </button>
            )}
          />
        )}
      </div>

      {/* Detail Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onToggleInvoice={handleToggleInvoice}
          onMarkShipped={handleMarkShipped}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 right-8 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 animate-slide-up">
          <CheckCircle className="w-5 h-5 text-green-400" />
          {toast}
        </div>
      )}

    </AdminLayout>
  );
}
