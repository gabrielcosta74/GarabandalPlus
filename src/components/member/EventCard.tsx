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
    const month = startDate.toLocaleDateString('pt-PT', { month: 'short' }).toUpperCase();
    const time = startDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

    // Check if event is "live" (start time - 10 mins <= now <= end time)
    const now = new Date();
    const tenMinsBefore = new Date(startDate.getTime() - 10 * 60000);
    const endDate = new Date(event.end_time);

    const isLive = now >= tenMinsBefore && now <= endDate;
    const isPast = now > endDate;

    return (
        <div className="min-w-[280px] md:min-w-[320px] bg-slate-900 border border-white/10 rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden group hover:border-white/20 transition-all">
            {/* Live Indicator Background - Only visible if Live */}
            {isLive && (
                <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/20 blur-[40px] rounded-full -translate-y-1/2 translate-x-1/2" />
            )}

            <div className="flex justify-between items-start">
                <div className="bg-white/5 rounded-lg p-2 text-center min-w-[60px]">
                    <span className="block text-2xl font-bold text-white leading-none">{day}</span>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">{month}</span>
                </div>
                {isLive ? (
                    <span className="bg-green-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]">
                        A Decorrer
                    </span>
                ) : (
                    <div className="flex items-center gap-1 text-slate-400 text-xs font-mono bg-white/5 px-2 py-1 rounded">
                        <Clock className="w-3 h-3" /> {time}
                    </div>
                )}
            </div>

            <div>
                <h3 className="text-lg font-bold text-white mb-2 leading-tight group-hover:text-yellow-500 transition-colors line-clamp-2">
                    {event.title}
                </h3>
                <p className="text-slate-400 text-sm line-clamp-2 leading-relaxed">
                    {event.description}
                </p>
            </div>

            <div className="mt-auto pt-4 border-t border-white/5">
                {isPast ? (
                    <button disabled className="w-full py-2 rounded-lg bg-slate-800 text-slate-500 text-xs font-bold uppercase tracking-wider cursor-not-allowed">
                        Terminado
                    </button>
                ) : (
                    event.meeting_url ? (
                        <a
                            href={event.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`
                                flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide transition-all
                                ${isLive
                                    ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20'
                                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/10 hover:border-white/30'
                                }
                            `}
                        >
                            {isLive ? (
                                <>Entrar Agora <Video className="w-4 h-4 animate-pulse" /></>
                            ) : (
                                <>Ver Detalhes <ArrowRight className="w-4 h-4" /></>
                            )}
                        </a>
                    ) : (
                        <div className="w-full py-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2">
                            <Clock className="w-3 h-3" />
                            Link disponível no dia
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
