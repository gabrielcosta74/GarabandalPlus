"use client";

import { useState, useEffect } from 'react';
import VIPLayout from '../../../components/member/VIPLayout';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { Play, Lock, Clock, Info, ChevronRight, Star, Film, BookOpen, Heart, History, Bookmark } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

import { MOCK_COURSES, Course } from '../../../lib/academy-data';
import { useLocale } from '../../../contexts/LocaleContext';

// --- Types ---
// (Course type is now imported)

// --- Mock Data (Netflix Style Fallback) ---
// (MOCK_COURSES is now imported)

// --- Components ---

function CourseCard({ course, isLandscape = true }: { course: Course, isLandscape?: boolean }) {
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const bgImage = course.thumbnail_url || 'https://images.unsplash.com/photo-1544928147-79a2dbc1f389?q=80&w=2574&auto=format&fit=crop';

    return (
        <Link href={`${isEn ? '/en/member/academy' : '/member/academy'}/${course.slug}`} className={`group relative flex-shrink-0 ${isLandscape ? 'w-[280px] md:w-[320px]' : 'w-[200px]'}`}>
            <div className={`
                ${isLandscape ? 'aspect-video' : 'aspect-[2/3]'} 
                rounded-lg overflow-hidden relative shadow-lg transition-all duration-500 
                group-hover:shadow-2xl group-hover:shadow-orange-900/40 border border-white/10 bg-slate-900
                group-hover:scale-105 z-0 group-hover:z-10
            `}>
                {/* Thumbnail Image */}
                <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                    style={{ backgroundImage: `url('${bgImage}')` }}
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-90 transition-opacity" />

                {/* Play Button */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-90 group-hover:scale-100 z-20">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center shadow-lg hover:bg-orange-600 hover:border-orange-600 transition-all">
                        <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                    </div>
                </div>

                {/* Badges */}
                <div className="absolute top-2 right-2 flex gap-1 z-20">
                    {course.is_premium && (
                        <div className="bg-black/80 backdrop-blur-md px-2 py-1 rounded border border-amber-500/50 flex items-center gap-1 text-[9px] font-serif font-bold text-amber-500 uppercase tracking-widest shadow-lg">
                            <Lock className="w-3 h-3" />
                            Premium
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-4 z-20 translate-y-2 group-hover:translate-y-0 transition-transform">
                    <p className="text-[10px] uppercase tracking-widest text-orange-400 font-bold mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {course.category}
                    </p>
                    <h3 className="text-white font-serif font-bold text-lg leading-tight mb-1 group-hover:text-orange-50 transition-colors drop-shadow-md">
                        {course.title}
                    </h3>
                </div>
            </div>
        </Link>
    );
}

function HeroBanner({ course }: { course: Course }) {
    const { locale } = useLocale();
    const isEn = locale === 'en';
    if (!course) return null;
    const bgImage = course.thumbnail_url || 'https://images.unsplash.com/photo-1473172707857-f9e276582ab6?q=80&w=2670&auto=format&fit=crop';

    return (
        <div className="relative w-full aspect-[4/5] md:aspect-[21/9] rounded-3xl overflow-hidden mb-16 shadow-2xl group ring-1 ring-white/10">
            <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-[40s] group-hover:scale-105"
                style={{ backgroundImage: `url('${bgImage}')` }}
            ></div>

            {/* Netflix-style Vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/60 to-transparent md:w-2/3"></div>

            <div className="absolute bottom-0 left-0 p-8 md:p-16 w-full md:w-2/3 lg:w-1/2 flex flex-col items-start z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-600 text-white text-[10px] font-bold uppercase tracking-[0.2em] mb-6 shadow-lg shadow-orange-900/50 border border-orange-400/20 animate-fade-in">
                    <Star className="w-3 h-3 fill-white" />
                    {isEn ? 'Featured' : 'Destaque'}
                </div>

                <h2 className="text-4xl md:text-6xl font-serif font-bold text-white mb-6 leading-[1.1] drop-shadow-2xl">
                    {course.title}
                </h2>

                <p className="text-slate-200 text-sm md:text-lg leading-relaxed mb-10 border-l-4 border-orange-600 pl-6 max-w-xl drop-shadow-md">
                    {course.description}
                </p>

                <div className="flex flex-wrap gap-4 w-full">
                    <Link href={`${isEn ? '/en/member/academy' : '/member/academy'}/${course.slug}`} className="px-8 py-4 bg-white text-slate-950 font-bold rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-3 shadow-xl hover:scale-105 active:scale-95">
                        <Play className="w-5 h-5 fill-slate-950" />
                        {isEn ? 'Watch Now' : 'Assistir Agora'}
                    </Link>
                    <button className="px-8 py-4 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 border border-white/10 transition-all flex items-center justify-center gap-2 backdrop-blur-md">
                        <Info className="w-5 h-5" />
                        {isEn ? 'More Details' : 'Mais Detalhes'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function SectionRail({ title, icon: Icon, courses, isVertical = false }: { title: string, icon?: any, courses: Course[], isVertical?: boolean }) {
    const { locale } = useLocale();
    const isEn = locale === 'en';
    if (!courses || courses.length === 0) return null;

    return (
        <section className="mb-16 last:mb-0 relative animate-fade-in-up">
            <div className="flex items-end justify-between mb-6 px-2 border-b border-white/5 pb-2">
                <h3 className="text-xl md:text-2xl font-serif font-bold text-white flex items-center gap-3">
                    {Icon && <Icon className="w-6 h-6 text-orange-500" />}
                    {title}
                </h3>
                <button className="text-xs font-bold text-slate-500 hover:text-white uppercase tracking-wider flex items-center gap-1 transition-colors group">
                    {isEn ? 'View All' : 'Ver Tudo'} <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                </button>
            </div>

            {isVertical ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {courses.map(course => <CourseCard key={course.id} course={course} isLandscape={false} />)}
                </div>
            ) : (
                <div className="relative group/rail">
                    {/* Scroll Container */}
                    <div className="flex overflow-x-auto pb-8 gap-6 px-2 snap-x hide-scrollbar scroll-smooth">
                        {courses.map(course => (
                            <div key={course.id} className="snap-start">
                                <CourseCard course={course} isLandscape={true} />
                            </div>
                        ))}
                    </div>
                    {/* Fade Edges */}
                    <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-slate-950 to-transparent pointer-events-none" />
                </div>
            )}
        </section>
    );
}

// --- Main Page ---

export default function AcademyHubPage() {
    const { locale } = useLocale();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const isEn = locale === 'en';

    useEffect(() => {
        async function loadCourses() {
            setLoading(true);

            let data: Course[] | null = null;
            let error = null;

            if (supabaseBrowser) {
                const response = await supabaseBrowser
                    .from('academy_courses')
                    .select('*')
                    .eq('published', true)
                    .order('created_at', { ascending: false });

                data = response.data;
                error = response.error;
            }

            if (error) {
                console.error("Error loading courses:", error);
            }

            if (data && data.length > 0) {
                console.log("Loaded courses from DB:", data.length);
                setCourses(data.map((course: any) => ({
                    ...course,
                    title: isEn ? course.title_en || course.title : course.title,
                    description: isEn ? course.description_en || course.description : course.description,
                })));
            } else {
                console.log("No courses found in DB, using mocks for demonstration.");
                setCourses(MOCK_COURSES);
            }
            setLoading(false);
        }
        loadCourses();
    }, [isEn]);

    // Filter Logic
    const featuredCourse = courses[0];
    const others = courses.filter(c => c.id !== featuredCourse?.id);

    // Categorization (fallback to 'All' if few categories)
    const theology = others.filter(c => c.category === 'Teologia' || c.category === 'Formação Geral');
    const spirituality = others.filter(c => c.category === 'Vida Espiritual');
    const docs = others.filter(c => c.category === 'Documentários');

    // If we rely on mocks, use their categories
    const mockTeology = others.filter(c => c.category === 'Teologia');
    const mockSpirit = others.filter(c => c.category === 'Vida Espiritual');

    if (loading) {
        return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">{isEn ? 'Loading content...' : 'Carregando conteúdos...'}</div>;
    }

    return (
        <VIPLayout>
            <div className="bg-slate-950 min-h-screen">
                <div className="max-w-[1700px] mx-auto p-4 md:p-8 pb-32">

                    {/* Navbar Spacer / Header */}
                    <div className="flex items-center justify-between mb-8 opacity-60 hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-900 border border-white/10 rounded-lg">
                                <Film className="w-5 h-5 text-orange-500" />
                            </div>
                            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{isEn ? 'Garabandal Academy' : 'Academia Garabandal'}</span>
                        </div>
                    </div>

                    {/* HERO FEATURED */}
                    <div className="animate-fade-in">
                        {featuredCourse && <HeroBanner course={featuredCourse} />}
                    </div>

                    {/* CONTENT RAILS */}
                    <div className="space-y-4 -mt-10 relative z-20">
                        {theology.length > 0 && <SectionRail title={isEn ? 'Theology & Formation' : 'Teologia & Formação'} icon={BookOpen} courses={theology} />}
                        {spirituality.length > 0 && <SectionRail title={isEn ? 'Life of Prayer' : 'Vida de Oração'} icon={Heart} courses={spirituality} />}
                        {docs.length > 0 && <SectionRail title={isEn ? 'Original Documentaries' : 'Documentários Originais'} icon={Film} courses={docs} />}

                        {/* If using Mocks and specific cats are empty, show 'More' */}
                        {others.length > 0 && theology.length === 0 && <SectionRail title={isEn ? 'All Content' : 'Todos os Conteúdos'} icon={Film} courses={others} />}
                    </div>

                </div>
            </div>
        </VIPLayout>
    );
}
