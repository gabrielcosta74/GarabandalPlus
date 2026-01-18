"use client";

import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import AdminStatCard from '../../../components/admin/AdminStatCard';
import AdminTable from '../../../components/admin/AdminTable';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { FileText, Download, TrendingUp, Calendar, AlertCircle } from 'lucide-react';

type ReportRow = {
  id: string;
  kind: 'pdf' | 'csv';
  report_month: number;
  report_year: number;
  period_start: string;
  period_end: string;
  file_path: string;
  created_at: string;
  total_orders: number | null;
  total_revenue: number | null;
  currency: string | null;
  download_url: string | null;
};

// Adapter for AdminTable
interface ReportTableItem extends ReportRow { }

const formatMonthLabel = (month: number, year: number) => {
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
};

const formatCurrency = (value: number, currency = 'EUR') =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(value);

export default function AdminRelatoriosPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getUTCMonth() + 1);
  const [year, setYear] = useState(today.getUTCFullYear());
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, index) => ({
        value: index + 1,
        label: formatMonthLabel(index + 1, year),
      })),
    [year],
  );

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!supabaseBrowser) throw new Error('Supabase nao configurado no browser.');
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessao invalida. Faz login novamente.');

      const res = await fetch('/api/admin/reports', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Erro ao carregar relatórios.');
      }
      const payload = await res.json();
      setReports(payload.reports || []);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar relatórios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleExport = async (kind: 'pdf' | 'csv') => {
    setExporting(kind);
    setError(null);
    try {
      if (!supabaseBrowser) throw new Error('Supabase nao configurado no browser.');
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessao invalida. Faz login novamente.');

      const res = await fetch('/api/admin/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ month, year, kind }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Erro ao exportar relatório.');
      }

      const payload = await res.json();
      if (payload?.file?.downloadUrl) {
        window.open(payload.file.downloadUrl, '_blank');
      }
      await loadReports();
    } catch (err: any) {
      setError(err?.message || 'Erro ao exportar relatório.');
    } finally {
      setExporting(null);
    }
  };

  const columns = [
    {
      key: 'report_month', header: 'Mês', render: (item: ReportTableItem) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
          <span className="font-medium text-gray-900 capitalize">{formatMonthLabel(item.report_month, item.report_year)}</span>
        </div>
      )
    },
    {
      key: 'kind', header: 'Tipo', align: 'center' as const, render: (item: ReportTableItem) => (
        <span className="uppercase text-xs font-bold tracking-wider text-gray-500 bg-gray-100 px-2 py-1 rounded">
          {item.kind}
        </span>
      )
    },
    { key: 'total_orders', header: 'Encomendas', align: 'center' as const, render: (item: ReportTableItem) => <span className="font-mono">{item.total_orders || 0}</span> },
    { key: 'total_revenue', header: 'Receita', align: 'right' as const, render: (item: ReportTableItem) => <span className="font-bold text-gray-900">{formatCurrency(item.total_revenue || 0, item.currency || 'EUR')}</span> },
  ];

  return (
    <AdminLayout title="Relatórios Financeiros" isLoading={loading}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Generation Panel */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold font-serif text-gray-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-garabandal-gold" />
            Gerar Relatório
          </h2>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mês</label>
                <select
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-garabandal-gold/20 focus:outline-none"
                  value={month}
                  onChange={(event) => setMonth(Number(event.target.value))}
                >
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ano</label>
                <select
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-garabandal-gold/20 focus:outline-none"
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value))}
                >
                  {Array.from({ length: 5 }).map((_, idx) => {
                    const value = today.getUTCFullYear() - idx;
                    return (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
                type="button"
                onClick={() => handleExport('csv')}
                disabled={!!exporting}
              >
                {exporting === 'csv' ? <span className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full" /> : <FileText className="w-4 h-4" />}
                Exportar CSV
              </button>
              <button
                className="flex-1 px-4 py-3 bg-garabandal-dark text-white font-medium rounded-xl hover:bg-gray-900 shadow-lg shadow-garabandal-dark/20 transition-all flex items-center justify-center gap-2"
                type="button"
                onClick={() => handleExport('pdf')}
                disabled={!!exporting}
              >
                {exporting === 'pdf' ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Download className="w-4 h-4" />}
                Gerar PDF
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Recent Reports List represented as a simplified table or just the table component */}
        <div>
          <h2 className="text-lg font-bold font-serif text-gray-900 mb-6">Histórico</h2>
          <AdminTable
            data={reports}
            columns={columns}
            itemsPerPage={5}
            actions={(item) => (
              <a
                href={item.download_url || '#'}
                target="_blank"
                rel="noreferrer"
                className={`p-2 rounded-lg transition-colors ${item.download_url ? 'text-garabandal-gold hover:bg-garabandal-gold/10' : 'text-gray-300 cursor-not-allowed'}`}
              >
                <Download className="w-4 h-4" />
              </a>
            )}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
