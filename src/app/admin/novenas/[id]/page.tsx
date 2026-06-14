"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../../../lib/supabase-browser';
import AdminLayout from '../../../../components/admin/AdminLayout';
import Link from 'next/link';
import {
    ArrowLeft, Save, Loader2, Image as ImageIcon,
    BookOpen, Sparkles, X, Plus, Edit3, Trash2, Calendar, CheckCircle2, ChevronRight,
    ChevronUp, ChevronDown, Repeat
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ImageCropper from '../../../../components/admin/ImageCropper';
import { Toaster, toast } from 'sonner';
import type { PrayerSequence, PrayerSeqItem, PrayerType } from '../../../../components/member/NovenaPrayerMode';

// --- Types ---

type NovenaDay = {
    id?: string;
    day_number: number;
    theme: string;
    content: string;
    image_url?: string | null;
    audio_url?: string | null;
    prayer_sequence?: PrayerSequence | null;
};

type NovenaFull = {
    id: string;
    slug: string;
    title: string;
    description: string;
    image_url: string | null;
    prayer_intro: string;
    prayer_final: string;
    prayer_sequence?: PrayerSequence | null;
    published: boolean;
    days: NovenaDay[];
};

// --- Prayer sequence editor (shared: novena default + per-day override) ---

const PRAYER_OPTIONS: { value: PrayerType; label: string }[] = [
    { value: 'ourFather', label: 'Pai Nosso' },
    { value: 'hailMary', label: 'Ave Maria' },
    { value: 'gloryBe', label: 'Glória' },
];

const STARTER_SEQUENCE: PrayerSequence = [
    { type: 'ourFather', count: 1 },
    { type: 'hailMary', count: 1 },
    { type: 'gloryBe', count: 1 },
];

function PrayerSequenceEditor({
    value,
    onChange,
    onCommit,
}: {
    value: PrayerSequence | null | undefined;
    onChange: (seq: PrayerSequence | null) => void;
    onCommit?: (seq: PrayerSequence | null) => void;
}) {
    const seq: PrayerSequence = Array.isArray(value) ? value : [];

    const apply = (next: PrayerSequence, commit = true) => {
        const cleaned = next.length ? next : null;
        onChange(cleaned);
        if (commit) onCommit?.(cleaned);
    };

    const addRow = () => apply([...seq, { type: 'hailMary', count: 1 }]);
    const removeRow = (i: number) => apply(seq.filter((_, idx) => idx !== i));
    const setRow = (i: number, patch: Partial<PrayerSeqItem>, commit = true) =>
        apply(seq.map((it, idx) => (idx === i ? { ...it, ...patch } : it)), commit);
    const move = (i: number, dir: -1 | 1) => {
        const j = i + dir;
        if (j < 0 || j >= seq.length) return;
        const next = [...seq];
        [next[i], next[j]] = [next[j], next[i]];
        apply(next);
    };

    return (
        <div className="space-y-3">
            {seq.length === 0 ? (
                <p className="text-sm text-slate-400 italic">
                    Sem sequência definida — usa o padrão (Pai Nosso, Ave Maria, Glória — 1× cada).
                </p>
            ) : (
                <div className="space-y-2">
                    {seq.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2">
                            <select
                                value={item.type}
                                onChange={e => setRow(i, { type: e.target.value as PrayerType })}
                                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-indigo-300"
                            >
                                {PRAYER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <div className="flex items-center gap-1 shrink-0">
                                <input
                                    type="number"
                                    min={1}
                                    value={item.count}
                                    onChange={e => setRow(i, { count: Math.max(1, parseInt(e.target.value, 10) || 1) }, false)}
                                    onBlur={() => onCommit?.(seq.length ? seq : null)}
                                    className="w-16 px-2 py-2 bg-white border border-slate-200 rounded-lg text-sm text-center font-bold text-slate-800 outline-none focus:border-indigo-300"
                                />
                                <span className="text-slate-400 text-sm font-bold">×</span>
                            </div>
                            <div className="flex items-center shrink-0">
                                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
                                    <ChevronUp className="w-4 h-4" />
                                </button>
                                <button type="button" onClick={() => move(i, 1)} disabled={i === seq.length - 1} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                                <button type="button" onClick={() => removeRow(i)} className="p-1.5 text-red-400 hover:text-red-600 transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
            >
                <Plus className="w-4 h-4" /> Adicionar oração
            </button>
        </div>
    );
}

// --- Main Page Component ---

export default function EditNovenaPage() {
    const params = useParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'info' | 'journey'>('info');

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
            toast.success('Alterações guardadas');
        } else {
            toast.error('Erro ao guardar');
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
            toast.error('Upload falhou');
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
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <AdminLayout title={`Editar: ${novena.title}`} hideHeader={true}>
            <Toaster position="bottom-right" />
            <div className="bg-slate-50 min-h-screen pb-20 relative">

                {/* 1. Immersive Hero Header */}
                <div className="relative h-[300px] md:h-[350px] w-full overflow-hidden group">
                    <div className="absolute inset-0 bg-slate-900 z-10" />
                    {novena.image_url ? (
                        <>
                            <img
                                src={novena.image_url}
                                className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700 ease-out"
                                alt="Cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent z-20" />
                        </>
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 opacity-90 z-10" />
                    )}

                    <div className="relative z-30 h-full max-w-7xl mx-auto px-6 md:px-10 flex flex-col justify-end pb-10">
                        <Link href="/admin/novenas" className="absolute top-6 left-6 md:left-10 text-white/70 hover:text-white transition-colors bg-black/20 hover:bg-black/40 p-2 rounded-full backdrop-blur-sm">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>

                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                            <div className="space-y-4 max-w-2xl">
                                <div className="flex items-center gap-3">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md border ${novena.published ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-500/20 border-slate-500/40 text-slate-300'}`}>
                                        {novena.published ? 'Publicada' : 'Rascunho'}
                                    </span>
                                    <span className="text-white/50 text-xs font-mono tracking-wide hidden md:inline-block">ID: {novena.slug}</span>
                                </div>
                                <div>
                                    <h1 className="text-3xl md:text-5xl font-bold text-white font-serif leading-tight">
                                        {novena.title}
                                    </h1>
                                    <p className="text-white/70 mt-2 line-clamp-2 md:text-lg max-w-xl">
                                        {novena.description || 'Sem descrição definida...'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => document.getElementById('cover-upload')?.click()}
                                    className="px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-xl text-xs font-bold transition-all border border-white/10 flex items-center gap-2 group"
                                >
                                    <ImageIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                    Alterar Capa
                                    <input id="cover-upload" type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])} />
                                </button>
                                <button
                                    onClick={() => saveNovenaDetails({ published: !novena.published })}
                                    className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all border backdrop-blur-md flex items-center gap-2 shadow-lg ${novena.published
                                        ? 'bg-red-500/80 border-red-400/50 text-white hover:bg-red-600'
                                        : 'bg-emerald-500/80 border-emerald-400/50 text-white hover:bg-emerald-600'
                                        }`}
                                >
                                    {novena.published ? 'Retirar' : 'Publicar Agora'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Floating Navigation */}
                <div className="sticky top-4 z-40 max-w-fit mx-auto">
                    <div className="bg-white/80 backdrop-blur-xl shadow-lg shadow-indigo-900/5 border border-white/50 rounded-full p-1.5 flex gap-1 items-center">
                        {[
                            { id: 'info', label: 'Detalhes & Orações', icon: BookOpen },
                            { id: 'journey', label: 'Jornada Diária', icon: ChevronRight }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`
                                    relative px-5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 z-10
                                    ${activeTab === tab.id ? 'text-indigo-950' : 'text-slate-500 hover:text-slate-800'}
                                `}
                            >
                                {activeTab === tab.id && (
                                    <motion.div
                                        layoutId="activePill"
                                        className="absolute inset-0 bg-white rounded-full shadow-sm border border-slate-100"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center gap-2">
                                    <tab.icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-indigo-600' : 'opacity-50'}`} />
                                    {tab.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 3. Content Area */}
                <div className="max-w-7xl mx-auto px-6 md:px-10 mt-8">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {activeTab === 'info' && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* General Info Card */}
                                    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
                                        <div className="flex items-center gap-3 text-indigo-900 mb-2">
                                            <div className="p-2 bg-indigo-50 rounded-xl">
                                                <Edit3 className="w-5 h-5 text-indigo-600" />
                                            </div>
                                            <h3 className="font-bold text-lg">Informações Básicas</h3>
                                        </div>

                                        <div className="space-y-5">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Título</label>
                                                <input
                                                    value={novena.title}
                                                    onChange={(e) => setNovena({ ...novena, title: e.target.value })}
                                                    onBlur={() => saveNovenaDetails({ title: novena.title })}
                                                    className="w-full text-lg font-serif px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:bg-white focus:border-indigo-200 transition-all outline-none"
                                                    placeholder="Nome da Novena"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Descrição</label>
                                                <textarea
                                                    rows={4}
                                                    value={novena.description || ''}
                                                    onChange={(e) => setNovena({ ...novena, description: e.target.value })}
                                                    onBlur={() => saveNovenaDetails({ description: novena.description })}
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:bg-white focus:border-indigo-200 transition-all outline-none resize-none"
                                                    placeholder="Breve resumo..."
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">URL Slug</label>
                                                <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
                                                    <span className="text-slate-400 text-sm">/novenas/</span>
                                                    <input
                                                        value={novena.slug}
                                                        onChange={(e) => setNovena({ ...novena, slug: e.target.value })}
                                                        onBlur={() => saveNovenaDetails({ slug: novena.slug })}
                                                        className="flex-1 bg-transparent text-sm font-mono text-slate-700 focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Prayers Card */}
                                    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-8">
                                        <div>
                                            <div className="flex items-center gap-3 text-indigo-900 mb-4">
                                                <div className="p-2 bg-amber-50 rounded-xl">
                                                    <Sparkles className="w-5 h-5 text-amber-600" />
                                                </div>
                                                <h3 className="font-bold text-lg">Orações Fixas</h3>
                                            </div>
                                            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                                                Defina aqui as orações que se repetem todos os dias (Intro e Final), para não ter de as copiar manuamente.
                                            </p>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="relative group">
                                                <label className="absolute -top-2.5 left-4 bg-white px-2 text-[10px] font-bold text-indigo-600 uppercase tracking-widest border border-indigo-100 rounded-full">Oração Inicial</label>
                                                <textarea
                                                    rows={4}
                                                    value={novena.prayer_intro || ''}
                                                    onChange={(e) => setNovena({ ...novena, prayer_intro: e.target.value })}
                                                    onBlur={() => saveNovenaDetails({ prayer_intro: novena.prayer_intro })}
                                                    className="w-full px-5 py-4 bg-indigo-50/30 border border-indigo-100 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none font-serif text-slate-700 leading-relaxed group-hover:bg-indigo-50/50"
                                                    placeholder="Ex: Vinde Espírito Santo..."
                                                />
                                            </div>
                                            <div className="relative group">
                                                <label className="absolute -top-2.5 left-4 bg-white px-2 text-[10px] font-bold text-amber-600 uppercase tracking-widest border border-amber-100 rounded-full">Oração Final</label>
                                                <textarea
                                                    rows={4}
                                                    value={novena.prayer_final || ''}
                                                    onChange={(e) => setNovena({ ...novena, prayer_final: e.target.value })}
                                                    onBlur={() => saveNovenaDetails({ prayer_final: novena.prayer_final })}
                                                    className="w-full px-5 py-4 bg-amber-50/30 border border-amber-100 rounded-2xl focus:ring-2 focus:ring-amber-500/20 focus:bg-white transition-all outline-none font-serif text-slate-700 leading-relaxed group-hover:bg-amber-50/50"
                                                    placeholder="Ex: Ave Maria..."
                                                />
                                            </div>
                                        </div>

                                        {/* Prayer sequence (repetitions) — novena default */}
                                        <div className="pt-2 border-t border-slate-100">
                                            <div className="flex items-center gap-3 text-indigo-900 mb-2">
                                                <div className="p-2 bg-indigo-50 rounded-xl">
                                                    <Repeat className="w-5 h-5 text-indigo-600" />
                                                </div>
                                                <h3 className="font-bold text-lg">Estrutura de Oração</h3>
                                            </div>
                                            <p className="text-sm text-slate-500 mb-5 leading-relaxed">
                                                Defina quantas vezes cada oração se reza por dia (ex.: Pai Nosso ×1, Ave Maria ×10, Glória ×1).
                                                Aplica-se a todos os dias, exceto onde o dia tenha a sua própria sequência.
                                            </p>
                                            <PrayerSequenceEditor
                                                value={novena.prayer_sequence}
                                                onChange={(seq) => setNovena(prev => prev ? { ...prev, prayer_sequence: seq } : null)}
                                                onCommit={(seq) => saveNovenaDetails({ prayer_sequence: seq })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'journey' && (
                                <DaysManager novenaId={novena.id} days={novena.days} onUpdate={loadNovena} />
                            )}
                        </motion.div>
                    </AnimatePresence>
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

    const handleEdit = (day: NovenaDay) => setEditingDay(day);

    const handleCreate = () => {
        const nextDayNum = days.length > 0 ? Math.max(...days.map(d => d.day_number)) + 1 : 1;
        setEditingDay({
            day_number: nextDayNum,
            theme: '',
            content: ''
        });
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-2xl font-serif font-bold text-slate-900">Jornada Espiritual</h3>
                    <p className="text-slate-500 mt-1">Gerir os 9 dias de meditação</p>
                </div>
                {days.length < 9 && (
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-all font-bold text-sm shadow-lg shadow-slate-200 active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        Adicionar Dia {days.length + 1}
                    </button>
                )}
            </div>

            {/* Visual Timeline Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
                {/* Connector Line (Desktop Only - purely decorative for first row) */}
                <div className="hidden lg:block absolute top-[2.5rem] left-[16%] right-[16%] h-0.5 bg-slate-100 -z-10" />

                {days.map((day, index) => (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        key={day.id || day.day_number}
                        onClick={() => handleEdit(day)}
                        className="group relative cursor-pointer"
                    >
                        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col">
                            {/* Day Badge */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xl font-serif font-bold text-slate-900 group-hover:bg-indigo-600 group-hover:text-white group-hover:rotate-6 transition-all shadow-inner">
                                    {day.day_number}
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600">
                                    <div className="p-2 bg-indigo-50 rounded-full">
                                        <Edit3 className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1">
                                <h4 className="text-lg font-bold text-slate-800 mb-2 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                                    {day.theme || 'Sem Título...'}
                                </h4>
                                <p className="text-sm text-slate-400 line-clamp-3 leading-relaxed">
                                    {day.content || 'Escreva aqui a meditação para este dia...'}
                                </p>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between text-xs font-bold text-slate-300 group-hover:text-slate-400">
                                <span className="uppercase tracking-widest">Editar Conteúdo</span>
                                <ChevronRight className="w-4 h-4" />
                            </div>
                        </div>
                    </motion.div>
                ))}

                {/* Empty State Card */}
                {days.length === 0 && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-slate-300">
                            <BookOpen className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700">A Jornada Começa Agora</h3>
                        <p className="text-slate-400 max-w-sm mx-auto mt-2 mb-6">Comece por adicionar o primeiro dia desta novena.</p>
                        <button
                            onClick={handleCreate}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                        >
                            Criar 1º Dia
                        </button>
                    </div>
                )}
            </div>

            {/* Side Drawer Editor */}
            <AnimatePresence>
                {editingDay && (
                    <DayEditorDrawer
                        day={editingDay}
                        novenaId={novenaId}
                        onClose={() => setEditingDay(null)}
                        onSave={onUpdate}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

function DayEditorDrawer({ day, novenaId, onClose, onSave }: { day: NovenaDay, novenaId: string, onClose: () => void, onSave: () => void }) {
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
            audio_url: formData.audio_url,
            prayer_sequence: formData.prayer_sequence ?? null
        };

        let error;
        if (day.id) {
            ({ error } = await supabaseBrowser.from('novena_days').update(payload).eq('id', day.id));
        } else {
            ({ error } = await supabaseBrowser.from('novena_days').insert(payload));
        }

        setSaving(false);
        if (!error) {
            onSave();
            onClose();
            toast.success(`Dia ${formData.day_number} guardado`);
        } else {
            toast.error('Erro ao guardar dia');
        }
    };

    const handleDelete = async () => {
        if (!confirm('Tem a certeza?')) return;
        if (!day.id || !supabaseBrowser) return;

        await supabaseBrowser.from('novena_days').delete().eq('id', day.id);
        onSave();
        onClose();
        toast.info('Dia removido');
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50"
            />
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed inset-y-0 right-0 z-50 w-full md:w-[600px] bg-white shadow-2xl flex flex-col"
            >
                {/* Drawer Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white z-10">
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                        <div>
                            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block mb-0.5">Editor de Conteúdo</span>
                            <h3 className="text-xl font-serif font-bold text-slate-900">Dia {formData.day_number}</h3>
                        </div>
                    </div>
                    {day.id && (
                        <button onClick={handleDelete} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Apagar Dia">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Drawer Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-slate-50/30">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Tema da Reflexão</label>
                            <input
                                value={formData.theme}
                                onChange={e => setFormData({ ...formData, theme: e.target.value })}
                                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-200 transition-all outline-none font-bold text-lg text-slate-900 placeholder:font-normal placeholder:text-slate-400"
                                placeholder="Sobre o que vamos rezar hoje?"
                                autoFocus
                            />
                        </div>

                        <div className="bg-white rounded-3xl p-1 border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-200 transition-all">
                            <textarea
                                value={formData.content}
                                onChange={e => setFormData({ ...formData, content: e.target.value })}
                                className="w-full px-6 py-6 min-h-[400px] bg-transparent border-none outline-none resize-none leading-relaxed text-slate-700 font-serif text-lg"
                                placeholder="Escreva a meditação do dia aqui..."
                            />
                        </div>

                        {/* Per-day prayer sequence override */}
                        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
                            <label className="flex items-start gap-3 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={formData.prayer_sequence != null}
                                    onChange={e => setFormData({ ...formData, prayer_sequence: e.target.checked ? STARTER_SEQUENCE : null })}
                                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
                                />
                                <span>
                                    <span className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                                        <Repeat className="w-4 h-4 text-indigo-600" />
                                        Sequência própria neste dia
                                    </span>
                                    <span className="block text-xs text-slate-400 mt-0.5">
                                        Se desligado, usa a estrutura padrão da novena.
                                    </span>
                                </span>
                            </label>
                            {formData.prayer_sequence != null && (
                                <div className="mt-4">
                                    <PrayerSequenceEditor
                                        value={formData.prayer_sequence}
                                        onChange={(seq) => setFormData({ ...formData, prayer_sequence: seq })}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Drawer Footer */}
                <div className="p-5 border-t border-slate-100 bg-white flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium px-2">
                        {formData.content.length} caracteres
                    </span>
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors text-sm">
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-indigo-600 text-white px-8 py-2.5 rounded-xl hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-200 active:scale-95 text-sm flex items-center gap-2 disabled:opacity-50 disabled:active:scale-100"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> A Guardar...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" /> Guardar Dia
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </motion.div>
        </>
    );
}
