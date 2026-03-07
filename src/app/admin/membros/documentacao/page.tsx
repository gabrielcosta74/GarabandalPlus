"use client";

import { useState, useEffect } from 'react';
import AdminLayout from '../../../../components/admin/AdminLayout';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import { Toaster, toast } from 'sonner';
import { 
    FolderLock, FileText, Music, Image as ImageIcon, 
    Plus, Trash2, Edit2, ChevronRight, Save, X, Loader2, Eye, EyeOff
} from 'lucide-react';
import ImageUpload from '../../../../components/admin/ImageUpload';

type MemberContent = {
    id: string;
    title: string;
    description: string | null;
    type: 'pdf' | 'audio' | 'gallery';
    file_url: string | null;
    is_published: boolean;
    created_at: string;
    member_gallery_images?: { count: number }[];
};

export default function MemberDocumentationPage() {
    const [contents, setContents] = useState<MemberContent[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    
    // Form state
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        type: 'pdf' as 'pdf' | 'audio' | 'gallery',
        is_published: false
    });

    useEffect(() => {
        fetchContents();
    }, []);

    const fetchContents = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabaseBrowser!.auth.getSession();
            const res = await fetch('/api/admin/member-contents', {
                 headers: { Authorization: `Bearer ${session?.access_token}` }
            });
            if (!res.ok) throw new Error("Failed to fetch contents");
            const data = await res.json();
            setContents(data.contents || []);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            const { data: { session } } = await supabaseBrowser!.auth.getSession();
            const res = await fetch('/api/admin/member-contents', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify(formData)
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            
            toast.success("Conteúdo criado com sucesso!");
            setIsCreateModalOpen(false);
            setFormData({ title: '', description: '', type: 'pdf', is_published: false });
            fetchContents(); // Refresh list
            
            // NOTE: The user should now be navigated to the edit page or open a detail modal to upload files!
            window.location.href = `/admin/membros/documentacao/${data.content.id}`;
            
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setCreating(false);
        }
    };

    const togglePublishStatus = async (content: MemberContent) => {
        try {
            const { data: { session } } = await supabaseBrowser!.auth.getSession();
            const res = await fetch(`/api/admin/member-contents/${content.id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ is_published: !content.is_published })
            });
            if (!res.ok) throw new Error("Failed to update");
            
            setContents(prev => prev.map(c => c.id === content.id ? { ...c, is_published: !content.is_published } : c));
            toast.success(content.is_published ? "Ocultado com sucesso" : "Publicado com sucesso");
        } catch (error: any) {
            toast.error("Erro: " + error.message);
        }
    };

    const getTypeIcon = (type: string) => {
        if (type === 'pdf') return <FileText className="w-5 h-5 text-red-500" />;
        if (type === 'audio') return <Music className="w-5 h-5 text-purple-500" />;
        return <ImageIcon className="w-5 h-5 text-blue-500" />;
    };
    const getTypeLabel = (type: string) => {
        if (type === 'pdf') return 'Documento PDF';
        if (type === 'audio') return 'Ficheiro Áudio';
        return 'Galeria de Fotos';
    };

    return (
        <AdminLayout title="Documentação Privada" isLoading={loading}>
            <Toaster position="top-right" richColors />
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold font-serif text-slate-900 flex items-center gap-2">
                        <FolderLock className="w-6 h-6 text-garabandal-gold" />
                        Área Documental Privada
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Materiais exclusivos apenas para membros ativos.</p>
                </div>
                
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-garabandal-dark text-white font-bold rounded-xl hover:bg-garabandal-dark/90 transition-all shadow-md"
                >
                    <Plus className="w-5 h-5" /> Novo Material
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {contents.map((content) => (
                    <div key={content.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow group">
                        <div className="p-5 flex-1">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    {getTypeIcon(content.type)}
                                </div>
                                <button 
                                    onClick={() => togglePublishStatus(content)}
                                    className={`px-3 py-1 rounded-full text-xs font-bold font-mono transition-colors border ${content.is_published ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}
                                >
                                    {content.is_published ? 'PÚBLICO' : 'OCULTO'}
                                </button>
                            </div>
                            
                            <h3 className="text-lg font-bold text-slate-900 mb-1 line-clamp-2">{content.title}</h3>
                            <p className="text-sm text-slate-500 mb-4 font-medium uppercase tracking-wider">{getTypeLabel(content.type)}</p>
                            
                            {content.description && (
                                <p className="text-sm text-slate-600 line-clamp-3 mb-4">{content.description}</p>
                            )}
                            
                            {content.type === 'gallery' && content.member_gallery_images && content.member_gallery_images.length > 0 && (
                                <div className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md w-fit">
                                    {content.member_gallery_images[0]?.count || 0} fotos na galeria
                                </div>
                            )}
                        </div>
                        
                        <div className="border-t border-slate-100 bg-slate-50 p-3 px-5 flex justify-between items-center group-hover:bg-garabandal-dark/5 transition-colors">
                            <span className="text-xs font-bold text-slate-400">
                                {new Date(content.created_at).toLocaleDateString('pt-PT')}
                            </span>
                            
                            <a 
                                href={`/admin/membros/documentacao/${content.id}`}
                                className="flex items-center gap-1 text-sm font-bold text-garabandal-dark hover:text-garabandal-gold transition-colors"
                            >
                                Gerir <Edit2 className="w-4 h-4 ml-1" />
                            </a>
                        </div>
                    </div>
                ))}
            </div>

            {contents.length === 0 && !loading && (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                    <FolderLock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-700 mb-2">Sem Materiais</h3>
                    <p className="text-slate-500 max-w-sm mx-auto">Ainda não adicionaste nenhum conteúdo para os teus membros. Clica em "Novo Material" para começar.</p>
                </div>
            )}

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-xl font-bold font-serif text-slate-900">Novo Material Privado</h3>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleCreate} className="p-6 overflow-y-auto space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Tipo de Material</label>
                                <div className="grid grid-cols-3 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({...formData, type: 'pdf'})}
                                        className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${formData.type === 'pdf' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-100 bg-white hover:border-slate-200 text-slate-500'}`}
                                    >
                                        <FileText className="w-6 h-6" />
                                        <span className="text-xs font-bold uppercase">PDF</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({...formData, type: 'audio'})}
                                        className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${formData.type === 'audio' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-100 bg-white hover:border-slate-200 text-slate-500'}`}
                                    >
                                        <Music className="w-6 h-6" />
                                        <span className="text-xs font-bold uppercase">Áudio</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({...formData, type: 'gallery'})}
                                        className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${formData.type === 'gallery' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 bg-white hover:border-slate-200 text-slate-500'}`}
                                    >
                                        <ImageIcon className="w-6 h-6" />
                                        <span className="text-xs font-bold uppercase">Galeria</span>
                                    </button>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Título</label>
                                <input
                                    required
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-garabandal-dark outline-none transition-all"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="Ex: Formação - Março 2026"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Descrição (Opcional)</label>
                                <textarea
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl h-24 resize-none focus:ring-2 focus:ring-garabandal-dark outline-none transition-all"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Um breve resumo sobre este conteúdo..."
                                />
                            </div>
                            
                            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" className="sr-only peer" checked={formData.is_published} onChange={(e) => setFormData({...formData, is_published: e.target.checked})} />
                                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                </label>
                                <div>
                                    <p className="text-sm font-bold text-slate-800">Publicar imediatamente?</p>
                                    <p className="text-xs text-slate-500">Se ativo, os membros com quotas pagas poderão ver.</p>
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-slate-100">
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="w-full py-4 bg-garabandal-dark text-white font-bold rounded-xl hover:bg-gray-900 transition-colors shadow-lg shadow-black/10 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
                                >
                                    {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Continuar para Upload"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
