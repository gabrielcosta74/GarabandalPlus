import { Calendar, Video, ArrowRight, Clock } from 'lucide-react';

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
    const day = startDate.getDate();
    const month = startDate.toLocaleDateString('pt-PT', { month: 'long' }).toUpperCase();
    const weekday = startDate.toLocaleDateString('pt-PT', { weekday: 'long' });
    const time = startDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

    // Check if event is "live" (start time - 10 mins <= now <= end time)
    const now = new Date();
    const tenMinsBefore = new Date(startDate.getTime() - 10 * 60000);
    const thirtyMinsBefore = new Date(startDate.getTime() - 30 * 60000);
    const endDate = new Date(event.end_time);

    const isLive = now >= tenMinsBefore && now <= endDate;
    const canJoin = now >= thirtyMinsBefore && now <= endDate;
    const isPast = now > endDate;

    return (
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-600 via-indigo-900 to-slate-900 p-1 shadow-2xl group min-h-[400px]">
            {/* Animated Glow Effect */}
            <div className="absolute top-0 right-0 -m-20 w-60 h-60 bg-indigo-400/20 blur-[80px] rounded-full group-hover:bg-indigo-300/30 transition-colors duration-500" />
            <div className="absolute bottom-0 left-0 -m-20 w-60 h-60 bg-purple-500/20 blur-[80px] rounded-full" />

            <div className="relative bg-slate-950/80 backdrop-blur-md rounded-[1.8rem] p-6 sm:p-8 h-full flex flex-col border border-white/5">

                {/* HeaderWrapper */}
                <div className="flex justify-between items-start mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider shadow-inner">
                        <Calendar className="w-3 h-3" />
                        Próximo Evento
                    </div>

                    {isLive && (
                        <span className="flex items-center gap-2 bg-red-600/90 backdrop-blur text-white text-[10px] uppercase font-bold px-3 py-1.5 rounded-full animate-pulse shadow-lg shadow-red-900/40 border border-red-500/50">
                            <span className="w-2 h-2 bg-white rounded-full" />
                            Em Direto
                        </span>
                    )}
                </div>

                {/* Date & Time Big Display */}
                <div className="flex items-end gap-4 mb-8">
                    <div className="text-7xl font-black text-white leading-[0.8] tracking-tighter">
                        {day}
                    </div>
                    <div className="flex flex-col pb-1 gap-0.5">
                        <span className="text-sm font-bold text-indigo-400 uppercase leading-none tracking-wider">{month}</span>
                        <span className="text-xl font-light text-slate-300 leading-none capitalize">{weekday}</span>
                    </div>
                    <div className="ml-auto pl-6 border-l border-white/10 flex flex-col justify-end pb-1 text-right">
                        <div className="mb-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Portugal</span>
                            <div className="flex items-center justify-end gap-2 text-xl font-bold text-white tracking-tight">
                                <Clock className="w-4 h-4 text-indigo-400" />
                                {time}
                            </div>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Brasil (SP)</span>
                            <div className="flex items-center justify-end gap-2 text-lg font-bold text-slate-300 tracking-tight">
                                {startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="mb-8 relative z-10">
                    <h3 className="text-2xl sm:text-3xl font-serif font-bold text-white mb-3 leading-tight group-hover:text-indigo-200 transition-colors">
                        {event.title}
                    </h3>
                    <p className="text-slate-300 text-base leading-relaxed line-clamp-3 opacity-90">
                        {event.description}
                    </p>
                </div>

                {/* Footer / Action */}
                <div className="mt-auto pt-8 border-t border-white/10">
                    {isPast ? (
                        <button disabled className="w-full py-4 rounded-xl bg-slate-800 text-slate-500 text-sm font-bold uppercase tracking-wider cursor-not-allowed">
                            Evento Terminado
                        </button>
                    ) : event.meeting_url && canJoin ? (
                        <a
                            href={event.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`
                                flex items-center justify-center gap-3 w-full py-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all transform hover:-translate-y-1 active:translate-y-0
                                ${isLive
                                    ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-xl shadow-red-900/30'
                                    : 'bg-white text-indigo-950 hover:bg-indigo-50 shadow-xl shadow-white/5'
                                }
                            `}
                        >
                            {isLive ? (
                                <>Entrar na Sala <Video className="w-5 h-5 animate-pulse" /></>
                            ) : (
                                <>Entrar na Sala <ArrowRight className="w-5 h-5" /></>
                            )}
                        </a>
                    ) : event.meeting_url ? (
                        <button disabled className="w-full py-4 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider cursor-not-allowed flex items-center justify-center gap-2">
                            <Clock className="w-4 h-4 text-indigo-400" /> Acesso abre 30 min antes
                        </button>
                    ) : (
                        <div className="w-full py-4 rounded-xl bg-white/5 border border-white/5 text-slate-400 text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2">
                            <Clock className="w-4 h-4" />
                            Link disponível brevemente
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
