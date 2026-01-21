"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import AdminLayout from '../../../components/admin/AdminLayout'; // Ensure AdminLayout usage if consistently used across admin
import { Plus, Search, Edit, Trash2, Eye, EyeOff, Film, Filter, MoreVertical, LayoutGrid, List as ListIcon, BookOpen, MonitorPlay } from 'lucide-react';

type Course = {
    id: string;
    title: string;
    category: string;
    published: boolean;
    is_premium: boolean;
    price: number;
    created_at: string;
    instructor: string;
    thumbnail_url?: string;
    format?: string;
};

export default function AdminCoursesPage() {
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

    // Fetch Courses
    useEffect(() => {
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        setLoading(true);
        if (!supabaseBrowser) {
            setLoading(false);
            return;
        }
        const { data } = await supabaseBrowser
            .from('academy_courses')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setCourses(data);
        setLoading(false);
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm("Tem a certeza absoluta? Esta ação é irreversível.")) return;

        if (!supabaseBrowser) return;

        const { error } = await supabaseBrowser
            .from('academy_courses')
            .delete()
            .eq('id', id);

        if (!error) {
            setCourses(prev => prev.filter(c => c.id !== id));
        } else {
            alert("Erro ao apagar: " + error.message);
        }
    };

    const filteredCourses = courses.filter(c =>
        c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AdminLayout title="Gestor de Conteúdo" isLoading={loading}>
            <div className="pb-20">
                {/* Header */}
                <div className="mb-6 md:mb-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Gestor de Conteúdo</h1>
                            <p className="text-slate-500 mt-1 text-sm md:text-base">Gerencie cursos, palestras e vídeos da Academia.</p>
                        </div>
                        <Link
                            href="/admin/academy/new"
                            className="bg-slate-900 hover:bg-slate-800 text-white !text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-1"
                        >
                            <Plus className="w-5 h-5" />
                            Criar Novo Conteúdo
                        </Link>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="mb-6 md:mb-8 bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative flex-1 w-full md:max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Pesquisar por título, categoria..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 md:py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                        />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto justify-end hidden md:flex">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                            <ListIcon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                            <LayoutGrid className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div>
                    {loading ? (
                        <div className="text-center py-20 animate-pulse">
                            <div className="w-12 h-12 bg-slate-200 rounded-full mx-auto mb-4"></div>
                            <div className="h-4 w-48 bg-slate-200 mx-auto rounded"></div>
                        </div>
                    ) : filteredCourses.length === 0 ? (
                        <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-300 p-4">
                            <Film className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Sem conteúdo encontrado</h3>
                            <p className="text-slate-500 mb-8 max-w-sm mx-auto">Parece que ainda não criou nada. Comece por adicionar o seu primeiro curso ou vídeo.</p>
                            <Link href="/admin/academy/new" className="text-primary font-bold hover:underline">
                                Começar Agora &rarr;
                            </Link>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View (Only visible if list mode AND desktop) */}
                            <div className={`hidden md:block ${viewMode === 'list' ? '' : 'md:hidden'}`}>
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-xs uppercase tracking-wider">
                                            <tr>
                                                <th className="px-6 py-4">Título</th>
                                                <th className="px-6 py-4">Tipo</th>
                                                <th className="px-6 py-4">Categoria</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredCourses.map(course => (
                                                <tr key={course.id} className="hover:bg-slate-50/80 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 relative">
                                                                {course.thumbnail_url ? (
                                                                    <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-slate-300"><Film className="w-5 h-5" /></div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-900">{course.title}</div>
                                                                <div className="text-xs text-slate-500 font-mono">{course.instructor || 'Sem instrutor'}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {course.format === 'course' ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                                                <BookOpen className="w-3 h-3" /> Curso
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold bg-purple-50 text-purple-700 border border-purple-100">
                                                                <Film className="w-3 h-3" /> Vídeo
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="px-2.5 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600 border border-slate-200">
                                                            {course.category}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`w-2 h-2 rounded-full ${course.published ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
                                                            <span className={`text-xs font-bold ${course.published ? 'text-green-700' : 'text-amber-700'}`}>
                                                                {course.published ? 'Publicado' : 'Rascunho'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Link
                                                                href={`/admin/academy/${course.id}`}
                                                                className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors group/btn"
                                                                title="Editar"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </Link>
                                                            <button
                                                                onClick={(e) => handleDelete(e, course.id)}
                                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Mobile Optimized View (Always visible on mobile, replacing both list and grid desktop modes for consistency) */}
                            <div className="flex flex-col gap-4 md:hidden">
                                {filteredCourses.map(course => (
                                    <Link
                                        href={`/admin/academy/${course.id}`}
                                        key={course.id}
                                        className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-4 active:scale-[0.98] transition-all relative overflow-hidden"
                                    >
                                        {/* Thumbnail */}
                                        <div className="w-24 h-24 shrink-0 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden relative">
                                            {course.thumbnail_url ? (
                                                <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-300"><Film className="w-6 h-6" /></div>
                                            )}
                                            <div className="absolute top-1 left-1">
                                                {course.format === 'course' ?
                                                    <div className="bg-blue-600/90 p-1 rounded text-white"><BookOpen className="w-3 h-3" /></div> :
                                                    <div className="bg-purple-600/90 p-1 rounded text-white"><Film className="w-3 h-3" /></div>
                                                }
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                            <div>
                                                <div className="flex justify-between items-start gap-2">
                                                    <h3 className="font-bold text-slate-900 leading-tight line-clamp-2">{course.title}</h3>
                                                    <button
                                                        onClick={(e) => handleDelete(e, course.id)}
                                                        className="p-2 -mr-2 -mt-2 text-slate-300 hover:text-red-500 z-10"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="text-xs text-slate-500 mb-2 truncate">{course.instructor}</div>
                                            </div>

                                            <div className="flex items-center gap-3 mt-auto">
                                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${course.published ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                    {course.published ? 'ON' : 'OFF'}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate border border-slate-100 px-1.5 py-0.5 rounded bg-slate-50">
                                                    {course.category}
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>

                            {/* Desktop Grid View (Only if grid mode enabled) */}
                            <div className={`hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${viewMode === 'grid' ? '' : 'hidden'}`}>
                                {filteredCourses.map(course => (
                                    <div key={course.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                                        <div className="aspect-video bg-slate-100 relative overflow-hidden">
                                            {course.thumbnail_url ? (
                                                <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-300"><Film className="w-8 h-8" /></div>
                                            )}
                                            <div className="absolute top-2 right-2 flex gap-1">
                                                {course.format === 'course' ?
                                                    <span className="bg-blue-600 text-white px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1"><BookOpen className="w-3 h-3" /> Curso</span> :
                                                    <span className="bg-purple-600 text-white px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1"><Film className="w-3 h-3" /> Vídeo</span>
                                                }
                                            </div>
                                        </div>
                                        <div className="p-5">
                                            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">{course.category}</div>
                                            <h3 className="font-bold text-slate-900 mb-1 leading-tight line-clamp-2 h-10">{course.title}</h3>
                                            <p className="text-xs text-slate-500 mb-4">{course.instructor || 'Sem instrutor'}</p>

                                            <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                                                <span className={`text-xs font-bold ${course.is_premium ? 'text-amber-600' : 'text-green-600'}`}>
                                                    {course.is_premium ? 'Premium' : 'Gratuito'}
                                                </span>
                                                <div className="flex gap-2">
                                                    <Link href={`/admin/academy/${course.id}`} className="text-sm font-bold text-slate-900 hover:text-blue-600">Editar</Link>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
