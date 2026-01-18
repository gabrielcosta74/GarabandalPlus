"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { Plus, Search, Edit, Trash2, Eye, EyeOff, Film, ChevronRight } from 'lucide-react';

type Course = {
    id: string;
    title: string;
    category: string;
    published: boolean;
    is_premium: boolean;
    price: number;
    created_at: string;
    instructor: string;
};

export default function AdminAcademyList() {
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Fetch Courses
    useEffect(() => {
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        setLoading(true);
        const { data, error } = await supabaseBrowser
            .from('academy_courses')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setCourses(data);
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem a certeza? Isto apagará o curso e todos os episódios.")) return;

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

    const togglePublish = async (course: Course) => {
        const { error } = await supabaseBrowser
            .from('academy_courses')
            .update({ published: !course.published })
            .eq('id', course.id);

        if (!error) {
            setCourses(prev => prev.map(c => c.id === course.id ? { ...c, published: !c.published } : c));
        }
    };

    const filteredCourses = courses.filter(c =>
        c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 max-w-7xl mx-auto text-slate-900">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Film className="w-8 h-8 text-slate-700" />
                        Gestão da Academia
                    </h1>
                    <p className="text-slate-500">Gerir cursos, episódios e conteúdos.</p>
                </div>
                <Link
                    href="/admin/academy/new"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg"
                >
                    <Plus className="w-5 h-5" />
                    Novo Curso
                </Link>
            </div>

            {/* Filters */}
            <div className="mb-6 flex gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Pesquisar por título ou categoria..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="text-center py-20 text-slate-500">Carregando cursos...</div>
            ) : filteredCourses.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                    <Film className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-700">Nenhum curso encontrado</h3>
                    <p className="text-slate-500 mb-6">Comece por criar o seu primeiro curso.</p>
                    <Link href="/admin/academy/new" className="text-blue-600 font-bold hover:underline">Criar Curso</Link>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Curso</th>
                                <th className="px-6 py-4">Categoria</th>
                                <th className="px-6 py-4">Acesso (Premium)</th>
                                <th className="px-6 py-4">Estado</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredCourses.map(course => (
                                <tr key={course.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900">{course.title}</div>
                                        <div className="text-xs text-slate-500">{course.instructor}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-600">
                                            {course.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {course.is_premium ? (
                                            <span className="text-amber-600 font-bold text-xs flex items-center gap-1">
                                                ★ Premium ({course.price} €)
                                            </span>
                                        ) : (
                                            <span className="text-green-600 font-bold text-xs">
                                                Grátis
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => togglePublish(course)}
                                            className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full transition-colors ${course.published
                                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                                }`}
                                        >
                                            {course.published ? <><Eye className="w-3 h-3" /> Publicado</> : <><EyeOff className="w-3 h-3" /> Rascunho</>}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Link
                                                href={`/admin/academy/${course.id}`}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Editar Episódios"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Link>
                                            <button
                                                onClick={() => handleDelete(course.id)}
                                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            <Link href={`/admin/academy/${course.id}`} className="ml-2 text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center">
                                                Gerir <ChevronRight className="w-3 h-3" />
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
