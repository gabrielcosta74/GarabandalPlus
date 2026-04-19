"use client";

import { useState } from 'react';
import Link from 'next/link';
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

const formatCurrency = (value: number, currency = 'EUR', locale = 'pt-PT') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);

const formatDate = (value: string, locale = 'pt-PT') => new Date(value).toLocaleDateString(locale, {
  day: '2-digit',
  month: 'long',
  year: 'numeric'
});

const getStatusInfo = (status: string, isEn = false) => {
  const normalized = status?.toLowerCase?.() || '';
  if (normalized === 'paid' || normalized === 'pago') return { label: isEn ? 'Paid' : 'Pago', color: 'green', icon: CheckCircle2 };
  if (normalized === 'pending' || normalized === 'pendente') return { label: isEn ? 'Pending' : 'Pendente', color: 'amber', icon: Clock };
  if (normalized === 'failed') return { label: isEn ? 'Failed' : 'Falhado', color: 'red', icon: AlertCircle };
  if (normalized === 'canceled' || normalized === 'cancelado') return { label: isEn ? 'Canceled' : 'Cancelado', color: 'gray', icon: AlertCircle };
  return { label: status || (isEn ? 'Undefined' : 'Indefinido'), color: 'gray', icon: AlertCircle };
};

const getShippingLabel = (status?: string | null, isEn = false) => {
  const normalized = status?.toLowerCase?.() || '';
  if (!normalized) return isEn ? 'Preparing' : 'Em preparação';
  if (normalized === 'enviado') return isEn ? 'Shipped' : 'Enviado';
  if (normalized === 'por_enviar') return isEn ? 'Preparing' : 'Em preparação';
  if (normalized === 'preparacao') return isEn ? 'Preparing' : 'Em preparação';
  return status || (isEn ? 'Preparing' : 'Em preparação');
};

