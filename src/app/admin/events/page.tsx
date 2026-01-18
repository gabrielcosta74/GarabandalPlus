"use client";

import { useEffect, useState } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import {
    Calendar,
    Plus,
    Video,
    Clock,
    MoreHorizontal,
    Trash2,
    Edit2,
    Link as LinkIcon,
    AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Event = {
    id: string;
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    meeting_url?: string;
    platform: string;
    is_active: boolean;
};

export default function AdminEventsPage() {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        start_date: '',
        start_time: '',
        end_date: '',
        end_time: '',
        meeting_url: '',
        platform: 'zoom',
        is_active: true
    });

    useEffect(() => {
        loadEvents();
    }, []);

    const loadEvents = async () => {
        setLoading(true);
        if (!supabaseBrowser) {
            setLoading(false);
            return;
        }
        const { data } = await supabaseBrowser
            .from('events')
            .select('*')
            .order('start_time', { ascending: false }); // Newest first

        if (data) setEvents(data);
        setLoading(false);
    };

    const handleEdit = (event: Event) => {
        setEditingEvent(event);
        const start = new Date(event.start_time);
        const end = new Date(event.end_time);

        setFormData({
            title: event.title,
            description: event.description || '',
            start_date: start.toISOString().split('T')[0],
            start_time: start.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
            end_date: end.toISOString().split('T')[0],
            end_time: end.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
            meeting_url: event.meeting_url || '',
            platform: event.platform || 'zoom',
            is_active: event.is_active
        });
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingEvent(null);
        // Default to tomorrow at 21:00
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        setFormData({
            title: '',
            description: '',
            start_date: tomorrow.toISOString().split('T')[0],
            start_time: '21:00',
            end_date: tomorrow.toISOString().split('T')[0],
            end_time: '22:00',
            meeting_url: '',
            platform: 'zoom',
            is_active: true
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Combine date and time
        const startISO = new Date(`${formData.start_date}T${formData.start_time}`).toISOString();
        const endISO = new Date(`${formData.end_date}T${formData.end_time}`).toISOString();

        const payload = {
            title: formData.title,
            description: formData.description,
            start_time: startISO,
            end_time: endISO,
            meeting_url: formData.meeting_url || null,
            platform: formData.platform,
            is_active: formData.is_active
        };

        if (!supabaseBrowser) return;

        let error;
        if (editingEvent) {
            const { error: err } = await supabaseBrowser
                .from('events')
                .update(payload)
                .eq('id', editingEvent.id);
            error = err;
        } else {
            const { error: err } = await supabaseBrowser
                .from('events')
                .insert([payload]);
            error = err;
        }

        if (error) {
            alert('Erro ao guardar: ' + error.message);
        } else {
            setIsModalOpen(false);
            loadEvents();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem a certeza que deseja eliminar este evento?')) return;
        if (!supabaseBrowser) return;

        const { error } = await supabaseBrowser
            .from('events')
            .delete()
            .eq('id', id);

        if (error) alert('Erro ao eliminar');
        else loadEvents();
    };

    return (
        <AdminLayout title="Gestão de Eventos" description="Adicione ou edite reuniões e encontros online.">
            <div className="flex flex-col gap-6 pb-20">
                {/* Header Controls */}
                <div className="flex justify-end">
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition-colors shadow-sm"
                    >
                        <Plus className="w-5 h-5" /> Novo Evento
                    </button>
                </div>

                {/* List */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    {loading ? (
                        <div className="p-12 text-center text-slate-400">Carregando eventos...</div>
                    ) : events.length === 0 ? (
                        <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                                <Calendar className="w-8 h-8 text-slate-300" />
                            </div>
                            <p>Nenhum evento agendado.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {events.map((event) => {
                                const isPast = new Date(event.end_time) < new Date();
                                return (
                                    <div key={event.id} className={`p-6 hover:bg-slate-50 transition-colors group ${!event.is_active ? 'opacity-60 bg-slate-50' : ''}`}>
                                        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-3">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {event.platform === 'zoom' && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Zoom</span>}
                                                    {event.platform === 'meet' && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Meet</span>}
                                                    {event.platform === 'youtube' && <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">YouTube</span>}

                                                    {isPast && <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Terminado</span>}
                                                    {!event.is_active && <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Inativo</span>}
                                                </div>
                                                <h3 className="text-lg font-bold text-slate-900">{event.title}</h3>
                                                <div className="flex items-center gap-4 text-sm text-slate-500">
                                                    <span className="flex items-center gap-1.5 font-medium text-slate-600">
                                                        <Calendar className="w-4 h-4" />
                                                        {new Date(event.start_time).toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short' })}
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <Clock className="w-4 h-4" />
                                                        {new Date(event.start_time).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                {!event.meeting_url && !isPast && (
                                                    <div className="flex items-center gap-1 text-xs text-orange-600 font-bold mt-2">
                                                        <AlertCircle className="w-3 h-3" />
                                                        Link em falta
                                                    </div>
                                                )}
                                                {event.meeting_url && (
                                                    <a href={event.meeting_url} target="_blank" className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1 truncate max-w-xs">
                                                        <LinkIcon className="w-3 h-3" />
                                                        {event.meeting_url}
                                                    </a>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEdit(event)} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-500 hover:text-blue-600 transition-all shadow-sm">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(event.id)} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-500 hover:text-red-600 transition-all shadow-sm">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* MODAL */}
                <AnimatePresence>
                    {isModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
                                onClick={e => e.stopPropagation()}
                            >
                                <form onSubmit={handleSubmit}>
                                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                        <h3 className="text-lg font-bold text-slate-800">
                                            {editingEvent ? 'Editar Evento' : 'Novo Evento'}
                                        </h3>
                                        <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                                    </div>

                                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                                        {/* Title */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título</label>
                                            <input
                                                required
                                                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={formData.title}
                                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                placeholder="Ex: Reunião Mensal"
                                            />
                                        </div>

                                        {/* Date/Time Row */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Início</label>
                                                <input
                                                    type="date" required
                                                    className="w-full p-2 border border-slate-200 rounded-lg outline-none"
                                                    value={formData.start_date}
                                                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora Início</label>
                                                <input
                                                    type="time" required
                                                    className="w-full p-2 border border-slate-200 rounded-lg outline-none"
                                                    value={formData.start_time}
                                                    onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Fim</label>
                                                <input
                                                    type="date" required
                                                    className="w-full p-2 border border-slate-200 rounded-lg outline-none"
                                                    value={formData.end_date}
                                                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora Fim</label>
                                                <input
                                                    type="time" required
                                                    className="w-full p-2 border border-slate-200 rounded-lg outline-none"
                                                    value={formData.end_time}
                                                    onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição</label>
                                            <textarea
                                                className="w-full p-2 border border-slate-200 rounded-lg outline-none h-24 text-sm"
                                                value={formData.description}
                                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                                placeholder="Detalhes sobre a reunião..."
                                            />
                                        </div>

                                        <hr className="border-slate-100" />

                                        {/* Meeting Details */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Plataforma</label>
                                            <select
                                                className="w-full p-2 border border-slate-200 rounded-lg outline-none bg-white"
                                                value={formData.platform}
                                                onChange={e => setFormData({ ...formData, platform: e.target.value })}
                                            >
                                                <option value="zoom">Zoom</option>
                                                <option value="meet">Google Meet</option>
                                                <option value="youtube">YouTube Live</option>
                                                <option value="other">Outro</option>
                                            </select>
                                        </div>

                                        <div>
                                            <div className="flex justify-between">
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Link da Reunião</label>
                                                <span className="text-[10px] text-slate-400 italic">Opcional - Adicionar mais tarde</span>
                                            </div>
                                            <div className="relative">
                                                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input
                                                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                    value={formData.meeting_url}
                                                    onChange={e => setFormData({ ...formData, meeting_url: e.target.value })}
                                                    placeholder="https://..."
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 pt-2">
                                            <input
                                                type="checkbox"
                                                id="isActive"
                                                checked={formData.is_active}
                                                onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                            <label htmlFor="isActive" className="text-sm font-medium text-slate-700">Evento Ativo (Visível aos membros)</label>
                                        </div>

                                    </div>

                                    <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-bold shadow-lg shadow-blue-900/10 transition-colors"
                                        >
                                            {editingEvent ? 'Guardar Alterações' : 'Criar Evento'}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </AdminLayout>
    );
}
