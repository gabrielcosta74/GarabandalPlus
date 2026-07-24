"use client";

import { useMemo, useState } from 'react';
import {
    ExternalLink,
    Eye,
    Laptop,
    RefreshCw,
    Save,
    Smartphone,
} from 'lucide-react';

type PreviewTabProps = {
    pilgrimageId: string;
    status?: string;
    slug?: string;
    saving: boolean;
    onSave: () => Promise<void>;
};

export default function PreviewTab({
    pilgrimageId,
    status,
    slug,
    saving,
    onSave,
}: PreviewTabProps) {
    const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
    const [refreshKey, setRefreshKey] = useState(0);
    const [savingPreview, setSavingPreview] = useState(false);

    const previewUrl = useMemo(() => {
        if (status !== 'draft' && slug?.trim()) {
            return `/peregrinacoes/${encodeURIComponent(slug.trim())}`;
        }
        return `/peregrinacoes/preview-admin?previewId=${encodeURIComponent(pilgrimageId)}`;
    }, [pilgrimageId, slug, status]);

    const refreshPreview = () => setRefreshKey((current) => current + 1);

    const saveAndRefresh = async () => {
        setSavingPreview(true);
        try {
            await onSave();
            refreshPreview();
        } finally {
            setSavingPreview(false);
        }
    };

    const isDraft = status === 'draft';
    const isBusy = saving || savingPreview;

    return (
        <div className="bg-slate-100">
            <div className="border-b border-slate-200 bg-white p-4 md:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                                <Eye className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">Página da peregrinação</h3>
                                <p className="text-xs text-slate-500">
                                    Mostra a última versão guardada exatamente como ficará para o visitante.
                                </p>
                            </div>
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                                isDraft
                                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            }`}>
                                {isDraft ? 'Rascunho privado' : 'Página pública'}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                            <button
                                type="button"
                                onClick={() => setViewport('desktop')}
                                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                                    viewport === 'desktop'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <Laptop className="h-4 w-4" />
                                Desktop
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewport('mobile')}
                                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                                    viewport === 'mobile'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <Smartphone className="h-4 w-4" />
                                Mobile
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={refreshPreview}
                            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Atualizar
                        </button>

                        <a
                            href={previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            <ExternalLink className="h-4 w-4" />
                            Abrir separador
                        </a>

                        <button
                            type="button"
                            onClick={saveAndRefresh}
                            disabled={isBusy}
                            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-100 transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Save className="h-4 w-4" />
                            {isBusy ? 'A guardar...' : 'Guardar e atualizar'}
                        </button>
                    </div>
                </div>

                {isDraft && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium leading-relaxed text-amber-900">
                        Esta pré-visualização exige sessão de administrador. A peregrinação continua em rascunho e não fica acessível ao público.
                    </div>
                )}
            </div>

            <div className="flex min-h-[720px] justify-center overflow-auto p-3 md:p-6">
                <div
                    className={`overflow-hidden bg-white shadow-2xl transition-[width] duration-300 ${
                        viewport === 'mobile'
                            ? 'w-[390px] max-w-full rounded-[2rem] border-[8px] border-slate-900'
                            : 'w-full rounded-2xl border border-slate-200'
                    }`}
                >
                    <iframe
                        key={`${previewUrl}-${refreshKey}`}
                        src={previewUrl}
                        title="Pré-visualização da página da peregrinação"
                        className="h-[780px] w-full bg-white"
                    />
                </div>
            </div>
        </div>
    );
}
