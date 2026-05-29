"use client";

import { useRef, useState } from 'react';
import { Upload, X, Loader2, ImagePlus, FilmIcon, ArrowUp, ArrowDown, GripVertical, AlertCircle } from 'lucide-react';
import { supabaseBrowser } from '../../../../lib/supabase-browser';

type Kind = 'image' | 'video';

interface AuctionMediaManagerProps {
    images: string[];
    videos: string[];
    onChange: (next: { images: string[]; videos: string[] }) => void;
}

const BUCKET = 'auction-media';
const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 50;

function fileExt(name: string, fallback: string) {
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : fallback;
}

export default function AuctionMediaManager({ images, videos, onChange }: AuctionMediaManagerProps) {
    const [uploadingImages, setUploadingImages] = useState(false);
    const [uploadingVideos, setUploadingVideos] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const dragSrc = useRef<{ kind: Kind; index: number } | null>(null);

    const uploadFiles = async (files: File[], kind: Kind) => {
        if (!supabaseBrowser || files.length === 0) return;

        const maxMB = kind === 'image' ? MAX_IMAGE_MB : MAX_VIDEO_MB;
        const tooBig = files.find(f => f.size > maxMB * 1024 * 1024);
        if (tooBig) {
            setError(`O ficheiro "${tooBig.name}" excede ${maxMB}MB.`);
            return;
        }

        setError(null);
        if (kind === 'image') setUploadingImages(true); else setUploadingVideos(true);
        setUploadProgress({ done: 0, total: files.length });

        const uploaded: string[] = [];
        try {
            for (let i = 0; i < files.length; i += 1) {
                const file = files[i];
                const ext = fileExt(file.name, kind === 'image' ? 'jpg' : 'mp4');
                const path = `${kind}s/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;

                const { error: upErr } = await supabaseBrowser.storage
                    .from(BUCKET)
                    .upload(path, file, { upsert: false, contentType: file.type });
                if (upErr) throw upErr;

                const { data } = supabaseBrowser.storage.from(BUCKET).getPublicUrl(path);
                if (data?.publicUrl) uploaded.push(data.publicUrl);

                setUploadProgress({ done: i + 1, total: files.length });
            }

            if (kind === 'image') {
                onChange({ images: [...images, ...uploaded], videos });
            } else {
                onChange({ images, videos: [...videos, ...uploaded] });
            }
        } catch (err: any) {
            console.error('[AuctionMediaManager] upload failed', err);
            setError(err?.message || 'Falha no carregamento.');
        } finally {
            setUploadingImages(false);
            setUploadingVideos(false);
            setUploadProgress(null);
            if (imageInputRef.current) imageInputRef.current.value = '';
            if (videoInputRef.current) videoInputRef.current.value = '';
        }
    };

    const removeAt = async (kind: Kind, index: number) => {
        const list = kind === 'image' ? images : videos;
        const url = list[index];
        const next = list.filter((_, i) => i !== index);

        if (kind === 'image') onChange({ images: next, videos });
        else onChange({ images, videos: next });

        if (supabaseBrowser && url?.includes(`/${BUCKET}/`)) {
            try {
                const path = url.split(`/${BUCKET}/`)[1]?.split('?')[0];
                if (path) await supabaseBrowser.storage.from(BUCKET).remove([path]);
            } catch (err) {
                console.warn('[AuctionMediaManager] cleanup failed', err);
            }
        }
    };

    const move = (kind: Kind, from: number, to: number) => {
        const list = kind === 'image' ? [...images] : [...videos];
        if (to < 0 || to >= list.length) return;
        const [moved] = list.splice(from, 1);
        list.splice(to, 0, moved);
        if (kind === 'image') onChange({ images: list, videos });
        else onChange({ images, videos: list });
    };

    const onDragStart = (kind: Kind, index: number) => {
        dragSrc.current = { kind, index };
    };
    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };
    const onDrop = (kind: Kind, index: number) => {
        const src = dragSrc.current;
        dragSrc.current = null;
        if (!src || src.kind !== kind || src.index === index) return;
        move(kind, src.index, index);
    };

    const busy = uploadingImages || uploadingVideos;

    return (
        <div className="space-y-5">
            {/* Images */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <ImagePlus className="w-4 h-4 text-slate-500" />
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Imagens {images.length > 0 && <span className="text-slate-400 normal-case">({images.length})</span>}
                        </label>
                    </div>
                    <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${uploadingImages ? 'bg-slate-200 text-slate-400 cursor-wait' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}>
                        {uploadingImages ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {uploadingImages
                            ? (uploadProgress ? `A enviar ${uploadProgress.done}/${uploadProgress.total}` : 'A enviar...')
                            : 'Carregar imagens'}
                        <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            disabled={busy}
                            onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                if (files.length) uploadFiles(files, 'image');
                            }}
                        />
                    </label>
                </div>

                {images.length === 0 ? (
                    <div className="text-sm text-slate-400 text-center py-6 border-2 border-dashed border-slate-200/60 rounded-xl">
                        Ainda sem imagens. Carregue uma ou várias de uma vez.
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {images.map((url, idx) => (
                            <div
                                key={`${url}-${idx}`}
                                className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group bg-white"
                                draggable
                                onDragStart={() => onDragStart('image', idx)}
                                onDragOver={onDragOver}
                                onDrop={() => onDrop('image', idx)}
                            >
                                <img src={url} alt="" className="w-full h-full object-cover" />
                                {idx === 0 && (
                                    <span className="absolute top-1 left-1 bg-yellow-500 text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow">
                                        Capa
                                    </span>
                                )}
                                <span className="absolute top-1 right-1 bg-white/90 text-slate-600 cursor-grab active:cursor-grabbing p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                    <GripVertical className="w-3 h-3" />
                                </span>
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-1.5 flex items-center justify-between gap-1">
                                    <div className="flex gap-1">
                                        <button
                                            type="button"
                                            disabled={idx === 0}
                                            onClick={() => move('image', idx, idx - 1)}
                                            className="p-1 bg-white/20 hover:bg-white/40 rounded text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                            title="Mover para a esquerda"
                                        >
                                            <ArrowUp className="w-3 h-3 -rotate-90" />
                                        </button>
                                        <button
                                            type="button"
                                            disabled={idx === images.length - 1}
                                            onClick={() => move('image', idx, idx + 1)}
                                            className="p-1 bg-white/20 hover:bg-white/40 rounded text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                            title="Mover para a direita"
                                        >
                                            <ArrowDown className="w-3 h-3 -rotate-90" />
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeAt('image', idx)}
                                        className="p-1 bg-red-500/80 hover:bg-red-500 rounded text-white"
                                        title="Remover"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <p className="text-[11px] text-slate-400 mt-2">
                    A primeira imagem é a capa. Arraste ou use as setas para reordenar.
                </p>
            </div>

            {/* Videos */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <FilmIcon className="w-4 h-4 text-slate-500" />
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Vídeos {videos.length > 0 && <span className="text-slate-400 normal-case">({videos.length})</span>}
                        </label>
                    </div>
                    <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${uploadingVideos ? 'bg-slate-200 text-slate-400 cursor-wait' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}>
                        {uploadingVideos ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {uploadingVideos
                            ? (uploadProgress ? `A enviar ${uploadProgress.done}/${uploadProgress.total}` : 'A enviar...')
                            : 'Carregar vídeos'}
                        <input
                            ref={videoInputRef}
                            type="file"
                            accept="video/*"
                            multiple
                            className="hidden"
                            disabled={busy}
                            onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                if (files.length) uploadFiles(files, 'video');
                            }}
                        />
                    </label>
                </div>

                {videos.length === 0 ? (
                    <div className="text-sm text-slate-400 text-center py-6 border-2 border-dashed border-slate-200/60 rounded-xl">
                        Sem vídeos. Limite {MAX_VIDEO_MB}MB por ficheiro.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {videos.map((url, idx) => (
                            <div
                                key={`${url}-${idx}`}
                                className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 group bg-black"
                                draggable
                                onDragStart={() => onDragStart('video', idx)}
                                onDragOver={onDragOver}
                                onDrop={() => onDrop('video', idx)}
                            >
                                <video
                                    src={url}
                                    className="w-full h-full object-cover"
                                    muted
                                    playsInline
                                    preload="metadata"
                                />
                                <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                    <FilmIcon className="w-2.5 h-2.5" /> {idx + 1}
                                </span>
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-1.5 flex items-center justify-between gap-1">
                                    <div className="flex gap-1">
                                        <button
                                            type="button"
                                            disabled={idx === 0}
                                            onClick={() => move('video', idx, idx - 1)}
                                            className="p-1 bg-white/20 hover:bg-white/40 rounded text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <ArrowUp className="w-3 h-3 -rotate-90" />
                                        </button>
                                        <button
                                            type="button"
                                            disabled={idx === videos.length - 1}
                                            onClick={() => move('video', idx, idx + 1)}
                                            className="p-1 bg-white/20 hover:bg-white/40 rounded text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <ArrowDown className="w-3 h-3 -rotate-90" />
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeAt('video', idx)}
                                        className="p-1 bg-red-500/80 hover:bg-red-500 rounded text-white"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