const OrderTimeline = ({ order, isEn }: { order: Order; isEn: boolean }) => {
  const isPaid = order.status?.toLowerCase() === 'paid' || order.status?.toLowerCase() === 'pago';
  const isShipped = order.shipping_status?.toLowerCase() === 'enviado';

  // Steps configuration
  const steps = [
    { label: isEn ? 'Payment' : 'Pagamento', completed: isPaid, icon: CheckCircle2 },
    { label: isEn ? 'Preparing' : 'Preparação', completed: isPaid, icon: Package },
    { label: isEn ? 'Shipped' : 'Enviado', completed: isShipped, icon: Truck },
  ];

  // For digital only orders, show simplified timeline
  if (!order.has_physical) {
    return (
      <div className="flex items-center gap-4 py-4 px-2">
        <div className="flex items-center gap-2 text-green-600 font-bold">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm">{isEn ? 'Payment Confirmed' : 'Pagamento Confirmado'}</span>
        </div>
        <div className="h-px bg-gray-200 flex-1"></div>
        <div className="flex items-center gap-2 text-green-600 font-bold">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm">{isEn ? 'Available in Library' : 'Disponível na Biblioteca'}</span>
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

import useSWR from 'swr';
import { User } from '@supabase/supabase-js';

import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '../../contexts/LocaleContext';

const fetchOrders = async (url: string) => {
  const { data: { session } } = await supabaseBrowser.auth.getSession();
  if (!session) throw new Error("No session");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session.access_token}` }
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || 'Erro ao carregar');
  }
  return res.json();
};

export default function EncomendasPage() {
  const { user, loading: authLoading } = useAuth();
  const { locale } = useLocale();
  const isEn = locale === 'en';
  const uiLocale = isEn ? 'en-GB' : 'pt-PT';

  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const toggleOrder = (ref: string) => {
    if (expandedOrder === ref) setExpandedOrder(null);
    else setExpandedOrder(ref);
  };

  // Use SWR for data
  const { data: payload, error: swrError, isLoading: swrLoading } = useSWR(
    user ? '/api/store/orders' : null,
    fetchOrders,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      revalidateIfStale: true,
      shouldRetryOnError: false
    }
  );

  const orders: Order[] = payload?.orders || [];
  const loading = authLoading || (!!user && swrLoading);
  const error = swrError?.message;

  return (
    <DashboardShell
      title={isEn ? 'My Orders' : 'As Minhas Encomendas'}
      subtitle={isEn ? 'Track your purchases and review your history.' : 'Acompanha o estado das tuas compras e consulta o histórico.'}
    >
      {loading ? (
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
          <h2 className="font-serif text-2xl font-bold text-garabandal-dark mb-2">{isEn ? 'No recent orders' : 'Sem encomendas recentes'}</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-8">{isEn ? 'You have not made any purchases in our store yet.' : 'Ainda não fizeste nenhuma compra na nossa loja.'}</p>
          <Link href={isEn ? '/en/store' : '/loja-online'} className="px-6 py-3 bg-garabandal-gold text-garabandal-dark font-bold rounded-xl hover:bg-yellow-400 transition-all shadow-lg hover:shadow-xl inline-flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            {isEn ? 'Explore Online Store' : 'Explorar Loja Online'}
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const status = getStatusInfo(order.status, isEn);
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
                      <p className="text-sm text-gray-500">{formatDate(order.created_at, uiLocale)} • {order.items.length} {isEn ? 'items' : 'itens'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-0.5">{isEn ? 'Total' : 'Total'}</p>
                      <p className="font-bold text-lg text-garabandal-dark">{formatCurrency(order.total_amount, order.currency, uiLocale)}</p>
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
                          <OrderTimeline order={order} isEn={isEn} />
                        </div>

                        {/* Items */}
                        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-6">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100">
                              <tr>
                                <th className="py-3 px-4 pl-6">{isEn ? 'Product' : 'Produto'}</th>
                                <th className="py-3 px-4 text-center">{isEn ? 'Qty' : 'Qtd'}</th>
                                <th className="py-3 px-4 pr-6 text-right">{isEn ? 'Total' : 'Total'}</th>
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
                                          {isEn ? 'Physical' : 'Físico'}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-4 px-4 text-center text-gray-500">{item.qty}</td>
                                  <td className="py-4 px-4 pr-6 text-right font-bold text-gray-900">{formatCurrency(item.total_price, order.currency, uiLocale)}</td>
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
                                  {isEn ? 'Digital products available' : 'Produtos digitais disponíveis'}
                                </div>
                                <p className="text-sm text-emerald-700/80 mb-3">{isEn ? 'You can access them at any time in your Library.' : 'Pode aceder a qualquer momento na sua Biblioteca.'}</p>
                                <Link href={isEn ? '/en/library' : '/biblioteca'} className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-600">
                                  {isEn ? 'Open Library' : 'Abrir Biblioteca'}
                                  <ArrowRight className="w-4 h-4" />
                                </Link>
                              </div>
                            )}
                            {order.has_physical && (
                              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                <div className="flex items-center gap-2 text-blue-700 font-bold text-sm mb-2">
                                  <Truck className="w-4 h-4" />
                                  {getShippingLabel(order.shipping_status, isEn)}
                                </div>
                                {order.shipping_tracking ? (
                                  <p className="text-sm text-blue-700/80">Tracking: {order.shipping_tracking}</p>
                                ) : (
                                  <p className="text-sm text-blue-700/80">{isEn ? 'We will send the tracking details as soon as the order ships.' : 'Enviamos o tracking assim que a encomenda for expedida.'}</p>
                                )}
                                {order.shipped_at ? (
                                  <p className="text-xs text-blue-700/70 mt-2">{isEn ? 'Shipped on' : 'Enviado em'} {formatDate(order.shipped_at, uiLocale)}</p>
                                ) : null}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap items-center justify-end gap-3">
                          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                            <Copy className="w-4 h-4" />
                            {isEn ? 'Copy Reference' : 'Copiar Referência'}
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
