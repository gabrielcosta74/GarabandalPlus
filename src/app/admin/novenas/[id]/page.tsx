"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import AdminLayout from '../../../../components/admin/AdminLayout';
import Link from 'next/link';
import {
    ArrowLeft, Save, Loader2, Image as ImageIcon,
    BookOpen, Sparkles, Calendar, Upload, X, CheckCircle,
    PlayCircle, Trash2, Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ImageCropper from '../../../../components/admin/ImageCropper';

// --- Types ---

type NovenaDay = {
    id?: string;
    day_number: number;
    theme: string;
    content: string;
    image_url?: string | null;
    audio_url?: string | null;
};

type NovenaFull = {
    id: string;
    slug: string;
    title: string;
    description: string;
    image_url: string | null;
    prayer_intro: string;
    prayer_final: string;
    published: boolean;
    days: NovenaDay[];
};

// --- Main Page Component ---

export default function EditNovenaPage() {
    const params = useParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'info' | 'prayers' | 'days'>('info');

    // Cropper State
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);

    // Data State
    const [novena, setNovena] = useState<NovenaFull | null>(null);

    // Load Data
    const loadNovena = useCallback(async () => {
        if (!supabaseBrowser || !params.id) return;

        const { data: novenaData, error } = await supabaseBrowser
            .from('novenas')
            .select('*')
            .eq('id', params.id)
            .single();

        if (error || !novenaData) {
            router.push('/admin/novenas');
            return;
        }

        const { data: daysData } = await supabaseBrowser
            .from('novena_days')
            .select('*')
            .eq('novena_id', params.id)
            .order('day_number', { ascending: true });

        setNovena({
            ...novenaData,
            days: daysData || []
        });
        setLoading(false);
    }, [params.id, router]);

    useEffect(() => {
        loadNovena();
    }, [loadNovena]);

    // Save Handlers
    const saveNovenaDetails = async (updates: Partial<NovenaFull>) => {
        if (!novena || !supabaseBrowser) return;
        setSaving(true);

        const { error } = await supabaseBrowser
            .from('novenas')
            .update(updates)
            .eq('id', novena.id);

        if (!error) {
            setNovena(prev => prev ? { ...prev, ...updates } : null);
        }
        setSaving(false);
    };

    const handleImageSelect = (file: File) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            setImageToCrop(reader.result?.toString() || null);
        });
        reader.readAsDataURL(file);
    };

    const handleCropSave = async (croppedFile: File) => {
        if (!novena || !supabaseBrowser) return;
        setSaving(true);
        setImageToCrop(null); // Close modal

        const fileExt = croppedFile.name.split('.').pop() || 'jpeg';
        const fileName = `${novena.id}/cover-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabaseBrowser
            .storage
            .from('novena-assets')
            .upload(filePath, croppedFile);

        if (uploadError) {
            alert('Upload failed');
            setSaving(false);
            return;
        }

        const { data: { publicUrl } } = supabaseBrowser
            .storage
            .from('novena-assets')
            .getPublicUrl(filePath);

        await saveNovenaDetails({ image_url: publicUrl });
    };

    if (loading || !novena) {
        return (
            <AdminLayout title="A carregar...">
                <div className="flex bg-white h-[90vh] items-center justify-center rounded-2xl">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title={`Editar: ${novena.title}`}>
            <div className="max-w-5xl mx-auto pb-20 space-y-6">

                {/* Header - Stacked on Mobile */}
                <div className="sticky top-0 bg-gray-50/95 backdrop-blur-md z-40 py-4 -mx-4 px-4 md:mx-0 md:px-0 mb-4 border-b border-gray-200">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Link href="/admin/novenas" className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors shrink-0">
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <div className="min-w-0 flex-1">
                                <h1 className="text-xl md:text-2xl font-bold text-gray-900 line-clamp-1">{novena.title}</h1>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${novena.published ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                                        {novena.published ? 'Publicado' : 'Rascunho'}
                                    </span>
                                    <span className="text-gray-400 font-mono truncate hidden md:inline">/{novena.slug}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <button
                                onClick={() => saveNovenaDetails({ published: !novena.published })}
                                className={`flex-1 md:flex-none justify-center px-4 py-3 md:py-2 rounded-lg font-medium text-sm transition-colors border ${novena.published
                                    ? 'border-red-200 text-red-600 hover:bg-red-50'
                                    : 'border-green-200 text-green-600 hover:bg-green-50'
                                    }`}
                            >
                                {novena.published ? 'Despublicar' : 'Publicar'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tabs - Scrollable on Mobile */}
                <div className="w-full overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
                    <div className="flex gap-2 p-1 bg-gray-200/50 rounded-xl w-max md:w-fit">
                        {(['info', 'prayers', 'days'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                                    }`}
                            >
                                {tab === 'info' && 'Detalhes Gerais'}
                                {tab === 'prayers' && 'Orações Base'}
                                {tab === 'days' && `Jornada (${novena.days.length}/9)`}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm min-h-[500px] relative overflow-hidden">
                    {saving && (
                        <div className="absolute top-4 right-4 z-50 bg-white/90 px-3 py-1 rounded-full shadow border flex items-center gap-2 text-xs font-bold text-green-600">
                            <Loader2 className="w-3 h-3 animate-spin" /> A guardar...
                        </div>
                    )}

                    <div className="p-4 md:p-8">
                        {activeTab === 'info' && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
                                <div className="space-y-6 md:col-span-2">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Título da Novena</label>
                                        <input
                                            value={novena.title}
                                            onChange={(e) => setNovena({ ...novena, title: e.target.value })}
                                            onBlur={() => saveNovenaDetails({ title: novena.title })}
                                            className="w-full text-lg font-serif px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Descrição</label>
                                        <textarea
                                            rows={5}
                                            value={novena.description || ''}
                                            onChange={(e) => setNovena({ ...novena, description: e.target.value })}
                                            onBlur={() => saveNovenaDetails({ description: novena.description })}
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Slug</label>
                                        <input
                                            value={novena.slug}
                                            onChange={(e) => setNovena({ ...novena, slug: e.target.value })}
                                            onBlur={() => saveNovenaDetails({ slug: novena.slug })}
                                            className="w-full font-mono text-sm px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white transition-colors outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Cover Image */}
                                <div className="space-y-4">
                                    <label className="block text-sm font-bold text-gray-700">Imagem de Capa</label>
                                    <div className="aspect-[3/4] bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 hover:border-indigo-500/50 transition-colors relative group overflow-hidden flex flex-col items-center justify-center">
                                        {novena.image_url ? (
                                            <>
                                                <img src={novena.image_url} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <label className="cursor-pointer px-4 py-2 bg-white rounded-lg text-sm font-bold text-gray-900 hover:bg-gray-100">
                                                        Alterar
                                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])} />
                                                    </label>
                                                </div>
                                            </>
                                        ) : (
                                            <label className="cursor-pointer flex flex-col items-center gap-2 p-4 text-center w-full h-full justify-center">
                                                <ImageIcon className="w-8 h-8 text-gray-300" />
                                                <span className="text-sm text-gray-500 font-medium">Carregar Imagem</span>
                                                <span className="text-xs text-gray-400">Recomendado: 3:4 Vertical</span>
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])} />
                                            </label>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'prayers' && (
                            <div className="space-y-8 max-w-3xl">
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                            <Sparkles className="w-5 h-5" />
                                        </div>
                                        <h3 className="font-bold text-lg text-gray-900">Oração Inicial</h3>
                                    </div>
                                    <p className="text-sm text-gray-500 mb-2">Esta oração será exibida no topo de cada dia da novena.</p>
                                    <textarea
                                        rows={6}
                                        value={novena.prayer_intro || ''}
                                        onChange={(e) => setNovena({ ...novena, prayer_intro: e.target.value })}
                                        onBlur={() => saveNovenaDetails({ prayer_intro: novena.prayer_intro })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none font-serif leading-relaxed"
                                        placeholder="Ex: Vinde Espírito Santo..."
                                    />
                                </div>

                                <div className="border-t border-gray-100 pt-8">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                            <BookOpen className="w-5 h-5" />
                                        </div>
                                        <h3 className="font-bold text-lg text-gray-900">Oração Final</h3>
                                    </div>
                                    <p className="text-sm text-gray-500 mb-2">Oração de encerramento, comum a todos os dias (Ex: Ave Maria, Salve Rainha).</p>
                                    <textarea
                                        rows={6}
                                        value={novena.prayer_final || ''}
                                        onChange={(e) => setNovena({ ...novena, prayer_final: e.target.value })}
                                        onBlur={() => saveNovenaDetails({ prayer_final: novena.prayer_final })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none font-serif leading-relaxed"
                                        placeholder="Ex: Ave Maria..."
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'days' && (
                            <DaysManager novenaId={novena.id} days={novena.days} onUpdate={loadNovena} />
                        )}
                    </div>
                </div>

            </div>

            {imageToCrop && (
                <ImageCropper
                    imageSrc={imageToCrop}
                    aspect={3 / 4}
                    onCropComplete={handleCropSave}
                    onCancel={() => setImageToCrop(null)}
                />
            )}

        </AdminLayout>
    );
}

