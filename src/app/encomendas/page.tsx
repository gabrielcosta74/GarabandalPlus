"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardShell from '../../components/dashboard/DashboardShell';
import { supabaseBrowser } from '../../lib/supabase-browser';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  AlertCircle,
  Download,
  Copy,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type OrderItem = {
  product_id: string;
  name: string;
  qty: number;
  unit_price: number;
  total_price: number;
  is_physical?: boolean | null;
};

type Order = {
  order_ref: string;
  total_amount: number;
  currency: string;
  status: string;
  has_physical: boolean;
  has_digital?: boolean;
  shipping_status?: string | null;
  shipping_tracking?: string | null;
  shipped_at?: string | null;
  created_at: string;
  items: OrderItem[];
};

const formatCurrency = (value: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(value);

const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-PT', {
  day: '2-digit',
  month: 'long',
  year: 'numeric'
});

const getStatusInfo = (status: string) => {
  const normalized = status?.toLowerCase?.() || '';
  if (normalized === 'paid' || normalized === 'pago') return { label: 'Pago', color: 'green', icon: CheckCircle2 };
  if (normalized === 'pending' || normalized === 'pendente') return { label: 'Pendente', color: 'amber', icon: Clock };
  if (normalized === 'failed') return { label: 'Falhado', color: 'red', icon: AlertCircle };
  if (normalized === 'canceled' || normalized === 'cancelado') return { label: 'Cancelado', color: 'gray', icon: AlertCircle };
  return { label: status || 'Indefinido', color: 'gray', icon: AlertCircle };
};

const getShippingLabel = (status?: string | null) => {
  const normalized = status?.toLowerCase?.() || '';
  if (!normalized) return 'Em preparação';
  if (normalized === 'enviado') return 'Enviado';
  if (normalized === 'por_enviar') return 'Em preparação';
  if (normalized === 'preparacao') return 'Em preparação';
  return status || 'Em preparação';
};

