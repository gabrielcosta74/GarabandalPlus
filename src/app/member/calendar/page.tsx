"use client";

import VIPLayout from '../../../components/member/VIPLayout';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Video, Clock } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale } from '../../../contexts/LocaleContext';

type Event = {
    id: string;
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    meeting_url: string;
    platform: string;
};

export default function CalendarPage() {
    const { locale } = useLocale();
    const isEn = locale === 'en';
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
    const [loading, setLoading] = useState(true);

    // Helpers
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
        return { days, firstDay };
    };

    const { days, firstDay } = getDaysInMonth(currentDate);

    // Fetch Events for current view
    useEffect(() => {
        const loadEvents = async () => {
            setLoading(true);
            const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
            const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString();

            if (!supabaseBrowser) return;

            const { data } = await supabaseBrowser
                .from('events')
                .select('*')
                .eq('is_active', true)
                .gte('end_time', startOfMonth)
                .lte('start_time', endOfMonth);

            if (data) setEvents(data);
            setLoading(false);
        };
        loadEvents();
    }, [currentDate]);

    // Handle Month Navigation
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

    // Get events for a specific day
    const getEventsForDay = (day: number) => {
        return events.filter(e => {
            const eventDate = new Date(e.start_time);
            return eventDate.getDate() === day &&
                eventDate.getMonth() === currentDate.getMonth() &&
                eventDate.getFullYear() === currentDate.getFullYear();
        });
    };

    const monthName = currentDate.toLocaleDateString(isEn ? 'en-GB' : 'pt-PT', { month: 'long', year: 'numeric' });
    const weekDays = isEn ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    // Selected Day Events
    const selectedDayEvents = selectedDate ? events.filter(e => {
        const d = new Date(e.start_time);
        return d.getDate() === selectedDate.getDate() &&
            d.getMonth() === selectedDate.getMonth() &&
            d.getFullYear() === selectedDate.getFullYear();
    }) : [];

    return (
        <VIPLayout>
            <div className="max-w-5xl mx-auto space-y-8 pb-20">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-serif text-white">{isEn ? 'Events Calendar' : 'Calendário de Eventos'}</h1>
                        <p className="text-slate-400">{isEn ? 'Schedule of Apostolate meetings and gatherings.' : 'Agenda de reuniões e encontros do Apostolado.'}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8"> {/* Simplified grid */}
                    {/* Centered Calendar Grid */}
                    <div className="max-w-4xl mx-auto bg-slate-900 border border-white/5 rounded-2xl p-6 shadow-2xl">
                        {/* Month Nav */}
                        <div className="flex items-center justify-between mb-8">
                            <button onClick={prevMonth} className="p-3 hover:bg-white/10 rounded-full text-white transition-colors">
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <h2 className="text-2xl font-bold text-white capitalize">{monthName}</h2>
                            <button onClick={nextMonth} className="p-3 hover:bg-white/10 rounded-full text-white transition-colors">
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Grid */}
                        <div className="grid grid-cols-7 gap-3 sm:gap-4 text-center mb-4">
                            {weekDays.map(d => (
                                <div key={d} className="text-sm font-bold text-slate-500 uppercase py-2 tracking-wider">{d}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-3 sm:gap-4">
                            {/* Empty Slots */}
                            {Array.from({ length: firstDay }).map((_, i) => (
                                <div key={`empty-${i}`} className="aspect-square" />
                            ))}

                            {/* Days */}
                            {Array.from({ length: days }).map((_, i) => {
                                const day = i + 1;
                                const dayEvents = getEventsForDay(day);
                                const hasEvents = dayEvents.length > 0;
                                // const isSelected = selectedDate?.getDate() === day && selectedDate?.getMonth() === currentDate.getMonth(); // Removed isSelected logic for day styling
                                const isToday = new Date().getDate() === day && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();

                                return (
                                    <button
                                        key={day}
                                        onClick={() => {
                                            if (hasEvents) setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
                                        }}
                                        disabled={!hasEvents}
                                        className={`
                                        aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all duration-300
                                        ${hasEvents
                                                ? 'bg-blue-900/30 border-2 border-blue-500/50 text-white hover:scale-105 hover:bg-blue-900/50 hover:border-blue-400 hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] cursor-pointer'
                                                : 'bg-white/5 border border-transparent text-slate-500 cursor-default opacity-50'
                                            }
                                        ${isToday ? 'border-yellow-500/50 text-yellow-500 font-bold opacity-100 bg-yellow-500/10' : ''}
                                    `}
                                    >
                                        <span className={`text-sm sm:text-lg ${hasEvents ? 'font-bold' : ''}`}>{day}</span>
                                        {hasEvents && (
                                            <div className="flex gap-1 mt-1.5">
                                                {dayEvents.map(e => (
                                                    <div key={e.id} className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                                                ))}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Event Details Modal */}
                    <AnimatePresence> {/* Added AnimatePresence */}
                        {selectedDate && (
                            <motion.div // Added motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedDate(null)}>
                                <motion.div // Added motion.div
                                    initial={{ scale: 0.9, y: 50 }}
                                    animate={{ scale: 1, y: 0 }}
                                    exit={{ scale: 0.9, y: 50 }}
                                    transition={{ type: "spring", damping: 20, stiffness: 300 }}
                                    className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                    <button
                                        onClick={() => setSelectedDate(null)}
                                        className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                                    >
                                        ✕
                                    </button>

                                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 pb-4 border-b border-white/10">
                                        <CalendarIcon className="w-6 h-6 text-blue-500" />
                                        {selectedDate.toLocaleDateString(isEn ? 'en-GB' : 'pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </h3>

                                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                                        {selectedDayEvents.length === 0 ? ( // Added check for no events
                                            <div className="text-center py-12 text-slate-500 border border-dashed border-white/10 rounded-xl">
                                                <p className="text-sm">{isEn ? 'No events.' : 'Sem eventos.'}</p>
                                            </div>
                                        ) : (
                                            selectedDayEvents.map(event => (
                                                <div key={event.id} className="bg-white/5 rounded-xl p-5 border border-white/5 hover:border-blue-500/30 transition-colors">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <span className="text-sm font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {new Date(event.start_time).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        {event.platform === 'zoom' && <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold border border-white/10 px-2 py-1 rounded">Zoom</span>}
                                                    </div>
                                                    <h4 className="text-lg font-bold text-white mb-2">{event.title}</h4>
                                                    <p className="text-sm text-slate-400 mb-6 leading-relaxed">{event.description}</p>

                                                    {(() => {
                                                        const now = new Date();
                                                        const eventStart = new Date(event.start_time);
                                                        const thirtyMinsBefore = new Date(eventStart.getTime() - 30 * 60000);
                                                        const tenMinsBefore = new Date(eventStart.getTime() - 10 * 60000);
                                                        const endDate = new Date(event.end_time);

                                                        const isLive = now >= tenMinsBefore && now <= endDate;
                                                        const canJoin = now >= thirtyMinsBefore && now <= endDate;
                                                        const isPast = now > endDate;

                                                        if (isPast) {
                                                            return (
                                                                <button disabled className="w-full py-3 rounded-lg bg-slate-800/50 text-slate-500 text-sm font-bold uppercase tracking-wide cursor-not-allowed">
                                                                    Evento Terminado
                                                                </button>
                                                            );
                                                        }

                                                        if (event.meeting_url && canJoin) {
                                                            return (
                                                                <a
                                                                    href={event.meeting_url}
                                                                    target="_blank"
                                                                    className={`flex items-center justify-center gap-2 w-full py-3 rounded-lg text-sm font-bold uppercase tracking-wide transition-all ${isLive ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'}`}
                                                                >
                                                            {isEn ? 'Join Meeting' : 'Participar na Reunião'} <Video className={isLive ? "w-4 h-4 animate-pulse" : "w-4 h-4"} />
                                                                </a>
                                                            );
                                                        }

                                                        if (event.meeting_url) {
                                                            return (
                                                                <button disabled className="w-full py-3 rounded-lg bg-slate-800 text-slate-400 text-sm font-bold uppercase tracking-wide cursor-not-allowed flex items-center justify-center gap-2">
                                                                    <Clock className="w-4 h-4 text-blue-400" /> {isEn ? 'Access opens 30 min before' : 'Acesso abre 30 min antes'}
                                                                </button>
                                                            );
                                                        }

                                                        return (
                                                            <div className="w-full py-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-bold uppercase tracking-wide text-center">
                                                                {isEn ? 'Link available on event day' : 'Link disponível no dia do evento'}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence> {/* Added AnimatePresence */}
                </div>

            </div>
        </VIPLayout>
    );
}
