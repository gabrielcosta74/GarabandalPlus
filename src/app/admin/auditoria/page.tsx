"use client";

import { useEffect, useState } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import AdminTable from '../../../components/admin/AdminTable';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { Shield, Clock, Search } from 'lucide-react';

type AuditLog = {
  id: string;
  admin_email: string | null;
  member_id: string | null;
  action: string;
  details: unknown | null;
  created_at: string;
};

// Adapter for AdminTable
interface AuditLogTableItem extends AuditLog { }

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-PT', { dateStyle: 'medium', timeStyle: 'short' });
};

const formatDetails = (details: unknown) => {
  if (!details) return '-';
  try {
    const raw = typeof details === 'string' ? details : JSON.stringify(details);
    if (raw.length <= 60) return raw;
    return `${raw.slice(0, 57)}...`;
  } catch {
    return '-';
  }
};

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!supabaseBrowser) throw new Error('Supabase nao configurado no browser.');
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Sessao invalida. Faz login novamente.');

      const res = await fetch('/api/admin/audit-logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Erro ao carregar auditoria.');
      }
      const payload = await res.json();
      setLogs(payload.logs || []);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar auditoria.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const columns = [
    {
      key: 'created_at', header: 'Data', render: (item: AuditLogTableItem) => (
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-gray-400" />
          <span className="text-gray-600 tabular-nums">{formatDate(item.created_at)}</span>
        </div>
      )
    },
    {
      key: 'action', header: 'Ação', render: (item: AuditLogTableItem) => (
        <span className="font-medium text-gray-900 bg-gray-100 px-2 py-1 rounded-md text-xs uppercase tracking-wide">
          {item.action}
        </span>
      )
    },
    {
      key: 'admin_email', header: 'Admin', render: (item: AuditLogTableItem) => (
        <span className="text-gray-700">{item.admin_email || '—'}</span>
      )
    },
    {
      key: 'member_id', header: 'Membro Alvo', render: (item: AuditLogTableItem) => (
        <span className="font-mono text-xs text-gray-500">{item.member_id || '—'}</span>
      )
    },
    {
      key: 'details', header: 'Detalhes', render: (item: AuditLogTableItem) => (
        <span className="text-gray-500 text-xs font-mono" title={JSON.stringify(item.details)}>{formatDetails(item.details)}</span>
      )
    },
  ];

  return (
    <AdminLayout title="Auditoria de Sistema" isLoading={loading}>
      <div className="mb-6 flex justify-between items-center">
        <p className="text-gray-500 text-sm">Registo de todas as ações administrativas sensíveis.</p>
        <button
          onClick={loadLogs}
          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
        >
          Atualizar Logs
        </button>
      </div>

      {error ? <div className="p-4 bg-red-50 text-red-600 rounded-lg mb-4">{error}</div> : null}

      <AdminTable
        data={logs}
        columns={columns}
        itemsPerPage={15}
      />
    </AdminLayout>
  );
}
