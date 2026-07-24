"use client";

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Image as ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { supabaseBrowser } from '../../lib/supabase-browser';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
]);

interface AdminImageUploadProps {
    value?: string | null;
    onChange: (url: string) => void;
    label: string;
    helperText?: string;
    alt?: string;
}

export default function AdminImageUpload({
    value,
    onChange,
    label,
    helperText = 'JPG, PNG, WebP ou AVIF até 10 MB.',
    alt = 'Pré-visualização da imagem',
}: AdminImageUploadProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const uploadImage = async (file: File) => {
        setError(null);

        if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
            setError('Escolha uma imagem JPG, PNG, GIF, WebP ou AVIF.');
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            setError('A imagem não pode ultrapassar 10 MB.');
            return;
        }

        if (!supabaseBrowser) {
            setError('O serviço de imagens não está disponível.');
            return;
        }

        setUploading(true);
        try {
            const { data: sessionData } = await supabaseBrowser.auth.getSession();
            const token = sessionData.session?.access_token;
            if (!token) {
                throw new Error('A sessão de administrador expirou. Volte a iniciar sessão.');
            }

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/admin/cms/upload', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });
            const body = await response.json().catch(() => ({}));

            if (!response.ok || typeof body?.url !== 'string') {
                throw new Error(body?.error || 'Não foi possível carregar a imagem.');
            }

            onChange(body.url);
        } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : 'Não foi possível carregar a imagem.');
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-bold text-slate-700">{label}</label>
                {value && (
                    <button
                        type="button"
                        onClick={() => {
                            onChange('');
                            setError(null);
                        }}
                        disabled={uploading}
                        className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                        <X className="h-3.5 w-3.5" />
                        Remover
                    </button>
                )}
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
                <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white shadow-sm">
                    {value ? (
                        <Image
                            src={value}
                            alt={alt}
                            fill
                            sizes="96px"
                            unoptimized
                            className="object-cover"
                        />
                    ) : (
                        <ImageIcon className="h-8 w-8 text-slate-300" aria-hidden="true" />
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <label
                        className={`inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors sm:w-auto ${
                            uploading
                                ? 'cursor-wait bg-slate-200 text-slate-500'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                    >
                        {uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <Upload className="h-4 w-4" aria-hidden="true" />
                        )}
                        {uploading ? 'A carregar…' : value ? 'Substituir fotografia' : 'Carregar fotografia'}
                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                            className="sr-only"
                            disabled={uploading}
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) void uploadImage(file);
                            }}
                        />
                    </label>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">{helperText}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                        Depois do carregamento, guarde a peregrinação para associar a fotografia ao membro.
                    </p>
                </div>
            </div>

            {error && (
                <p role="alert" className="text-xs font-semibold text-red-600">
                    {error}
                </p>
            )}
        </div>
    );
}
