"use client";

import { useEffect, useState } from 'react';
import AdminShell from '../AdminShell';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { KpiCard, RevenueDistWidget, RevenueTrendWidget, LowStockList, RevenueTrendData, RevenueDistData, RevenueStackedBarChart, TopItemsList } from '../../../components/admin/DashboardWidgets';
import { ShoppingCart, Heart, Activity, AlertTriangle, Bell, Check, ChevronRight, ChevronDown, Calendar, Filter, Award } from 'lucide-react';
import { useAdminNotifications } from '../../../context/AdminNotificationContext';
import Link from 'next/link';
import { format, subDays, startOfMonth, endOfMonth, startOfYear } from 'date-fns';
import { pt } from 'date-fns/locale';

interface DashboardV4Data {
  kpi: {
    revenue: { value: number, trend: number, prev: number };
    orders: { value: number, trend: number, prev: number };
    donations: { value: number, trend: number, prev: number };
    aov: { value: number, trend: number };
  };
  charts: {
    revenueOverTime: any[];
    revenueDistribution: RevenueDistData[];
  };
  tables: {
    recentTransactions: any[];
    lowStock: any[];
    topProducts: any[];
    topPilgrimages: any[];
  };
  meta: {
    from: string;
    to: string;
    prevFrom: string;
    prevTo: string;
  }
}

