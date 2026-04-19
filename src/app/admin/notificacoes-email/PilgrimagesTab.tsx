"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  CalendarDays,
  Calendar,
  CircleAlert,
  CreditCard,
  Route,
  Check,
  Clock,
  ArrowRight,
  PieChart,
  RefreshCw
} from 'lucide-react';

export type PilgrimageViewMode = 'agenda' | 'tracking';
export type PilgrimageTimeFilter = 'all' | 'today' | 'upcoming' | 'overdue';
export type PilgrimageKindFilter = 'all' | 'deposit' | 'installment';

interface PilgrimagesTabProps {
  data?: any;
  error: any;
  isLoading: boolean;
  mutate: () => void;
}

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Sem data';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return format(d, "d MMM yyyy, HH:mm", { locale: pt });
};

function translateReminderKind(kind: string) {
  switch (kind) {
    case 'upcoming_7d': return '7 dias antes';
    case 'upcoming_3d': return '3 dias antes';
    case 'upcoming_2d': return '2 dias antes';
    case 'upcoming_1d': return '1 dia antes';
    case 'due_today': return 'No vencimento';
    case 'overdue_2d': return '2 dias em atraso';
    case 'overdue_3d': return '3 dias em atraso';
    case 'overdue_5d': return '5 dias em atraso';
    case 'overdue_10d': return '10 dias em atraso';
    default: return kind;
  }
}

