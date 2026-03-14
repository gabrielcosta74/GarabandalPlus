"use client";

import { useEffect, useState, useMemo } from 'react';
import VIPLayout from '../../../../components/member/VIPLayout';
import { getBrowserAccessToken } from '../../../../lib/supabase-browser';
import { 
    FileText, 
    Download,
    ChevronRight,
    Loader2,
    ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { Toaster, toast } from 'sonner';

type MemberContent = {
    id: string;
    title: string;
    description: string | null;
    type: 'pdf' | 'audio' | 'gallery';
    file_url: string | null;
    created_at: string;
};

export default function ManuscritosPage() {
    const [contents, setContents] = useState<MemberContent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchContents = async () => {
            try {
                const token = await getBrowserAccessToken();
                const res = await fetch('/api/member/contents', {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: 'no-store'
                });
                const data = await res.json().catch(() => null);
                if (!res.ok) throw new Error(data?.error || "Falha ao carregar o arquivo confidencial");
                setContents(data?.contents || []);
            } catch (error: any) {
                toast.error(error.message);
            } finally {
                setLoading(false);
            }
        };
        fetchContents();
    }, []);

    const pdfs = useMemo(() => contents.filter(c => c.type === 'pdf'), [contents]);

    return (
        <VIPLayout>
            <Toaster position="top-right" richColors theme="dark" />
            
            <div className="space-y-10 pb-24">
                <div className="mt-8 flex items-center gap-4">
                    <Link href="/member/documentos" className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition-colors flex items-center justify-center">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-3xl font-serif font-bold text-white tracking-tight">Manuscritos e Documentos Escritos</h1>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 animate-in fade-in duration-500">
                        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-6" />
                        <p className="text-slate-400 font-medium tracking-wide">Aceder ao Arquivo Confidencial...</p>
                    </div>
                ) : pdfs.length === 0 ? (
                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-16 text-center animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <FileText className="w-10 h-10 text-red-500" />
                        </div>
                        <h3 className="text-2xl font-serif font-bold text-white mb-3">O Arquivo Encontra-se Vazio</h3>
                        <p className="text-slate-400 max-w-md mx-auto leading-relaxed">De momento não existem documentos escritos partilhados.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {pdfs.map(pdf => (
                            <a 
                                key={pdf.id} 
                                href={pdf.file_url || '#'} 
                                target="_blank" 
                                rel="noreferrer"
                                className="group relative bg-slate-900 border border-slate-800 p-6 rounded-3xl hover:border-red-500/50 hover:bg-slate-800/80 transition-all duration-300 flex flex-col justify-between hover:-translate-y-1 hover:shadow-2xl hover:shadow-red-900/10"
                            >
                                <div className="absolute top-4 right-4 bg-red-500/10 text-red-400 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Download className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-serif font-bold text-white text-xl mb-3 pr-8 group-hover:text-red-400 transition-colors">{pdf.title}</h3>
                                    {pdf.description && <p className="text-sm text-slate-400 line-clamp-3 leading-relaxed">{pdf.description}</p>}
                                </div>
                                <div className="mt-8 flex items-center justify-between border-t border-slate-800 pt-5">
                                    <span className="text-xs font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded">{new Date(pdf.created_at).toLocaleDateString('pt-PT')}</span>
                                    <span className="text-sm font-bold text-red-400 flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                                        Ler Documento <ChevronRight className="w-4 h-4" />
                                    </span>
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </VIPLayout>
    );
}