// --- Sub-Component: Days Manager ---

function DaysManager({ novenaId, days, onUpdate }: { novenaId: string, days: NovenaDay[], onUpdate: () => void }) {
    const [editingDay, setEditingDay] = useState<NovenaDay | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    const handleEdit = (day: NovenaDay) => {
        setEditingDay(day);
        setIsEditorOpen(true);
    };

    const handleCreate = () => {
        const nextDayNum = days.length > 0 ? Math.max(...days.map(d => d.day_number)) + 1 : 1;
        setEditingDay({
            day_number: nextDayNum,
            theme: '',
            content: ''
        });
        setIsEditorOpen(true);
    };

    const handleDelete = async (dayId: string) => {
        if (!confirm('Apagar este dia?')) return;
        if (!supabaseBrowser) return;

        await supabaseBrowser.from('novena_days').delete().eq('id', dayId);
        onUpdate();
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-900">Jornada de 9 Dias</h3>
                {days.length < 9 && (
                    <button
                        onClick={handleCreate}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm flex items-center gap-2 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Adicionar Dia {days.length + 1}
                    </button>
                )}
            </div>

            {/* Grid of Days */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {days.map(day => (
                    <div
                        key={day.id || day.day_number}
                        onClick={() => handleEdit(day)}
                        className="group cursor-pointer bg-white border border-gray-200 rounded-xl p-6 hover:border-indigo-500 hover:shadow-md transition-all relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="p-2 bg-indigo-50 rounded-full text-indigo-600">
                                <EditIcon className="w-4 h-4" />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg shadow-indigo-600/20">
                                {day.day_number}
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Dia</span>
                        </div>

                        <h4 className="font-bold text-gray-900 mb-2 line-clamp-1">{day.theme || 'Sem Título'}</h4>
                        <p className="text-sm text-gray-500 line-clamp-3">{day.content || 'Sem conteúdo...'}</p>
                    </div>
                ))}
            </div>

            {/* Editor Modal */}
            <AnimatePresence>
                {isEditorOpen && editingDay && (
                    <DayEditorModal
                        day={editingDay}
                        novenaId={novenaId}
                        onClose={() => setIsEditorOpen(false)}
                        onSave={onUpdate}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

function EditIcon({ className }: { className?: string }) {
    return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>;
}

function DayEditorModal({ day, novenaId, onClose, onSave }: { day: NovenaDay, novenaId: string, onClose: () => void, onSave: () => void }) {
    const [formData, setFormData] = useState(day);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!supabaseBrowser) return;
        setSaving(true);

        const payload = {
            novena_id: novenaId,
            day_number: formData.day_number,
            theme: formData.theme,
            content: formData.content,
            image_url: formData.image_url,
            audio_url: formData.audio_url
        };

        let error;
        if (day.id) {
            // Update
            ({ error } = await supabaseBrowser
                .from('novena_days')
                .update(payload)
                .eq('id', day.id));
        } else {
            // Insert
            ({ error } = await supabaseBrowser
                .from('novena_days')
                .insert(payload));
        }

        setSaving(false);
        if (!error) {
            onSave();
            onClose();
        } else {
            alert('Erro ao guardar dia: ' + error.message);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm"
        >
            <motion.div
                initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                className="bg-white rounded-none md:rounded-2xl w-full h-full md:h-auto md:max-w-2xl md:max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl"
            >
                <div className="p-4 md:p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                    <h3 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2">
                        <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm">{formData.day_number}</span>
                        Editar Dia {formData.day_number}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 md:p-8 space-y-6 flex-1">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Tema do Dia</label>
                        <input
                            value={formData.theme}
                            onChange={e => setFormData({ ...formData, theme: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold text-lg"
                            placeholder="Ex: O Chamamento"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Reflexão / Conteúdo</label>
                        <textarea
                            rows={10}
                            value={formData.content}
                            onChange={e => setFormData({ ...formData, content: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none leading-relaxed h-[50vh] md:h-auto"
                            placeholder="Escreva a meditação do dia..."
                        />
                    </div>
                </div>

                <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 sticky bottom-0 safe-area-bottom">
                    <button onClick={onClose} className="px-4 py-3 md:py-2 font-medium text-gray-600 hover:bg-gray-200 rounded-lg flex-1 md:flex-none text-center">Cancelar</button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-3 md:py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-50 flex-1 md:flex-none shadow-lg shadow-indigo-200"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        Guardar Dia
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
