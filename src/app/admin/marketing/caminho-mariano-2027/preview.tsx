'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '../../../../lib/supabase-browser';

type Preview = { key: string; label: string; day: number; subject: string; html: string; image: string };
type ScheduledCampaign = { id: string; name: string; status: string; scheduled_at: string; metrics: { language?: string; sent?: number; remaining?: number } };

function nextBrazilMorning() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  const day = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1));
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() + 1);
  return `${day.toISOString().slice(0, 10)}T11:00`;
}

export default function MarianCampaignPreview({ previews }: { previews: Record<'pt' | 'en', Preview[]> }) {
  const [selected, setSelected] = useState(0);
  const [language, setLanguage] = useState<'pt' | 'en'>('pt');
  const [mobile, setMobile] = useState(false);
  const [audience, setAudience] = useState<{ eligible: number; optedIn: number; bookingRows: number; status: string; vacancies: number } | null>(null);
  const [audienceError, setAudienceError] = useState('');
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [schedule, setSchedule] = useState<ScheduledCampaign[]>([]);
  const [startAt, setStartAt] = useState(nextBrazilMorning);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState('');
  const current = previews[language][selected];

  async function adminRequest(method: 'GET' | 'POST', body?: object) {
    const { data } = await supabaseBrowser!.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Inicie sessão de administrador para gerir a campanha.');
    const response = await fetch(`/api/admin/marketing/marian-2027?language=${language}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Falha ao consultar a campanha.');
    return result;
  }

  async function loadAudience() {
    setLoadingAudience(true);
    setAudienceError('');
    try {
      const result = await adminRequest('GET');
      setAudience(result.stats);
      setSchedule(result.schedule || []);
    } catch (error) {
      setAudienceError(error instanceof Error ? error.message : 'Falha ao consultar o público.');
    } finally {
      setLoadingAudience(false);
    }
  }

  async function changeSchedule(mode: 'schedule' | 'pause' | 'resume') {
    setScheduleBusy(true);
    setScheduleMessage('');
    try {
      const result = await adminRequest('POST', mode === 'schedule'
        ? { mode, startAt: new Date(`${startAt}:00-03:00`).toISOString() }
        : { mode });
      setSchedule(result.schedule || result.campaigns || []);
      setScheduleMessage(mode === 'schedule' ? 'Campanha programada. Os envios começam no horário indicado.' : mode === 'pause' ? 'Campanha pausada.' : 'Campanha retomada.');
      if (mode === 'schedule') await loadAudience();
    } catch (error) {
      setScheduleMessage(error instanceof Error ? error.message : 'Falha ao alterar a campanha.');
    } finally {
      setScheduleBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f0eeec] px-4 pb-16 pt-8 text-[#203146] md:px-8">
      <div className="mx-auto max-w-[1360px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link href="/admin/marketing" className="text-sm font-semibold text-[#445b78] hover:text-[#132e52]">← Marketing</Link>
          <span className="rounded-full border border-[#d7c2c7] bg-[#f7eef0] px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-[#754c58]">{schedule.length ? 'Campanha programada' : 'Pré-visualização da campanha'}</span>
        </div>

        <div className="mb-8 rounded-[28px] bg-[#0e2748] px-7 py-8 text-white shadow-xl md:px-10 md:py-10">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-[#d5aeb8]">Apostolado de Garabandal · Campanha de email</p>
          <h1 className="max-w-3xl font-serif text-4xl leading-tight md:text-5xl">Caminho Mariano 2027</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#d5deea]">Três mensagens, um convite sereno: descobrir o percurso, conhecer o programa e decidir sobre a inscrição. Estes são os emails reais que o sistema vai renderizar.</p>
          <div className="mt-7 flex flex-wrap gap-2 text-xs font-semibold text-[#e9eef6]">
            <span className="rounded-full border border-white/25 px-3 py-2">11–24 outubro 2027</span>
            <span className="rounded-full border border-white/25 px-3 py-2">3 etapas</span>
            <span className="rounded-full border border-white/25 px-3 py-2">Público com consentimento explícito</span>
            <span className="rounded-full border border-white/25 px-3 py-2">Inscritos excluídos</span>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#536074]">Idioma do email</p>
          <div className="flex rounded-xl border border-[#d7d0d2] bg-white p-1" role="group" aria-label="Idioma do email">
            <button type="button" aria-pressed={language === 'pt'} onClick={() => { setLanguage('pt'); setAudience(null); }} className={`rounded-lg px-5 py-2 text-sm font-bold ${language === 'pt' ? 'bg-[#203146] text-white' : 'text-[#536074]'}`}>Português</button>
            <button type="button" aria-pressed={language === 'en'} onClick={() => { setLanguage('en'); setAudience(null); }} className={`rounded-lg px-5 py-2 text-sm font-bold ${language === 'en' ? 'bg-[#203146] text-white' : 'text-[#536074]'}`}>English</button>
          </div>
        </div>

        <div className="grid gap-7 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <section className="rounded-[22px] bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#74839a]">Sequência</h2>
              <div className="space-y-2" role="tablist" aria-label="Emails da campanha">
                {previews[language].map((preview, index) => (
                  <button key={preview.key} type="button" role="tab" aria-selected={selected === index} onClick={() => setSelected(index)} className={`w-full rounded-xl px-4 py-4 text-left transition ${selected === index ? 'bg-[#0e2748] text-white shadow-md' : 'bg-[#f2f5f8] text-[#203653] hover:bg-[#e7edf4]'}`}>
                    <span className={`block text-[11px] font-bold uppercase tracking-[0.15em] ${selected === index ? 'text-[#e4bdc7]' : 'text-[#754c58]'}`}>Dia {preview.day}</span>
                    <span className="mt-1 block text-sm font-bold">{preview.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[22px] bg-white p-5 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#74839a]">Programação</h2>
              <p className="mt-3 text-sm leading-6 text-[#56677e]">Primeiro envio às 11:00 em São Paulo (10:00 em Nova Iorque). As etapas seguintes começam 7 e 14 dias depois, respeitando o limite diário do sistema.</p>
              {schedule.length ? (
                <div className="mt-4 space-y-2">
                  {schedule.filter((item) => item.metrics?.language === language).map((item) => (
                    <div key={item.id} className="rounded-xl bg-[#f2f5f8] p-3 text-xs text-[#344c67]">
                      <div className="font-bold">{item.name}</div>
                      <div className="mt-1">{new Date(item.scheduled_at).toLocaleString(language === 'pt' ? 'pt-BR' : 'en-US', { timeZone: 'America/Sao_Paulo', dateStyle: 'medium', timeStyle: 'short' })} · {item.status} · {item.metrics?.sent || 0} enviados</div>
                    </div>
                  ))}
                  <button type="button" disabled={scheduleBusy} onClick={() => changeSchedule(schedule.some((item) => item.status === 'paused') ? 'resume' : 'pause')} className="w-full rounded-xl border border-[#bfcbd9] px-4 py-3 text-sm font-bold text-[#17385f] disabled:opacity-60">{schedule.some((item) => item.status === 'paused') ? 'Retomar campanha' : 'Pausar campanha'}</button>
                </div>
              ) : (
                <div className="mt-4">
                  <label htmlFor="marian-start" className="block text-xs font-bold text-[#56677e]">Data e hora em São Paulo</label>
                  <input id="marian-start" type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="mt-2 w-full rounded-xl border border-[#bfcbd9] bg-white px-3 py-3 text-sm text-[#203146]" />
                  <button type="button" disabled={scheduleBusy || !startAt} onClick={() => changeSchedule('schedule')} className="mt-3 w-full rounded-xl bg-[#17385f] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{scheduleBusy ? 'A programar…' : 'Programar os 6 emails'}</button>
                </div>
              )}
              {scheduleMessage ? <p role="status" className="mt-3 text-sm leading-5 text-[#405a75]">{scheduleMessage}</p> : null}
            </section>

            <section className="rounded-[22px] bg-white p-5 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#74839a]">Público elegível</h2>
              <p className="mt-3 text-sm leading-6 text-[#56677e]">Contamos subscritores {language === 'pt' ? 'em português' : 'em inglês'} com consentimento explícito, depois retiramos quem já está inscrito e quem cancelou os emails.</p>
              <button type="button" onClick={loadAudience} disabled={loadingAudience} className="mt-4 w-full rounded-xl bg-[#e9f0f8] px-4 py-3 text-sm font-bold text-[#17385f] hover:bg-[#dce8f5] disabled:opacity-60">{loadingAudience ? 'A calcular…' : 'Calcular público agora'}</button>
              {audience ? <div className="mt-4 rounded-xl bg-[#f5f8fb] p-4 text-sm leading-7"><strong className="block text-2xl text-[#0e2748]">{audience.eligible}</strong><span>contactos elegíveis</span><div className="mt-2 text-xs text-[#66788d]">{audience.optedIn} subscritores · {audience.bookingRows} reservas da peregrinação · estado: {audience.status} · vagas: {audience.vacancies}</div></div> : null}
              {audienceError ? <p role="alert" className="mt-3 text-sm text-red-700">{audienceError}</p> : null}
            </section>
          </aside>

          <section className="min-w-0 rounded-[22px] bg-white p-4 shadow-sm md:p-6" role="tabpanel">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e9edf2] pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#754c58]">Pré-visualização real · {current.label}</p>
                <p className="mt-2 text-sm text-[#61738a]"><strong className="text-[#263c57]">Assunto:</strong> {current.subject}</p>
              </div>
              <div className="flex rounded-xl bg-[#eff3f7] p-1" aria-label="Largura do preview">
                <button type="button" aria-pressed={!mobile} onClick={() => setMobile(false)} className={`rounded-lg px-4 py-2 text-xs font-bold ${!mobile ? 'bg-white text-[#17385f] shadow-sm' : 'text-[#66788d]'}`}>Computador</button>
                <button type="button" aria-pressed={mobile} onClick={() => setMobile(true)} className={`rounded-lg px-4 py-2 text-xs font-bold ${mobile ? 'bg-white text-[#17385f] shadow-sm' : 'text-[#66788d]'}`}>Telemóvel</button>
              </div>
            </div>
            <div className="mt-6 flex justify-center overflow-x-auto rounded-2xl bg-[#dce3ec] p-3 md:p-6">
              <iframe key={`${language}-${current.key}-${mobile ? 'mobile' : 'desktop'}`} title={`Preview do email ${current.label}`} srcDoc={current.html} sandbox="allow-popups allow-popups-to-escape-sandbox" className="rounded-xl border border-[#cad4df] bg-white shadow-lg" style={{ width: mobile ? 390 : 680, maxWidth: '100%', height: mobile ? 1660 : 1460 }} />
            </div>
            <p className="mt-4 text-center text-xs text-[#687b91]">Nome de exemplo: Maria · Imagens do site do Apostolado · Nenhum email é enviado nesta página</p>
          </section>
        </div>
      </div>
    </main>
  );
}