export function PilgrimagesTab({ data, error, isLoading, mutate }: PilgrimagesTabProps) {
  const [viewMode, setViewMode] = useState<PilgrimageViewMode>('agenda');
  const [timeFilter, setTimeFilter] = useState<PilgrimageTimeFilter>('all');
  const [kindFilter, setKindFilter] = useState<PilgrimageKindFilter>('all');

  const rawReminders = data?.reminders || [];
  const summary = data?.summary || { totalBookings: 0, deposits: 0, installments: 0, sendToday: 0, upcomingNext7Days: 0 };

  type AgendaEvent = {
    bookingId: string;
    recipientName: string;
    email: string;
    pilgrimageName: string;
    bookingUrl: string;
    obligationLabel: string;
    reminderKind: 'deposit' | 'installment';
    amountDue: number;
    scheduledFor: string;
    state: 'today' | 'scheduled' | 'overdue_pending';
    diffDays: number;
    kind: string;
    dateSort: number;
  };

  const agendaGroups = useMemo(() => {
    let events: AgendaEvent[] = [];

    for (const r of rawReminders) {
      if (kindFilter !== 'all' && r.reminderKind !== kindFilter) continue;

      const action = r.currentAction || r.nextPlanned;
      if (!action || action.alreadySent) continue;

      if (timeFilter === 'today' && action.state !== 'today') continue;
      if (timeFilter === 'overdue' && action.state !== 'overdue_pending') continue;
      if (timeFilter === 'upcoming' && action.state !== 'scheduled') continue;

      events.push({
        bookingId: r.bookingId,
        recipientName: r.recipientName,
        email: r.email,
        pilgrimageName: r.pilgrimageName,
        bookingUrl: r.bookingUrl,
        obligationLabel: r.obligationLabel,
        reminderKind: r.reminderKind,
        amountDue: r.amountDue,
        scheduledFor: action.scheduledFor,
        state: action.state,
        diffDays: action.diffDays,
        kind: action.kind,
        dateSort: new Date(action.scheduledFor).getTime(),
      });
    }

    events.sort((a, b) => a.dateSort - b.dateSort);

    const groups: { label: string; events: AgendaEvent[]; priority: number }[] = [
      { label: 'Hoje', events: [], priority: 1 },
      { label: 'Atrasados', events: [], priority: 0 },
      { label: 'Próximos', events: [], priority: 2 },
    ];

    for (const ev of events) {
      if (ev.state === 'today') groups[0].events.push(ev);
      else if (ev.state === 'overdue_pending') groups[1].events.push(ev);
      else groups[2].events.push(ev);
    }

    return groups.filter(g => g.events.length > 0).sort((a, b) => a.priority - b.priority);
  }, [rawReminders, timeFilter, kindFilter]);

  const filteredReminders = useMemo(() => {
    return rawReminders.filter((r: any) => {
      if (kindFilter !== 'all' && r.reminderKind !== kindFilter) return false;
      const action = r.currentAction || r.nextPlanned;
      if (timeFilter === 'today' && (!action || action.state !== 'today')) return false;
      if (timeFilter === 'overdue' && (!action || action.state !== 'overdue_pending')) return false;
      if (timeFilter === 'upcoming' && (!action || action.state !== 'scheduled')) return false;
      return true;
    });
  }, [rawReminders, timeFilter, kindFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row gap-5">
        <div className="shrink-0 flex self-start rounded-2xl bg-slate-100 p-1">
          <button
            onClick={() => setViewMode('agenda')}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-bold transition-all ${
              viewMode === 'agenda'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Agenda de Envios
          </button>
          <button
            onClick={() => setViewMode('tracking')}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-bold transition-all ${
              viewMode === 'tracking'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Route className="w-4 h-4" />
            Tracking Avançado
          </button>
        </div>

        <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="col-span-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-500">Métricas</p>
              <p className="text-xl font-bold text-blue-900 mt-1">{summary.totalBookings} Reservas ativas</p>
            </div>
            <PieChart className="w-8 h-8 text-blue-300 opacity-60" />
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm flex flex-col justify-center relative overflow-hidden">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">A Enviar Hoje</p>
            <p className="text-2xl font-black text-amber-700 mt-1">{summary.sendToday}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 shadow-sm flex flex-col justify-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-500">Próximos 7 Dias</p>
            <p className="text-2xl font-black text-rose-700 mt-1">{summary.upcomingNext7Days}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 py-2 border-y border-slate-100">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mr-2">Filtros</span>
        
        <div className="flex items-center gap-1.5 border-r border-slate-200 pr-4">
          <FilterPill active={timeFilter === 'all'} onClick={() => setTimeFilter('all')} label="Ver Tudo" />
          <FilterPill active={timeFilter === 'today'} onClick={() => setTimeFilter('today')} label="Envio Hoje" tone="amber" />
          <FilterPill active={timeFilter === 'overdue'} onClick={() => setTimeFilter('overdue')} label="Em Atraso" tone="rose" />
          <FilterPill active={timeFilter === 'upcoming'} onClick={() => setTimeFilter('upcoming')} label="Próximos" tone="slate" />
        </div>

        <div className="flex items-center gap-1.5 pl-2">
          <FilterPill active={kindFilter === 'all'} onClick={() => setKindFilter('all')} label="Todas" />
          <FilterPill active={kindFilter === 'deposit'} onClick={() => setKindFilter('deposit')} label="Sinais" icon={<CircleAlert className="w-3.5 h-3.5" />} tone="blue" />
          <FilterPill active={kindFilter === 'installment'} onClick={() => setKindFilter('installment')} label="Prestações" icon={<CreditCard className="w-3.5 h-3.5" />} tone="emerald" />
        </div>

        <div className="ml-auto">
           <button
            onClick={() => mutate()}
            className="inline-flex items-center gap-2 rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700 font-medium">
          Erro ao carregar a agenda dos lembretes.
        </div>
      )}

      {viewMode === 'agenda' && !isLoading && !error && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-4 sm:p-8 min-h-[400px]">
          {agendaGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
             <CalendarDays className="w-10 h-10 mb-4 opacity-20" />
             <p className="text-sm font-medium">Nenhum evento agendado para os filtros selecionados.</p>
            </div>
          ) : (
            <div className="space-y-12">
              {agendaGroups.map((group) => (
                <div key={group.label} className="relative">
                  <div className="sticky top-0 bg-white/90 backdrop-blur pb-4 z-10 w-full pt-2">
                    <h3 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${group.label === 'Hoje' ? 'bg-amber-500 animate-pulse' : group.label === 'Atrasados' ? 'bg-rose-500' : 'bg-blue-500'}`}></span>
                      {group.label}
                    </h3>
                  </div>

                  <div className="space-y-4 pl-4 border-l-2 border-slate-100 ml-[5px]">
                    {group.events.map((ev, i) => (
                      <div key={i} className="relative group flex items-center py-1">
                        <div className="absolute -left-[23px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-slate-300 group-hover:border-slate-500 transition-colors hidden sm:block"></div>
                        
                        <div className="rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all bg-white px-5 py-4 w-full sm:ml-2">
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div className="flex-1 space-y-1">
                              <p className="text-sm font-semibold text-slate-800">{ev.recipientName} <span className="text-slate-400 font-normal">({ev.email})</span></p>
                              <p className="text-sm font-bold text-slate-900">{ev.pilgrimageName}</p>
                              <div className="text-xs text-slate-500 pt-1 flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">{translateReminderKind(ev.kind)}</span> 
                                <span>Ref: <strong className="font-semibold text-slate-600">{ev.obligationLabel}</strong></span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-start gap-6 shrink-0">
                               <div className="text-right">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Em Falta</p>
                                  <p className="text-xl font-black text-rose-600">{ev.amountDue.toFixed(2)}€</p>
                               </div>
                               <Link href={ev.bookingUrl} className="shrink-0 h-10 w-10 bg-slate-900 border border-slate-900 hover:bg-slate-700 rounded-xl flex items-center justify-center transition-colors shadow-sm">
                                 <ArrowRight className="w-4 h-4 text-white" />
                               </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === 'tracking' && !isLoading && !error && (
        <div className="space-y-4">
          {filteredReminders.length === 0 ? (
             <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-16 text-center text-slate-400 font-medium">
               Sem alertas para as opções ativas.
             </div>
          ) : (
             filteredReminders.map((entry: any) => (
              <div key={entry.bookingId} className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-6 relative">
                  
                  {entry.currentAction?.state === 'today' && (
                     <div className="absolute top-0 right-0 p-4">
                       <span className="flex h-3 w-3 relative">
                         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                         <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                       </span>
                     </div>
                  )}

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                       <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider border ${
                            entry.reminderKind === 'deposit'
                              ? 'border-blue-200 bg-blue-50 text-blue-700'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          }`}>
                          {entry.reminderKind === 'deposit' ? 'Sinal' : 'Prestação'}
                       </span>
                       <span className="text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md">{entry.obligationLabel}</span>
                    </div>
                    <p className="text-base font-bold text-slate-900 leading-tight">{entry.pilgrimageName}</p>
                    <p className="text-sm font-medium text-slate-600">{entry.recipientName} <span className="text-slate-400 hidden sm:inline">({entry.email})</span></p>
                  </div>

                  <div className="flex gap-2 items-stretch shrink-0 overflow-x-auto pb-1 xl:pb-0 hide-scrollbar pt-2 xl:pt-0">
                    <TrackingMetric label="Falta Pagar" value={`${entry.amountDue.toFixed(2)}€`} highlight />
                    <TrackingMetric label="Vence a" value={entry.dueDate ? formatDateTime(entry.dueDate).split(',')[0] : '—'} />
                    <Link href={entry.bookingUrl} className="flex flex-col justify-center px-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-800 hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                      <p className="text-[13px] font-bold whitespace-nowrap">Ver Inscrição</p>
                    </Link>
                  </div>
                </div>

                <div className="px-6 py-12 bg-slate-50/50 overflow-x-auto">
                  <div className="flex items-center min-w-[600px] max-w-4xl mx-auto">
                    {entry.timeline.map((step: any, idx: number) => {
                      const isLast = idx === entry.timeline.length - 1;
                      let dotClasses = "w-7 h-7 rounded-full border-[3px] flex items-center justify-center shrink-0 z-10 bg-white ";
                      let ringClasses = "";
                      let lineClasses = "h-1 flex-1 transition-all ";

                      if (step.alreadySent) {
                        dotClasses += "border-emerald-500 text-emerald-600 bg-emerald-50";
                        lineClasses += "bg-emerald-500";
                      } else if (step.state === 'today') {
                        dotClasses += "border-amber-500 text-amber-600 bg-amber-50";
                        ringClasses = "ring-4 ring-amber-500/20";
                        lineClasses += "bg-slate-200";
                      } else if (step.state === 'overdue_pending') {
                        dotClasses += "border-rose-500 text-rose-600 bg-rose-50";
                        ringClasses = "ring-4 ring-rose-500/20";
                        lineClasses += "bg-slate-200";
                      } else {
                        dotClasses += "border-slate-300 text-slate-300";
                        lineClasses += "bg-slate-200";
                      }

                      return (
                        <div key={idx} className="flex items-center flex-1 last:flex-none relative">
                          <div className="relative group flex flex-col items-center">
                            <div className={`${dotClasses} ${ringClasses}`}>
                              {step.alreadySent ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                            </div>
                            
                            <div className="absolute top-10 flex flex-col justify-center items-center w-36 text-center">
                               <p className={`text-[11px] font-bold ${step.state === 'today' ? 'text-amber-700' : step.alreadySent ? 'text-slate-800' : 'text-slate-500'}`}>
                                 {translateReminderKind(step.kind)}
                               </p>
                               <p className="text-[10px] font-medium text-slate-400 mt-0.5 whitespace-nowrap">
                                 {step.scheduledFor ? formatDateTime(step.scheduledFor) : '—'}
                               </p>
                            </div>
                          </div>

                          {!isLast && (
                            <div className={`${lineClasses} -ml-1 -mr-1 z-0`}></div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function FilterPill({ active, onClick, label, tone = 'slate', icon }: { active: boolean, onClick: () => void, label: string, tone?: 'slate'|'emerald'|'amber'|'rose'|'blue', icon?: React.ReactNode }) {
  const tones = {
    slate: active ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200',
    emerald: active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 hover:bg-emerald-50 border-emerald-200',
    amber: active ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 hover:bg-amber-50 border-amber-200',
    rose: active ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-700 hover:bg-rose-50 border-rose-200',
    blue: active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-700 hover:bg-blue-50 border-blue-200',
  };

  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border transition-all shadow-sm ${tones[tone]}`}>
      {icon}
      {label}
    </button>
  );
}

function TrackingMetric({ label, value, highlight }: { label: string, value: string, highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border px-4 py-2.5 min-w-[130px] flex flex-col justify-center ${highlight ? 'bg-rose-50 border-rose-200 shadow-sm' : 'bg-white border-slate-200 shadow-sm'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider ${highlight ? 'text-rose-500' : 'text-slate-400'}`}>{label}</p>
      <p className={`mt-0.5 text-sm font-black ${highlight ? 'text-rose-700' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}
