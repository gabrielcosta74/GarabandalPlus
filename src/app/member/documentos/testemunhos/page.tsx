"use client";

import { useEffect, useState, useMemo } from 'react';
import VIPLayout from '../../../../components/member/VIPLayout';
import { getBrowserAccessToken } from '../../../../lib/supabase-browser';
import { 
    Music, 
    ArrowLeft,
    Loader2
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
    created_at: string;
};

export default function TestemunhosPage() {
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

    const audios = useMemo(() => contents.filter(c => c.type === 'audio'), [contents]);

    return (
        <VIPLayout>
            <Toaster position="top-right" richColors theme="dark" />
            
            <div className="space-y-10 pb-24">
                <div className="mt-8 flex items-center gap-4">
                    <Link href={documentsPath} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition-colors flex items-center justify-center">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-3xl font-serif font-bold text-white tracking-tight">{isEn ? 'Audio Testimonies' : 'Testemunhos Áudio'}</h1>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 animate-in fade-in duration-500">
                        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-6" />
                        <p className="text-slate-400 font-medium tracking-wide">{isEn ? 'Accessing the private archive...' : 'Aceder ao Arquivo Confidencial...'}</p>
                    </div>
                ) : audios.length === 0 ? (
                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-16 text-center animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Music className="w-10 h-10 text-purple-500" />
                        </div>
                        <h3 className="text-2xl font-serif font-bold text-white mb-3">{isEn ? 'The Archive Is Empty' : 'O Arquivo Encontra-se Vazio'}</h3>
                        <p className="text-slate-400 max-w-md mx-auto leading-relaxed">{isEn ? 'There are no shared audio files at the moment.' : 'De momento não existem áudios partilhados.'}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {audios.map(audio => (
                            <div key={audio.id} className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl flex flex-col gap-6 hover:bg-slate-800/50 transition-colors">
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-serif font-bold text-xl text-white">{audio.title}</h3>
                                        <span className="text-xs font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded ml-4 shrink-0">{new Date(audio.created_at).toLocaleDateString('pt-PT')}</span>
                                    </div>
                                    {audio.description && <p className="text-sm text-slate-400 leading-relaxed mt-2 line-clamp-2">{audio.description}</p>}
                                </div>
                                
                                {audio.file_url && (
                                    <div className="mt-auto bg-slate-950/50 rounded-2xl p-3 border border-slate-800">
                                        <audio 
                                            controls 
                                            controlsList="nodownload"
                                            className="w-full h-11 [&::-webkit-media-controls-panel]:bg-slate-100"
                                            src={audio.file_url}
                                            preload="metadata"
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </VIPLayout>
    );
}
