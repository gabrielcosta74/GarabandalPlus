'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ChevronLeft, ClipboardCopy, GraduationCap, Loader2, Video } from 'lucide-react';
import VIPLayout from './VIPLayout';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '../../contexts/LocaleContext';
import { applyForHouseTraining, getHouseTrainingStatus, type HouseTrainingStatus } from '../../lib/house-training';
import '../../app/peregrinacoes/[slug]/inscrever/registration.css';
import './house-booking.css';

export default function HouseTrainingFlow() {
  const { locale } = useLocale();
  const { user, memberData, loading: authLoading } = useAuth();
  const en = locale === 'en';
  const root = en ? '/en/member/house' : '/member/casa';
  const booking = `${root}/${en ? 'book' : 'reservar'}`;
  const [status, setStatus] = useState<HouseTrainingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [availability, setAvailability] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setStatus(await getHouseTrainingStatus()); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a formação.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (!authLoading && user?.id) void load(); }, [authLoading, user?.id, load]);
  useEffect(() => {
    if (memberData) {
      setName(current => current || memberData.nome || '');
      setEmail(current => current || memberData.email || user?.email || '');
      setPhone(current => current || memberData.telefone || '');
    }
  }, [memberData, user?.email]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError('');
    try { await applyForHouseTraining({ name, email, phone, availability }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível enviar o pedido.'); }
    finally { setBusy(false); }
  };
  const application = status?.application;
  const validCode = application?.code && (!application.codeValidUntil || application.codeValidUntil >= new Date().toISOString().slice(0, 10));
  const canApply = status?.eligible && !status.activeCode && (!application || application.status === 'declined' || (application.status === 'code_issued' && !validCode));
  const statusCopy = application?.status === 'pending' ? (en ? 'Request received' : 'Pedido recebido')
    : application?.status === 'assigned' ? (en ? 'Class assigned' : 'Turma atribuída')
      : application?.status === 'completed' ? (en ? 'Training completed' : 'Formação concluída')
        : application?.status === 'code_issued' ? (validCode ? (en ? 'Code issued' : 'Código emitido') : (en ? 'Code no longer valid' : 'Código já não válido'))
          : en ? 'Request not accepted' : 'Pedido não aceite';

  return <VIPLayout className="registration-page house-registration house-training-page" showQuotaWarning={false}>
    <header className="reg-header"><div className="reg-header-inner">
      <Link className="reg-back-link" href={root} aria-label={en ? 'Back to the House' : 'Voltar à Casa'}><ChevronLeft size={20} /></Link>
      <div className="reg-header-trip"><p className="reg-trip-title">{en ? 'Apostolate House' : 'Casa do Apostolado'}</p></div>
      <span className="reg-step-count"><strong>{en ? 'Online training' : 'Formação online'}</strong></span>
    </div><div className="reg-progress-track"><div className="reg-progress-fill" style={{ width: application ? '100%' : '35%' }} /></div></header>
    <main className="reg-main"><section className="reg-card">
      <div className="reg-step-head"><p className="reg-eyebrow"><GraduationCap size={17} /> {en ? 'Before booking' : 'Antes de reservar'}</p>
        <h1 className="house-training-title">{en ? 'Online training for the House' : 'Formação online para a Casa'}</h1>
        <p>{en ? 'The member responsible for the stay completes the training. Afterward, the Apostolate issues a personal code for the booking.' : 'O membro responsável pela estadia faz a formação. No fim, o Apostolado entrega-lhe um código pessoal para pedir a reserva.'}</p>
      </div>
      {loading || authLoading ? <p className="house-muted"><Loader2 className="house-spin" size={20} /> {en ? 'Loading…' : 'A carregar…'}</p>
        : !status ? <div className="reg-alert"><p>{error || (en ? 'Could not load training.' : 'Não foi possível carregar a formação.')}</p><button type="button" className="reg-secondary" onClick={() => void load()}>{en ? 'Try again' : 'Tentar de novo'}</button></div>
        : !status.eligible ? <div className="reg-alert"><p>{en ? 'Training requests are available when your membership meets the House requirements.' : 'Pode pedir a formação quando a sua quota e antiguidade cumprirem os requisitos da Casa.'}</p><Link className="reg-secondary" href={root}>{en ? 'Back to the House' : 'Voltar à Casa'}</Link></div>
        : <div className="reg-step">
          {application && application.status !== 'declined' && <div className="house-training-status" role="status">
            <strong><Check size={19} />{statusCopy}</strong>
            {application.status === 'pending' && <p>{en ? 'The team will assign you to an online class. You can follow the status here.' : 'A equipa vai atribuir-lhe uma turma online. Pode acompanhar o estado aqui.'}</p>}
            {application.cohort && <div className="house-training-class"><Video size={19} /><div><strong>{application.cohort.title}</strong><span>{new Intl.DateTimeFormat(en ? 'en-GB' : 'pt-PT', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(application.cohort.starts_at))}</span>
              {application.cohort.meeting_url && application.status === 'assigned' && <a href={application.cohort.meeting_url} target="_blank" rel="noopener noreferrer">{en ? 'Join online class' : 'Entrar na aula online'} <ArrowRight size={16} /></a>}</div></div>}
            {application.status === 'assigned' && application.cohort && !application.cohort.meeting_url && <p>{en ? 'The class link will appear here when the team adds it.' : 'A ligação da aula aparecerá aqui quando a equipa a adicionar.'}</p>}
            {application.status === 'completed' && <p>{en ? 'The team will now issue your personal booking code.' : 'A equipa vai agora emitir o seu código pessoal para a reserva.'}</p>}
            {validCode && <div className="house-training-code"><span>{en ? 'Your training code' : 'O seu código de formação'}</span><strong>{application.code}</strong><button type="button" onClick={() => { void navigator.clipboard.writeText(application.code!); setCopied(true); }}><ClipboardCopy size={16} />{copied ? (en ? 'Copied' : 'Copiado') : (en ? 'Copy' : 'Copiar')}</button></div>}
            {validCode && <Link href={booking} className="reg-primary is-block">{en ? 'Request a stay' : 'Pedir reserva'} <ArrowRight size={18} /></Link>}
            {application.status === 'code_issued' && !validCode && <p>{en ? 'Your code is no longer valid. You can request renewed training below.' : 'O seu código já não está válido. Pode pedir nova formação abaixo.'}</p>}
          </div>}
          {!validCode && status.activeCode && <div className="house-training-status" role="status"><strong><Check size={19} />{en ? 'Training code already available' : 'Já tem um código de formação'}</strong>
            {status.activeCode.code ? <div className="house-training-code"><span>{en ? 'Your code' : 'O seu código'}</span><strong>{status.activeCode.code}</strong><button type="button" onClick={() => { void navigator.clipboard.writeText(status.activeCode!.code!); setCopied(true); }}><ClipboardCopy size={16} />{copied ? (en ? 'Copied' : 'Copiado') : (en ? 'Copy' : 'Copiar')}</button></div> : <p>{en ? 'Contact the Apostolate to retrieve your existing code.' : 'Contacte o Apostolado para recuperar o seu código existente.'}</p>}
            <Link href={booking} className="reg-primary is-block">{en ? 'Request a stay' : 'Pedir reserva'} <ArrowRight size={18} /></Link></div>}
          {application?.status === 'declined' && !status.activeCode && <div className="reg-alert"><p>{en ? 'This request was not accepted. You can submit a new one.' : 'Este pedido não foi aceite. Pode enviar um novo pedido.'}</p></div>}
          {canApply && <form onSubmit={submit} className="reg-stack house-training-form">
            <p className="house-training-form-intro">{en ? 'Request a place in an online class. The team will contact you with the date and access details.' : 'Peça um lugar numa turma online. A equipa confirma a data e o acesso consigo.'}</p>
            <label className="reg-field"><span className="reg-field-label">{en ? 'Full name' : 'Nome completo'} *</span><input value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={160} autoComplete="name" /></label>
            <label className="reg-field"><span className="reg-field-label">Email *</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} autoComplete="email" /></label>
            <label className="reg-field"><span className="reg-field-label">{en ? 'Phone' : 'Telefone'} *</span><input type="tel" value={phone} onChange={event => setPhone(event.target.value)} required minLength={5} maxLength={40} autoComplete="tel" /></label>
            <label className="reg-field"><span className="reg-field-label">{en ? 'Availability for online classes (optional)' : 'Disponibilidade para aulas online (opcional)'}</span><textarea value={availability} onChange={event => setAvailability(event.target.value)} maxLength={1000} rows={3} /></label>
            <button className="reg-primary is-block" type="submit" disabled={busy}>{busy && <Loader2 className="house-spin" size={18} />}{en ? 'Request training' : 'Pedir inscrição na formação'} <ArrowRight size={18} /></button>
          </form>}
        </div>}
      {error && status && <p className="house-error" role="alert">{error}</p>}
    </section></main>
  </VIPLayout>;
}
