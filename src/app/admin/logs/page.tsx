"use client";

import { useEffect, useState } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { FileText, Search, User } from 'lucide-react';

type AuditLog = {
    id: number;
    created_at: string;
    admin_email: string;
    action: string;
    target_id: string;
    details: any;
};

export default function AdminLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchLogs = async () => {
            if (!supabaseBrowser) return;
            const { data, error } = await supabaseBrowser
                .from('admin_audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (data) setLogs(data);
            setLoading(false);
        };
        fetchLogs();
    }, []);

    const filteredLogs = logs.filter(log =>
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.admin_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.target_id && log.target_id.includes(searchTerm))
    );

    return (
        <AdminLayout title="Audit Logs" isLoading={loading}>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <FileText className="w-6 h-6 text-gray-400" />
                        <h2 className="text-lg font-bold text-gray-900">Registo de Ações</h2>
                    </div>

                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-garabandal-gold/20"
                            placeholder="Pesquisar ação, admin..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3 rounded-l-lg">Data</th>
                                <th className="px-4 py-3">Admin</th>
                                <th className="px-4 py-3">Ação</th>
                                <th className="px-4 py-3">Detalhes</th>
                                <th className="px-4 py-3 rounded-r-lg">Target ID</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredLogs.map(log => (
                                <tr key={log.id} className="hover:bg-gray-50/50">
                                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                        {new Date(log.created_at).toLocaleString('pt-PT')}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <User className="w-3 h-3 text-gray-400" />
                                            <span className="font-medium text-gray-700">{log.admin_email}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-bold border border-blue-100">
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                                        {JSON.stringify(log.details)}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                                        {log.target_id || '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </AdminLayout>
    );
}
