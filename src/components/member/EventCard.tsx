import { Calendar, Video, Clock } from 'lucide-react';

interface EventCardProps {
    event: {
        id: string;
        title: string;
        description: string;
        start_time: string;
        end_time: string;
        meeting_url: string;
        platform: string;
    };
}

export default function EventCard({ event }: EventCardProps) {
    const startDate = new Date(event.start_time);
    const day = startDate.toLocaleDateString('pt-PT', { day: 'numeric', timeZone: 'Europe/Lisbon' });
    const month = startDate.toLocaleDateString('pt-PT', { month: 'long', timeZone: 'Europe/Lisbon' }).toUpperCase();
    const weekday = startDate.toLocaleDateString('pt-PT', { weekday: 'long', timeZone: 'Europe/Lisbon' });
    const timePT = startDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' });
    const timeBR = startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

    // Check if event is "live" (start time - 10 mins <= now <= end time)
    const now = new Date();
    const tenMinsBefore = new Date(startDate.getTime() - 10 * 60000);
    const thirtyMinsBefore = new Date(startDate.getTime() - 30 * 60000);
    const endDate = new Date(event.end_time);

    const isLive = now >= tenMinsBefore && now <= endDate;
    const canJoin = now >= thirtyMinsBefore && now <= endDate;
    const isPast = now > endDate;

    return (
        <div className="relative overflow-hidden rounded-[1.5rem] sm:rounded-3xl bg-slate-900/90 border border-white/10 p-5 sm:p-6 shadow-xl group">
            {/* Ambient Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[50px] rounded-full group-hover:bg-indigo-400/20 transition-colors duration-500 pointer-events-none" />

            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">

                {/* Date Badge */}
                <div className="flex-shrink-0 flex flex-row sm:flex-col items-center justify-between sm:justify-center w-full sm:w-24 sm:h-24 bg-slate-800/80 rounded-xl sm:rounded-2xl border border-white/5 shadow-inner p-3 sm:p-0">
                    <div className="flex sm:flex-col items-center gap-2 sm:gap-0">
                        <span className="text-[10px] sm:text-xs font-bold text-indigo-400 uppercase tracking-widest">{month.substring(0, 3)}</span>
                        <span className="text-2xl sm:text-3xl font-black text-white leading-none sm:mt-1">{day}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium uppercase sm:mt-2">{weekday.substring(0, 3)}</span>
                </div>

                {/* Event Details */}
                <div className="flex-1 min-w-0 w-full">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 text-[10px] font-bold uppercase tracking-wider">
                            <Calendar className="w-3 h-3" /> Próximo Evento
                        </span>
                        {isLive && (
                            <span className="flex items-center gap-1.5 bg-red-500/10 text-red-500 text-[10px] font-bold uppercase tracking-wider animate-pulse px-2 py-1 rounded-full border border-red-500/20">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" /> Em Direto
                            </span>
                        )}
                    </div>

                    <h3 className="text-lg sm:text-xl font-serif font-bold text-white mb-2 line-clamp-1 group-hover:text-indigo-200 transition-colors">
                        {event.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm font-medium text-slate-400">
                        <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-indigo-400/70" />
                            <span className="text-white">{timePT} PT</span> <span className="text-slate-500">/</span> {timeBR} BR
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                <div className="w-full sm:w-auto mt-2 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-white/5 sm:border-none flex justify-end">
                    {isPast ? (
                        <button disabled className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-800 text-slate-500 text-[10px] font-bold uppercase tracking-widest cursor-not-allowed">
                            Terminado
                        </button>
                    ) : event.meeting_url && canJoin ? (
                        <a
                            href={event.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-transform hover:scale-105 active:scale-95 ${isLive ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20' : 'bg-white text-slate-900 hover:bg-slate-100 shadow-lg shadow-white/10'
                                }`}
                        >
                            Entrar na Sala <Video className="w-4 h-4" />
                        </a>
                    ) : event.meeting_url ? (
                        <button disabled className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-slate-800/80 text-slate-400 text-[10px] font-bold uppercase tracking-widest cursor-not-allowed flex items-center justify-center gap-2 border border-white/5">
                            <Clock className="w-3 h-3 text-indigo-400" /> Abre 30m Antes
                        </button>
                    ) : (
                        <div className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-slate-800/50 text-slate-500 text-[10px] font-bold uppercase tracking-widest text-center border border-white/5 flex items-center justify-center gap-2">
                            Disponível Brevemente
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
