"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { useRouter } from 'next/navigation';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminStatCard from '../../components/admin/AdminStatCard';
import AdminTable from '../../components/admin/AdminTable';
import {
  Users,
  CreditCard,
  ShoppingBag,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Search
} from 'lucide-react';
import styles from './page.module.css';

type Order = {
  id: string; // Required for AdminTable
  order_ref: string;
  buyer_name: string;
  buyer_email: string;
  total_amount: number;
  status: string;
  created_at: string;
};

type Dashboard = {
  totalOrders: number;
  totalRevenue: number;
  lowStock: Array<{ product_id: string; name: string; stock: number }>;
  recentOrders: Order[];
  totalMembers: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [login, setLogin] = useState({ email: 'geral@apostoladodegarabandal.com', password: '' });
  const router = useRouter();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!supabaseBrowser) throw new Error('Supabase nao configurado.');
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessao invalida.');

      const [ordersRes, dashboardRes, membersRes] = await Promise.all([
        fetch('/api/admin/orders', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/dashboard', { headers: { Authorization: `Bearer ${token}` } }),
        supabaseBrowser.from('membros').select('id', { count: 'exact', head: true })
      ]);

      if (!ordersRes.ok || !dashboardRes.ok) throw new Error('Falha ao carregar dados.');

      const ordersData = await ordersRes.json();
      const dashboardData = await dashboardRes.json();

      setOrders(ordersData.orders || []);
      setDashboard({
        ...dashboardData,
        totalMembers: membersRes.count || 0
      });

    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      if (!supabaseBrowser) {
        setSessionReady(true);
        return;
      }
      const { data } = await supabaseBrowser.auth.getSession();
      const email = data.session?.user?.email || null;
      setSessionEmail(email);
      setSessionReady(true);
      if (email) {
        await loadData();
      }
    };
    init();
  }, []);

  const handleLogin = async () => {
    if (!supabaseBrowser) return;
    setError(null);
    const { error: signInError } = await supabaseBrowser.auth.signInWithPassword({
      email: login.email.trim(),
      password: login.password,
    });
    if (signInError) {
      setError(signInError.message);
      return;
    }
    const { data } = await supabaseBrowser.auth.getSession();
    const email = data.session?.user?.email || null;
    setSessionEmail(email);
    await loadData();
  };

  const recentOrders = useMemo(() => {
    if (dashboard?.recentOrders?.length) return dashboard.recentOrders;
    return orders.slice(0, 5);
  }, [dashboard, orders]);

  if (!sessionReady) return <AdminLayout isLoading title="Dashboard">{null}</AdminLayout>;

  if (!sessionEmail) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="w-16 h-16 mx-auto bg-garabandal-dark rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-garabandal-dark/20">
            <span className="text-garabandal-gold font-serif text-3xl font-bold">G</span>
          </div>
          <h2 className="text-center text-3xl font-serif font-bold text-gray-900">
            Acesso Administrativo
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Esta área é restrita a administradores.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-xl border border-gray-100 sm:rounded-2xl sm:px-10">
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <div className="mt-1">
                  <input
                    type="email"
                    value={login.email}
                    onChange={(e) => setLogin({ ...login, email: e.target.value })}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-garabandal-gold focus:border-garabandal-gold sm:text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <div className="mt-1">
                  <input
                    type="password"
                    value={login.password}
                    onChange={(e) => setLogin({ ...login, password: e.target.value })}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-garabandal-gold focus:border-garabandal-gold sm:text-sm transition-all"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-4 border border-red-100">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-garabandal-dark hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-garabandal-dark transition-all transform hover:scale-[1.02]"
              >
                Entrar em Sistema
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const columns = [
    { key: 'order_ref', header: 'ID', render: (item: Order) => <span className="font-mono font-medium">#{item.order_ref}</span> },
    { key: 'created_at', header: 'Data', render: (item: Order) => new Date(item.created_at).toLocaleDateString('pt-PT') },
    {
      key: 'buyer', header: 'Cliente', render: (item: Order) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-900">{item.buyer_name || 'N/A'}</span>
          <span className="text-xs text-gray-500">{item.buyer_email}</span>
        </div>
      )
    },
    { key: 'total_amount', header: 'Valor', align: 'right' as const, render: (item: Order) => <span className="font-bold text-gray-900">{formatCurrency(item.total_amount)}</span> },
    {
      key: 'status', header: 'Estado', align: 'center' as const, render: (item: Order) => {
        const status = item.status || 'pending';
        const styles = {
          paid: 'bg-green-100 text-green-700 border-green-200',
          succeeded: 'bg-green-100 text-green-700 border-green-200',
          pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
          failed: 'bg-red-100 text-red-700 border-red-200',
          canceled: 'bg-gray-100 text-gray-700 border-gray-200'
        };
        const style = (styles as any)[status] || styles.pending;
        return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style}`}>{status}</span>
      }
    }
  ];

  const lowStockColumns = [
    { key: 'name', header: 'Produto', render: (item: any) => <span className="font-medium text-gray-900">{item.name}</span> },
    { key: 'stock', header: 'Stock', align: 'right' as const, render: (item: any) => <span className="text-red-600 font-bold">{item.stock}</span> }
  ];

  return (
    <AdminLayout title="Dashboard" userEmail={sessionEmail} isLoading={loading}>
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <AdminStatCard
          title="Receita Total"
          value={formatCurrency(dashboard?.totalRevenue || 0)}
          icon={TrendingUp}
          color="gold"
          trend={12.5}
          trendLabel="vs mês anterior"
        />
        <AdminStatCard
          title="Total Membros"
          value={dashboard?.totalMembers || 0}
          icon={Users}
          color="blue"
        />
        <AdminStatCard
          title="Encomendas"
          value={dashboard?.totalOrders || 0}
          icon={ShoppingBag}
          color="purple"
        />
        <AdminStatCard
          title="Stock Crítico"
          value={dashboard?.lowStock?.length || 0}
          icon={AlertTriangle}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Recent Orders */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 font-serif">Encomendas Recentes</h2>
            <Link href="/admin/encomendas" className="text-sm font-medium text-garabandal-gold hover:text-garabandal-dark flex items-center gap-1 transition-colors">
              Ver todas <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <AdminTable
            data={recentOrders}
            columns={columns}
            itemsPerPage={5}
          />
        </div>

        {/* Low Stock */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 font-serif">Alerta de Stock</h2>
            <Link href="/admin/loja" className="text-sm font-medium text-garabandal-gold hover:text-garabandal-dark flex items-center gap-1 transition-colors">
              Gerir <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm h-fit">
            {dashboard?.lowStock && dashboard.lowStock.length > 0 ? (
              <div className="space-y-3">
                {dashboard?.lowStock.slice(0, 5).map((item) => (
                  <div key={item.product_id} className="flex items-center justify-between p-3 bg-red-50/50 rounded-xl border border-red-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{item.name}</p>
                      <p className="text-xs text-red-500">ID: {item.product_id}</p>
                    </div>
                    <span className="text-sm font-bold text-red-600 bg-white px-2 py-1 rounded-lg border border-red-100 shadow-sm">
                      {item.stock} un
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Stock em dia!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
