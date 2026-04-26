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
import { useLocale } from '../../../../contexts/LocaleContext';

type MemberContent = {
    id: string;
    title: string;
    description: string | null;
    type: 'pdf' | 'audio' | 'gallery';
    file_url: string | null;
    cover_image_url: string | null;
    created_at: string;
    category: {
        id: string;
        name: string;
        slug: string;
    } | null;
};

export default function ManuscritosPage() {
    const { locale } = useLocale();
    const [contents, setContents] = useState<MemberContent[]>([]);
    const [loading, setLoading] = useState(true);
    const isEn = locale === 'en';
    const documentsPath = isEn ? '/en/member/documents' : '/member/documentos';

    useEffect(() => {
        const fetchContents = async () => {
            try {
                const token = await getBrowserAccessToken();
                const res = await fetch(`/api/member/contents?locale=${locale}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: 'no-store'
                });
                const data = await res.json().catch(() => null);
                if (!res.ok) throw new Error(data?.error || (isEn ? 'Failed to load the private archive' : 'Falha ao carregar o arquivo confidencial'));
                setContents(data?.contents || []);
            } catch (error: any) {
                toast.error(error.message);
            } finally {
                setLoading(false);
            }
        };
        fetchContents();
    }, [isEn, locale]);

    const pdfs = useMemo(() => contents.filter(c => c.type === 'pdf'), [contents]);
    return (
        <VIPLayout>
            <Toaster position="top-right" richColors theme="dark" />
            
            <div className="space-y-10 pb-24">
                <div className="mt-8 flex items-center gap-4">
                    <Link href={documentsPath} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition-colors flex items-center justify-center">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-3xl font-serif font-bold text-white tracking-tight">{isEn ? 'Manuscripts and Written Documents' : 'Manuscritos e Documentos Escritos'}</h1>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 animate-in fade-in duration-500">
                        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-6" />
                        <p className="text-slate-400 font-medium tracking-wide">{isEn ? 'Accessing the private archive...' : 'Aceder ao Arquivo Confidencial...'}</p>
                    </div>
                ) : pdfs.length === 0 ? (
                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-16 text-center animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <FileText className="w-10 h-10 text-red-500" />
                        </div>
                        <h3 className="text-2xl font-serif font-bold text-white mb-3">{isEn ? 'The Archive Is Empty' : 'O Arquivo Encontra-se Vazio'}</h3>
                        <p className="text-slate-400 max-w-md mx-auto leading-relaxed">{isEn ? 'There are no shared written documents at the moment.' : 'De momento não existem documentos escritos partilhados.'}</p>
                    </div>
                ) : (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <section className="space-y-5">
                            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.3em] text-red-400/80">{isEn ? 'Archive' : 'Arquivo'}</p>
                                    <h2 className="text-2xl font-serif font-bold text-white">{isEn ? 'All Written Documents' : 'Todos os Documentos Escritos'}</h2>
                                </div>
                                <span className="inline-flex items-center self-start px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300">
                                    {pdfs.length} {pdfs.length === 1 ? (isEn ? 'document' : 'documento') : (isEn ? 'documents' : 'documentos')}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {pdfs.map((pdf) => (
                                    <a
                                        key={pdf.id}
                                        href={pdf.file_url || '#'}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 hover:border-red-500/50 hover:bg-slate-800/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-red-900/10"
                                    >
                                        <div className="relative aspect-[5/3] overflow-hidden border-b border-slate-800 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950">
                                            {pdf.cover_image_url ? (
                                                <>
                                                    <img
                                                        src={pdf.cover_image_url}
                                                        alt={pdf.title}
                                                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                        loading="lazy"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
                                                </>
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <FileText className="w-14 h-14 text-red-500/40" />
                                                </div>
                                            )}

                                            <div className="absolute left-4 top-4 max-w-[calc(100%-5rem)] rounded-full bg-slate-950/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300 backdrop-blur">
                                                {pdf.category?.name || (isEn ? 'Uncategorized' : 'Sem categoria')}
                                            </div>

                                            <div className="absolute right-4 top-4 rounded-lg bg-red-500/10 p-2 text-red-400 opacity-0 transition-opacity group-hover:opacity-100">
                                                <Download className="w-4 h-4" />
                                            </div>
                                        </div>

                                        <div className="p-6 flex min-h-[220px] flex-col justify-between">
                                            <div>
                                                <h3 className="font-serif font-bold text-white text-xl mb-3 pr-8 group-hover:text-red-400 transition-colors">
                                                    {pdf.title}
                                                </h3>
                                                {pdf.description && (
                                                    <p className="text-sm text-slate-400 line-clamp-3 leading-relaxed">
                                                        {pdf.description}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="mt-8 flex items-center justify-between border-t border-slate-800 pt-5">
                                                <span className="text-xs font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded">
                                                    {new Date(pdf.created_at).toLocaleDateString('pt-PT')}
                                                </span>
                                                <span className="text-sm font-bold text-red-400 flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                                                    {isEn ? 'Read Document' : 'Ler Documento'} <ChevronRight className="w-4 h-4" />
                                                </span>
                                            </div>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </VIPLayout>
    );
}
