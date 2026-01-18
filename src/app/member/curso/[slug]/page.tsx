"use client";

import { useState, useEffect } from 'react';
import VIPLayout from '../../../../components/member/VIPLayout';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import { MOCK_COURSES, Course, Episode } from '../../../../lib/academy-data';
import { Play, Lock, ChevronLeft, Layout, FileText, Info, CheckCircle, ChevronRight, Menu } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function NewCoursePlayerPage() {
    const params = useParams();
    const slug = params?.slug as string;

    const [course, setCourse] = useState<Course | null>(null);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Fetch Logic (Hybrid: DB + Mock)
    useEffect(() => {
        async function loadData() {
            setLoading(true);

            let foundCourse: Course | null = null;
            let foundEpisodes: Episode[] = [];

            // 1. Try DB
            if (supabaseBrowser) {
                const { data: cData } = await supabaseBrowser
                    .from('academy_courses')
                    .select('*')
                    .eq('slug', slug)
                    .single();

                if (cData) {
                    foundCourse = cData;
                    // Get Episodes
                    const { data: eData } = await supabaseBrowser
                        .from('academy_episodes')
                        .select('*')
                        .eq('course_id', cData.id)
                        .order('position', { ascending: true });

                    if (eData) foundEpisodes = eData;
                }
            }

            // 2. Fallback to Mock
            if (!foundCourse) {
                const mock = MOCK_COURSES.find(c => c.slug === slug);
                if (mock) {
                    foundCourse = mock;
                    foundEpisodes = mock.episodes || [];
                }
            }

            // Set State
            if (foundCourse) {
                setCourse(foundCourse);
                setEpisodes(foundEpisodes);
                if (foundEpisodes.length > 0) setActiveEpisode(foundEpisodes[0]);

                // Initialize sidebar state based on format
                // If single, sidebar is closed/hidden by default
                if (foundCourse.format === 'single') {
                    setSidebarOpen(false);
                }
            }

            setLoading(false);
        }
        loadData();
    }, [slug]);

    if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Carregando sala de aula...</div>;
    if (!course) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Curso não encontrado.</div>;

    const isLocked = course.is_premium;
    const isSingle = course.format === 'single';

    return (
        <VIPLayout>
            <div className="bg-slate-950 min-h-screen flex flex-col">

                {/* TOOLBAR */}
                <div className="h-16 border-b border-white/5 bg-slate-900/50 backdrop-blur flex items-center justify-between px-4 md:px-8 sticky top-0 z-40">
                    <div className="flex items-center gap-4">
                        <Link href="/member/cursos" className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-sm md:text-base font-serif font-bold text-white leading-none">{course.title}</h1>
                            {activeEpisode && !isSingle && <span className="text-xs text-slate-500">{activeEpisode.position}. {activeEpisode.title}</span>}
                        </div>
                    </div>

                    {/* Only show menu toggle if NOT single format */}
                    {!isSingle && (
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className={`p-2 rounded-lg border transition-all ${sidebarOpen ? 'bg-orange-500/10 border-orange-500/50 text-orange-400' : 'bg-transparent border-white/10 text-slate-400'}`}
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* MAIN CONTENT AREA */}
                <div className="flex-1 flex overflow-hidden">

                    {/* VIDEO STAGE */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-black relative flex flex-col">
                        <div className={`w-full aspect-video bg-black relative shadow-2xl z-10 ${isSingle ? 'max-w-6xl mx-auto' : ''}`}>
                            {activeEpisode ? (
                                <iframe
                                    width="100%"
                                    height="100%"
                                    src={`https://www.youtube.com/embed/${activeEpisode.video_id}?autoplay=0&modestbranding=1&rel=0`}
                                    title={activeEpisode.title}
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                    className="absolute inset-0"
                                ></iframe>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                                    <p>Selecione um episódio</p>
                                </div>
                            )}
                        </div>

                        {/* Description & Tab Content */}
                        <div className="p-6 md:p-12 max-w-4xl mx-auto w-full">
                            <div className="mb-8">
                                <h2 className="text-2xl font-serif font-bold text-white mb-2">{isSingle ? course.title : (activeEpisode?.title || course.title)}</h2>
                                <p className="text-slate-400 leading-relaxed font-light text-lg">
                                    {isSingle ? course.description : (activeEpisode?.description || course.description)}
                                </p>
                            </div>

                            <div className="flex gap-4 border-b border-white/5 pb-1 mb-6">
                                <button className="px-4 py-2 border-b-2 border-orange-500 text-white font-bold text-sm">Visão Geral</button>
                                <button className="px-4 py-2 border-b-2 border-transparent text-slate-500 hover:text-white font-bold text-sm">Materiais</button>
                            </div>

                            <div className="bg-slate-900/50 p-6 rounded-xl border border-white/5">
                                <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Info className="w-4 h-4 text-orange-500" />
                                    Sobre este Conteúdo
                                </h4>
                                <div className="text-slate-400 text-sm space-y-4">
                                    <p>{course.description}</p>
                                    <div className="flex gap-4 pt-4">
                                        {!isSingle && (
                                            <div className="flex items-center gap-2 text-slate-500">
                                                <Layout className="w-4 h-4" />
                                                <span>{episodes.length} Aulas</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <FileText className="w-4 h-4" />
                                            <span>Certificado Disponível</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SIDEBAR PLAYLIST (Only if NOT SINGLE) */}
                    {!isSingle && sidebarOpen && (
                        <div className="w-80 md:w-96 bg-slate-900 border-l border-white/5 overflow-y-auto flex-shrink-0 animate-slide-in-right z-20">
                            <div className="p-4 border-b border-white/5 bg-slate-900 sticky top-0 z-10">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Conteúdo do Curso</h3>
                                <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-2">
                                    <div className="bg-orange-600 h-full w-[10%]" />
                                </div>
                            </div>

                            <div className="p-2 space-y-1">
                                {episodes.map((ep, idx) => {
                                    const isActive = activeEpisode?.id === ep.id;
                                    return (
                                        <button
                                            key={ep.id}
                                            onClick={() => setActiveEpisode(ep)}
                                            className={`w-full text-left p-3 rounded-lg flex gap-3 transition-all group relative overflow-hidden
                                                ${isActive ? 'bg-white/5' : 'hover:bg-white/5'}
                                            `}
                                        >
                                            {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" />}

                                            <div className={`mt-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
                                                ${isActive ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700'}
                                            `}>
                                                {isActive ? <Play className="w-3 h-3 ml-0.5 fill-white" /> : (idx + 1)}
                                            </div>

                                            <div>
                                                <h4 className={`text-sm font-medium mb-1 leading-tight ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                                                    {ep.title}
                                                </h4>
                                                <span className="text-xs text-slate-600 font-mono flex items-center gap-2">
                                                    {ep.duration}
                                                    {isActive && <span className="text-orange-500 font-bold">Reproduzindo</span>}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </VIPLayout>
    );
}
