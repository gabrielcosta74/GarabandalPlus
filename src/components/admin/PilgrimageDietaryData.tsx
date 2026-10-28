'use client';

import { useEffect, useState } from 'react';
import { Download, Loader2, RefreshCw, Search, Utensils } from 'lucide-react';
import { getBrowserAccessToken } from '../../lib/supabase-browser';
import type { DietaryRow } from '../../lib/pilgrimage-dietary';

export default function PilgrimageDietaryData({ pilgrimageId }: { pilgrimageId: string }) {
    const [rows, setRows] = useState<DietaryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('declared');
    const [revision, setRevision] = useState(0);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        async function load() {
            try {
                const token = await getBrowserAccessToken();
                const response = await fetch(`/api/admin/pilgrimages/${pilgrimageId}/dietary`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
                const body = await response.json();
                if (!response.ok) throw new Error(body.error || 'Erro ao carregar dados.');
                if (active) setRows(body.rows);
            } catch (loadError) {
                if (active) setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar dados.');
            } finally {
                if (active) setLoading(false);
            }
        }
        void load();
        return () => { active = false; };
    }, [pilgrimageId, revision]);

    async function download() {
        setDownloading(true);
        setError('');
        try {
            const token = await getBrowserAccessToken();
            const response = await fetch(`/api/admin/pilgrimages/${pilgrimageId}/dietary?format=csv`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
            if (!response.ok) throw new Error('Não foi possível exportar o CSV.');
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement('a');
            link.href = url;
            link.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'alergias-alimentares.csv';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (downloadError) {
            setError(downloadError instanceof Error ? downloadError.message : 'Erro ao exportar.');
        } finally {
            setDownloading(false);
        }
    }

    const declared = rows.filter(row => row.status === 'declared').length;
    const pending = rows.filter(row => row.status === 'pending').length;
    const needle = query.trim().toLocaleLowerCase('pt-PT');
    const filtered = rows.filter(row => (filter === 'all' || row.status === filter)
        && `${row.full_name} ${row.details}`.toLocaleLowerCase('pt-PT').includes(needle));

    return (
        <div className="space-y-5">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <h3 className="flex items-center gap-2 font-bold text-amber-950"><Utensils className="h-5 w-5" />Lista para hotéis e refeições</h3>
                <p className="mt-2 text-sm text-amber-900">{declared} com alergias/restrições · {rows.length - declared - pending} sem alergias/restrições · {pending} por preencher.</p>
                <p className="mt-2 text-sm text-amber-800">Os participantes podem atualizar os dados na sua inscrição. O CSV inclui todos os participantes com alergias ou restrições declaradas nesta peregrinação, ordenados por nome, para partilhar com os hotéis. Inscrições canceladas ou expiradas são excluídas.</p>
            </div>
            <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => setRevision(value => value + 1)} disabled={loading} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"><RefreshCw className="h-4 w-4" />Atualizar lista</button>
                <button type="button" onClick={download} disabled={loading || downloading || !declared} className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Exportar alergias (CSV)</button>
            </div>
            {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
            <div className="flex flex-col gap-3 sm:flex-row">
                <label className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2"><Search className="h-4 w-4 text-slate-400" /><input aria-label="Pesquisar nome ou alergia" value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisar nome ou alergia..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
                <select aria-label="Filtrar por estado alimentar" value={filter} onChange={event => setFilter(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="declared">Com alergias / restrições</option><option value="pending">Por preencher</option><option value="none">Sem alergias / restrições</option><option value="all">Todos os participantes</option></select>
            </div>
            {loading ? <div role="status" className="flex items-center gap-2 py-8 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />A carregar...</div> : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-600"><tr><th scope="col" className="p-4">Nome</th><th scope="col" className="p-4">Alergias alimentares / restrições</th><th scope="col" className="p-4">Inscrição</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">{filtered.map(row => <tr key={row.id}><td className="p-4 font-semibold text-slate-900">{row.full_name}</td><td className="whitespace-pre-wrap break-words p-4 text-slate-700">{row.details || (row.status === 'none' ? 'Sem alergias / restrições' : 'Por preencher')}</td><td className="p-4 font-mono text-xs text-slate-500">#{row.booking_id.slice(0, 8).toUpperCase()}</td></tr>)}{!filtered.length && <tr><td colSpan={3} className="p-8 text-center text-slate-500">Nenhum participante nesta lista.</td></tr>}</tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
