"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '../../../components/admin/AdminLayout';
import AdminStatCard from '../../../components/admin/AdminStatCard';
import AdminTable from '../../../components/admin/AdminTable';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { FileText, Activity, AlertTriangle, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';

type FactPtDoc = {
  id: string;
  source_type: 'store' | 'donation' | 'membership';
  source_ref: string;
  status: 'issued' | 'pending' | 'failed';
  factpt_document_id: string | null;
  factpt_url: string | null;
  created_at: string;
  error: string | null;
};

type OverviewStats = {
  total: number;
  issued: number;
  pending: number;
  failed: number;
  lastCreatedAt: string | null;
};

// Adapter for AdminTable
interface FactPtDocTableItem extends FactPtDoc { }

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString('pt-PT') : 'Sem emissões';

const typeLabels: Record<string, string> = {
  store: 'Venda',
  donation: 'Doação',
  membership: 'Quota',
};

const statusLabels: Record<string, string> = {
  issued: 'Emitido',
  pending: 'Pendente',
  failed: 'Erro',
};

export default function FactPtOverviewPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [recent, setRecent] = useState<FactPtDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinging, setPinging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<string | null>(null);

  const loadOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!supabaseBrowser) throw new Error('Supabase nao configurado no browser.');
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessao invalida. Faz login novamente.');

      const res = await fetch('/api/admin/factpt/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Erro ao carregar overview.');
      }
      const payload = await res.json();
      setStats(payload.stats || null);
      setRecent(payload.recent || []);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar overview.');
    } finally {
      setLoading(false);
    }
  };

  const handlePing = async () => {
    setPinging(true);
    setPingResult(null);
    try {
      if (!supabaseBrowser) throw new Error('Supabase nao configurado no browser.');
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessao invalida. Faz login novamente.');

      const res = await fetch('/api/admin/factpt/ping', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.message || 'Falha ao testar ligacao.');
      }
      setPingResult(`Ligado: ${payload.baseUrl} (${payload.count} taxas)`);
    } catch (err: any) {
      setPingResult(err?.message || 'Falha ao testar ligacao.');
    } finally {
      setPinging(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const columns = [
    {
      key: 'factpt_document_id', header: 'ID Documento', render: (item: FactPtDocTableItem) => (
        <span className="font-mono font-medium text-gray-900">{item.factpt_document_id || item.id.slice(0, 8)}</span>
      )
    },
    { key: 'created_at', header: 'Data', render: (item: FactPtDocTableItem) => formatDate(item.created_at) },
    {
      key: 'source_type', header: 'Origem', render: (item: FactPtDocTableItem) => (
        <span className="text-sm text-gray-600 capitalize">{typeLabels[item.source_type] || item.source_type}</span>
      )
    },
    {
      key: 'status', header: 'Estado', align: 'center' as const, render: (item: FactPtDocTableItem) => (
        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${item.status === 'issued' ? 'bg-green-50 text-green-700' :
            item.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
          }`}>
          {statusLabels[item.status] || item.status}
        </span>
      )
    },
  ];

  return (
    <AdminLayout title="Integração Fact.pt" isLoading={loading}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <AdminStatCard
          title="Total Emitido"
          value={stats?.total || 0}
          icon={FileText}
          color="blue"
        />
        <AdminStatCard
          title="Documentos ok"
          value={stats?.issued || 0}
          icon={CheckCircle}
          color="green"
        />
        <AdminStatCard
          title="Pendentes/Erro"
          value={(stats?.pending || 0) + (stats?.failed || 0)}
          subtitle={`${stats?.pending || 0} pendentes / ${stats?.failed || 0} falhados`}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Recent Docs */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold font-serif text-gray-900">Documentos Recentes</h2>
              <Link href="/admin/factpt/documentos" className="text-sm font-medium text-garabandal-gold hover:text-garabandal-dark">
                Ver Todos
              </Link>
            </div>
            <AdminTable
              data={recent}
              columns={columns}
              itemsPerPage={5}
              actions={(item) => (
                item.factpt_url ? (
                  <a
                    href={item.factpt_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-gray-400 hover:text-garabandal-gold hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                ) : null
              )}
            />
          </div>
        </div>

        <div className="space-y-6">
          {/* System Status */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-gray-400" /> Estado do Sistema
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-600">Última Emissão</span>
                <span className="text-sm font-medium">{formatDate(stats?.lastCreatedAt)}</span>
              </div>

              <button
                onClick={handlePing}
                disabled={pinging}
                className="w-full py-2 px-4 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
              >
                {pinging ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                Testar Ligação API
              </button>

              {pingResult && (
                <div className={`p-3 rounded-xl text-xs ${pingResult.includes('Falha') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                  {pingResult}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">Ações Rápidas</h3>
            <div className="space-y-2">
              <Link href="/admin/factpt/documentos" className="block w-full py-2 px-4 text-center bg-gray-50 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors text-sm">
                Gerir Documentos
              </Link>
              <Link href="/admin/factpt/relatorios" className="block w-full py-2 px-4 text-center bg-gray-50 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors text-sm">
                Exportar SAF-T
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
