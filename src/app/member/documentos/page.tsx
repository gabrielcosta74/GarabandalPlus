"use client";

import { useEffect, useState } from 'react';
import VIPLayout from '../../../components/member/VIPLayout';
import { getBrowserAccessToken } from '../../../lib/supabase-browser';
import { 
    FolderLock, 
    FileText, 
    Music, 
    Image as ImageIcon,
    ChevronRight,
    BookOpen
} from 'lucide-react';
import Link from 'next/link';
import { Toaster, toast } from 'sonner';

type MemberContent = {
    id: string;
    type: 'pdf' | 'audio' | 'gallery';
};

export default function MemberDocumentosNavigationPage() {
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

    const pdfCount = contents.filter(c => c.type === 'pdf').length;
    const audioCount = contents.filter(c => c.type === 'audio').length;
    const galleryCount = contents.filter(c => c.type === 'gallery').length;

    return (
        <VIPLayout>
            <Toaster position="top-right" richColors theme="dark" />
            
            <div className="space-y-10 pb-24">
                {/* Hero */}
                <section className="relative overflow-hidden rounded-3xl bg-slate-900 border border-white/5 p-8 md:p-12 mt-6">
                    <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
                    
                    <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-6">
                                <FolderLock className="w-4 h-4" />
                                Arquivo Reservado
                            </div>
                            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                                O Tesouro Oculto de Garabandal
                            </h1>
                            <p className="text-slate-400 text-lg md:text-xl leading-relaxed">
                                Mergulha na profundidade das Aparições. Aqui preservamos relatórios originais, áudios com testemunhos diretos e galerias fotográficas inéditas sobre os eventos ocorridos em San Sebastián de Garabandal, reservados exclusivamente para os que apoiam a Mensagem.
                            </p>
                        </div>
                        <div className="hidden lg:flex shrink-0 w-48 h-48 bg-gradient-to-br from-emerald-500/20 to-slate-900 rounded-full items-center justify-center border border-emerald-500/30">
                            <BookOpen className="w-20 h-20 text-emerald-400/80" />
                        </div>
                    </div>
                </section>

                {/* Selection Cards */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Link 
                        href="/member/documentos/manuscritos"
                        className="group relative overflow-hidden rounded-3xl p-8 text-left transition-all duration-500 border-2 border-slate-800 bg-slate-900/50 hover:bg-slate-800 hover:border-red-500/50 hover:-translate-y-1 hover:shadow-2xl hover:shadow-red-500/10"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300 bg-red-500/10 text-red-500 group-hover:bg-red-500/20">
                            <FileText className="w-7 h-7" />
                        </div>
                        <h3 className="text-2xl font-serif font-bold text-white mb-2 group-hover:text-red-400 transition-colors">Manuscritos</h3>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6">Documentos e registos escritos sobre as Aparições.</p>
                        <div className="flex items-center justify-between mt-auto">
                            {loading ? (
                                <div className="h-4 w-16 bg-slate-800 rounded animate-pulse"></div>
                            ) : (
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{pdfCount} {pdfCount === 1 ? 'Ficheiro' : 'Ficheiros'}</span>
                            )}
                            <div className="w-8 h-8 rounded-full flex items-center justify-center transition-all bg-slate-800 text-white group-hover:bg-red-500/20 group-hover:text-red-400">
                                <ChevronRight className="w-4 h-4" />
                            </div>
                        </div>
                    </Link>

                    <Link 
                        href="/member/documentos/testemunhos"
                        className="group relative overflow-hidden rounded-3xl p-8 text-left transition-all duration-500 border-2 border-slate-800 bg-slate-900/50 hover:bg-slate-800 hover:border-purple-500/50 hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-500/10"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300 bg-purple-500/10 text-purple-500 group-hover:bg-purple-500/20">
                            <Music className="w-7 h-7" />
                        </div>
                        <h3 className="text-2xl font-serif font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">Testemunhos</h3>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6">Gravações áudio vitais e mensagens documentadas.</p>
                        <div className="flex items-center justify-between mt-auto">
                            {loading ? (
                                <div className="h-4 w-16 bg-slate-800 rounded animate-pulse"></div>
                            ) : (
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{audioCount} {audioCount === 1 ? 'Áudio' : 'Áudios'}</span>
                            )}
                            <div className="w-8 h-8 rounded-full flex items-center justify-center transition-all bg-slate-800 text-white group-hover:bg-purple-500/20 group-hover:text-purple-400">
                                <ChevronRight className="w-4 h-4" />
                            </div>
                        </div>
                    </Link>

                    <Link 
                        href="/member/documentos/fotografias"
                        className="group relative overflow-hidden rounded-3xl p-8 text-left transition-all duration-500 border-2 border-slate-800 bg-slate-900/50 hover:bg-slate-800 hover:border-blue-500/50 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/10"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300 bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20">
                            <ImageIcon className="w-7 h-7" />
                        </div>
                        <h3 className="text-2xl font-serif font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">Fotografias</h3>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6">Galerias ocultas históricas e imagens exclusivas.</p>
                        <div className="flex items-center justify-between mt-auto">
                            {loading ? (
                                <div className="h-4 w-16 bg-slate-800 rounded animate-pulse"></div>
                            ) : (
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{galleryCount} {galleryCount === 1 ? 'Galeria' : 'Galerias'}</span>
                            )}
                            <div className="w-8 h-8 rounded-full flex items-center justify-center transition-all bg-slate-800 text-white group-hover:bg-blue-500/20 group-hover:text-blue-400">
                                <ChevronRight className="w-4 h-4" />
                            </div>
                        </div>
                    </Link>
                </section>
            </div>
        </VIPLayout>
    );
}
