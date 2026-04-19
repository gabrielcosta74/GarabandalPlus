"use client";

import { useState, useEffect, useRef } from 'react';
import VIPLayout from '../../../components/member/VIPLayout';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { MOCK_COURSES, Course } from '../../../lib/academy-data';
import { Play, Clock, ChevronRight, User, Star, BookOpen, Heart, Film, Info, Plus, Check, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from '../../../contexts/LocaleContext';

// --- Components ---

// 1. Hero Banner (Slideshow Version)
function HeroBanner({ featuredCourses }: { featuredCourses: Course[] }) {
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFading, setIsFading] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const course = featuredCourses[currentIndex];

    // Reset rotation when courses change
    useEffect(() => {
        if (featuredCourses.length <= 1) return;

        const rotate = () => {
            setIsFading(true);
            setTimeout(() => {
                setCurrentIndex((prev) => (prev + 1) % featuredCourses.length);
                setIsFading(false);
            }, 500); // Wait for fade out before switching content
        };

        const interval = setInterval(rotate, 8000); // 8 seconds per slide
        return () => clearInterval(interval);
    }, [featuredCourses.length]);

    if (!course) return null;

    return (
        <div className="relative w-full h-[85vh] md:h-[75vh] mb-10 group mt-[-80px] md:mt-[-90px] z-0 overflow-hidden">
            {/* Background Image Layer */}
            <div
                key={course.id + '-bg'} // Force re-render for animation reset
                className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-[20s] ease-linear group-hover:scale-105 ${isFading ? 'opacity-50' : 'opacity-100'} transition-opacity duration-500`}
                style={{ backgroundImage: `url('${course.thumbnail_url}')` }}
            >
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/30" />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/40 to-transparent" />
            </div>

            {/* Content Layer */}
            <div className={`relative h-full max-w-[1400px] mx-auto px-6 md:px-12 flex flex-col justify-center pt-20 pb-24 md:pb-12 transition-opacity duration-500 ${isFading ? 'opacity-0' : 'opacity-100'}`}>
                <div className="max-w-2xl animate-fade-in-up">
                    <div className="mb-4 flex items-center gap-3">
                        <span className="text-yellow-500 font-bold tracking-widest text-xs uppercase bg-yellow-500/10 px-3 py-1 rounded border border-yellow-500/20 backdrop-blur-sm">
                            {isEn ? `Featured #${currentIndex + 1}` : `Em Destaque #${currentIndex + 1}`}
                        </span>
                        {course.is_premium && (
                            <span className="text-amber-200 font-bold tracking-widest text-xs uppercase bg-amber-900/40 px-3 py-1 rounded border border-amber-500/30 backdrop-blur-sm">
                                Premium
                            </span>
                        )}
                    </div>

                    <h1 className="text-4xl md:text-6xl font-serif font-bold text-white leading-tight mb-4 drop-shadow-xl">
                        {course.title}
                    </h1>

                    <div className="flex items-center gap-4 text-slate-300 text-sm md:text-base font-medium mb-6">
                        <span className="text-green-400 font-bold">{isEn ? '98% Match' : '98% Relevância'}</span>
                        <span>{course.duration || '45m'}</span>
                        <span>{course.category}</span>
                    </div>

                    <p className="text-slate-200 text-lg md:text-xl line-clamp-3 mb-8 drop-shadow-md max-w-xl leading-relaxed">
                        {course.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-4">
                        <Link
                            href={`/member/curso/${course.slug}`}
                            className="bg-yellow-500 text-black hover:bg-yellow-400 px-8 py-3.5 rounded-lg font-bold flex items-center gap-3 transition-all hover:scale-105 shadow-xl hover:shadow-yellow-500/20"
                        >
                            <Play className="w-6 h-6 fill-black" /> {isEn ? 'Watch' : 'Assistir'}
                        </Link>
                        <button className="bg-slate-800/80 hover:bg-slate-700/80 backdrop-blur-md text-white px-8 py-3.5 rounded-lg font-bold flex items-center gap-3 transition-all border border-white/20 hover:border-white/40 shadow-lg">
                            <Info className="w-6 h-6" /> {isEn ? 'More Info' : 'Mais Informações'}
                        </button>
                    </div>
                </div>

                {/* Indicators */}
                {featuredCourses.length > 1 && (
                    <div className="absolute bottom-24 right-6 md:right-12 flex gap-2 z-20">
                        {featuredCourses.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => { setIsFading(true); setTimeout(() => { setCurrentIndex(idx); setIsFading(false); }, 500); }}
                                className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-8 bg-yellow-500' : 'w-4 bg-white/30 hover:bg-white/50'}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// 2. Course Card (Progress & List Enabled)
function NetflixCard({ course, showProgress = false, isListed = false, onToggleList }: { course: Course, showProgress?: boolean, isListed?: boolean, onToggleList?: (id: string, currentlyInList: boolean) => void }) {
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const [inList, setInList] = useState(isListed);
    const [loadingToggle, setLoadingToggle] = useState(false);

    useEffect(() => {
        setInList(isListed);
    }, [isListed]);

    const toggleList = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (loadingToggle) return;
        setLoadingToggle(true);

        try {
            if (onToggleList) {
                await onToggleList(course.id, inList || false);
                setInList(!inList);
            }
        } finally {
            setLoadingToggle(false);
        }
    };

    return (
        <Link
            href={`/member/curso/${course.slug}`}
            className="group/card relative flex-none w-[200px] md:w-[280px] aspect-video bg-slate-800 rounded-lg overflow-hidden transition-all duration-300 hover:scale-110 hover:z-50 shadow-lg hover:shadow-2xl hover:shadow-black/80 border border-white/5 hover:border-yellow-500/50 cursor-pointer origin-center"
        >
            <div
                className="absolute inset-0 bg-cover bg-center transition-opacity duration-300 group-hover/card:opacity-40"
                style={{ backgroundImage: `url('${course.thumbnail_url}')` }}
            />

            {/* Overlay Gradient (Hidden by default, shown on hover) */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/90 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                <div className="transform translate-y-4 group-hover/card:translate-y-0 transition-transform duration-300">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg shadow-black/50">
                            <Play className="w-4 h-4 fill-black text-black ml-0.5" />
                        </div>
                        <button
                            onClick={toggleList}
                            disabled={loadingToggle}
                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center hover:border-white transition-colors cursor-pointer z-50 ${inList ? 'border-green-500 bg-green-500/20' : 'border-slate-400'} ${loadingToggle ? 'opacity-50' : ''}`}
                        >
                            {loadingToggle ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> :
                                (inList ? <Check className="w-4 h-4 text-green-500" /> : <Plus className="w-4 h-4 text-white" />)
                            }
                        </button>
                    </div>

                    <h4 className="font-bold text-white text-sm line-clamp-1 mb-1 shadow-black drop-shadow-md">
                        {course.title}
                    </h4>

                    <div className="flex items-center gap-2 text-[10px] text-slate-300 font-bold">
                        <span className="text-green-400">{isEn ? 'New' : 'Novo'}</span>
                        <span className="border border-slate-500 px-1 rounded">HD</span>
                        <span>{course.duration || '20m'}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
                        <span className="text-yellow-500">{course.category}</span>
                        <span>•</span>
                        <span>{course.instructor}</span>
                    </div>
                </div>
            </div>

            {/* Default visible title (bottom left) - fades out on hover */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent group-hover/card:opacity-0 transition-opacity">
                <h4 className="text-white font-bold text-sm drop-shadow-md line-clamp-1">{course.title}</h4>
            </div>

            {/* Progress Bar (Visible Always if exists) */}
            {showProgress && course.progress && course.progress > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-700/50 z-20">
                    <div
                        className="h-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.7)]"
                        style={{ width: `${course.progress}%` }}
                    />
                </div>
            )}
        </Link>
    );
}

// 3. Horizontal Scroll Section
function CarouselSection({ title, courses, showProgress = false, watchlistItems = [], onToggleList }: { title: string, courses: Course[], showProgress?: boolean, watchlistItems?: string[], onToggleList?: (id: string, inList: boolean) => void }) {
    const scrollContainer = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainer.current) {
            const { current } = scrollContainer;
            const scrollAmount = direction === 'left' ? -300 : 300;
            current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    if (courses.length === 0) return null;

    return (
        <div className="mb-8 md:mb-12 relative group/section pl-6 md:pl-12 hover:z-40">
            <h3 className="text-lg md:text-xl font-bold text-slate-200 mb-4 font-serif flex items-center gap-2 group-hover/section:text-yellow-500 transition-colors cursor-pointer relative z-40">
                {title} <ChevronRight className="w-5 h-5 opacity-0 group-hover/section:opacity-100 transition-opacity -ml-2 group-hover/section:ml-0" />
            </h3>

            <div className="group relative z-30">
                {/* Scroll Buttons */}
                <button
                    onClick={() => scroll('left')}
                    className="absolute left-0 top-0 bottom-0 z-40 w-12 bg-black/60 hover:bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 md:-ml-4 rounded-r-lg backdrop-blur-sm border-r border-white/10"
                >
                    <ChevronLeft className="w-8 h-8 text-white" />
                </button>

                <div
                    ref={scrollContainer}
                    className="flex gap-4 overflow-x-auto pb-8 pt-6 -mt-6 scrollbar-hide snap-x px-1 relative z-30"
                    style={{ scrollBehavior: 'smooth' }}
                >
                    {courses.map(course => (
                        <NetflixCard
                            key={course.id}
                            course={course}
                            showProgress={showProgress}
                            isListed={watchlistItems.includes(course.id)}
                            onToggleList={onToggleList}
                        />
                    ))}
                </div>

                <button
                    onClick={() => scroll('right')}
                    className="absolute right-0 top-0 bottom-0 z-40 w-12 bg-black/60 hover:bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 md:mr-0 rounded-l-lg backdrop-blur-sm border-l border-white/10"
                >
                    <ChevronRight className="w-8 h-8 text-white" />
                </button>
            </div>
        </div>
    );
}

export default function CoursesPage() {
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [watchlist, setWatchlist] = useState<string[]>([]);
    const [userId, setUserId] = useState<string | null>(null);

    async function loadData() {
        setLoading(true);

        let dbCourses: Course[] = [];
        let progressMap: Record<string, number> = {};
        let userWatchlist: string[] = [];
        let currentUserId = null;

        if (supabaseBrowser) {
            // Get User
            const { data: { user } } = await supabaseBrowser.auth.getUser();
            if (user) {
                currentUserId = user.id;
                setUserId(user.id);

                // 1. Fetch Progress
                const { data: progressData } = await supabaseBrowser
                    .from('academy_progress')
                    .select('course_id, progress_seconds, completed')
                    .eq('user_id', user.id);

                if (progressData) {
                    // Calculate percentage roughly. In real app, join with duration.
                    // Here we just map raw or mock percentage
                    progressData.forEach((p: any) => {
                        // Demo logic: assume 3600s total duration for calc if not present
                        const percent = Math.min(100, Math.floor((p.progress_seconds / 3600) * 100)); // improved later
                        progressMap[p.course_id] = percent > 0 ? percent : 0;
                    });
                }

                // 2. Fetch Watchlist
                const { data: watchlistData } = await supabaseBrowser
                    .from('academy_watchlist')
                    .select('course_id')
                    .eq('user_id', user.id);

                if (watchlistData) {
                    userWatchlist = watchlistData.map((w: any) => w.course_id);
                }
            }

            // 3. Fetch Courses
            const { data } = await supabaseBrowser
                .from('academy_courses')
                .select('*')
                .eq('published', true)
                .order('created_at', { ascending: false });

            if (data) dbCourses = data;
        }

        // Merge Data
        if (dbCourses.length > 0) {
            const merged = dbCourses.map(c => ({
                ...c,
                progress: progressMap[c.id] || 0
            }));
            setCourses(merged);
        } else {
            setCourses(MOCK_COURSES);
        }

        setWatchlist(userWatchlist);
        setLoading(false);
    }

    useEffect(() => {
        loadData();
    }, []);

    const toggleWatchlist = async (courseId: string, currentlyInList: boolean) => {
        if (!userId || !supabaseBrowser) return;

        if (currentlyInList) {
            // Remove
            await supabaseBrowser.from('academy_watchlist').delete().match({ user_id: userId, course_id: courseId });
            setWatchlist(prev => prev.filter(id => id !== courseId));
        } else {
            // Add
            await supabaseBrowser.from('academy_watchlist').insert({ user_id: userId, course_id: courseId });
            setWatchlist(prev => [...prev, courseId]);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
                <div className="w-12 h-12 border-4 border-yellow-600 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-slate-400 animate-pulse">{isEn ? 'Loading catalog...' : 'Carregando catálogo...'}</p>
            </div>
        );
    }

    // Featured Logic
    const featuredList = courses.filter(c => c.is_featured);
    if (featuredList.length === 0 && courses.length > 0) {
        featuredList.push(courses[0]);
    }

    // Personalization Logic (REAL)
    // Continue watching: progress > 0 and < 100 (and not completed)
    const continueWatching = courses.filter(c => c.progress && c.progress > 0 && c.progress < 100);

    // My List: Filter courses that are in the watchlist array
    const myList = courses.filter(c => watchlist.includes(c.id));

    // Grouping
    const profecias = courses.filter(c => c.category === 'Profecias' || c.title.toLowerCase().includes('profecia'));
    const theology = courses.filter(c => ['Teologia', 'Formação', 'História'].includes(c.category) && !profecias.includes(c));
    const spirituality = courses.filter(c => ['Vida Espiritual', 'Espiritualidade'].includes(c.category));
    const documentaries = courses.filter(c => ['Documentários', 'Destaques', 'O Milagre'].includes(c.category) && !profecias.includes(c));
    const others = courses.filter(c => !profecias.includes(c) && !theology.includes(c) && !spirituality.includes(c) && !documentaries.includes(c));

    const allOthers = [...others, ...courses].filter((c, index, self) =>
        index === self.findIndex((t) => (t.id === c.id))
    );

    return (
        <VIPLayout>
            <div className="bg-slate-950 min-h-screen pb-20 overflow-x-hidden">
                {featuredList.length > 0 && <HeroBanner featuredCourses={featuredList} />}

                {/* Adjusted negative margin and layout to prevent hero overlap */}
                <div className="relative z-10 -mt-10 md:-mt-24 space-y-2 pb-10">

                    {/* NEW: Personalization Rows */}
                    {continueWatching.length > 0 && (
                        <CarouselSection
                            title={isEn ? "Continue Watching" : "Continuar a Ver"}
                            courses={continueWatching}
                            showProgress={true}
                            watchlistItems={watchlist}
                            onToggleList={toggleWatchlist}
                        />
                    )}
                    {myList.length > 0 && (
                        <CarouselSection
                            title={isEn ? "My List" : "Minha Lista"}
                            courses={myList}
                            watchlistItems={watchlist}
                            onToggleList={toggleWatchlist}
                        />
                    )}

                    {/* Standard Categories */}
                    {profecias.length > 0 && <CarouselSection title={isEn ? "Prophecies & The Future" : "Profecias & O Futuro"} courses={profecias} watchlistItems={watchlist} onToggleList={toggleWatchlist} />}
                    {documentaries.length > 0 && <CarouselSection title={isEn ? "Original Documentaries" : "Documentários Originais"} courses={documentaries} watchlistItems={watchlist} onToggleList={toggleWatchlist} />}
                    {theology.length > 0 && <CarouselSection title={isEn ? "Studies & Theology" : "Estudos & Teologia"} courses={theology} watchlistItems={watchlist} onToggleList={toggleWatchlist} />}
                    {spirituality.length > 0 && <CarouselSection title={isEn ? "Spiritual Life" : "Vida Espiritual"} courses={spirituality} watchlistItems={watchlist} onToggleList={toggleWatchlist} />}

                    {(profecias.length === 0 && documentaries.length === 0) && (
                        <CarouselSection title={isEn ? "Recently Added" : "Adicionados Recentemente"} courses={allOthers} watchlistItems={watchlist} onToggleList={toggleWatchlist} />
                    )}
                </div>
            </div>
        </VIPLayout>
    );
}