const OrderTimeline = ({ order }: { order: Order }) => {
  const isPaid = order.status?.toLowerCase() === 'paid' || order.status?.toLowerCase() === 'pago';
  const isShipped = order.shipping_status?.toLowerCase() === 'enviado';

  // Steps configuration
  const steps = [
    { label: 'Pagamento', completed: isPaid, icon: CheckCircle2 },
    { label: 'Preparação', completed: isPaid, icon: Package }, // Assuming prep starts after payment
    { label: 'Enviado', completed: isShipped, icon: Truck },
  ];

  // For digital only orders, show simplified timeline
  if (!order.has_physical) {
    return (
      <div className="flex items-center gap-4 py-4 px-2">
        <div className="flex items-center gap-2 text-green-600 font-bold">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm">Pagamento Confirmado</span>
        </div>
        <div className="h-px bg-gray-200 flex-1"></div>
        <div className="flex items-center gap-2 text-green-600 font-bold">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm">Disponível na Biblioteca</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative py-6">
      {/* Progress Bar Background */}
      <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 rounded-full z-0" />

      {/* Progress Bar Fill - Simplified logic for demonstration */}
      <div
        className="absolute top-1/2 left-0 h-1 bg-garabandal-gold -translate-y-1/2 rounded-full z-0 transition-all duration-500"
        style={{ width: isShipped ? '100%' : isPaid ? '50%' : '0%' }}
      />

      <div className="relative z-10 flex justify-between w-full">
        {steps.map((step, idx) => {
          const active = step.completed;
          return (
            <div key={idx} className="flex flex-col items-center gap-2 bg-white px-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${active ? 'bg-garabandal-gold border-garabandal-gold text-white shadow-md' : 'bg-white border-gray-200 text-gray-300'}`}>
                <step.icon className="w-5 h-5" />
              </div>
              <span className={`text-xs font-bold uppercase tracking-wider ${active ? 'text-garabandal-dark' : 'text-gray-400'}`}>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function EncomendasPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const router = useRouter();

  const toggleOrder = (ref: string) => {
    if (expandedOrder === ref) setExpandedOrder(null);
    else setExpandedOrder(ref);
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!supabaseBrowser) {
        setError('Sessão indisponível.');
        setLoading(false);
        return;
      }

      // Retry mechanism for session
      let token = (await supabaseBrowser.auth.getSession()).data.session?.access_token;
      if (!token) {
        // Wait a bit and try again (handles hydration race)
        await new Promise(r => setTimeout(r, 500));
        token = (await supabaseBrowser.auth.getSession()).data.session?.access_token;
      }

      if (!token) {
        if (mounted) {
          setLoggedIn(false);
          setLoading(false);
          // Optional: Don't redirect immediately, let them see "Entra para ver"
          // router.replace('/login?next=/encomendas'); 
        }
        return;
      }

      if (mounted) setLoggedIn(true);

      try {
        const res = await fetch('/api/store/orders', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || 'Não foi possível carregar as encomendas.');
        }
        const payload = await res.json();
        if (mounted) {
          setOrders(payload.orders || []);
          setError(null);
        }
      } catch (err: any) {
        if (mounted) setError(err?.message || 'Erro ao carregar encomendas.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [router]);

  return (
    <DashboardShell
      title="As Minhas Encomendas"
      subtitle="Acompanha o estado das tuas compras e consulta o histórico."
    >
      {!loggedIn ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-garabandal-dark mb-2">Entra para ver as tuas encomendas</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-8">Usa o mesmo email da compra para associar automaticamente.</p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/login?next=/encomendas" className="px-6 py-2.5 bg-garabandal-gold text-garabandal-dark font-bold rounded-xl hover:bg-yellow-400 transition-colors">
              Entrar
            </Link>
            <Link href="/register" className="px-6 py-2.5 bg-white text-gray-600 font-bold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
              Criar conta
            </Link>
          </div>
        </div>
      ) : loading ? (
        <div className="py-20 flex justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-garabandal-gold border-t-transparent rounded-full" />
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-center font-bold">
          {error}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-garabandal-dark mb-2">Sem encomendas recentes</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-8">Ainda não fizeste nenhuma compra na nossa loja.</p>
          <Link href="/loja-online" className="px-6 py-3 bg-garabandal-gold text-garabandal-dark font-bold rounded-xl hover:bg-yellow-400 transition-all shadow-lg hover:shadow-xl inline-flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            Explorar Loja Online
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const status = getStatusInfo(order.status);
            const isExpanded = expandedOrder === order.order_ref;

            return (
              <motion.article
                key={order.order_ref}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <div
                  onClick={() => toggleOrder(order.order_ref)}
                  className="p-6 cursor-pointer hover:bg-gray-50/50 transition-colors flex flex-col md:flex-row gap-6 items-start md:items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${status.color === 'green' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900">#{order.order_ref}</h3>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${status.color === 'green' ? 'bg-green-100 text-green-700' :
                          status.color === 'amber' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{formatDate(order.created_at)} • {order.items.length} itens</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-0.5">Total</p>
                      <p className="font-bold text-lg text-garabandal-dark">{formatCurrency(order.total_amount, order.currency)}</p>
                    </div>
                    <div className={`p-2 rounded-full transition-transform duration-300 ${isExpanded ? 'bg-gray-100 rotate-180' : 'bg-gray-50'}`}>
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-100 bg-gray-50/30"
                    >
                      <div className="p-6 md:p-8">
                        {/* Status Tracker */}
                        <div className="mb-10 max-w-2xl mx-auto">
                          <OrderTimeline order={order} />
                        </div>

                        {/* Items */}
                        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-6">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100">
                              <tr>
                                <th className="py-3 px-4 pl-6">Produto</th>
                                <th className="py-3 px-4 text-center">Qtd</th>
                                <th className="py-3 px-4 pr-6 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {order.items.map((item, idx) => (
                                <tr key={idx}>
                                  <td className="py-4 px-4 pl-6 font-medium text-gray-900">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span>{item.name}</span>
                                      {item.is_physical === false && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                          Digital
                                        </span>
                                      )}
                                      {item.is_physical === true && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                          Físico
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-4 px-4 text-center text-gray-500">{item.qty}</td>
                                  <td className="py-4 px-4 pr-6 text-right font-bold text-gray-900">{formatCurrency(item.total_price, order.currency)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {(order.has_digital || order.has_physical) && (
                          <div className="grid md:grid-cols-2 gap-4 mb-6">
                            {order.has_digital && (
                              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                                <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm mb-2">
                                  <Download className="w-4 h-4" />
                                  Produtos digitais disponíveis
                                </div>
                                <p className="text-sm text-emerald-700/80 mb-3">Pode aceder a qualquer momento na sua Biblioteca.</p>
                                <Link href="/biblioteca" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-600">
                                  Abrir Biblioteca
                                  <ArrowRight className="w-4 h-4" />
                                </Link>
                              </div>
                            )}
                            {order.has_physical && (
                              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                <div className="flex items-center gap-2 text-blue-700 font-bold text-sm mb-2">
                                  <Truck className="w-4 h-4" />
                                  {getShippingLabel(order.shipping_status)}
                                </div>
                                {order.shipping_tracking ? (
                                  <p className="text-sm text-blue-700/80">Tracking: {order.shipping_tracking}</p>
                                ) : (
                                  <p className="text-sm text-blue-700/80">Enviamos o tracking assim que a encomenda for expedida.</p>
                                )}
                                {order.shipped_at ? (
                                  <p className="text-xs text-blue-700/70 mt-2">Enviado em {formatDate(order.shipped_at)}</p>
                                ) : null}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap items-center justify-end gap-3">
                          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                            <Copy className="w-4 h-4" />
                            Copiar Referência
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.article>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
