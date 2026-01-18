"use client";

import Link from 'next/link';
import AdminLayout from '../../../components/admin/AdminLayout';
import AdminStatCard from '../../../components/admin/AdminStatCard';
import AdminTable from '../../../components/admin/AdminTable';
import { CreditCard, Wallet, RotateCcw, CheckCircle, Clock, AlertCircle } from 'lucide-react';

// Mock data for payments - in a real scenario this would come from an API
const recentPayments = [
  { id: 'RNU-24081', method: 'MB WAY', amount: 16.50, status: 'paid', date: '2024-03-20', type: 'Quota' },
  { id: 'STR-18812', method: 'Cartão', amount: 25.00, status: 'paid', date: '2024-03-19', type: 'Loja' },
  { id: 'STR-18811', method: 'Cartão', amount: 12.00, status: 'failed', date: '2024-03-19', type: 'Donativo' },
  { id: 'RNU-24080', method: 'MB WAY', amount: 45.00, status: 'pending', date: '2024-03-18', type: 'Loja' },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

export default function AdminPagamentosPage() {
  const columns = [
    { key: 'id', header: 'Referência', render: (item: any) => <span className="font-mono font-medium">#{item.id}</span> },
    { key: 'date', header: 'Data', render: (item: any) => new Date(item.date).toLocaleDateString('pt-PT') },
    { key: 'type', header: 'Tipo', render: (item: any) => <span className="text-sm text-gray-600">{item.type}</span> },
    {
      key: 'method', header: 'Método', render: (item: any) => (
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-gray-400" />
          <span>{item.method}</span>
        </div>
      )
    },
    { key: 'amount', header: 'Valor', align: 'right' as const, render: (item: any) => <span className="font-bold text-gray-900">{formatCurrency(item.amount)}</span> },
    {
      key: 'status', header: 'Estado', align: 'center' as const, render: (item: any) => {
        const styles = {
          paid: 'bg-green-100 text-green-700 border-green-200',
          pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
          failed: 'bg-red-100 text-red-700 border-red-200',
        };
        const labels = {
          paid: 'Pago',
          pending: 'Pendente',
          failed: 'Falhou'
        };
        const style = (styles as any)[item.status] || styles.pending;
        return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style}`}>{(labels as any)[item.status] || item.status}</span>
      }
    }
  ];

  return (
    <AdminLayout title="Reconciliação Financeira">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <AdminStatCard
          title="Stripe"
          value="Ativo"
          trendLabel="0 falhas hoje"
          icon={CreditCard}
          color="purple"
        />
        <AdminStatCard
          title="Reduniq"
          value="Ativo"
          trendLabel="2 pendentes"
          icon={Wallet}
          color="blue"
        />
        <AdminStatCard
          title="Reembolsos"
          value="1"
          trendLabel="Em análise"
          icon={RotateCcw}
          color="gold"
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900 font-serif">Pagamentos Recentes</h2>
        <AdminTable
          data={recentPayments}
          columns={columns}
          itemsPerPage={10}
          actions={(item) => (
            <button className="text-sm font-medium text-garabandal-gold hover:text-garabandal-dark transition-colors">
              Detalhes
            </button>
          )}
        />
      </div>
    </AdminLayout>
  );
}
