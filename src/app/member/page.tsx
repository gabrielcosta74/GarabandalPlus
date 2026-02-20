"use client";

import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import VIPLayout from '../../components/member/VIPLayout';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { isActiveMember } from '../../lib/store-discounts';
import {
  CreditCard,
  ShieldCheck,
  Gift,
  Clock,
  ChevronRight,
  BookOpen,
  Star,
  Lock,
  Flame,
  Calendar,
  Film,
  ArrowRight,
  Sparkles,
  Video,
  ScrollText
} from 'lucide-react';
import EventCard from '../../components/member/EventCard';
import MemberTutorial from '../../components/onboarding/MemberTutorial';

type MemberSummary = {
  nome?: string | null;
  numero_socio?: number | null;
  estado_quota?: string | null;
  proxima_quota?: string | null;
  tipo_subscricao?: string | null;
  is_membro?: boolean | null;
  data_adesao?: string | null;
  avatar_url?: string | null;
};

type Event = {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  meeting_url: string;
  platform: string;
};

export default function MemberDashboardPage() {
  const [member, setMember] = useState<MemberSummary | null>(null);
  const [nextEvent, setNextEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!supabaseBrowser) return;
        const { data: { user } } = await supabaseBrowser.auth.getUser();

        if (!user) {
          // If no user, we can't load data. 
          // VIPLayout might handle redirect, but we must stop loading.
          return;
        }

        // Load Member
        const { data: memberData } = await supabaseBrowser
          .from('membros')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (memberData) setMember(memberData);

        // Load ONLY the next Active Event
        const { data: eventsData } = await supabaseBrowser
          .from('events')
          .select('*')
          .eq('is_active', true)
          .gte('end_time', new Date().toISOString()) // Only future or ongoing events
          .order('start_time', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (eventsData) setNextEvent(eventsData);
      } catch (error) {
        console.error('Error loading member dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  /* REMOVED LOCAL LOGIC - Using shared lib/store-discounts.ts */
  const isValidMember = useMemo(() => isActiveMember(member), [member]);

  const firstName = member?.nome?.split(' ')[0] || 'Membro';

  return (
    <VIPLayout>
      <MemberTutorial />
      <div className="space-y-12">
        {/* Welcome Hero */}
        <section className="relative" id="tut-hero">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-500/20 rounded-full blur-[100px] pointer-events-none" />

          <div className="flex flex-col md:flex-row items-end md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-slate-800 border-4 border-slate-700/50 overflow-hidden shadow-2xl shrink-0 flex items-center justify-center">
                {member?.avatar_url ? (
                  <img src={member.avatar_url} alt={firstName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-serif text-yellow-500 font-bold">{firstName.charAt(0)}</span>
                )}
              </div>
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-xs font-bold uppercase tracking-wider text-yellow-500 mb-2">
                  <Star className="w-3 h-3 fill-yellow-500" />
                  Membro Oficial
                </div>
                <h1 className="font-serif text-3xl md:text-5xl font-bold text-white mb-2 flex items-baseline gap-3">
                  Olá, {firstName}
                  {member?.numero_socio && (
                    <span className="text-2xl md:text-4xl text-slate-400 font-light tracking-wide">#{member.numero_socio}</span>
                  )}
                </h1>
                <p className="text-slate-400 text-sm md:text-base max-w-xl">
                  Bem-vindo ao teu espaço exclusivo.
                </p>
              </div>
            </div>

            {/* Status Card */}
            <div className="bg-slate-900/50 backdrop-blur-sm p-4 rounded-2xl border border-white/10 flex items-center gap-4 min-w-[280px]">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-600 to-yellow-800 rounded-full flex items-center justify-center text-white shadow-lg">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Estado Atual</p>
                <p className={`text-lg font-bold ${loading ? 'text-slate-500 animate-pulse' : isValidMember ? 'text-white' : 'text-red-400'}`}>
                  {loading ? 'A carregar...' : (isValidMember ? 'Quota em Dia' : 'Pagamento Pendente')}
                </p>
                <Link href="/member/quota" className="text-xs text-yellow-500 hover:text-yellow-400 hover:underline">
                  Gerir quota &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* AGENDA / EVENTS (Single Next Event) - Only shows if there are events */}
        {nextEvent && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                Agenda
              </h2>
              <Link href="/member/calendar" className="text-sm font-bold text-slate-900 hover:text-indigo-950 transition-colors flex items-center gap-2 bg-white hover:bg-slate-200 px-5 py-2.5 rounded-full shadow-lg shadow-white/10">
                Ver Calendário Completo <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch" id="tut-event-section">
              <div className="lg:col-span-2">
                <EventCard event={nextEvent} />
              </div>

              {/* Context / Helper Text */}
              <div className="hidden lg:flex flex-col justify-center bg-slate-900/50 border border-white/5 rounded-[2rem] p-8 h-full" id="tut-event-help">
                <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6">
                  <Video className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Como participar?
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Os encontros realizam-se através da plataforma Zoom ou Google Meet.
                  <br /><br />
                  Basta clicares no botão <strong>"Entrar na Sala"</strong> quando faltarem 30 minutos para o evento começar. O botão ficará desbloqueado automaticamente.
                </p>
                <div className="mt-auto pt-6 border-t border-white/5">
                  <p className="text-xs text-slate-500 font-medium">
                    Tens dúvidas? <a href="#" className="text-indigo-400 hover:underline">Contacta o suporte.</a>
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Exclusive Content Grid */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-2xl font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-yellow-600" />
              Conteúdos Exclusivos
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Mensagens */}
            <Link href="/member/espiritualidade" id="tut-about" className="group relative bg-slate-900 rounded-2xl border border-white/5 hover:border-yellow-600/30 overflow-hidden transition-all hover:shadow-2xl hover:shadow-yellow-900/20">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
              <div className="h-64 bg-[url('/images/meninasgarabandal.jpg')] bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center backdrop-blur-sm mb-4 text-blue-400">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-white mb-2">Sobre Garabandal</h3>
                <p className="text-base text-slate-400 mb-6 max-w-lg">
                  A história completa das aparições. Explore as mensagens, os avisos proféticos e artigos de aprofundamento.
                </p>
                <span className="text-sm font-bold text-white group-hover:text-yellow-500 flex items-center gap-2 transition-colors">
                  Explorar História <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </Link>

            {/* Card 2: Enviar Intenções (UPDATED) */}
            <Link href="/member/velas" id="tut-intentions" className="group relative bg-slate-900 rounded-2xl border border-white/5 hover:border-orange-500/30 overflow-hidden transition-all hover:shadow-2xl hover:shadow-orange-900/20">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
              {/* Church Image */}
              <div className="h-64 bg-[url('/images/igrejagarabandal.webp')] bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="w-12 h-12 bg-orange-600/20 rounded-xl flex items-center justify-center backdrop-blur-sm mb-4 text-orange-400">
                  <Flame className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-white mb-2">Enviar Intenções</h3>
                <p className="text-base text-slate-400 mb-6 max-w-lg">
                  Acende uma vela pelas tuas intenções. Elas serão apresentadas a Nossa Senhora na igreja em Garabandal.
                </p>
                <span className="text-sm font-bold text-white group-hover:text-orange-500 flex items-center gap-2 transition-colors">
                  Enviar Agora <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </Link>

            {/* Card 4: Cursos de Aprendizagem (UPDATED) */}
            <Link href="/member/cursos" id="tut-academy" className="group relative overflow-hidden rounded-3xl bg-slate-900 border border-white/5 transition-all hover:border-white/20 hover:shadow-2xl hover:shadow-orange-900/10">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 to-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity" />
              {/* Multimedia Background */}
              <div className="absolute inset-0 bg-[url('/images/multimedia_background.webp')] bg-cover bg-center opacity-20 group-hover:opacity-40 transition-opacity duration-500" />

              <div className="relative p-8 h-full flex flex-col items-start gap-4">
                <div className="p-3 bg-indigo-500/10 rounded-2xl group-hover:bg-indigo-500/20 transition-colors backdrop-blur-md">
                  <Film className="w-8 h-8 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-200 transition-colors">Cursos & Multimédia</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Começa a aprender com a nossa coleção de filmes e cursos sobre as aparições.
                  </p>
                </div>
                <div className="mt-auto flex items-center text-sm font-bold text-indigo-400 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                  Assistir Agora <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </Link>

            {/* Card 3: Novenas */}
            <Link href="/member/novenas" id="tut-novenas" className="group relative bg-slate-900 rounded-2xl border border-white/5 hover:border-indigo-500/30 overflow-hidden transition-all hover:shadow-2xl hover:shadow-indigo-900/20">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
              <div className="h-64 bg-[url('https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?q=80&w=2786&auto=format&fit=crop')] bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center backdrop-blur-sm mb-4 text-indigo-400">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-white mb-2">Novenas Assistidas</h3>
                <p className="text-base text-slate-400 mb-6 max-w-lg">
                  Inicia uma jornada de oração guiada. Nós ajudamos-te a completar os 9 dias.
                </p>
                <span className="text-sm font-bold text-white group-hover:text-indigo-500 flex items-center gap-2 transition-colors">
                  Iniciar Novena <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </Link>

            {/* Card 6: Garabandal Em Direto (NEW) */}
            <Link href="/member/live" id="tut-live" className="group relative bg-slate-900 rounded-2xl border border-white/5 hover:border-red-500/30 overflow-hidden transition-all hover:shadow-2xl hover:shadow-red-900/20">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
              <div className="h-64 bg-[url('/images/igrejagarabandal.webp')] bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="w-12 h-12 bg-red-600/20 rounded-xl flex items-center justify-center backdrop-blur-sm mb-4 text-red-500">
                  <Video className="w-6 h-6 animate-pulse" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-2xl font-serif font-bold text-white">Garabandal Ao Vivo</h3>
                  <span className="bg-red-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded animate-pulse">Live</span>
                </div>
                <p className="text-base text-slate-400 mb-6 max-w-lg">
                  Liga-te à Igreja Paroquial de Garabandal e assiste às missas diárias.
                </p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-red-200/80 bg-red-900/20 px-2 py-1 rounded w-fit">
                    <Clock className="w-3 h-3 text-red-400" />
                    <span>2ª a 6ª Feira (11:00 ES)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-red-200/80 bg-red-900/20 px-2 py-1 rounded w-fit">
                    <Clock className="w-3 h-3 text-red-400" />
                    <span>Domingo (13:00 ES)</span>
                  </div>
                </div>
                <span className="text-sm font-bold text-white group-hover:text-red-500 flex items-center gap-2 transition-colors mt-4">
                  Assistir Agora <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </Link>

            {/* Card 5: Orações */}
            <Link href="/member/prayers" id="tut-prayers" className="group relative bg-slate-900 rounded-2xl border border-white/5 hover:border-yellow-500/30 overflow-hidden transition-all hover:shadow-2xl hover:shadow-yellow-900/20">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
              <div className="h-64 bg-[url('https://images.unsplash.com/photo-1549652127-2eec5d29bec5?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="w-12 h-12 bg-yellow-600/20 rounded-xl flex items-center justify-center backdrop-blur-sm mb-4 text-yellow-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-white mb-2">Orações & Devoção</h3>
                <p className="text-base text-slate-400 mb-6 max-w-lg">
                  Encontra paz com a nossa coleção de orações, incluindo a súplica a Nossa Senhora de Garabandal.
                </p>
                <span className="text-sm font-bold text-white group-hover:text-yellow-500 flex items-center gap-2 transition-colors">
                  Ver Orações <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </Link>

          </div>
        </section>

        {/* Quick Actions Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/member/quota" id="tut-quota" className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 hover:bg-slate-800/50 hover:border-white/10 transition-all flex items-start gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-bold mb-1">Estado da Quota</h3>
              <p className="text-sm text-slate-400">Verifica os pagamentos e regulariza a tua situação anual.</p>
            </div>
          </Link>
          <Link href="/member/history" id="tut-history" className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 hover:bg-slate-800/50 hover:border-white/10 transition-all flex items-start gap-4">
            <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-bold mb-1">Histórico</h3>
              <p className="text-sm text-slate-400">Consulta todas as tuas interações e donativos passados.</p>
            </div>
          </Link>

          <Link href="/member/direitos-deveres" id="tut-card" className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 hover:bg-slate-800/50 hover:border-white/10 transition-all flex items-start gap-4">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
              <ScrollText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-bold mb-1">Direitos e Deveres</h3>
              <p className="text-sm text-slate-400">Consulta o regulamento, benefícios e obrigações dos membros.</p>
            </div>
          </Link>
        </section>

      </div>
    </VIPLayout>
  );
}
