"use client";

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '../../../../../components/admin/AdminLayout';
import { getBrowserAccessToken, supabaseBrowser } from '../../../../../lib/supabase-browser';
import { Toaster, toast } from 'sonner';
import { 
    ArrowLeft, FileText, Music, Image as ImageIcon, Save, Trash2, Loader2, UploadCloud, Play, File, Plus
} from 'lucide-react';
import ImageUpload from '../../../../../components/admin/ImageUpload';
import PdfCategoryPicker from '../../../../../components/admin/PdfCategoryPicker';

type MemberContentCategory = {
    id: string;
    name: string;
    slug: string;
};

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
    cover_image_url: string | null;
    category_id: string | null;
    category: MemberContentCategory | null;
    is_published: boolean;
    member_gallery_images?: MemberGalleryImage[];
};

export default function MemberContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const [content, setContent] = useState<MemberContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    
    // Form state
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        is_published: false,
        category_id: null as string | null,
        cover_image_url: ''
    });

    useEffect(() => {
        fetchContent();
    }, [resolvedParams.id]);

    const fetchContent = async () => {
        setLoading(true);
        try {
            const token = await getBrowserAccessToken();
            const res = await fetch(`/api/admin/member-contents/${resolvedParams.id}`, {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store'
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || "Failed to fetch content details");
            setContent(data.content);
            setFormData({
                title: data.content.title,
                description: data.content.description || '',
                is_published: data.content.is_published,
                category_id: data.content.category_id || null,
                cover_image_url: data.content.cover_image_url || ''
            });
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveInfo = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setSaving(true);
        try {
            const token = await getBrowserAccessToken();
            const res = await fetch(`/api/admin/member-contents/${resolvedParams.id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: formData.title,
                    description: formData.description,
                    is_published: formData.is_published,
                    file_url: content?.file_url,
                    category_id: content?.type === 'pdf' ? formData.category_id : null,
                    cover_image_url: content?.type === 'pdf' ? formData.cover_image_url || null : null
                })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || "Failed to update content");
            toast.success("Informações salvas com sucesso!");
            fetchContent();
        } catch (error: any) {
            toast.error("Erro: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Tem a certeza que quer apagar este material? Esta acção é irreversível e irá apagar os ficheiros associados.")) return;
        
        try {
            const token = await getBrowserAccessToken();
            const res = await fetch(`/api/admin/member-contents/${resolvedParams.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to delete content");
            toast.success("Material apagado com sucesso!");
            router.push('/admin/membros/documentacao');
        } catch (error: any) {
            toast.error("Erro ao apagar: " + error.message);
        }
    };

    // Generic file upload handle for PDF or Audio
    const handleFileUpload = async (file: File) => {
        if (!supabaseBrowser || !content) return;
        setUploadingFile(true);
        try {
            const extension = file.name.split('.').pop() || '';
            const filename = `docs/${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;

            const { error: uploadError } = await supabaseBrowser.storage
                .from('member-private-files')
                .upload(filename, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabaseBrowser.storage
                .from('member-private-files')
                .getPublicUrl(filename);

            if (data?.publicUrl) {
                 // Save the URL to the DB
                 const token = await getBrowserAccessToken();
                 const res = await fetch(`/api/admin/member-contents/${resolvedParams.id}`, {
                     method: 'PUT',
                     headers: { 
                         'Content-Type': 'application/json',
                         'Authorization': `Bearer ${token}`
                     },
                     body: JSON.stringify({
                         ...formData,
                         file_url: data.publicUrl
                     })
                 });
                 if (!res.ok) throw new Error("Failed to link file to content");
                 toast.success("Ficheiro carregado com sucesso!");
                 fetchContent();
            }
        } catch (err: any) {
            console.error('Upload failed:', err);
            toast.error(err.message || "Falha no upload");
        } finally {
            setUploadingFile(false);
        }
    };

    const handleCoverImageChange = async (url: string) => {
        if (!content) return;

        setFormData((current) => ({ ...current, cover_image_url: url }));

        try {
            const token = await getBrowserAccessToken();
            const res = await fetch(`/api/admin/member-contents/${resolvedParams.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: formData.title,
                    description: formData.description,
                    is_published: formData.is_published,
                    file_url: content.file_url,
                    category_id: formData.category_id,
                    cover_image_url: url || null
                })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || 'Falha ao guardar imagem de capa');
            setContent((current) => current ? { ...current, cover_image_url: url || null } : current);
            toast.success(url ? 'Imagem de capa atualizada.' : 'Imagem de capa removida.');
        } catch (error: any) {
            toast.error(error.message || 'Falha ao guardar imagem de capa');
            fetchContent();
        }
    };

    // Gallery handers
    const handleGalleryImageAdded = async (url: string) => {
        try {
            const token = await getBrowserAccessToken();
            const res = await fetch(`/api/admin/member-contents/${resolvedParams.id}/images`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    image_url: url,
                    display_order: content?.member_gallery_images?.length || 0
                })
            });
            if (!res.ok) throw new Error("Failed to add image");
            toast.success("Imagem adicionada à galeria");
            fetchContent();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleDeleteGalleryImage = async (imageId: string) => {
        if (!confirm('Tem certeza?')) return;
        try {
            const token = await getBrowserAccessToken();
            const res = await fetch(`/api/admin/member-contents/${resolvedParams.id}/images/${imageId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to delete image");
            toast.success("Imagem removida!");
            fetchContent();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    if (loading) return <AdminLayout title="Carregando..." isLoading={true}><div/></AdminLayout>;
    if (!content) return <AdminLayout title="Erro"><div className="p-8">Conteúdo não encontrado.</div></AdminLayout>;

    const Icon = content.type === 'pdf' ? FileText : content.type === 'audio' ? Music : ImageIcon;

    return (
        <AdminLayout title={`Gerir: ${content.title}`}>
            <Toaster position="top-right" richColors />
            
            <div className="flex items-center gap-4 mb-6">
                <button 
                    onClick={() => router.push('/admin/membros/documentacao')}
                    className="p-2 bg-white rounded-full border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                   <h1 className="text-2xl font-bold font-serif text-slate-900 flex items-center gap-2">
                       <Icon className="w-6 h-6 text-garabandal-gold" />
                       {content.title}
                   </h1>
                   <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{content.type}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Col - Form Info */}
                <div className="lg:col-span-1 space-y-6">
                    <form onSubmit={handleSaveInfo} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-5">
                       <h3 className="font-bold text-lg text-slate-900 mb-4">Detalhes Básicos</h3>
                       
                       <div>
                           <label className="block text-sm font-bold text-slate-700 mb-2">Título</label>
                           <input
                               required
                               className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-garabandal-dark outline-none transition-all"
                               value={formData.title}
                               onChange={e => setFormData({ ...formData, title: e.target.value })}
                           />
                       </div>
                       
                       <div>
                           <label className="block text-sm font-bold text-slate-700 mb-2">Descrição</label>
                           <textarea
                               className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl h-32 resize-none focus:ring-2 focus:ring-garabandal-dark outline-none transition-all"
                               value={formData.description}
                               onChange={e => setFormData({ ...formData, description: e.target.value })}
                           />
                       </div>

                       {content.type === 'pdf' && (
                           <PdfCategoryPicker
                               value={formData.category_id}
                               onChange={(categoryId) => setFormData((current) => ({ ...current, category_id: categoryId }))}
                           />
                       )}
                       
                       <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                           <label className="relative inline-flex items-center cursor-pointer">
                             <input type="checkbox" className="sr-only peer" checked={formData.is_published} onChange={(e) => setFormData({...formData, is_published: e.target.checked})} />
                             <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                           </label>
                           <div>
                               <p className="text-sm font-bold text-slate-800">Publicado</p>
                               <p className="text-xs text-slate-500">Visível para os membros</p>
                           </div>
                       </div>
                       
                       <button
                           type="submit"
                           disabled={saving}
                           className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
                       >
                           {saving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                           Guardar Detalhes
                       </button>
                    </form>
                    
                    <button 
                        onClick={handleDelete}
                        className="w-full py-3 bg-white border-2 border-red-100 text-red-600 font-bold rounded-xl hover:bg-red-50 hover:border-red-200 transition-colors flex justify-center items-center gap-2"
                    >
                        <Trash2 className="w-5 h-5" /> Apagar Material
                    </button>
                </div>

                {/* Right Col - Files / Gallery */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* File Upload for PDF / Audio */}
                    {(content.type === 'pdf' || content.type === 'audio') && (
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
                                <UploadCloud className="w-5 h-5 text-slate-400" />
                                Ficheiro {content.type.toUpperCase()}
                            </h3>
                            
                            {content.file_url ? (
                                <div className="p-4 border-2 border-garabandal-gold/30 bg-garabandal-gold/5 rounded-2xl flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                                            <Icon className="w-6 h-6 text-garabandal-dark"/>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">Ficheiro Atual</p>
                                            <a href={content.file_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">Ver / Ouvir Ficheiro</a>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            if (confirm("Isto apenas remove o link, para carregar um novo faça o upload abaixo. Continuar?")) {
                                                 setFormData({...formData}); // dummy update just to trigger state? no, call handlesave
                                                 // simpler: just tell them to upload a new one which will replace the old.
                                            }
                                        }}
                                        className="text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-lg border hover:bg-slate-50"
                                    >Substituir</button>
                                </div>
                            ) : (
                                <div className="p-8 border-2 border-dashed border-slate-200 bg-slate-50 rounded-2xl flex flex-col items-center justify-center mb-6 text-center">
                                    <Icon className="w-12 h-12 text-slate-300 mb-3" />
                                    <p className="text-slate-600 font-medium max-w-sm">Ainda não carregaste nenhum ficheiro para este material.</p>
                                </div>
                            )}
                            
                            <label className={`
                                flex items-center justify-center gap-2 w-full py-4 rounded-xl font-bold transition-all border-2 border-dashed cursor-pointer
                                ${uploadingFile 
                                    ? 'bg-slate-100 border-slate-200 text-slate-400' 
                                    : 'bg-garabandal-dark text-garabandal-gold border-transparent hover:bg-garabandal-dark/90 hover:shadow-lg shadow-black/10'
                                }
                            `}>
                                {uploadingFile ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                                {uploadingFile ? "A enviar aguarde..." : "Carregar Novo Ficheiro"}
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept={content.type === 'pdf' ? '.pdf' : 'audio/*'} 
                                    disabled={uploadingFile}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileUpload(file);
                                    }}
                                />
                            </label>
                            
                            <p className="text-xs text-center text-slate-400 mt-4">
                                {content.type === 'pdf' ? 'Formatos suportados: .pdf (Máx: 20MB)' : 'Formatos suportados: .mp3, .wav, .m4a (Máx: 50MB)'}
                            </p>
                        </div>
                    )}

                    {content.type === 'pdf' && (
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
                                <ImageIcon className="w-5 h-5 text-slate-400" />
                                Imagem Associada ao PDF
                            </h3>

                            <ImageUpload
                                value={formData.cover_image_url}
                                onChange={(url) => {
                                    void handleCoverImageChange(url);
                                }}
                                bucket="member-private-files"
                                path={`pdf-covers/${content.id}`}
                                fixedFilename="cover"
                                label="Capa do documento"
                                className="w-full"
                            />

                            <p className="text-xs text-slate-500 mt-4">
                                Esta imagem será usada como destaque na área dos membros, na secção de manuscritos.
                            </p>
                        </div>
                    )}
                    
                    {/* Gallery Manager */}
                    {content.type === 'gallery' && (
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                             <h3 className="font-bold text-lg text-slate-900 mb-6 flex items-center gap-2">
                                 <ImageIcon className="w-5 h-5 text-slate-400" />
                                 Galeria de Fotos
                             </h3>
                             
                             <div className="mb-8 p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                 <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                     <Plus className="w-4 h-4" /> Adicionar Fotos
                                 </h4>
                                 <ImageUpload
                                     bucket="member-private-files"
                                     path={`gallery/${content.id}`}
                                     onChange={handleGalleryImageAdded}
                                     label="Fazer Upload de Nova Fotografia"
                                     className="w-full"
                                 />
                             </div>
                             
                             <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                 {content.member_gallery_images?.map((img) => (
                                     <div key={img.id} className="group relative aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                                         <img
                                             src={img.image_url}
                                             alt="Gallery"
                                             className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                         />
                                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                                             <button
                                                 onClick={() => handleDeleteGalleryImage(img.id)}
                                                 className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors ms-auto"
                                                 title="Remover"
                                             >
                                                 <Trash2 className="w-4 h-4" />
                                             </button>
                                         </div>
                                     </div>
                                 ))}
                                 
                                 {(!content.member_gallery_images || content.member_gallery_images.length === 0) && (
                                     <div className="col-span-full py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
                                         Sem fotografias nesta galeria.
                                     </div>
                                 )}
                             </div>
                        </div>
                    )}
                </div>
            </div>

        </AdminLayout>
    );
}