function NotificationsWidget() {
  const { notifications, markAsRead, isLoading } = useAdminNotifications();
  const unreadCount = notifications.filter(n => !n.read_at).length;
  // Show top 5
  const displayList = notifications.slice(0, 5);

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell size={20} className="text-garabandal-dark" />
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
          </div>
          <h3 className="text-lg font-bold text-slate-900">Notificações</h3>
        </div>
        <span className="text-xs font-medium text-slate-500">{unreadCount} novas</span>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-gray-400">A carregar...</p>
        ) : displayList.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Sem notificações recentes.</p>
        ) : (
          displayList.map((n) => (
            <div key={n.id} className={`flex gap-3 relative group ${!n.read_at ? 'bg-blue-50/50 -mx-2 px-2 py-2 rounded-lg' : ''}`}>
              <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${!n.read_at ? 'bg-blue-500' : 'bg-transparent'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!n.read_at ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>{n.title}</p>
                <p className="text-xs text-gray-500 line-clamp-1">{n.message}</p>
                {n.link && (
                  <Link
                    href={n.link}
                    onClick={() => !n.read_at && markAsRead(n.id)}
                    className="text-[10px] font-bold text-garabandal-gold hover:text-garabandal-dark mt-1 inline-flex items-center gap-0.5"
                  >
                    Ver <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
              {!n.read_at && (
                <button
                  onClick={() => markAsRead(n.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-green-600 absolute top-2 right-2"
                  title="Marcar como lida"
                >
                  <Check className="w-3 h-3" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// --- DATE RANGE DROPDOWN ---
function DateRangeDropdown({
  currentLabel,
  dateRange,
  onRangeChange
}: {
  currentLabel: string,
  dateRange: { from: Date, to: Date },
  onRangeChange: (val: any) => void
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Close when clicking outside
  useEffect(() => {
    const handleClick = () => setIsOpen(false);
    if (isOpen) window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [isOpen]);

  const options = [
    { label: 'Últimos 7 Dias', val: 7 },
    { label: 'Últimos 30 Dias', val: 30 },
    { label: 'Este Mês', val: 'month' },
    { label: 'Últimos 3 Meses', val: 90 },
    { label: 'Este Ano', val: 'year' },
    { label: 'Todo o Histórico', val: 'all' },
  ];

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 bg-white pl-4 pr-3 py-2 rounded-full shadow-sm border border-slate-200 hover:border-slate-300 transition-colors group"
      >
        <div className="flex items-center gap-2 text-slate-500">
          <Calendar size={15} />
          <span className="text-xs font-semibold uppercase tracking-wide">
            {format(dateRange.from, 'd MMM', { locale: pt })} - {format(dateRange.to, 'd MMM', { locale: pt })}
          </span>
        </div>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <div className="flex items-center gap-2 text-slate-700">
          <span className="text-xs font-bold">{currentLabel}</span>
          <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
          {options.map((opt) => (
            <button
              key={opt.label}
              onClick={() => {
                onRangeChange(opt.val);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors flex items-center justify-between
                ${currentLabel === opt.label ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
              `}
            >
              {opt.label}
              {currentLabel === opt.label && <Check size={12} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import useSWR from 'swr';

const fetcher = async (url: string) => {
  const { data: { session } } = await supabaseBrowser.auth.getSession();
  if (!session) throw new Error("No session");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session.access_token}` }
  });

  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

export default function AdminDashboardPage() {
  // Date Filters
  const [rangeLabel, setRangeLabel] = useState('Últimos 30 Dias');
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date()
  });

  const params = new URLSearchParams({
    from: dateRange.from.toISOString(),
    to: dateRange.to.toISOString()
  });

  const { data, error, isLoading } = useSWR<DashboardV4Data>(
    `/api/admin/dashboard?${params.toString()}`,
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false // Don't aggressive refresh on window focus
    }
  );

  const loading = isLoading && !data; // Only show spinner if no data at all (initial load)

  const handleRangeChange = (days: number | 'month' | 'year' | 'all') => {
    const now = new Date();
    let from = subDays(now, 30);
    let label = 'Últimos 30 Dias';

    if (typeof days === 'number') {
      from = subDays(now, days);
      label = `Últimos ${days} Dias`;
    } else if (days === 'month') {
      from = startOfMonth(now);
      label = 'Este Mês';
    } else if (days === 'year') {
      from = startOfYear(now);
      label = 'Este Ano';
    } else if (days === 'all') { // "All" is tricky, let's use a far back date
      from = new Date('2024-01-01');
      label = 'Todo o Histórico';
    }

    setRangeLabel(label);
    setDateRange({ from, to: now });
  };


  if (loading && !data) {
    return (
      <AdminShell title="Visão Geral" description="Carregando dados...">
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminShell>
    );
  }

  // Fallback defaults if API fails or returns nulls
  const kpi = data?.kpi || { revenue: { value: 0, trend: 0, prev: 0 }, orders: { value: 0, trend: 0, prev: 0 }, donations: { value: 0, trend: 0, prev: 0 }, aov: { value: 0, trend: 0 } };

  return (
    <AdminShell
      title="Visão Geral"
      description="Painel de controlo financeiro e operacional"
    >
      {/* HEADER CONTROLS */}
      <div className="flex justify-end mb-8 -mt-16 relative z-10">
        <DateRangeDropdown
          currentLabel={rangeLabel}
          dateRange={dateRange}
          onRangeChange={handleRangeChange}
        />
      </div>


      {/* 1. KEY METRICS GRID */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <KpiCard title="Volume Total (Bruto)" value={kpi.revenue.value} trend={kpi.revenue.trend} />
        <KpiCard title="Encomendas" value={kpi.orders.value} trend={kpi.orders.trend} prefix="" />
        <KpiCard title="Doações" value={kpi.donations.value} trend={kpi.donations.trend} />
        <KpiCard title="Ticket Médio (Loja)" value={kpi.aov.value} trend={0} />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* 2. MAIN CHART AREA (Left 2/3) */}
        <div className="xl:col-span-2 space-y-8">

          {/* Revenue Stacked Bar - NEW */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">

            {loading && <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center"><div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" /></div>}

            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Origem de Receita Diária</h3>
                <p className="text-xs text-slate-500">Distribuição acumulada por dia e fonte</p>
              </div>
            </div>
            <RevenueStackedBarChart data={data?.charts.revenueOverTime || []} />
          </div>

          {/* Top Performance Lists - NEW */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <ShoppingCart size={16} className="text-blue-500" /> Produtos Mais Vendidos
              </h3>
              <TopItemsList items={data?.tables.topProducts || []} type="product" />
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Activity size={16} className="text-amber-500" /> Top Peregrinações
              </h3>
              <TopItemsList items={data?.tables.topPilgrimages || []} type="pilgrimage" />
            </div>
          </div>


          {/* Recent Transactions Feed */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Actividade Recente</h3>
            <div className="space-y-0">
              {data?.tables.recentTransactions?.map((tx: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'shop' ? 'bg-blue-50 text-blue-600' :
                      tx.type === 'donation' ? 'bg-rose-50 text-rose-600' :
                        tx.type === 'quota' ? 'bg-violet-50 text-violet-600' :
                          'bg-amber-50 text-amber-600'
                      }`}>
                      {tx.type === 'shop' && <ShoppingCart size={18} />}
                      {tx.type === 'donation' && <Heart size={18} />}
                      {tx.type === 'booking' && <Activity size={18} />}
                      {tx.type === 'quota' && <Award size={18} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{tx.customer_name || 'Desconhecido'}</p>
                      <p className="text-xs text-slate-500 capitalize">{tx.label} • {new Date(tx.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">€{Number(tx.amount).toFixed(2)}</p>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${['succeeded', 'paid', 'verified', 'pago'].includes(tx.status) ? 'bg-emerald-50 text-emerald-600' :
                      ['pending', 'processing'].includes(tx.status) ? 'bg-amber-50 text-amber-600' :
                        'bg-slate-50 text-slate-500'
                      }`}>
                      {(() => {
                        const s = (tx.status || '').toLowerCase();
                        if (s === 'paid' || s === 'succeeded' || s === 'pago') return 'PAGO';
                        if (s === 'verified') return 'VERIFICADO';
                        if (s === 'pending') return 'PENDENTE';
                        if (s === 'processing') return 'PROCESSANDO';
                        if (s === 'failed') return 'FALHOU';
                        if (s === 'canceled') return 'CANCELADO';
                        return s;
                      })()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. SIDEBAR AREA (Right 1/3) */}
        <div className="space-y-8">
          {/* Notifications Widget */}
          <NotificationsWidget />

          {/* Distributions */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Origem de Receita</h3>
            <p className="text-xs text-slate-400 mb-6">Distribuição total no período seleccionado</p>
            <RevenueDistWidget data={data?.charts.revenueDistribution || []} />
          </div>

          {/* Stock Alerts */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={20} className="text-amber-500" />
              <h3 className="text-lg font-bold text-slate-900">Alertas de Stock</h3>
            </div>
            <LowStockList items={data?.tables.lowStock || []} />
          </div>
        </div>

      </div>
    </AdminShell>
  );
}
