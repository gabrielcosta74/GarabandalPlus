"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import Link from 'next/link';
import { ArrowLeft, Save, Plus, Trash2, GripVertical, Image as ImageIcon, Video, Layers, MonitorPlay, Settings, DollarSign, Globe, Check, Eye, Film, BookOpen, Star, Loader2 } from 'lucide-react';

type Episode = {
    id?: string;
    title: string;
    video_id: string;
    description: string;
    duration: string;
    position: number;
};

export default function CourseEditor() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;
    const isNew = id === 'new';

    const [activeTab, setActiveTab] = useState<'general' | 'media' | 'episodes' | 'settings'>('general');
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'Teologia',
        format: 'course', // 'course' | 'single'
        instructor: '',
        thumbnail_url: '',
        price: 0,
        is_premium: false,
        published: false,
        is_featured: false,
        slug: ''
    });

    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [singleVideoUrl, setSingleVideoUrl] = useState('');
    const [singleDuration, setSingleDuration] = useState('00:00');

    useEffect(() => {
        if (!isNew) {
            loadCourse();
        }
    }, [id]);

    const loadCourse = async () => {
        setLoading(true);
        const supabase = supabaseBrowser;
        if (!supabase) {
            setLoading(false);
            return;
        }

        const { data: course, error } = await supabase
            .from('academy_courses')
            .select('*')
            .eq('id', id)
            .single();

        if (course) {
            setFormData({
                title: course.title || '',
                description: course.description || '',
                category: course.category || 'Teologia',
                format: course.format || 'course',
                instructor: course.instructor || '',
                thumbnail_url: course.thumbnail_url || '',
                price: course.price || 0,
                is_premium: course.is_premium || false,
                published: course.published || false,
                is_featured: course.is_featured || false,
                slug: course.slug || ''
            });

            const { data: eps } = await supabase
                .from('academy_episodes')
                .select('*')
                .eq('course_id', id)
                .order('position', { ascending: true });

            if (eps && eps.length > 0) {
                setEpisodes(eps);
                if (course.format === 'single' || eps.length === 1) {
                    setSingleVideoUrl(eps[0].video_id ? `https://youtu.be/${eps[0].video_id}` : '');
                    setSingleDuration(eps[0].duration || '00:00');
                }
            }
        }
        setLoading(false);
    };

    const handleSave = async () => {
        const supabase = supabaseBrowser;
        if (!supabase) return;
        setSaving(true);

        const courseData = {
            ...formData,
            slug: formData.slug || formData.title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')
        };

        let courseId = id;

        if (isNew) {
            const { data, error } = await supabase.from('academy_courses').insert([courseData]).select().single();
            if (error) { alert('Erro ao criar: ' + error.message); setSaving(false); return; }
            courseId = data.id;
        } else {
            const { error } = await supabase.from('academy_courses').update(courseData).eq('id', id);
            if (error) { alert('Erro ao atualizar: ' + error.message); setSaving(false); return; }
        }

        if (formData.format === 'single') {
            let videoId = '';
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
            const match = singleVideoUrl.match(regExp);
            if (match && match[2].length === 11) {
                videoId = match[2];
            } else if (singleVideoUrl.length === 11) {
                videoId = singleVideoUrl;
            }

            await supabase.from('academy_episodes').delete().eq('course_id', courseId);
            if (videoId) {
                await supabase.from('academy_episodes').insert([{
                    course_id: courseId,
                    title: formData.title,
                    video_id: videoId,
                    description: formData.description,
                    duration: singleDuration,
                    position: 1,
                    video_provider: 'youtube'
                }]);
            }
        } else {
            for (const [index, ep] of episodes.entries()) {
                const epData = {
                    course_id: courseId,
                    title: ep.title,
                    video_id: ep.video_id,
                    description: ep.description,
                    duration: ep.duration,
                    position: index + 1
                };
                if (ep.id) {
                    await supabase.from('academy_episodes').update(epData).eq('id', ep.id);
                } else {
                    await supabase.from('academy_episodes').insert([epData]);
                }
            }
        }

        if (isNew) router.push(`/admin/academy/${courseId}`);
        else alert('Guardado com sucesso!');

        setSaving(false);
    };

    const addEpisode = () => {
        setEpisodes([...episodes, { title: 'Nova Aula', video_id: '', description: '', duration: '00:00', position: episodes.length + 1 }]);
        setActiveTab('episodes');
    };

    const removeEpisode = (index: number) => {
        if (!confirm('Apagar aula?')) return;
        const newEps = [...episodes];
        const toDelete = newEps[index];
        const supabase = supabaseBrowser;
        if (toDelete.id && supabase) {
            supabase.from('academy_episodes').delete().eq('id', toDelete.id).then();
        }
        newEps.splice(index, 1);
        setEpisodes(newEps);
    };

    const updateEpisode = (index: number, field: keyof Episode, value: any) => {
        const newEps = [...episodes];
        let finalValue = value;
        if (field === 'video_id') {
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
            const match = value.match(regExp);
            if (match && match[2].length === 11) finalValue = match[2];
        }
        newEps[index] = { ...newEps[index], [field]: finalValue };
        setEpisodes(newEps);
    };

    if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

    const tabs = [
        { id: 'general', label: 'Geral', icon: Layers },
        { id: 'media', label: 'Media', icon: ImageIcon },
        ...(formData.format === 'course' ? [{ id: 'episodes', label: `Aulas (${episodes.length})`, icon: MonitorPlay }] : []),
        { id: 'settings', label: 'Config', icon: Settings },
    ] as const;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col pb-20">
            {/* Responsive Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 md:px-6 md:py-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link href="/admin/academy" className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 shrink-0">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg md:text-xl font-bold text-slate-900 truncate">{isNew ? 'Novo Conteúdo' : formData.title}</h1>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                {formData.format === 'course' ? <span className="font-bold text-blue-600">CURSO</span> : <span className="font-bold text-purple-600">VÍDEO</span>}
                                <span>•</span>
                                <span>{formData.published ? 'Publicado' : 'Rascunho'}</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 md:py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-all active:scale-[0.98]"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        <span className="md:hidden">Guardar Alterações</span>
                        <span className="hidden md:inline">Guardar</span>
                    </button>
                </div>

                {/* Mobile Scrollable Tabs */}
                <div className="mt-4 -mx-4 md:hidden overflow-x-auto scrollbar-hide border-t border-slate-100">
                    <div className="flex px-4 pt-2 pb-1 gap-2 w-max">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap flex items-center gap-2 transition-colors ${activeTab === tab.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row max-w-7xl mx-auto w-full p-4 md:p-6 gap-6 md:gap-8">
                {/* Desktop Sidebar Navigation */}
                <div className="hidden lg:block w-64 flex-shrink-0 space-y-2 sticky top-24 self-start">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-colors ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'}`}
                        >
                            <tab.icon className="w-4 h-4" /> {tab.label}
                        </button>
                    ))}
                </div>

                {/* Main Content Form */}
                <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-8 min-h-[500px]">

                    {activeTab === 'general' && (
                        <div className="space-y-6 max-w-2xl animate-fade-in">
                            {/* Format Selector */}
                            <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-xl mb-6">
                                <button
                                    onClick={() => setFormData({ ...formData, format: 'course' })}
                                    className={`py-2 px-1 rounded-lg text-xs md:text-sm font-bold transition-all flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 ${formData.format === 'course' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <BookOpen className="w-4 h-4" /> Curso Completo
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, format: 'single' })}
                                    className={`py-2 px-1 rounded-lg text-xs md:text-sm font-bold transition-all flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 ${formData.format === 'single' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Film className="w-4 h-4" /> Vídeo Único
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Título</label>
                                <input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full text-lg font-medium border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" placeholder="Ex: A Mensagem de Garabandal" />
                            </div>

                            {/* Single Format: Video URL */}
                            {formData.format === 'single' && (
                                <div className="bg-purple-50 p-4 md:p-6 rounded-xl border border-purple-100 space-y-4 animate-fade-in">
                                    <h4 className="font-bold text-purple-900 flex items-center gap-2"><Video className="w-4 h-4" /> Dados do Vídeo Principal</h4>
                                    <div>
                                        <label className="block text-xs font-bold text-purple-700 mb-1">Link do YouTube</label>
                                        <input
                                            value={singleVideoUrl}
                                            onChange={e => setSingleVideoUrl(e.target.value)}
                                            className="w-full border border-purple-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                            placeholder="https://youtu.be/..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-purple-700 mb-1">Duração</label>
                                        <input
                                            value={singleDuration}
                                            onChange={e => setSingleDuration(e.target.value)}
                                            className="w-full md:w-32 border border-purple-200 rounded-lg p-3 text-sm bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                                            placeholder="00:00"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Categoria</label>
                                    <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm h-[50px]">
                                        <option>Teologia</option>
                                        <option>Vida Espiritual</option>
                                        <option>História</option>
                                        <option>Profecias</option>
                                        <option>O Milagre</option>
                                        <option>Mariologia</option>
                                        <option>Documentários</option>
                                        <option>Atualidade</option>
                                        <option>Formação</option>
                                        <option>Destaques</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Instrutor / Autor</label>
                                    <input value={formData.instructor} onChange={e => setFormData({ ...formData, instructor: e.target.value })} className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm h-[50px]" placeholder="Ex: Padre Rodrigo" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Descrição Curta</label>
                                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={4} className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" placeholder="Resumo do conteúdo..." />
                            </div>
                        </div>
                    )}

                    {activeTab === 'media' && (
                        <div className="space-y-8 max-w-2xl animate-fade-in">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Capa / Thumbnail (URL)</label>
                                <div className="flex gap-4">
                                    <input type="text" value={formData.thumbnail_url} onChange={e => setFormData({ ...formData, thumbnail_url: e.target.value })} className="flex-1 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" placeholder="https://..." />
                                </div>
                            </div>
                            <div className="aspect-video bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center relative group shadow-sm">
                                {formData.thumbnail_url ? <img src={formData.thumbnail_url} alt="Preview" className="w-full h-full object-cover" /> : <div className="text-center text-slate-400"><ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" /><p className="text-sm font-bold">Sem imagem de capa</p></div>}
                            </div>
                        </div>
                    )}

                    {activeTab === 'episodes' && formData.format === 'course' && (
                        <div className="animate-fade-in max-w-4xl">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                <div><h3 className="font-bold text-slate-900 text-lg">Conteúdo Programático</h3><p className="text-sm text-slate-500">Adicione e organize as aulas do curso.</p></div>
                                <button onClick={addEpisode} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-4 py-3 md:py-2 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm w-full md:w-auto"><Plus className="w-4 h-4" /> Adicionar Aula</button>
                            </div>
                            <div className="space-y-4">
                                {episodes.map((ep, index) => (
                                    <div key={index} className="bg-white border border-slate-200 rounded-xl p-4 md:p-6 flex flex-col md:flex-row gap-4 items-start group shadow-sm hover:shadow-md transition-all">
                                        <div className="hidden md:block mt-3 text-slate-300 cursor-move hover:text-slate-500 transition-colors"><GripVertical className="w-5 h-5" /></div>
                                        <div className="flex-1 space-y-4 w-full">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">Aula {index + 1}</span>
                                                <button onClick={() => removeEpisode(index)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors md:hidden"><Trash2 className="w-5 h-5" /></button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                <div className="md:col-span-3">
                                                    <label className="block text-xs font-bold text-slate-500 mb-1">Título</label>
                                                    <input type="text" value={ep.title} onChange={(e) => updateEpisode(index, 'title', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-3 md:py-2 text-sm font-bold text-slate-900 outline-none" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 mb-1">Duração</label>
                                                    <input type="text" value={ep.duration} onChange={(e) => updateEpisode(index, 'duration', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-3 md:py-2 text-sm font-mono text-center outline-none" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1">ID YouTube</label>
                                                <input type="text" value={ep.video_id} onChange={(e) => updateEpisode(index, 'video_id', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-3 md:py-2 text-sm font-mono outline-none" placeholder="ID" />
                                            </div>
                                        </div>
                                        <button onClick={() => removeEpisode(index)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-2 hidden md:block"><Trash2 className="w-5 h-5" /></button>
                                    </div>
                                ))}
                                {episodes.length === 0 && <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl text-slate-400"><MonitorPlay className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>Nenhuma aula adicionada.</p></div>}
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="space-y-6 md:space-y-8 max-w-2xl animate-fade-in">
                            <div className="bg-slate-50 p-4 md:p-6 rounded-xl border border-slate-200">
                                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Globe className="w-5 h-5 text-blue-500" /> SEO & URL</h3>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Slug</label>
                                    <div className="flex items-center flex-col md:flex-row gap-0">
                                        <span className="bg-slate-200 text-slate-500 px-3 py-3 rounded-t-xl md:rounded-l-xl md:rounded-tr-none border border-b-0 md:border-b md:border-r-0 border-slate-200 font-mono text-sm w-full md:w-auto text-center md:text-left">/curso/</span>
                                        <input type="text" value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} className="flex-1 border border-slate-200 rounded-b-xl md:rounded-r-xl md:rounded-bl-none p-3 outline-none font-mono text-sm w-full" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-yellow-50 p-4 md:p-6 rounded-xl border border-yellow-200">
                                <h3 className="font-bold text-yellow-800 mb-4 flex items-center gap-2"><Star className="w-5 h-5" /> Configuração de Destaque</h3>
                                <label className="flex items-start md:items-center gap-3 cursor-pointer p-4 bg-white rounded-lg border border-yellow-200 hover:border-yellow-500 transition-colors shadow-sm">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${formData.is_featured ? 'bg-yellow-500 border-yellow-500' : 'border-slate-300'}`}>{formData.is_featured && <Check className="w-3.5 h-3.5 text-white" />}</div>
                                    <input type="checkbox" className="hidden" checked={formData.is_featured} onChange={e => setFormData({ ...formData, is_featured: e.target.checked })} />
                                    <div>
                                        <span className="font-bold text-slate-900 block">Destaque Principal (Hero)</span>
                                        <span className="text-xs text-slate-500">Este conteúdo aparecerá no banner gigante no topo da Academy.</span>
                                    </div>
                                </label>
                            </div>

                            <div className="bg-slate-50 p-4 md:p-6 rounded-xl border border-slate-200">
                                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-600" /> Acesso & Preço</h3>
                                <div className="space-y-4">
                                    <label className="flex items-center gap-3 cursor-pointer p-4 bg-white rounded-lg border border-slate-200 hover:border-blue-500 transition-colors shadow-sm">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${formData.is_premium ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>{formData.is_premium && <Check className="w-3.5 h-3.5 text-white" />}</div>
                                        <input type="checkbox" className="hidden" checked={formData.is_premium} onChange={e => setFormData({ ...formData, is_premium: e.target.checked })} />
                                        <div><span className="font-bold text-slate-900 block">Conteúdo Premium</span></div>
                                    </label>
                                    {formData.is_premium && (<div className="pl-0 md:pl-8 animate-fade-in"><label className="block text-sm font-bold text-slate-700 mb-2">Preço (€)</label><input type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} className="w-full md:w-32 border border-slate-200 rounded-xl p-3 outline-none shadow-sm" placeholder="0.00" /></div>)}
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 md:p-6 rounded-xl border border-slate-200">
                                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Eye className="w-5 h-5 text-slate-700" /> Visibilidade</h3>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={formData.published} onChange={e => setFormData({ ...formData, published: e.target.checked })} className="sr-only peer" />
                                    <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
                                    <span className="ml-3 text-sm font-bold text-slate-900">{formData.published ? 'Publicado' : 'Rascunho (Oculto)'}</span>
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
