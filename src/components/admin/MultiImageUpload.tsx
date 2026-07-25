"use client";

import { useState } from 'react';
import { Upload, X, Loader2, ArrowLeft, ArrowRight, Plus, Link as LinkIcon, Star } from 'lucide-react';
import { supabaseBrowser } from '../../lib/supabase-browser';

interface MultiImageUploadProps {
    value: string[];
    onChange: (urls: string[]) => void;
    bucket: string;
    path: string;
    label?: string;
}

export default function MultiImageUpload({ value, onChange, bucket, path, label }: MultiImageUploadProps) {
    const images = Array.isArray(value) ? value.filter(Boolean) : [];
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [urlDraft, setUrlDraft] = useState('');

    const uploadOne = async (file: File): Promise<string | null> => {
        if (!supabaseBrowser) return null;
        const extension = file.name.split('.').pop() || 'jpg';
        const filename = `${path}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${extension}`;
        const { error: upErr } = await supabaseBrowser.storage.from(bucket).upload(filename, file, { upsert: true });
        if (upErr) throw upErr;
        const { data } = supabaseBrowser.storage.from(bucket).getPublicUrl(filename);
        return data?.publicUrl ?? null;
    };

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const list = Array.from(files);
        setError(null);
        setProgress({ done: 0, total: list.length });
        const collected: string[] = [];
        try {
            for (let i = 0; i < list.length; i++) {
                const url = await uploadOne(list[i]);
                if (url) collected.push(url);
                setProgress({ done: i + 1, total: list.length });
            }
            if (collected.length) onChange([...images, ...collected]);
        } catch (err: unknown) {
            console.error('Upload failed:', err);
            setError(err instanceof Error ? err.message : 'Falha no upload');
        } finally {
            setProgress(null);
        }
    };

    const removeAt = (index: number) => onChange(images.filter((_, i) => i !== index));

    const move = (index: number, dir: -1 | 1) => {
        const target = index + dir;
        if (target < 0 || target >= images.length) return;
        const next = [...images];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };

    const addUrl = () => {
        const url = urlDraft.trim();
        if (!url) return;
        onChange([...images, url]);
        setUrlDraft('');
    };

    return (
        <div>
            {label && (
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
                    <span className="text-[10px] font-semibold text-slate-400">{images.length} foto(s)</span>
                </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {images.map((url, index) => (
                    <div
                        key={`${url}-${index}`}
                        className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />

                        {index === 0 && (
                            <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-yellow-400/95 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-yellow-950 shadow-sm">
                                <Star className="h-2.5 w-2.5" /> Capa
                            </span>
                        )}

                        <button
                            type="button"
                            onClick={() => removeAt(index)}
                            title="Remover"
                            className="absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>

                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1.5 pt-4 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                                type="button"
                                onClick={() => move(index, -1)}
                                disabled={index === 0}
                                title="Mover para trás"
                                className="rounded-md bg-white/20 p-1 text-white hover:bg-white/40 disabled:opacity-30"
                            >
                                <ArrowLeft className="h-3.5 w-3.5" />
                            </button>
                            <span className="text-[10px] font-bold text-white/90">{index + 1}</span>
                            <button
                                type="button"
                                onClick={() => move(index, 1)}
                                disabled={index === images.length - 1}
                                title="Mover para a frente"
                                className="rounded-md bg-white/20 p-1 text-white hover:bg-white/40 disabled:opacity-30"
                            >
                                <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                ))}

                {/* Add tile */}
                <label
                    className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-center transition-all ${progress ? 'border-slate-200 bg-slate-50 text-slate-300' : 'border-slate-300 bg-slate-50/60 text-slate-400 hover:border-yellow-300 hover:bg-yellow-50/40 hover:text-yellow-700'
                        }`}
                >
                    {progress ? (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-[10px] font-bold">{progress.done}/{progress.total}</span>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-0.5">
                                <Plus className="h-4 w-4" />
                                <Upload className="h-4 w-4" />
                            </div>
                            <span className="px-1 text-[10px] font-bold leading-tight">Adicionar fotos</span>
                        </>
                    )}
                    <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        multiple
                        disabled={!!progress}
                        onChange={(e) => {
                            handleFiles(e.target.files);
                            e.target.value = '';
                        }}
                    />
                </label>
            </div>

            {/* Add by URL (optional) */}
            <div className="mt-3 flex items-center gap-2">
                <div className="relative flex-1">
                    <LinkIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
                    <input
                        type="text"
                        value={urlDraft}
                        onChange={(e) => setUrlDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
                        placeholder="…ou colar URL de imagem"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
                    />
                </div>
                <button
                    type="button"
                    onClick={addUrl}
                    disabled={!urlDraft.trim()}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
                >
                    Adicionar
                </button>
            </div>

            <p className="mt-2 text-[10px] text-slate-400">
                A primeira foto é a <strong>capa</strong> do dia. Arrasta com as setas para ordenar o slideshow. Podes selecionar várias fotos de uma vez.
            </p>
            {error && <p className="mt-1 text-xs font-medium text-red-500">{error}</p>}
        </div>
    );
}
