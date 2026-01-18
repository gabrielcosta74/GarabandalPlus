"use client";

import { useState, useEffect } from 'react';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Save, Plus, Trash2, GripVertical, Youtube, Video, ExternalLink } from 'lucide-react';

// --- Types ---
type Course = {
    id: string;
    title: string;
    description: string;
    slug: string;
    category: string;
    instructor: string;
    price: number;
    is_premium: boolean;
    published: boolean;
    thumbnail_url: string;
};

type Episode = {
    id: string;
    title: string;
    video_id: string;
    position: number;
    duration: string;
};

export default function EditCoursePage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;

    const [course, setCourse] = useState<Course | null>(null);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Episode creation state
    const [newEpUrl, setNewEpUrl] = useState("");
    const [newEpTitle, setNewEpTitle] = useState("");

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        if (!supabaseBrowser) return;

        // Load Course
        const { data: c } = await supabaseBrowser
            .from('academy_courses')
            .select('*')
            .eq('id', id)
            .single();

        // Load Episodes
        const { data: e } = await supabaseBrowser
            .from('academy_episodes')
            .select('*')
            .eq('course_id', id)
            .order('position', { ascending: true });

        if (c) setCourse(c);
        if (e) setEpisodes(e);
        setLoading(false);
    };

    const handleSaveCourse = async () => {
        if (!course || !supabaseBrowser) return;
        setSaving(true);
        const { error } = await supabaseBrowser
            .from('academy_courses')
            .update({
                title: course.title,
                description: course.description,
                price: course.price,
                is_premium: course.is_premium,
                category: course.category,
                thumbnail_url: course.thumbnail_url,
                slug: course.slug,
                published: course.published
            })
            .eq('id', id);

        setSaving(false);
        if (error) alert("Erro ao guardar: " + error.message);
    };

    const handleAddEpisode = async () => {
        if (!newEpUrl || !newEpTitle || !supabaseBrowser) return;

        // Extract YouTube ID
        let videoId = "";
        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = newEpUrl.match(youtubeRegex);
        if (match && match[1]) {
            videoId = match[1];
        } else {
            alert("URL do YouTube inválido");
            return;
        }

        const newPos = episodes.length > 0 ? Math.max(...episodes.map(e => e.position)) + 1 : 1;

        const { data, error } = await supabaseBrowser
            .from('academy_episodes')
            .insert({
                course_id: id,
                title: newEpTitle,
                video_provider: 'youtube',
                video_id: videoId,
                position: newPos,
                duration: '00:00' // Placeholder
            })
            .select()
            .single();

        if (data) {
            setEpisodes([...episodes, data]);
            setNewEpUrl("");
            setNewEpTitle("");
        }
        if (error) alert("Erro: " + error.message);
    };

    const handleDeleteEpisode = async (epId: string) => {
        if (!confirm("Apagar episódio?") || !supabaseBrowser) return;

        await supabaseBrowser.from('academy_episodes').delete().eq('id', epId);
        setEpisodes(prev => prev.filter(e => e.id !== epId));
    };

    if (loading || !course) return <div className="p-10 text-center">Carregando...</div>;

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-8 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <Link href="/admin/academy" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">{course.title}</h1>
                        <span className={`text-xs px-2 py-0.5 rounded ${course.published ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                            {course.published ? 'Publicado' : 'Rascunho'}
                        </span>
                    </div>
                </div>
                <button
                    onClick={handleSaveCourse}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                >
                    <Save className="w-4 h-4" />
                    {saving ? 'Guardando...' : 'Guardar Alterações'}
                </button>
            </div>

            <div className="max-w-6xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LEFT: Meta Data */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h3 className="font-bold text-slate-900 border-b pb-2">Detalhes</h3>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título</label>
                            <input
                                value={course.title}
                                onChange={e => setCourse({ ...course, title: e.target.value })}
                                className="w-full p-2 border rounded font-bold"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Slug (URL)</label>
                            <input
                                value={course.slug}
                                onChange={e => setCourse({ ...course, slug: e.target.value })}
                                className="w-full p-2 border rounded bg-slate-50 font-mono text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Capa / Thumbnail (URL)</label>
                            <div className="flex gap-2">
                                <input
                                    value={course.thumbnail_url || ''}
                                    onChange={e => setCourse({ ...course, thumbnail_url: e.target.value })}
                                    placeholder="https://..."
                                    className="w-full p-2 border rounded text-sm"
                                />
                                {course.thumbnail_url && (
                                    <div className="w-10 h-10 rounded bg-slate-200 shrink-0 overflow-hidden bg-center bg-cover border border-slate-300" style={{ backgroundImage: `url('${course.thumbnail_url}')` }} />
                                )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">Recomendado: Imagem horizontal de alta qualidade (1920x1080).</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoria</label>
                            <select
                                value={course.category}
                                onChange={e => setCourse({ ...course, category: e.target.value })}
                                className="w-full p-2 border rounded"
                            >
                                <option>Formação Geral</option>
                                <option>Teologia</option>
                                <option>História</option>
                                <option>Vida Espiritual</option>
                                <option>Documentários</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição</label>
                            <textarea
                                value={course.description || ''}
                                onChange={e => setCourse({ ...course, description: e.target.value })}
                                className="w-full p-2 border rounded h-32 text-sm"
                            />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h3 className="font-bold text-slate-900 border-b pb-2">Acesso & Preço</h3>

                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={course.is_premium}
                                onChange={e => setCourse({ ...course, is_premium: e.target.checked })}
                                className="w-5 h-5 text-blue-600 rounded"
                            />
                            <label className="font-medium text-slate-700">Conteúdo Premium?</label>
                        </div>

                        {course.is_premium && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Preço (€)</label>
                                <input
                                    type="number"
                                    value={course.price}
                                    onChange={e => setCourse({ ...course, price: parseFloat(e.target.value) })}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                        )}

                        <div className="flex items-center gap-3 pt-4 border-t">
                            <input
                                type="checkbox"
                                checked={course.published}
                                onChange={e => setCourse({ ...course, published: e.target.checked })}
                                className="w-5 h-5 text-green-600 rounded"
                            />
                            <label className="font-medium text-slate-700">Publicado (Visível no site)</label>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Episode Manager */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-900 border-b pb-4 mb-4 flex items-center gap-2">
                            <Video className="w-5 h-5 text-slate-500" />
                            Episódios ({episodes.length})
                        </h3>

                        {/* Add Episode Form */}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
                            <h4 className="font-bold text-sm text-slate-700 mb-3">Adicionar Novo Episódio</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                <input
                                    placeholder="Título do Episódio (Ex: Aula 1)"
                                    className="p-2 border rounded"
                                    value={newEpTitle}
                                    onChange={e => setNewEpTitle(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Youtube className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                                        <input
                                            placeholder="Link do YouTube"
                                            className="w-full pl-8 p-2 border rounded"
                                            value={newEpUrl}
                                            onChange={e => setNewEpUrl(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleAddEpisode}
                                disabled={!newEpTitle || !newEpUrl}
                                className="w-full py-2 bg-slate-800 text-white rounded font-bold hover:bg-slate-900 transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" /> Adicionar Vídeo
                            </button>
                        </div>

                        {/* Episode List */}
                        <div className="space-y-2">
                            {episodes.map((ep, idx) => (
                                <div key={ep.id} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-lg hover:border-slate-300 transition-colors group shadow-sm">
                                    <div className="text-slate-400 cursor-move">
                                        <GripVertical className="w-5 h-5" />
                                    </div>
                                    <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center text-xs font-bold text-slate-500">
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-slate-800">{ep.title}</div>
                                        <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
                                            ID: {ep.video_id}
                                            <a href={`https://youtu.be/${ep.video_id}`} target="_blank" className="hover:text-blue-500">
                                                <ExternalLink className="w-3 h-3 inline" />
                                            </a>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteEpisode(ep.id)}
                                        className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {episodes.length === 0 && (
                                <div className="text-center py-10 text-slate-400 text-sm italic">
                                    Ainda sem episódios. Adicione o primeiro acima.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
