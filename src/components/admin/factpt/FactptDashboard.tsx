"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CircleAlert, Clock3, FileCheck2, RefreshCw } from 'lucide-react';

import { supabaseBrowser } from '../../../lib/supabase-browser';
import FactptAttentionPanel from './FactptAttentionPanel';
import FactptDashboardSkeleton from './FactptDashboardSkeleton';
import FactptDocumentDrawer from './FactptDocumentDrawer';
import FactptDocumentsPanel, {
    EMPTY_DOCUMENT_FILTERS,
    matchesStatusFilter,
    type DocumentFilters,
    type StatusFilter,
} from './FactptDocumentsPanel';
import FactptKpiCard from './FactptKpiCard';
import { DEFAULT_PERIOD, periodToRange, type FactptPeriod } from './FactptPeriodPicker';
import FactptReconciliationPanel from './FactptReconciliationPanel';
import FactptToolbar from './FactptToolbar';
import {
    normalizeFactptOverview,
    type FactptEnvironment,
    type FactptOverview,
} from './types';
import { formatCount, formatTime } from './ui';

export default function FactptDashboard() {
    const [environment, setEnvironment] = useState<FactptEnvironment>('production');
    const [period, setPeriod] = useState<FactptPeriod>(DEFAULT_PERIOD);
    const [overview, setOverview] = useState<FactptOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<DocumentFilters>(EMPTY_DOCUMENT_FILTERS);
    const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

    const loadOverview = useCallback(async (quiet = false) => {
        if (!supabaseBrowser) {
            setError('A ligação à área administrativa não está disponível.');
            setLoading(false);
            return;
        }

        if (quiet) setRefreshing(true);
        else setLoading(true);
        setError(null);

        try {
            const { data: { session } } = await supabaseBrowser.auth.getSession();
            if (!session) throw new Error('A sessão de administrador expirou.');

            const params = new URLSearchParams({ environment });
            const range = periodToRange(period);
            if (range.from) params.set('from', range.from);
            if (range.to) params.set('to', range.to);

            const response = await fetch(`/api/admin/factpt/overview?${params}`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
                cache: 'no-store',
            });
            const body = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(body?.error || 'Não foi possível carregar a faturação.');
            }

            setOverview(normalizeFactptOverview(body));
        } catch (loadError) {
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : 'Não foi possível carregar a faturação.',
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [environment, period]);

    useEffect(() => {
        void loadOverview();
    }, [loadOverview]);

    const allDocuments = useMemo(() => overview?.documents || [], [overview?.documents]);

    const documents = useMemo(() => {
        const search = filters.search.trim().toLocaleLowerCase('pt');
        return allDocuments.filter((document) => {
            if (!matchesStatusFilter(document, filters.status)) return false;
            if (filters.source !== 'all' && document.sourceType !== filters.source) return false;
            if (!search) return true;

            const values = [
                document.factptNumber,
                document.sourceReference,
                document.customer.name,
                document.customer.email,
                document.customer.nif,
                document.sourceId,
            ];
            return values.some((value) => value?.toLocaleLowerCase('pt').includes(search));
        });
    }, [filters, allDocuments]);

    // Contagens dos atalhos: sempre sobre o período todo, não sobre o filtro ativo.
    const statusCounts = useMemo(() => {
        const counts = { all: allDocuments.length } as Record<StatusFilter, number>;
        for (const document of allDocuments) {
            counts[document.status] = (counts[document.status] || 0) + 1;
            if (document.status === 'failed' || document.status === 'email_failed') {
                counts.incidents = (counts.incidents || 0) + 1;
            }
        }
        return counts;
    }, [allDocuments]);

    const selectedDocument = allDocuments.find((document) => document.id === selectedDocumentId) || null;

    const clearFilters = () => setFilters(EMPTY_DOCUMENT_FILTERS);
    const hasFilters =
        filters.search !== EMPTY_DOCUMENT_FILTERS.search
        || filters.status !== EMPTY_DOCUMENT_FILTERS.status
        || filters.source !== EMPTY_DOCUMENT_FILTERS.source;

    if (loading && !overview) return <FactptDashboardSkeleton />;

    if (error && !overview) {
        return (
            <section className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-6 py-14 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 ring-1 ring-inset ring-rose-200/70">
                    <CircleAlert className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
                </span>
                <h2 className="mt-1 text-[19px] font-bold tracking-tight text-slate-900">Não foi possível abrir a faturação</h2>
                <p className="text-[14.5px] text-slate-500">{error}</p>
                <button
                    type="button"
                    onClick={() => void loadOverview()}
                    className="mt-2 inline-flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-[14.5px] font-semibold text-white transition-colors hover:bg-slate-800"
                >
                    <RefreshCw className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
                    Tentar novamente
                </button>
            </section>
        );
    }

    const kpis = overview?.kpis;
    const incidents = (kpis?.failures || 0) + (kpis?.emailFailures || 0);
    const awaitingEmission = (kpis?.awaitingApproval || 0) + (kpis?.pending || 0) + (kpis?.processing || 0);

    return (
        <div className="grid gap-5">
            <FactptToolbar
                environment={environment}
                onEnvironmentChange={setEnvironment}
                onRefresh={() => void loadOverview(true)}
                refreshing={refreshing}
                updatedAt={overview?.generatedAt ? formatTime(overview.generatedAt) : null}
            />

            {error && (
                <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-[14px] font-medium text-rose-700" role="alert">
                    <CircleAlert className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2} aria-hidden="true" />
                    <span>{error}</span>
                </div>
            )}

            {/* KPIs clicáveis: cada um filtra a lista abaixo */}
            <section className="grid grid-cols-2 gap-4 xl:grid-cols-4" aria-label="Resumo da faturação">
                <FactptKpiCard
                    label="Emitidas"
                    value={formatCount(kpis?.issued)}
                    detail={`${formatCount(kpis?.emailed)} enviadas por email`}
                    icon={FileCheck2}
                    tone="emerald"
                    active={filters.status === 'issued'}
                    onClick={() => setFilters((current) => ({
                        ...current,
                        status: current.status === 'issued' ? 'all' : 'issued',
                    }))}
                />
                <FactptKpiCard
                    label="Por emitir"
                    value={formatCount(awaitingEmission)}
                    detail={`${formatCount(kpis?.awaitingApproval)} aguardam aprovação`}
                    icon={Clock3}
                    tone={awaitingEmission > 0 ? 'amber' : 'slate'}
                    active={filters.status === 'awaiting_approval'}
                    onClick={() => setFilters((current) => ({
                        ...current,
                        status: current.status === 'awaiting_approval' ? 'all' : 'awaiting_approval',
                    }))}
                />
                <FactptKpiCard
                    label="Requer dados"
                    value={formatCount(kpis?.needsData)}
                    detail="Dados fiscais incompletos"
                    icon={CircleAlert}
                    tone={(kpis?.needsData || 0) > 0 ? 'amber' : 'slate'}
                    active={filters.status === 'needs_data'}
                    onClick={() => setFilters((current) => ({
                        ...current,
                        status: current.status === 'needs_data' ? 'all' : 'needs_data',
                    }))}
                />
                <FactptKpiCard
                    label="Incidentes"
                    value={formatCount(incidents)}
                    detail="Emissão ou envio por resolver"
                    icon={AlertTriangle}
                    tone={incidents > 0 ? 'rose' : 'emerald'}
                    active={filters.status === 'incidents'}
                    onClick={() => setFilters((current) => ({
                        ...current,
                        status: current.status === 'incidents' ? 'all' : 'incidents',
                    }))}
                />
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
                <FactptAttentionPanel
                    items={overview?.attention || []}
                    onOpenDocument={(documentId) => { if (documentId) setSelectedDocumentId(documentId); }}
                />
                {overview?.reconciliation && (
                    <FactptReconciliationPanel reconciliation={overview.reconciliation} />
                )}
            </div>

            <FactptDocumentsPanel
                documents={documents}
                filters={filters}
                onFiltersChange={setFilters}
                onClearFilters={clearFilters}
                hasFilters={hasFilters}
                counts={statusCounts}
                period={period}
                onPeriodChange={setPeriod}
                onSelect={setSelectedDocumentId}
            />

            <FactptDocumentDrawer
                document={selectedDocument}
                open={Boolean(selectedDocument)}
                onClose={() => setSelectedDocumentId(null)}
                onChanged={() => loadOverview(true)}
            />
        </div>
    );
}
