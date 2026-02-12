"use client";

import { useState } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { supabaseBrowser } from '../../lib/supabase-browser';

interface ImageUploadProps {
    value?: string;
    onChange: (url: string) => void;
    bucket: string;
    path: string;
    label?: string;
    className?: string;
    fixedFilename?: string;
}

export default function ImageUpload({ value, onChange, bucket, path, label = "Imagem", className = "", fixedFilename }: ImageUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleUpload = async (file: File) => {
        if (!supabaseBrowser) return;
        setUploading(true);
        setError(null);

        try {
            const extension = file.name.split('.').pop() || 'jpg';

            // Phase 2: Use fixed filename if provided, otherwise generate random
            const filename = fixedFilename
                ? `${path}/${fixedFilename}.${extension}`
                : `${path}/${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;

            const { error: uploadError } = await supabaseBrowser.storage
                .from(bucket)
                .upload(filename, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabaseBrowser.storage
                .from(bucket)
                .getPublicUrl(filename);

            if (data?.publicUrl) {
                // Cleanup: Delete old image if it exists and belongs to the same bucket
                if (value && value.includes(bucket)) {
                    try {
                        const oldPath = value.split(`${bucket}/`)[1];
                        if (oldPath) {
                            await supabaseBrowser.storage.from(bucket).remove([oldPath]);
                        }
                    } catch (cleanupErr) {
                        console.error('Failed to cleanup old image:', cleanupErr);
                    }
                }
                onChange(data.publicUrl);
            }
        } catch (err: any) {
            console.error('Upload failed:', err);
            setError(err.message || "Falha no upload");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className={className}>
            <label className="block text-sm font-bold text-slate-700 mb-2">{label}</label>

            <div className="flex gap-4 items-start">
                {/* Preview */}
                <div className="w-24 h-24 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden relative flex-shrink-0 group">
                    {value ? (
                        <>
                            <img src={value} alt="Preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button
                                    onClick={() => onChange('')}
                                    className="p-1 bg-white/20 hover:bg-white/40 rounded-full text-white"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <ImageIcon className="w-8 h-8" />
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex-1">
                    <div className="relative">
                        <input
                            type="text"
                            value={value || ''}
                            onChange={(e) => onChange(e.target.value)} // Allow manual URL entry
                            placeholder="https://..."
                            className="w-full pl-3 pr-10 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none mb-2"
                        />
                    </div>

                    <label className={`
                        inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-all
                        ${uploading
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm'
                        }
                    `}>
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {uploading ? 'A enviar...' : 'Carregar Imagem'}
                        <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            disabled={uploading}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUpload(file);
                            }}
                        />
                    </label>

                    {error && (
                        <p className="text-xs text-red-500 mt-2 font-medium">{error}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
