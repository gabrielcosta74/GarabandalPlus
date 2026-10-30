'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, GraduationCap, Loader2, Mail, Moon, Users } from 'lucide-react';
import VIPLayout from './VIPLayout';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '../../contexts/LocaleContext';
import {
  cancelHouseBooking, createHouseBooking, getHouseAvailability, getHouseOverview,
  isActiveHouseBooking, verifyHouseCode, HouseError, type CodeReason, type HouseBooking,
  type HouseErrorCode, type HouseOverview, type HouseRange,
} from '../../lib/house-booking';
import { addDays, dayKey, formatHouseDay, nightTaken, nightsBetween, stayOverlaps } from '../../lib/house-dates';
import '../../app/peregrinacoes/[slug]/inscrever/registration.css';
import './house-booking.css';

const words = {
  pt: {
    title: 'Casa do Apostolado', booking: 'Pedir reserva', requests: 'Os meus pedidos',
    subtitle: 'Um lugar para viver Garabandal em comunidade.',
    training: 'Formação', people: 'Quem vai', dates: 'Datas', rules: 'Regras da casa',
    donation: 'Ajudar a casa', summary: 'Resumo', step: 'Passo',
    continue: 'Continuar', send: 'Enviar pedido', back: 'Voltar',
    maxPeople: 'Até {n} pessoas', maxNights: 'Até {n} noites', withTraining: 'Com formação',
    closed: 'As reservas da casa estão fechadas de momento.',
    seniority: 'A casa é para membros com {n} anos seguidos de quota. Se já cumpre, fale com o Apostolado.',
    active: 'Já tem um pedido ativo. Depois desta estadia pode pedir outro.',
    loadError: 'Não foi possível abrir a casa.', retry: 'Tentar de novo', loading: 'A carregar',
    codeBody: 'Todos os membros que usam a casa têm de ter a formação online validada para a sua missão em Garabandal.',
    code: 'Código de formação', noCode: 'Não tenho código',
    noCodeBody: 'O código é dado pelo Apostolado depois da formação online.', contact: 'Falar com o Apostolado',
    codeInvalid: 'Este código não existe. Confirme as letras e os números.',
    codeNotYours: 'Este código é de outro membro. Cada membro usa o seu.',
    codeRevoked: 'Este código foi anulado. Fale com o Apostolado.',
    codeExpired: 'Este código expirou. Fale com o Apostolado para renovar a formação.',
    codeSeniority: 'A casa só pode ser usada após {n} anos de quota.',
    codeRateLimited: 'Muitas tentativas. Tente de novo daqui a uma hora.',
    name: 'Nome completo', phone: 'Telefone', email: 'Email', count: 'Pessoas',
    companions: 'Acompanhantes', companion: 'Nome da pessoa {n}', notes: 'Observações (opcional)',
    peopleError: 'Preencha o nome, telefone, email válido e o nome de cada acompanhante.',
    arrival: 'Chegada', departure: 'Saída', choose: 'Escolher', taken: 'Ocupado',
    datesError: 'Escolha o dia de chegada e o de saída.', datesTaken: 'Há noites ocupadas nestas datas. Escolha outras.',
    rulesAccept: 'Li e aceito as regras da casa', damagesAccept: 'Em caso de danos, assumo os custos',
    rulesError: 'Para continuar, aceite as duas condições.', readDocument: 'Ver o documento completo',
    donationBody: 'A casa vive de donativos para a eletricidade e a manutenção.',
    donateYes: 'Quero fazer um donativo', donateNo: 'Agora não',
    codeValid: 'Código validado', accepted: 'Aceites', yes: 'Sim', no: 'Não', change: 'Alterar',
    sentTitle: 'Pedido enviado', sentBody: 'A equipa do Apostolado confirma o pedido. Pode acompanhar o estado aqui e na app.',
    sentDonate: 'Fazer o donativo', done: 'Concluir',
    pending: 'À espera de confirmação', confirmed: 'Confirmada', declined: 'Não aceite', cancelled: 'Cancelada',
    teamMessage: 'Mensagem da equipa', cancel: 'Cancelar pedido',
    cancelConfirm: 'Cancelar este pedido? As datas ficam livres para outros membros.',
    cancelError: 'Não foi possível cancelar. Tente de novo.',
    genericError: 'Não foi possível enviar. Tente de novo.',
    alreadyBooked: 'Já tem um pedido ativo para a casa.', rulesChanged: 'As regras da casa mudaram. Leia-as de novo.',
    codeChanged: 'O código de formação deixou de ser válido.',
    prevMonth: 'Mês anterior', nextMonth: 'Mês seguinte',
  },
  en: {
    title: 'Apostolate House', booking: 'Request a stay', requests: 'My requests',
    subtitle: 'A place to experience Garabandal in community.',
    training: 'Training', people: 'Who is going', dates: 'Dates', rules: 'House rules',
    donation: 'Help the house', summary: 'Summary', step: 'Step',
    continue: 'Continue', send: 'Send request', back: 'Back',
    maxPeople: 'Up to {n} people', maxNights: 'Up to {n} nights', withTraining: 'With training',
    closed: 'House bookings are closed at the moment.',
    seniority: 'The house is for members with {n} consecutive years of membership fees. If you qualify, contact the Apostolate.',
    active: 'You already have an active request. You can ask for another stay after this one.',
    loadError: 'Could not open the house.', retry: 'Try again', loading: 'Loading',
    codeBody: 'Every member who uses the house must have completed the online training validated for their mission in Garabandal.',
    code: 'Training code', noCode: "I don't have a code",
    noCodeBody: 'The Apostolate gives you the code after the online training.', contact: 'Contact the Apostolate',
    codeInvalid: 'This code does not exist. Check the letters and numbers.',
    codeNotYours: 'This code belongs to another member. Each member uses their own.',
    codeRevoked: 'This code was cancelled. Contact the Apostolate.',
    codeExpired: 'This code has expired. Contact the Apostolate to renew your training.',
    codeSeniority: 'The house can only be used after {n} years of membership.',
    codeRateLimited: 'Too many attempts. Try again in an hour.',
    name: 'Full name', phone: 'Phone', email: 'Email', count: 'People',
    companions: 'Others going', companion: 'Name of person {n}', notes: 'Notes (optional)',
    peopleError: 'Enter your name, phone, valid email and the name of each companion.',
    arrival: 'Arrival', departure: 'Departure', choose: 'Choose', taken: 'Taken',
    datesError: 'Choose arrival and departure days.', datesTaken: 'Some nights in these dates are taken. Choose others.',
    rulesAccept: 'I have read and accept the house rules', damagesAccept: 'If anything is damaged, I will pay for it',
    rulesError: 'To continue, accept both conditions.', readDocument: 'See the full document',
    donationBody: 'The house relies on donations for electricity and upkeep.',
    donateYes: 'I want to make a donation', donateNo: 'Not now',
    codeValid: 'Code validated', accepted: 'Accepted', yes: 'Yes', no: 'No', change: 'Change',
    sentTitle: 'Request sent', sentBody: 'The Apostolate team will confirm your request. You can track its status here and in the app.',
    sentDonate: 'Make the donation', done: 'Done',
    pending: 'Waiting for confirmation', confirmed: 'Confirmed', declined: 'Not accepted', cancelled: 'Cancelled',
    teamMessage: 'Message from the team', cancel: 'Cancel request',
    cancelConfirm: 'Cancel this request? The dates become free for other members.',
    cancelError: 'Could not cancel. Try again.',
    genericError: 'Could not send. Try again.',
    alreadyBooked: 'You already have an active request for the house.', rulesChanged: 'The house rules have changed. Please read them again.',
    codeChanged: 'Your training code is no longer valid.',
    prevMonth: 'Previous month', nextMonth: 'Next month',
  },
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const statusKey = { pending: 'pending', confirmed: 'confirmed', declined: 'declined', cancelled: 'cancelled' } as const;
type Draft = {
  code: string; name: string | null; phone: string | null; email: string | null; guests: number; companions: string[];
  notes: string; checkIn: string | null; checkOut: string | null; acceptRules: boolean;
  acceptDamages: boolean; rulesVersion: number | null; donate: boolean;
};
const blankDraft: Draft = {
  code: '', name: null, phone: null, email: null, guests: 1, companions: [], notes: '',
  checkIn: null, checkOut: null, acceptRules: false, acceptDamages: false,
  rulesVersion: null, donate: false,
};

function useHouseContext() {
  const { locale } = useLocale();
  const { user, memberData, loading: authLoading } = useAuth();
  const isEn = locale === 'en';
  const copy = words[isEn ? 'en' : 'pt'];
  const root = isEn ? '/en/member/house' : '/member/casa';
  const [overview, setOverview] = useState<HouseOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try { setOverview(await getHouseOverview()); }
    catch { setError(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (!authLoading && user?.id) void refresh(); }, [authLoading, user?.id, refresh]);
  return { locale: isEn ? 'en-GB' : 'pt-PT', user, memberData, copy, root, overview, loading, error, refresh };
}

function replaceN(text: string, n: number) { return text.replace('{n}', String(n)); }
function stayLabel(booking: HouseBooking, locale: string) {
  return `${formatHouseDay(booking.checkIn, locale)} – ${formatHouseDay(booking.checkOut, locale)}`;
}

export function HouseHome() {
  const { copy: t, locale, root, overview, loading, error, refresh } = useHouseContext();
  const [selected, setSelected] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(false);
  const today = dayKey();
  const active = overview?.bookings.find(booking => isActiveHouseBooking(booking, today));
  const cancel = async (id: string) => {
    if (!window.confirm(t.cancelConfirm)) return;
    setCancelling(true); setCancelError(false);
    try { await cancelHouseBooking(id); await refresh(); }
    catch { setCancelError(true); }
    finally { setCancelling(false); }
  };
  return <VIPLayout>
    <div className="house-home">
      <div className="house-hero">
        <div className="house-hero-content">
          <Link href={root.startsWith('/en') ? '/en/member' : '/member'} className="house-hero-back"><ChevronLeft size={18} />{t.back}</Link>
          <p>GARABANDAL</p><h1>{t.title}</h1><span>{t.subtitle}</span>
        </div>
      </div>
      <div className="house-home-body">
        {loading ? <p className="house-muted"><Loader2 className="house-spin" size={18} /> {t.loading}…</p>
          : error || !overview ? <div className="house-notice">{t.loadError} <button onClick={() => void refresh()}>{t.retry}</button></div>
          : <>
            <div className="house-facts">
              <div><Users size={21} />{replaceN(t.maxPeople, overview.maxGuests)}</div>
              <div><Moon size={21} />{replaceN(t.maxNights, overview.maxNights)}</div>
              <div><GraduationCap size={21} />{t.withTraining}</div>
            </div>
            <div className="house-action">
              {!overview.enabled ? <p>{t.closed}</p>
                : !overview.seniorityOk ? <><p>{replaceN(t.seniority, overview.minMemberYears)}</p><a href="mailto:geral@apostoladodegarabandal.com">{t.contact}</a></>
                : active ? <p>{t.active}</p>
                : <Link href={`${root}/${root.startsWith('/en') ? 'book' : 'reservar'}`} className="reg-primary">{t.booking}<ArrowRight size={19} /></Link>}
            </div>
            {!!overview.bookings.length && <section className="house-requests">
              <h2>{t.requests}</h2>
              {overview.bookings.map(booking => <div className="house-request" key={booking.id}>
                <button className="house-request-head" onClick={() => setSelected(selected === booking.id ? null : booking.id)} aria-expanded={selected === booking.id}>
                  <span><strong>{stayLabel(booking, locale)}</strong><small>{nightsBetween(booking.checkIn, booking.checkOut)} {locale === 'en-GB' ? 'nights' : 'noites'} · {booking.guests} {t.count.toLowerCase()}</small></span>
                  <span className={`house-status is-${booking.status}`}>{t[statusKey[booking.status]]}</span>
                  <ChevronRight className={selected === booking.id ? 'house-rotated' : ''} size={20} />
                </button>
                {selected === booking.id && <div className="house-request-details">
                  {booking.teamMessage && <div className="house-message"><strong>{t.teamMessage}</strong><p>{booking.teamMessage}</p></div>}
                  <p><strong>{t.name}:</strong> {booking.contactName}</p>
                  {!!booking.companions.length && <p><strong>{t.companions}:</strong> {booking.companions.join(', ')}</p>}
                  <p><strong>{t.phone}:</strong> {booking.contactPhone} · <strong>{t.email}:</strong> {booking.contactEmail}</p>
                  {booking.notes && <p><strong>{t.notes}:</strong> {booking.notes}</p>}
                  {(booking.status === 'pending' || booking.status === 'confirmed') && booking.checkIn > today &&
                    <button className="house-cancel" disabled={cancelling} onClick={() => void cancel(booking.id)}>{t.cancel}</button>}
                  {cancelError && <p className="house-error" role="alert">{t.cancelError}</p>}
                </div>}
              </div>)}
            </section>}
          </>}
      </div>
    </div>
  </VIPLayout>;
}

function HouseCalendar({ value, onChange, ranges, maxNights, horizonDays, loading, locale, t }: {
  value: Draft; onChange: (checkIn: string | null, checkOut: string | null) => void;
  ranges: HouseRange[]; maxNights: number; horizonDays: number; loading: boolean;
  locale: string; t: typeof words.pt;
}) {
  const today = dayKey();
  const first = addDays(today, 1);
  const last = addDays(today, horizonDays);
  const [cursor, setCursor] = useState(() => {
    const date = new Date(); return { year: date.getFullYear(), month: date.getMonth() };
  });
  const firstWeekday = (new Date(Date.UTC(cursor.year, cursor.month, 1)).getUTCDay() + 6) % 7;
  const monthDays = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();
  const index = cursor.year * 12 + cursor.month;
  const firstIndex = new Date().getFullYear() * 12 + new Date().getMonth();
  const lastParts = last.split('-').map(Number);
  const lastIndex = lastParts[0] * 12 + lastParts[1] - 1;
  const move = (delta: number) => setCursor(current => {
    const next = current.year * 12 + current.month + delta;
    return { year: Math.floor(next / 12), month: next % 12 };
  });
  const pick = (day: string) => {
    if (value.checkIn && !value.checkOut && day > value.checkIn &&
      nightsBetween(value.checkIn, day) <= maxNights && !stayOverlaps(value.checkIn, day, ranges)) {
      onChange(value.checkIn, day); return;
    }
    if (day >= first && day <= last && !nightTaken(day, ranges)) onChange(day, null);
  };
  return <div className="house-calendar">
    <div className="house-calendar-head">
      <button type="button" aria-label={t.prevMonth} disabled={index <= firstIndex} onClick={() => move(-1)}><ChevronLeft size={20} /></button>
      <strong>{new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(cursor.year, cursor.month, 1)))}</strong>
      <button type="button" aria-label={t.nextMonth} disabled={index >= lastIndex} onClick={() => move(1)}><ChevronRight size={20} /></button>
    </div>
    <div className="house-calendar-grid">
      {Array.from({ length: 7 }, (_, i) => <span className="house-weekday" key={i}>{new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, i + 1)))}</span>)}
      {Array.from({ length: firstWeekday }, (_, i) => <span key={`blank-${i}`} />)}
      {Array.from({ length: monthDays }, (_, i) => {
        const day = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
        const canArrive = day >= first && day <= last && !nightTaken(day, ranges);
        const canLeave = !!value.checkIn && !value.checkOut && day > value.checkIn && nightsBetween(value.checkIn, day) <= maxNights && !stayOverlaps(value.checkIn, day, ranges);
        const selected = day === value.checkIn || day === value.checkOut;
        const inside = !!value.checkIn && !!value.checkOut && day > value.checkIn && day < value.checkOut;
        return <button key={day} type="button" disabled={loading || (!canArrive && !canLeave)} onClick={() => pick(day)}
          aria-label={`${formatHouseDay(day, locale, true)}${nightTaken(day, ranges) ? `, ${t.taken}` : ''}`}
          aria-pressed={selected} className={`${selected ? 'is-selected' : ''} ${inside ? 'is-inside' : ''} ${nightTaken(day, ranges) ? 'is-taken' : ''}`}>{i + 1}</button>;
      })}
    </div>
    {loading && <p className="house-muted"><Loader2 className="house-spin" size={16} />…</p>}
    <small className="house-calendar-legend"><s>12</s> {t.taken}</small>
  </div>;
}

