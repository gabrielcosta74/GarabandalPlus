"use client";

import { useEffect, useState } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import {
    Calendar as CalendarIcon,
    Plus,
    Video,
    Clock,
    MoreHorizontal,
    Trash2,
    Edit2,
    Link as LinkIcon,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    MapPin,
    Users,
    X,
    Check
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

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function AdminEventsPage() {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);

    // Calendar State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);
    const [formLoading, setFormLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        start_date: '',
        start_time: '21:00',
        end_date: '',
        end_time: '22:00',
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

        // Load events for a broad range (e.g., current year +/- 1) or just all for now since volume is likely low
        const { data } = await supabaseBrowser
            .from('events')
            .select('*')
            .order('start_time', { ascending: true });

        if (data) setEvents(data);
        setLoading(false);
    };

    // --- Calendar Logic ---

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const days = [];
        const paddingStart = firstDay.getDay(); // 0 = Sun

        // Pad start
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = paddingStart - 1; i >= 0; i--) {
            days.push({
                date: new Date(year, month - 1, prevMonthLastDay - i),
                isCurrentMonth: false
            });
        }

        // Current month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push({
                date: new Date(year, month, i),
                isCurrentMonth: true
            });
        }

        // Pad end
        const remainingCells = 42 - days.length; // 6 rows * 7 cols
        for (let i = 1; i <= remainingCells; i++) {
            days.push({
                date: new Date(year, month + 1, i),
                isCurrentMonth: false
            });
        }

        return days;
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getDate() === d2.getDate() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getFullYear() === d2.getFullYear();
    };

    const getEventsForDay = (date: Date) => {
        return events.filter(e => isSameDay(new Date(e.start_time), date));
    };

    // --- Event Handling ---

    const handleDayClick = (date: Date) => {
        setSelectedDate(date);
        setEditingEvent(null);

        // Pre-fill form
        const dateStr = date.toISOString().split('T')[0];
        setFormData({
            title: '',
            description: '',
            start_date: dateStr,
            start_time: '21:00',
            end_date: dateStr,
            end_time: '22:00',
            meeting_url: '',
            platform: 'zoom',
            is_active: true
        });

        setIsModalOpen(true);
    };

    const handleEventClick = (e: React.MouseEvent, event: Event) => {
        e.stopPropagation();
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);

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

        setFormLoading(false);
        if (error) {
            alert('Erro ao guardar: ' + error.message);
        } else {
            setIsModalOpen(false);
            loadEvents();
        }
    };

    const handleDelete = async () => {
        if (!editingEvent || !confirm('Tem a certeza que deseja eliminar este evento?')) return;
        setFormLoading(true);
        if (!supabaseBrowser) return;

        const { error } = await supabaseBrowser
            .from('events')
            .delete()
            .eq('id', editingEvent.id);

        setFormLoading(false);
        if (error) alert('Erro ao eliminar');
        else {
            setIsModalOpen(false);
            loadEvents();
        }
    };

    // --- Render Helpers ---

    const getPlatformColor = (platform: string) => {
        switch (platform) {
            case 'zoom': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'meet': return 'bg-green-100 text-green-700 border-green-200';
            case 'youtube': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const days = getDaysInMonth(currentDate);

    return (
        <AdminLayout title="Gestão de Calendário" description="Organize os eventos e reuniões da comunidade.">
            <div className="flex flex-col gap-6 h-[calc(100vh-180px)]">

                {/* Tools & Navigation */}
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button onClick={prevMonth} className="p-2 hover:bg-white rounded-md transition-all shadow-sm">
                                <ChevronLeft className="w-5 h-5 text-slate-600" />
                            </button>
                            <button onClick={nextMonth} className="p-2 hover:bg-white rounded-md transition-all shadow-sm">
                                <ChevronRight className="w-5 h-5 text-slate-600" />
                            </button>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 capitalize">
                            {currentDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
                        </h2>
                    </div>

                    <button
                        onClick={() => handleDayClick(new Date())}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5" /> Novo Evento
                    </button>
                </div>

                {/* Calendar Grid */}
                <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                    {/* Header Row */}
                    <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                        {WEEKDAYS.map(day => (
                            <div key={day} className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="flex-1 grid grid-cols-7 grid-rows-6">
                        {days.map((dayObj, index) => {
                            const dateEvents = getEventsForDay(dayObj.date);
                            const isToday = isSameDay(dayObj.date, new Date());
                            const isSelected = selectedDate && isSameDay(dayObj.date, selectedDate);

                            return (
                                <div
                                    key={index}
                                    onClick={() => handleDayClick(dayObj.date)}
                                    className={`
                                        border-b border-r border-slate-100 p-2 relative group cursor-pointer transition-all
                                        ${!dayObj.isCurrentMonth ? 'bg-slate-50/50 text-slate-400' : 'bg-white text-slate-700'}
                                        ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}
                                    `}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`
                                            text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full
                                            ${isToday ? 'bg-indigo-600 text-white shadow-md' : ''}
                                        `}>
                                            {dayObj.date.getDate()}
                                        </span>
                                        {isModalOpen && isSelected && (
                                            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold animate-pulse">
                                                Novo +
                                            </span>
                                        )}
                                    </div>

                                    <div className="space-y-1.5 overflow-y-auto max-h-[80px] scrollbar-hide">
                                        {dateEvents.map(event => (
                                            <motion.div
                                                layoutId={event.id}
                                                key={event.id}
                                                onClick={(e) => handleEventClick(e, event)}
                                                className={`
                                                    text-[10px] font-bold px-2 py-1 rounded border truncate shadow-sm cursor-pointer hover:scale-[1.02] transition-transform
                                                    ${getPlatformColor(event.platform)}
                                                    ${!event.is_active ? 'opacity-50 grayscale' : ''}
                                                `}
                                            >
                                                {new Date(event.start_time).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} {event.title}
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* MODAL */}
                <AnimatePresence>
                    {isModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/20"
                                onClick={e => e.stopPropagation()}
                            >
                                <form onSubmit={handleSubmit}>
                                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-800">
                                                {editingEvent ? 'Editar Evento' : 'Novo Evento'}
                                            </h3>
                                            <p className="text-xs text-slate-500">
                                                {new Date(formData.start_date).toLocaleDateString('pt-PT', { dateStyle: 'full' })}
                                            </p>
                                        </div>
                                        <button type="button" onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                                        {/* Main Info */}
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Título do Evento</label>
                                                <input
                                                    required
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-slate-700"
                                                    value={formData.title}
                                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                    placeholder="Ex: Reunião de Oração"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase mb-2">
                                                        <Clock className="w-3.5 h-3.5" /> Início
                                                    </label>
                                                    <div className="space-y-2">
                                                        <input
                                                            type="date" required
                                                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-indigo-500"
                                                            value={formData.start_date}
                                                            onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                                        />
                                                        <input
                                                            type="time" required
                                                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-indigo-500"
                                                            value={formData.start_time}
                                                            onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase mb-2">
                                                        <Clock className="w-3.5 h-3.5" /> Fim
                                                    </label>
                                                    <div className="space-y-2">
                                                        <input
                                                            type="date" required
                                                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-indigo-500"
                                                            value={formData.end_date}
                                                            onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                                        />
                                                        <input
                                                            type="time" required
                                                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-indigo-500"
                                                            value={formData.end_time}
                                                            onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <hr className="border-slate-100" />

                                        {/* Details */}
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Descrição</label>
                                                <textarea
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm min-h-[100px] resize-none"
                                                    value={formData.description}
                                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                                    placeholder="Sobre o que será este evento..."
                                                />
                                            </div>

                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="col-span-1">
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Plataforma</label>
                                                    <div className="relative">
                                                        <select
                                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm appearance-none"
                                                            value={formData.platform}
                                                            onChange={e => setFormData({ ...formData, platform: e.target.value })}
                                                        >
                                                            <option value="zoom">Zoom</option>
                                                            <option value="meet">Meet</option>
                                                            <option value="youtube">YouTube</option>
                                                            <option value="other">Outro</option>
                                                        </select>
                                                        <Video className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                                    </div>
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Link de Acesso</label>
                                                    <div className="relative">
                                                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                        <input
                                                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                                                            value={formData.meeting_url}
                                                            onChange={e => setFormData({ ...formData, meeting_url: e.target.value })}
                                                            placeholder="https://..."
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 pt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                                    className={`
                                                        w-12 h-6 rounded-full p-1 transition-colors flex items-center
                                                        ${formData.is_active ? 'bg-green-500 justify-end' : 'bg-slate-200 justify-start'}
                                                    `}
                                                >
                                                    <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                                                </button>
                                                <span className="text-sm font-medium text-slate-700">
                                                    {formData.is_active ? 'Evento Ativo e Visível' : 'Oculto (Rascunho)'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                                        {editingEvent ? (
                                            <button
                                                type="button"
                                                onClick={handleDelete}
                                                disabled={formLoading}
                                                className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg font-bold text-sm transition-colors flex items-center gap-2"
                                            >
                                                <Trash2 className="w-4 h-4" /> Eliminar
                                            </button>
                                        ) : (
                                            <div />
                                        )}

                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setIsModalOpen(false)}
                                                className="px-4 py-2 text-slate-500 hover:bg-slate-200 rounded-lg font-bold text-sm transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={formLoading}
                                                className="px-6 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                                            >
                                                {formLoading ? <MoreHorizontal className="w-4 h-4 animate-pulse" /> : <Check className="w-4 h-4" />}
                                                {editingEvent ? 'Guardar' : 'Criar Evento'}
                                            </button>
                                        </div>
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
