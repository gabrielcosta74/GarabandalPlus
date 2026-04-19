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
  ScrollText,
  FolderLock
} from 'lucide-react';
import EventCard from '../../components/member/EventCard';
import MemberTutorial from '../../components/onboarding/MemberTutorial';
import ReferralWidget from '../../components/member/ReferralWidget';
import { useLocale } from '../../contexts/LocaleContext';

type MemberSummary = {
  nome?: string | null;
  numero_socio?: number | null;
  estado_quota?: string | null;
  proxima_quota?: string | null;
  tipo_subscricao?: string | null;
  is_membro?: boolean | null;
  data_adesao?: string | null;
  avatar_url?: string | null;
  id?: string | null;
  referral_code?: string | null;
  store_credits?: number | null;
  referrals_count?: number | null;
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
  const { locale } = useLocale();
  const isEn = locale === 'en';
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

  const firstName = member?.nome?.split(' ')[0] || (isEn ? 'Member' : 'Membro');
  const memberRoot = isEn ? '/en/member' : '/member';
  const calendarPath = `${memberRoot}/calendar`;
  const spiritualityPath = isEn ? '/en/member/spirituality' : `${memberRoot}/espiritualidade`;
  const candlesPath = isEn ? '/en/member/candles' : `${memberRoot}/velas`;
  const academyPath = isEn ? '/en/member/academy' : `${memberRoot}/cursos`;
  const novenasPath = `${memberRoot}/novenas`;
  const livePath = `${memberRoot}/live`;
  const prayersPath = `${memberRoot}/prayers`;
  const documentsPath = isEn ? '/en/member/documents' : `${memberRoot}/documentos`;
  const quotaPath = `${memberRoot}/quota`;
  const historyPath = `${memberRoot}/history`;
  const rightsPath = isEn ? '/en/member/rights-duties' : `${memberRoot}/direitos-deveres`;

  return (
    <VIPLayout>
      <MemberTutorial />
      <div className="space-y-12">
        {/* Welcome Hero */}
        <section className="relative" id="tut-hero">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-500/20 rounded-full blur-[100px] pointer-events-none" />

          <div className="flex flex-col md:flex-row items-center md:items-center justify-between gap-6 md:gap-8 relative z-10">
            {/* Avatar & Info */}
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 text-center md:text-left">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-slate-800 border-4 border-slate-700/50 overflow-hidden shadow-2xl shrink-0 flex items-center justify-center">
                {member?.avatar_url ? (
                  <img src={member.avatar_url} alt={firstName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl md:text-5xl font-serif text-yellow-500 font-bold">{firstName.charAt(0)}</span>
                )}
              </div>
              <div className="flex flex-col items-center md:items-start">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-[10px] md:text-xs font-bold uppercase tracking-wider text-yellow-500 mb-3">
                  <Star className="w-3 h-3 fill-yellow-500" />
                  {isEn ? 'Official Member' : 'Membro Oficial'}
                </div>
                <h1 className="font-serif text-3xl md:text-5xl font-bold text-white mb-2 flex flex-col md:flex-row items-center md:items-baseline gap-1 md:gap-3">
                  <span>{isEn ? 'Hello' : 'Olá'}, {firstName}</span>
                  {member?.numero_socio && (
                    <span className="text-xl md:text-4xl text-slate-400 font-light tracking-wide mt-1 md:mt-0">#{member.numero_socio}</span>
                  )}
                </h1>
                <p className="text-slate-400 text-sm md:text-base max-w-xl">
                  {isEn ? 'Welcome to your exclusive space.' : 'Bem-vindo ao teu espaço exclusivo.'}
                </p>
              </div>
            </div>

            {/* Status Card */}
            <div className="w-full md:w-auto bg-slate-900/50 backdrop-blur-sm p-4 rounded-2xl border border-white/10 flex items-center justify-between md:justify-start gap-4 min-w-[280px]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-600 to-yellow-800 rounded-full flex items-center justify-center text-white shadow-lg shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">{isEn ? 'Current Status' : 'Estado Atual'}</p>
                  <p className={`text-lg font-bold ${loading ? 'text-slate-500 animate-pulse' : isValidMember ? 'text-white' : 'text-red-400'}`}>
                    {loading ? (isEn ? 'Loading...' : 'A carregar...') : (isValidMember ? (isEn ? 'Fee Up to Date' : 'Quota em Dia') : (isEn ? 'Payment Pending' : 'Pagamento Pendente'))}
                  </p>
                  <Link href={quotaPath} className="inline-block mt-1 text-xs font-bold text-yellow-400 hover:text-yellow-300 hover:underline transition-colors">
                    {isEn ? 'Manage fee' : 'Gerir quota'} &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Gamification / Referral Widget */}
        {member?.id && (
          <section>
            <ReferralWidget
              userId={member.id}
              nome={member.nome || null}
              initialCode={member.referral_code || null}
              initialCredits={member.store_credits || 0}
              initialCount={member.referrals_count || 0}
            />
          </section>
        )}

        {/* AGENDA / EVENTS (Single Next Event) - Only shows if there are events */}
        {nextEvent && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                {isEn ? 'Calendar' : 'Agenda'}
              </h2>
              <Link href={calendarPath} className="text-sm font-bold !text-white flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-5 py-2.5 rounded-full transition-colors shadow-sm">
                {isEn ? 'View Full Calendar' : 'Ver Calendário Completo'} <ArrowRight className="w-4 h-4 text-white" />
              </Link>
            </div>

            <div className="flex flex-col gap-4" id="tut-event-section">
              <EventCard event={nextEvent} />

              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex items-start sm:items-center gap-4 mt-2">
                <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center shrink-0 hidden sm:flex">
                  <Video className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-white text-sm font-bold mb-1">{isEn ? 'How to participate?' : 'Como participar?'}</h4>
                  <p className="text-indigo-200/80 text-xs leading-relaxed max-w-3xl">
                    {isEn
                      ? <>Click &quot;Join Room&quot; when there are 30 minutes left before the event starts to enter via Zoom or Google Meet. The button will unlock automatically. <a href="#" className="font-bold text-indigo-400 hover:text-indigo-300 underline ml-1">Need support?</a></>
                      : <>Clica em &quot;Entrar na Sala&quot; quando faltarem 30 minutos para o evento começar para acederes através do Zoom ou Google Meet. O botão ficará desbloqueado automaticamente. <a href="#" className="font-bold text-indigo-400 hover:text-indigo-300 underline ml-1">Precisas de suporte?</a></>}
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
              {isEn ? 'Exclusive Content' : 'Conteúdos Exclusivos'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Mensagens */}
            <Link href={spiritualityPath} id="tut-about" className="group relative bg-slate-900 rounded-2xl border border-white/5 hover:border-yellow-600/30 overflow-hidden transition-all hover:shadow-2xl hover:shadow-yellow-900/20">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
              <div className="h-64 bg-[url('/images/meninasgarabandal.jpg')] bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center backdrop-blur-sm mb-4 text-blue-400">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-white mb-2">{isEn ? 'About Garabandal' : 'Sobre Garabandal'}</h3>
                <p className="text-base text-slate-400 mb-6 max-w-lg">
                  {isEn ? 'The full story of the apparitions. Explore the messages, prophetic warnings, and in-depth articles.' : 'A história completa das aparições. Explore as mensagens, os avisos proféticos e artigos de aprofundamento.'}
                </p>
                <span className="text-sm font-bold text-white group-hover:text-yellow-500 flex items-center gap-2 transition-colors">
                  {isEn ? 'Explore the Story' : 'Explorar História'} <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </Link>

            {/* Card 2: Enviar Intenções (UPDATED) */}
            <Link href={candlesPath} id="tut-intentions" className="group relative bg-slate-900 rounded-2xl border border-white/5 hover:border-orange-500/30 overflow-hidden transition-all hover:shadow-2xl hover:shadow-orange-900/20">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
              {/* Church Image */}
              <div className="h-64 bg-[url('/images/igrejagarabandal.webp')] bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="w-12 h-12 bg-orange-600/20 rounded-xl flex items-center justify-center backdrop-blur-sm mb-4 text-orange-400">
                  <Flame className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-white mb-2">{isEn ? 'Send Intentions' : 'Enviar Intenções'}</h3>
                <p className="text-base text-slate-400 mb-6 max-w-lg">
                  {isEn ? 'Light a candle for your intentions. They will be presented to Our Lady in the church at Garabandal.' : 'Acende uma vela pelas tuas intenções. Elas serão apresentadas a Nossa Senhora na igreja em Garabandal.'}
                </p>
                <span className="text-sm font-bold text-white group-hover:text-orange-500 flex items-center gap-2 transition-colors">
                  {isEn ? 'Send Now' : 'Enviar Agora'} <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </Link>

            {/* Card 4: Cursos de Aprendizagem (UPDATED) */}
            <Link href={academyPath} id="tut-academy" className="group relative overflow-hidden rounded-3xl bg-slate-900 border border-white/5 transition-all hover:border-white/20 hover:shadow-2xl hover:shadow-orange-900/10">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 to-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity" />
              {/* Multimedia Background */}
              <div className="absolute inset-0 bg-[url('/images/multimedia_background.webp')] bg-cover bg-center opacity-20 group-hover:opacity-40 transition-opacity duration-500" />

              <div className="relative p-8 h-full flex flex-col items-start gap-4">
                <div className="p-3 bg-indigo-500/10 rounded-2xl group-hover:bg-indigo-500/20 transition-colors backdrop-blur-md">
                  <Film className="w-8 h-8 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-200 transition-colors">{isEn ? 'Courses & Multimedia' : 'Cursos & Multimédia'}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {isEn ? 'Start learning with our collection of films and courses about the apparitions.' : 'Começa a aprender com a nossa coleção de filmes e cursos sobre as aparições.'}
                  </p>
                </div>
                <div className="mt-auto flex items-center text-sm font-bold text-indigo-400 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                  {isEn ? 'Watch Now' : 'Assistir Agora'} <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </Link>

            {/* Card 3: Novenas */}
            <Link href={novenasPath} id="tut-novenas" className="group relative bg-slate-900 rounded-2xl border border-white/5 hover:border-indigo-500/30 overflow-hidden transition-all hover:shadow-2xl hover:shadow-indigo-900/20">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
              <div className="h-64 bg-[url('https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?q=80&w=2786&auto=format&fit=crop')] bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center backdrop-blur-sm mb-4 text-indigo-400">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-white mb-2">{isEn ? 'Guided Novenas' : 'Novenas Assistidas'}</h3>
                <p className="text-base text-slate-400 mb-6 max-w-lg">
                  {isEn ? 'Start a guided prayer journey. We help you complete all 9 days.' : 'Inicia uma jornada de oração guiada. Nós ajudamos-te a completar os 9 dias.'}
                </p>
                <span className="text-sm font-bold text-white group-hover:text-indigo-500 flex items-center gap-2 transition-colors">
                  {isEn ? 'Start Novena' : 'Iniciar Novena'} <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </Link>

            {/* Card 6: Garabandal Em Direto (NEW) */}
            <Link href={livePath} id="tut-live" className="group relative bg-slate-900 rounded-2xl border border-white/5 hover:border-red-500/30 overflow-hidden transition-all hover:shadow-2xl hover:shadow-red-900/20">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
              <div className="h-64 bg-[url('/images/igrejagarabandal.webp')] bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="w-12 h-12 bg-red-600/20 rounded-xl flex items-center justify-center backdrop-blur-sm mb-4 text-red-500">
                  <Video className="w-6 h-6 animate-pulse" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-2xl font-serif font-bold text-white">{isEn ? 'Garabandal Live' : 'Garabandal Ao Vivo'}</h3>
                  <span className="bg-red-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded animate-pulse">Live</span>
                </div>
                  <p className="text-base text-slate-400 mb-6 max-w-lg">
                  {isEn ? 'Connect to the parish church of Garabandal and watch the daily Masses.' : 'Liga-te à Igreja Paroquial de Garabandal e assiste às missas diárias.'}
                  </p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-red-200/80 bg-red-900/20 px-2 py-1 rounded w-fit">
                    <Clock className="w-3 h-3 text-red-400" />
                    <span>{isEn ? 'Mon to Fri (11:00 ES)' : '2ª a 6ª Feira (11:00 ES)'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-red-200/80 bg-red-900/20 px-2 py-1 rounded w-fit">
                    <Clock className="w-3 h-3 text-red-400" />
                    <span>{isEn ? 'Sunday (13:00 ES)' : 'Domingo (13:00 ES)'}</span>
                  </div>
                </div>
                <span className="text-sm font-bold text-white group-hover:text-red-500 flex items-center gap-2 transition-colors mt-4">
                  {isEn ? 'Watch Now' : 'Assistir Agora'} <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </Link>

            {/* Card 5: Orações */}
            <Link href={prayersPath} id="tut-prayers" className="group relative bg-slate-900 rounded-2xl border border-white/5 hover:border-yellow-500/30 overflow-hidden transition-all hover:shadow-2xl hover:shadow-yellow-900/20">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
              <div className="h-64 bg-[url('https://images.unsplash.com/photo-1549652127-2eec5d29bec5?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="w-12 h-12 bg-yellow-600/20 rounded-xl flex items-center justify-center backdrop-blur-sm mb-4 text-yellow-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-white mb-2">{isEn ? 'Prayers & Devotion' : 'Orações & Devoção'}</h3>
                <p className="text-base text-slate-400 mb-6 max-w-lg">
                  {isEn ? 'Find peace with our collection of prayers, including the supplication to Our Lady of Garabandal.' : 'Encontra paz com a nossa coleção de orações, incluindo a súplica a Nossa Senhora de Garabandal.'}
                </p>
                <span className="text-sm font-bold text-white group-hover:text-yellow-500 flex items-center gap-2 transition-colors">
                  {isEn ? 'View Prayers' : 'Ver Orações'} <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </Link>

            {/* Card 7: Documentação Privada */}
            <Link href={documentsPath} id="tut-docs" className="group relative bg-slate-900 rounded-2xl border border-white/5 hover:border-emerald-500/30 overflow-hidden transition-all hover:shadow-2xl hover:shadow-emerald-900/20">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
              <div className="h-64 bg-[url('https://images.unsplash.com/photo-1456324504439-367cee3b3c32?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="w-12 h-12 bg-emerald-600/20 rounded-xl flex items-center justify-center backdrop-blur-sm mb-4 text-emerald-400">
                  <FolderLock className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-white mb-2">{isEn ? 'Private Documents' : 'Documentação Privada'}</h3>
                <p className="text-base text-slate-400 mb-6 max-w-lg">
                  {isEn ? 'Exclusive access to minutes, reports, photo galleries, and audio reserved for members.' : 'Acesso exclusivo a atas, relatórios, galerias de fotos e áudios reservados aos membros.'}
                </p>
                <span className="text-sm font-bold text-white group-hover:text-emerald-500 flex items-center gap-2 transition-colors">
                  {isEn ? 'Access Files' : 'Aceder a Ficheiros'} <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </Link>

          </div>
        </section>

        {/* Quick Actions Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href={quotaPath} id="tut-quota" className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 hover:bg-slate-800/50 hover:border-white/10 transition-all flex items-start gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-bold mb-1">{isEn ? 'Fee Status' : 'Estado da Quota'}</h3>
              <p className="text-sm text-slate-400">{isEn ? 'Check your payments and regularize your annual status.' : 'Verifica os pagamentos e regulariza a tua situação anual.'}</p>
            </div>
          </Link>
          <Link href={historyPath} id="tut-history" className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 hover:bg-slate-800/50 hover:border-white/10 transition-all flex items-start gap-4">
            <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-bold mb-1">{isEn ? 'History' : 'Histórico'}</h3>
              <p className="text-sm text-slate-400">{isEn ? 'Review all your previous interactions and donations.' : 'Consulta todas as tuas interações e donativos passados.'}</p>
            </div>
          </Link>

          <Link href={rightsPath} id="tut-card" className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 hover:bg-slate-800/50 hover:border-white/10 transition-all flex items-start gap-4">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
              <ScrollText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-bold mb-1">{isEn ? 'Rights and Duties' : 'Direitos e Deveres'}</h3>
              <p className="text-sm text-slate-400">{isEn ? 'Review the rules, benefits, and obligations of members.' : 'Consulta o regulamento, benefícios e obrigações dos membros.'}</p>
            </div>
          </Link>
        </section>

      </div>
    </VIPLayout>
  );
}