function Field({ label, value, onChange, type = 'text', required = false, maxLength, multiline = false }: {
  label: string; value: string; onChange: (value: string) => void; type?: string;
  required?: boolean; maxLength?: number; multiline?: boolean;
}) {
  return <label className="reg-field"><span className="reg-field-label">{label}{required && ' *'}</span>
    {multiline ? <textarea value={value} onChange={event => onChange(event.target.value)} maxLength={maxLength} />
      : <input type={type} value={value} required={required} maxLength={maxLength} onChange={event => onChange(event.target.value)} />}
  </label>;
}

export function HouseBookingForm() {
  const { copy: t, locale, root, overview, loading, error: loadError, refresh, user, memberData } = useHouseContext();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [restored, setRestored] = useState(false);
  const [codeOk, setCodeOk] = useState(false);
  const [ranges, setRanges] = useState<HouseRange[]>([]);
  const [availabilityReady, setAvailabilityReady] = useState(false);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const key = useRef<string | null>(null);
  const today = dayKey();
  const storageKey = user?.id ? `house-booking-draft:v1:${user.id}` : null;
  const update = (patch: Partial<Draft>) => { setDraft(current => ({ ...current, ...patch })); setError(null); };
  const loadAvailability = useCallback(async (settings: HouseOverview) => {
    setAvailabilityError(false);
    setAvailabilityReady(false);
    try {
      // The RPC allows at most 400 days per call; cover the complete booking horizon.
      const until = addDays(dayKey(), settings.horizonDays + settings.maxNights + 1);
      const chunks: Promise<HouseRange[]>[] = [];
      for (let from = dayKey(); from < until; from = addDays(from, 399)) {
        chunks.push(getHouseAvailability(from, addDays(from, Math.min(399, nightsBetween(from, until)))));
      }
      setRanges((await Promise.all(chunks)).flat());
      setAvailabilityReady(true);
    } catch { setAvailabilityError(true); }
  }, []);
  useEffect(() => { if (overview) void loadAvailability(overview); }, [overview, loadAvailability]);
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null') as Partial<Draft> | null;
      if (saved) setDraft({ ...blankDraft, ...saved,
        ...(saved.checkIn && saved.checkIn > dayKey() ? {} : { checkIn: null, checkOut: null }) });
    } catch { /* Damaged local draft: start again. */ }
    setRestored(true);
  }, [storageKey]);
  useEffect(() => {
    if (!storageKey || !restored || sent) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(draft)); }
      catch { /* The form still works when local storage is unavailable. */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, storageKey, restored, sent]);
  const go = (next: number) => { setStep(next); setError(null); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const codeReason = (reason: CodeReason) => ({ invalid: t.codeInvalid, not_yours: t.codeNotYours,
    revoked: t.codeRevoked, expired: t.codeExpired, seniority: replaceN(t.codeSeniority, overview?.minMemberYears ?? 0),
    rate_limited: t.codeRateLimited })[reason];
  const submitError = (code: HouseErrorCode) => ({ dates_taken: t.datesTaken, already_booked: t.alreadyBooked,
    rules_changed: t.rulesChanged, invalid_code: t.codeChanged, seniority: replaceN(t.codeSeniority, overview?.minMemberYears ?? 0),
    closed: t.closed } as Partial<Record<HouseErrorCode, string>>)[code] ?? t.genericError;
  const next = async () => {
    if (!overview || busy) return;
    if (step === 0) {
      if (codeOk) { go(1); return; }
      if (!draft.code.trim()) { setError(t.codeInvalid); return; }
      setBusy(true);
      try { const result = await verifyHouseCode(draft.code); if (!result.ok) { setError(codeReason(result.reason)); return; } setCodeOk(true); go(1); }
      catch { setError(t.genericError); } finally { setBusy(false); }
      return;
    }
    if (step === 1) {
      const name = (draft.name ?? memberData?.nome ?? '').trim();
      const phone = (draft.phone ?? memberData?.telefone ?? '').trim();
      const email = (draft.email ?? memberData?.email ?? user?.email ?? '').trim();
      if (!name || !phone || !emailPattern.test(email) ||
        Array.from({ length: draft.guests - 1 }, (_, i) => draft.companions[i] || '').some(name => !name.trim())) {
        setError(t.peopleError); return;
      }
      go(2); return;
    }
    if (step === 2) {
      if (!availabilityReady) { setError(t.loadError); return; }
      if (!draft.checkIn || !draft.checkOut) { setError(t.datesError); return; }
      if (stayOverlaps(draft.checkIn, draft.checkOut, ranges)) { setError(t.datesTaken); return; }
      go(3); return;
    }
    if (step === 3) {
      if (!draft.acceptRules || !draft.acceptDamages || draft.rulesVersion !== overview.rulesVersion) { setError(t.rulesError); return; }
      go(4); return;
    }
    if (step === 4) { go(5); return; }
    if (!draft.checkIn || !draft.checkOut) return;
    if (!key.current) key.current = crypto.randomUUID();
    setBusy(true);
    try {
      await createHouseBooking({
        code: draft.code, checkIn: draft.checkIn, checkOut: draft.checkOut, guests: draft.guests,
        contactName: (draft.name ?? memberData?.nome ?? '').trim(),
        contactPhone: (draft.phone ?? memberData?.telefone ?? '').trim(),
        contactEmail: (draft.email ?? memberData?.email ?? user?.email ?? '').trim(),
        companions: draft.companions.slice(0, draft.guests - 1).map(name => name.trim()), notes: draft.notes.trim(),
        rulesVersion: overview.rulesVersion, acceptRules: draft.acceptRules,
        acceptDamages: draft.acceptDamages, wantsToDonate: draft.donate, idempotencyKey: key.current,
      });
      setSent(true);
      if (storageKey) {
        try { localStorage.removeItem(storageKey); }
        catch { /* Storage may be unavailable; the sent state is authoritative. */ }
      }
    } catch (reason) {
      const code = reason instanceof HouseError ? reason.code : 'generic';
      if (code === 'dates_taken') { update({ checkIn: null, checkOut: null }); void loadAvailability(overview); go(2); }
      if (code === 'invalid_code') { setCodeOk(false); go(0); }
      if (code === 'rules_changed') { update({ acceptRules: false, acceptDamages: false, rulesVersion: null }); await refresh(); go(3); }
      setError(submitError(code));
    } finally { setBusy(false); }
  };
  const labels = [t.training, t.people, t.dates, t.rules, t.donation, t.summary];
  const active = overview?.bookings.find(booking => isActiveHouseBooking(booking, today));
  const dateValue = draft.checkIn && draft.checkOut ? `${formatHouseDay(draft.checkIn, locale)} – ${formatHouseDay(draft.checkOut, locale)}` : '—';
  return <VIPLayout className="registration-page house-registration" showQuotaWarning={false}>
    <header className="reg-header"><div className="reg-header-inner">
      <button type="button" className="reg-back-link" aria-label={t.back} onClick={() => step > 0 && !sent ? go(step - 1) : router.push(root)}><ChevronLeft size={20} /></button>
      <div className="reg-header-trip"><p className="reg-trip-title">{t.title}</p></div>
      {!sent && <span className="reg-step-count"><strong>{labels[step]}</strong> {step + 1}/6</span>}
    </div><div className="reg-progress-track" role="progressbar" aria-label={t.step} aria-valuenow={sent ? 100 : Math.round((step + 1) / 6 * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="reg-progress-fill" style={{ width: `${sent ? 100 : (step + 1) / 6 * 100}%` }} /></div></header>
    <main className="reg-main"><section className="reg-card" aria-label={sent ? t.sentTitle : labels[step]}>
      {sent ? <div className="house-sent"><div className="house-sent-icon"><Check size={32} /></div><h1>{t.sentTitle}</h1><p>{t.sentBody}</p>
        <strong>{dateValue} · {draft.guests} {t.count.toLowerCase()}</strong>
        {draft.donate && <Link className="reg-secondary" href="/donations?donate=1&campaign=casa">{t.sentDonate}</Link>}
        <Link className="reg-primary is-block" href={root}>{t.done}</Link></div>
        : loading || !restored ? <p className="house-muted"><Loader2 className="house-spin" size={20} />…</p>
        : loadError || !overview ? <div className="reg-alert">{t.loadError}<button className="reg-secondary" onClick={() => void refresh()}>{t.retry}</button></div>
        : !overview.enabled || !overview.seniorityOk || active ? <div className="reg-alert">
            <p>{!overview.enabled ? t.closed : !overview.seniorityOk ? replaceN(t.seniority, overview.minMemberYears) : t.active}</p>
            <Link href={root} className="reg-secondary">{t.back}</Link></div>
        : <div className="reg-step" key={step}>
          <div className="reg-step-head"><p className="reg-eyebrow">{t.step} {step + 1} / 6</p><h2>{labels[step]}</h2>
            {step === 0 && <p>{t.codeBody}</p>}{step === 4 && <p>{t.donationBody}</p>}</div>
          {step === 0 && <div className="reg-stack">
            <Field label={t.code} value={draft.code} maxLength={12} required onChange={code => { update({ code: code.toUpperCase() }); setCodeOk(false); }} />
            {codeOk && <p className="house-ok"><Check size={16} /> {t.codeValid}</p>}
            <details className="house-help"><summary>{t.noCode}</summary><p>{t.noCodeBody}</p><a href="mailto:geral@apostoladodegarabandal.com"><Mail size={16} />{t.contact}</a></details>
          </div>}
          {step === 1 && <div className="reg-stack">
            <Field label={t.name} value={draft.name ?? memberData?.nome ?? ''} required onChange={name => update({ name })} />
            <Field label={t.phone} value={draft.phone ?? memberData?.telefone ?? ''} type="tel" required onChange={phone => update({ phone })} />
            <Field label={t.email} value={draft.email ?? memberData?.email ?? user?.email ?? ''} type="email" required onChange={email => update({ email })} />
            <div className="house-counter"><span>{t.count}</span><div><button type="button" aria-label="−" disabled={draft.guests <= 1} onClick={() => update({ guests: draft.guests - 1 })}>−</button><strong>{draft.guests}</strong><button type="button" aria-label="+" disabled={draft.guests >= overview.maxGuests} onClick={() => update({ guests: draft.guests + 1 })}>+</button></div></div>
            {draft.guests > 1 && <><h3 className="house-subtitle">{t.companions}</h3>{Array.from({ length: draft.guests - 1 }, (_, i) => <Field key={i} label={replaceN(t.companion, i + 2)} value={draft.companions[i] || ''} required onChange={name => { const companions = [...draft.companions]; companions[i] = name; update({ companions }); }} />)}</>}
            <Field label={t.notes} value={draft.notes} multiline onChange={notes => update({ notes })} />
          </div>}
          {step === 2 && <div className="reg-stack">
            <div className="house-date-summary"><div><small>{t.arrival}</small><strong>{draft.checkIn ? formatHouseDay(draft.checkIn, locale, true) : t.choose}</strong></div><ArrowRight size={18} /><div><small>{t.departure}</small><strong>{draft.checkOut ? formatHouseDay(draft.checkOut, locale, true) : t.choose}</strong></div></div>
            {availabilityError && <div className="reg-alert"><p>{t.loadError}</p><button type="button" className="reg-secondary" onClick={() => void loadAvailability(overview)}>{t.retry}</button></div>}
            <HouseCalendar value={draft} onChange={(checkIn, checkOut) => update({ checkIn, checkOut })} ranges={ranges} maxNights={overview.maxNights} horizonDays={overview.horizonDays} loading={!availabilityReady} locale={locale} t={t} />
          </div>}
          {step === 3 && <div className="reg-stack">
            <ol className="house-rules">{(locale === 'en-GB' && overview.rulesEn.length ? overview.rulesEn : overview.rulesPt).map((rule, i) => <li key={i}>{rule}</li>)}</ol>
            {overview.rulesContentId && <Link className="reg-link" href={locale === 'en-GB' ? '/en/member/documents' : '/member/documentos'}>{overview.rulesTitle || t.readDocument}</Link>}
            <label className="house-check"><input type="checkbox" checked={draft.acceptRules && draft.rulesVersion === overview.rulesVersion} onChange={event => update({ acceptRules: event.target.checked, rulesVersion: overview.rulesVersion })} />{t.rulesAccept}</label>
            <label className="house-check"><input type="checkbox" checked={draft.acceptDamages && draft.rulesVersion === overview.rulesVersion} onChange={event => update({ acceptDamages: event.target.checked, rulesVersion: overview.rulesVersion })} />{t.damagesAccept}</label>
          </div>}
          {step === 4 && <div className="reg-stack"><label className="house-option"><input type="radio" name="donate" checked={draft.donate} onChange={() => update({ donate: true })} />{t.donateYes}</label><label className="house-option"><input type="radio" name="donate" checked={!draft.donate} onChange={() => update({ donate: false })} />{t.donateNo}</label></div>}
          {step === 5 && <div className="house-summary">
            <div><span><CalendarDays size={19} />{t.dates}</span><strong>{dateValue}</strong><button onClick={() => go(2)}>{t.change}</button></div>
            <div><span><Users size={19} />{t.people}</span><strong>{draft.guests} {t.count.toLowerCase()}<br />{(draft.name ?? memberData?.nome ?? '').trim()}{draft.companions.slice(0, draft.guests - 1).map((name, i) => <span key={i}><br />{name.trim()}</span>)}</strong><button onClick={() => go(1)}>{t.change}</button></div>
            <div><span><GraduationCap size={19} />{t.training}</span><strong>{t.codeValid}</strong><button onClick={() => go(0)}>{t.change}</button></div>
            <div><span>{t.rules}</span><strong>{t.accepted}</strong><button onClick={() => go(3)}>{t.change}</button></div>
            <div><span>{t.donation}</span><strong>{draft.donate ? t.yes : t.no}</strong><button onClick={() => go(4)}>{t.change}</button></div>
          </div>}
          {error && <p className="house-error" role="alert">{error}</p>}
          <div className="reg-actions"><button type="button" className="reg-ghost" onClick={() => step > 0 ? go(step - 1) : router.push(root)}>{t.back}</button>
            <button type="button" className="reg-primary" disabled={busy || (step === 2 && !availabilityReady)} onClick={() => void next()}>{busy && <Loader2 className="house-spin" size={17} />}{step === 5 ? t.send : t.continue}<ArrowRight size={18} /></button></div>
        </div>}
    </section></main>
  </VIPLayout>;
}
