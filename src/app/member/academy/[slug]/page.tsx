"use client";

import { useState, useEffect } from 'react';
import VIPLayout from '../../../../components/member/VIPLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Lock, CheckCircle, ChevronLeft, AlertCircle, Shield, Key, FileText, Info } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import { MOCK_COURSES, Course, Episode } from '../../../../lib/academy-data';

// --- Types ---


type Resource = {
    id: string;
    title: string;
    type: 'pdf' | 'audio' | 'link';
    size?: string;
};



export default function CoursePlayerPage() {
    const params = useParams();
    const slug = params?.slug as string;

    const [course, setCourse] = useState<Course | null>(null);
    const [episodes, setEpisodes] = useState<Episode[]>([]);

    const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null);
    const [isLocked, setIsLocked] = useState(false);
    const [showUnlockModal, setShowUnlockModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'episodes' | 'resources'>('episodes');
    const [loading, setLoading] = useState(true);

    // Fetch Course & Episodes
    useEffect(() => {
        async function loadCourseData() {
            setLoading(true);

            // 1. Try Fetch from Supabase
            let courseData: Course | null = null;
            if (supabaseBrowser) {
                const { data } = await supabaseBrowser
                    .from('academy_courses')
                    .select('*')
                    .eq('slug', slug)
                    .single();
                courseData = data;
            }

            if (courseData) {
                // DB Data Found
                setCourse(courseData);
                if (courseData.is_premium) setIsLocked(true);

                if (supabaseBrowser) {
                    const { data: epData } = await supabaseBrowser
                        .from('academy_episodes')
                        .select('*')
                        .eq('course_id', courseData.id)
                        .order('position', { ascending: true });

                    if (epData && epData.length > 0) {
                        setEpisodes(epData);
                        setActiveEpisode(epData[0]);
                    }
                }
            } else {
                // 2. Fallback to Mock
                console.log("Course not found in DB, checking mocks...", slug);
                const mockCourse = MOCK_COURSES.find(c => c.slug === slug);
                if (mockCourse) {
                    setCourse(mockCourse);
                    if (mockCourse.is_premium) setIsLocked(true);

                    if (mockCourse.episodes && mockCourse.episodes.length > 0) {
                        setEpisodes(mockCourse.episodes);
                        setActiveEpisode(mockCourse.episodes[0]);
                    }
                }
            }
            setLoading(false);
        }

        if (slug) loadCourseData();
    }, [slug]);


    const handleUnlock = () => {
        // Mock unlock for now
        setIsLocked(false);
        setShowUnlockModal(false);
    };

    if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Carregando...</div>;
    if (!course) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Curso não encontrado.</div>;

    const bgImage = course.thumbnail_url || 'https://images.unsplash.com/photo-1544928147-79a2dbc1f389?q=80&w=2574&auto=format&fit=crop';

    return (
        <VIPLayout>
            <div className="max-w-[1600px] mx-auto p-4 md:p-8 pb-20">
                {/* Back Link */}
                <Link href="/member/academy" className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors text-xs font-bold uppercase tracking-wider group">
                    <ChevronLeft className="w-4 h-4 mr-1 transition-transform group-hover:-translate-x-1" />
                    Voltar à Academia
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* LEFT COLUMN: Player & Metadata */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Video Player Container */}
                        <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/5 ring-1 ring-white/10 group">
                            {isLocked ? (
                                // LOCKED STATE OVERLAY
                                <div className="absolute inset-0 flex flex-col items-center justify-center relative">
                                    <div
                                        className="absolute inset-0 bg-cover bg-center opacity-20 blur-sm"
                                        style={{ backgroundImage: `url('${bgImage}')` }}
                                    ></div>
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-slate-950/80"></div>

                                    <div className="relative z-10 text-center p-8 max-w-lg">
                                        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-700 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-orange-900/30 transform rotate-3">
                                            <Lock className="w-8 h-8 text-white" />
                                        </div>
                                        <h2 className="text-3xl font-serif font-bold text-white mb-3">Conteúdo de Apoio</h2>
                                        <p className="text-slate-300 mb-8 text-lg font-light leading-relaxed">
                                            Este documentário é fruto de meses de investigação.
                                            Ao desbloquear, você ajuda-nos a continuar a produzir conteúdos que evangelizam.
                                        </p>
                                        <button
                                            onClick={() => setShowUnlockModal(true)}
                                            className="px-8 py-4 bg-white text-slate-900 font-bold rounded-xl shadow-lg hover:scale-105 transition-all flex items-center gap-3 mx-auto"
                                        >
                                            <Key className="w-5 h-5 text-orange-600" />
                                            Desbloquear Acesso Completo
                                        </button>
                                        <p className="mt-4 text-xs text-slate-500 uppercase tracking-widest font-bold">Donativo sugerido: {Number(course.price || 5).toFixed(2)} €</p>
                                    </div>
                                </div>
                            ) : (
                                // UNLOCKED PLAYER (Real YouTube Embed)
                                <div className="absolute inset-0 bg-black flex items-center justify-center relative">
                                    {activeEpisode ? (
                                        <iframe
                                            width="100%"
                                            height="100%"
                                            src={`https://www.youtube.com/embed/${activeEpisode.video_id}?autoplay=1&modestbranding=1&rel=0`}
                                            title={activeEpisode.title}
                                            frameBorder="0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                            allowFullScreen
                                        ></iframe>
                                    ) : (
                                        <div className="text-center text-slate-500">
                                            <Play className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                            <p>Selecione um episódio</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Video Details */}
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <span className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${course.is_premium ? 'bg-orange-950/30 border-orange-500/30 text-orange-400' : 'bg-slate-800/50 border-white/10 text-slate-300'}`}>
                                    {course.is_premium ? 'Premium' : 'Incluído'}
                                </span>
                                <span className="text-slate-500 text-sm font-serif italic">com {course.instructor}</span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-serif font-bold text-white mb-4 leading-tight">{course.title}</h1>
                            <p className="text-slate-300 leading-relaxed text-lg font-light border-l-2 border-slate-700 pl-6">
                                {course.description}
                            </p>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Interactive Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-md sticky top-24 shadow-2xl">

                            {/* Tabs Header */}
                            <div className="flex border-b border-white/5">
                                <button
                                    onClick={() => setActiveTab('episodes')}
                                    className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'episodes' ? 'bg-white/5 text-white border-b-2 border-orange-500' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                                >
                                    Episódios
                                </button>
                                <button
                                    onClick={() => setActiveTab('resources')}
                                    className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'resources' ? 'bg-white/5 text-white border-b-2 border-orange-500' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                                >
                                    Materiais
                                </button>
                            </div>

                            {/* Tab Content */}
                            <div className="min-h-[400px] max-h-[600px] overflow-y-auto">
                                {activeTab === 'episodes' ? (
                                    <div className="divide-y divide-white/5">
                                        {episodes.map((ep, idx) => {
                                            const isActive = activeEpisode?.id === ep.id;
                                            return (
                                                <div
                                                    key={ep.id}
                                                    onClick={() => !isLocked && setActiveEpisode(ep)}
                                                    className={`p-5 flex gap-4 cursor-pointer transition-all hover:bg-white/5
                                                        ${isActive ? 'bg-orange-500/5 border-l-4 border-orange-500' : 'border-l-4 border-transparent'}
                                                        ${isLocked ? 'opacity-50 pointer-events-none grayscale' : ''}
                                                    `}
                                                >
                                                    <div className="flex-shrink-0 mt-0.5">
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px]
                                                            ${isActive ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/40' : 'bg-slate-800 text-slate-500 border border-white/10'}
                                                        `}>
                                                            {idx + 1}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h4 className={`font-serif font-medium mb-1 ${isActive ? 'text-white' : 'text-slate-300'}`}>
                                                            {ep.title}
                                                        </h4>
                                                        <span className="text-xs text-slate-500 font-mono">
                                                            {ep.duration}
                                                            {isActive && <span className="ml-2 text-orange-400 font-bold">REPRODUZINDO</span>}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {episodes.length === 0 && (
                                            <div className="p-8 text-center text-slate-500 text-sm">
                                                Ainda não há episódios disponíveis.
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-6 space-y-4">
                                        {/* Simplified Mock Resources for demo, ideally fetched from DB too */}

                                        <div className="text-center py-10 text-slate-500">
                                            <p>Sem materiais adicionais para este curso.</p>
                                        </div>

                                        {!isLocked && (
                                            <div className="mt-6 p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl text-xs text-blue-300 leading-relaxed">
                                                <Info className="w-4 h-4 mb-2 inline-block mr-1" />
                                                Estes materiais são para uso pessoal e estudo espiritual.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* UNLOCK MODAL (Simplified for brevity, similar to before) */}
            <AnimatePresence>
                {showUnlockModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowUnlockModal(false)}
                            className="absolute inset-0 bg-black/90 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="relative bg-slate-900 w-full max-w-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                        >
                            <div className="p-8 text-center pt-12">
                                <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Lock className="w-8 h-8 text-orange-500" />
                                </div>
                                <h3 className="text-2xl font-serif font-bold text-white mb-2">Desbloquear Conteúdo</h3>
                                <p className="text-slate-400 text-sm mb-8 px-4">
                                    Ajude a missão Garabandal com um donativo de <strong>{Number(course.price || 5).toFixed(2)}€</strong> e tenha acesso imediato.
                                </p>
                                <button
                                    onClick={handleUnlock}
                                    className="w-full py-4 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-colors mb-3"
                                >
                                    Confirmar Donativo
                                </button>
                                <button onClick={() => setShowUnlockModal(false)} className="text-sm text-slate-500 hover:text-white">Cancelar</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </VIPLayout>
    );
}
