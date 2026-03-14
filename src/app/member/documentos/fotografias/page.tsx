"use client";

import { useEffect, useState, useMemo } from 'react';
import VIPLayout from '../../../../components/member/VIPLayout';
import { getBrowserAccessToken } from '../../../../lib/supabase-browser';
import { 
    Image as ImageIcon,
    Loader2,
    ArrowLeft,
    X,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { Toaster, toast } from 'sonner';

type MemberGalleryImage = {
    id: string;
    image_url: string;
    display_order: number;
};

type MemberContent = {
    id: string;
    title: string;
    description: string | null;
    type: 'pdf' | 'audio' | 'gallery';
    file_url: string | null;
    created_at: string;
    member_gallery_images?: MemberGalleryImage[];
};

export default function FotografiasPage() {
    const [contents, setContents] = useState<MemberContent[]>([]);
    const [loading, setLoading] = useState(true);

    // Gallery Viewer State
    const [activeGallery, setActiveGallery] = useState<MemberContent | null>(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

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

    const openGallery = (content: MemberContent) => {
        setActiveGallery(content);
        setCurrentImageIndex(0);
        document.body.style.overflow = 'hidden';
    };

    const closeGallery = () => {
        setActiveGallery(null);
        document.body.style.overflow = 'unset';
    };

    const nextImage = () => {
        if (!activeGallery?.member_gallery_images) return;
        setCurrentImageIndex((prev) => 
            (prev + 1) % activeGallery.member_gallery_images!.length
        );
    };

    const prevImage = () => {
        if (!activeGallery?.member_gallery_images) return;
        setCurrentImageIndex((prev) => 
            prev === 0 ? activeGallery.member_gallery_images!.length - 1 : prev - 1
        );
    };

    const galleries = useMemo(() => contents.filter(c => c.type === 'gallery'), [contents]);

    return (
        <VIPLayout>
            <Toaster position="top-right" richColors theme="dark" />
            
            <div className="space-y-10 pb-24">
                <div className="mt-8 flex items-center gap-4">
                    <Link href="/member/documentos" className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition-colors flex items-center justify-center">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-3xl font-serif font-bold text-white tracking-tight">Galerias Fotográficas</h1>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 animate-in fade-in duration-500">
                        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-6" />
                        <p className="text-slate-400 font-medium tracking-wide">Aceder ao Arquivo Confidencial...</p>
                    </div>
                ) : galleries.length === 0 ? (
                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-16 text-center animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <ImageIcon className="w-10 h-10 text-blue-500" />
                        </div>
                        <h3 className="text-2xl font-serif font-bold text-white mb-3">O Arquivo Encontra-se Vazio</h3>
                        <p className="text-slate-400 max-w-md mx-auto leading-relaxed">De momento não existem galerias partilhadas.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {galleries.map(gallery => {
                            const coverImage = gallery.member_gallery_images?.[0]?.image_url;
                            const count = gallery.member_gallery_images?.length || 0;
                            
                            return (
                                <button 
                                    key={gallery.id} 
                                    onClick={() => openGallery(gallery)}
                                    className="group text-left relative aspect-[4/5] rounded-3xl overflow-hidden border border-slate-800 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/20 transition-all bg-slate-900 flex flex-col justify-end"
                                >
                                    {coverImage ? (
                                        <>
                                            <img src={coverImage} alt={gallery.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent opacity-90 group-hover:opacity-80 transition-opacity" />
                                        </>
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                                            <ImageIcon className="w-12 h-12 text-slate-800" />
                                        </div>
                                    )}
                                    
                                    <div className="relative z-10 p-6 w-full">
                                        <div className="flex flex-col gap-3">
                                            <div className="inline-flex items-center self-start gap-1.5 px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-lg text-xs font-bold backdrop-blur-md border border-blue-500/30">
                                                <ImageIcon className="w-3.5 h-3.5" />
                                                {count} Fotografias
                                            </div>
                                            <h3 className="font-serif font-bold text-white text-xl leading-snug group-hover:text-blue-300 transition-colors">{gallery.title}</h3>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Gallery Fullscreen Modal */}
            {activeGallery && activeGallery.member_gallery_images && activeGallery.member_gallery_images.length > 0 && (
                <div className="fixed inset-0 z-[100] bg-black/98 backdrop-blur-3xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between p-4 md:p-6 bg-gradient-to-b from-black/80 to-transparent">
                        <div className="flex-1">
                            <h3 className="text-white font-serif text-xl md:text-2xl font-bold truncate pr-4">{activeGallery.title}</h3>
                            <p className="text-slate-400 text-sm font-mono mt-1">{currentImageIndex + 1} / {activeGallery.member_gallery_images.length}</p>
                        </div>
                        <button 
                            onClick={closeGallery}
                            className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-md active:scale-95"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex-1 relative flex items-center justify-center p-2 md:p-8 overflow-hidden touch-none"
                         onClick={closeGallery} 
                    >
                        <button 
                            onClick={(e) => { e.stopPropagation(); prevImage(); }}
                            className="absolute left-4 md:left-8 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all z-10 hidden sm:block border border-white/10 backdrop-blur-md group"
                        >
                            <ChevronLeft className="w-8 h-8 group-active:-translate-x-1 transition-transform" />
                        </button>

                        <img 
                            src={activeGallery.member_gallery_images[currentImageIndex].image_url} 
                            alt={`Photo ${currentImageIndex + 1}`}
                            className="max-h-full max-w-full object-contain rounded-xl shadow-2xl animate-in slide-in-from-right-4 fade-in duration-300 pointer-events-none"
                            onClick={(e) => e.stopPropagation()} 
                        />

                        <button 
                            onClick={(e) => { e.stopPropagation(); nextImage(); }}
                            className="absolute right-4 md:right-8 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all z-10 hidden sm:block border border-white/10 backdrop-blur-md group"
                        >
                            <ChevronRight className="w-8 h-8 group-active:translate-x-1 transition-transform" />
                        </button>
                    </div>
                    
                    {/* Mobile Controls & Thumbnails */}
                    <div className="p-4 bg-gradient-to-t from-black via-black/90 to-transparent">
                         <div className="flex sm:hidden justify-center gap-4 mb-4">
                            <button onClick={prevImage} className="p-4 bg-white/10 active:bg-white/20 rounded-full text-white backdrop-blur-md"><ChevronLeft className="w-6 h-6"/></button>
                            <button onClick={nextImage} className="p-4 bg-white/10 active:bg-white/20 rounded-full text-white backdrop-blur-md"><ChevronRight className="w-6 h-6"/></button>
                         </div>
                         <div className="hidden sm:flex items-center justify-center gap-3 overflow-x-auto p-4 scrollbar-hide max-w-5xl mx-auto">
                            {activeGallery.member_gallery_images.map((img, idx) => (
                                <button 
                                    key={img.id}
                                    onClick={() => setCurrentImageIndex(idx)}
                                    className={`relative h-20 w-24 rounded-xl overflow-hidden shrink-0 border-2 transition-all duration-300 ${idx === currentImageIndex ? 'border-blue-500 scale-110 shadow-lg shadow-blue-500/20' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                >
                                    <img src={img.image_url} className="w-full h-full object-cover" loading="lazy" />
                                </button>
                            ))}
                         </div>
                    </div>
                </div>
            )}
        </VIPLayout>
    );
}
