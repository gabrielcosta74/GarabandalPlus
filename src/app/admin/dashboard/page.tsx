"use client";

import { useEffect, useState } from 'react';
import AdminShell from '../AdminShell';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { KpiCard, RevenueDistWidget, RevenueTrendWidget, LowStockList, RevenueTrendData, RevenueDistData } from '../../../components/admin/DashboardWidgets';
import { ShoppingCart, Heart, Activity, AlertTriangle, Bell, Check, ChevronRight } from 'lucide-react';
import { useAdminNotifications } from '../../../context/AdminNotificationContext';
import Link from 'next/link';

interface DashboardV2Data {
  kpi: {
    revenue: { value: number, trend: number, last30: number };
    orders: { value: number, trend: number, last30: number };
    donations: { value: number, trend: number, last30: number };
    aov: { value: number, trend: number };
  };
  charts: {
    revenueTrend: RevenueTrendData[];
    revenueDistribution: RevenueDistData[];
  };
  tables: {
    recentTransactions: any[];
    lowStock: any[];
  };
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

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardV2Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <AdminShell title="Visão Geral" description="Carregando painel...">
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminShell>
    );
  }

  // Fallback defaults if API fails or returns nulls
  const kpi = data?.kpi || { revenue: { value: 0, trend: 0, last30: 0 }, orders: { value: 0, trend: 0, last30: 0 }, donations: { value: 0, trend: 0, last30: 0 }, aov: { value: 0, trend: 0 } };

  return (
    <AdminShell
      title="Visão Geral"
      description="Painel de controlo financeiro e operacional"
    >
      {/* 1. KEY METRICS GRID */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <KpiCard title="Volume Total (Bruto)" value={kpi.revenue.value} trend={kpi.revenue.trend} />
        <KpiCard title="Encomendas (30d)" value={kpi.orders.last30} trend={kpi.orders.trend} prefix="" />
        <KpiCard title="Doações (30d)" value={kpi.donations.last30} trend={kpi.donations.trend} />
        <KpiCard title="Ticket Médio (Loja)" value={kpi.aov.value} trend={0} />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* 2. MAIN CHART AREA (Left 2/3) */}
        <div className="xl:col-span-2 space-y-8">
          {/* Revenue Trend */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Evolução Financeira</h3>
                <p className="text-sm text-slate-500">Receita bruta diária e volume de transações (30 dias)</p>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg">
                <Activity size={20} className="text-slate-400" />
              </div>
            </div>
            <RevenueTrendWidget data={data?.charts.revenueTrend || []} />
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
                        'bg-amber-50 text-amber-600'
                      }`}>
                      {tx.type === 'shop' && <ShoppingCart size={18} />}
                      {tx.type === 'donation' && <Heart size={18} />}
                      {tx.type === 'booking' && <Activity size={18} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{tx.customer_name || 'Desconhecido'}</p>
                      <p className="text-xs text-slate-500 capitalize">{tx.label} • {new Date(tx.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">€{Number(tx.amount).toFixed(2)}</p>
                    <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {tx.status}
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
            <p className="text-xs text-slate-400 mb-6">Distribuição por categoria (Mês actual vs total)</p>
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
