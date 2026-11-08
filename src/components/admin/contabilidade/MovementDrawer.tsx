"use client";

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleDashed, FileText, LoaderCircle, Undo2, UploadCloud, X } from 'lucide-react';

import { KIND_LABELS, categoriesFor, categoryLabel, requiresDocument, requiresInvoice } from '../../../lib/ledger/categories';
import { formatDay, formatEur } from '../../../lib/ledger/format';
import { categoryForInvoice } from '../../../lib/ledger/factpt-mirror-rules';
import { validateInvoiceRef } from '../../../lib/ledger/invoice-safety';
import { visualFor } from './theme';
import type { LedgerMovement } from './types';
import { adminFetch } from './useLedger';
import { useToast } from './Toasts';
import { Button, StatePill, cx, isOpen, movementTitle } from './ui';
import DonationInvoiceField, { useDonationGate } from './DonationInvoiceField';
import AgreementField from './AgreementField';
import ExpenseDocumentsField from './ExpenseDocumentsField';
import PilgrimageTransferField from './PilgrimageTransferField';

type Props = {
  movement: LedgerMovement | null;
  readOnlyReason: string | null;
  onClose: () => void;
  onChanged: () => void;
  /** Demo / preview: apply the action in memory instead of calling the API. */
  onLocalChange?: (id: string, patch: Partial<LedgerMovement>) => void;
};

type InvoiceAssessment = {
  issued: { number: string | null } | null;
  pending: { type: 'donation' | 'pilgrimage_payment' | 'quota' | 'factpt_document'; id: string } | null;
  ambiguous: boolean;
  nearbyIssuedCount: number;
  linkedPaymentId?: string | null;
};

/** The FR found by hand in FACT.pt, ready to confirm, when its series fits the category. */
function manualInvoiceRef(movement: LedgerMovement | null, category: string): string {
  const suggestion = movement?.suggestion;
  if (!movement || !suggestion?.invoiceRef || !['manual', 'manual_likely'].includes(suggestion.confidence)) return '';
  return validateInvoiceRef(suggestion.invoiceRef, category, movement.bookingDate) ? suggestion.invoiceRef : '';
}

export default function MovementDrawer({ movement, readOnlyReason, onClose, onChanged, onLocalChange }: Props) {
  const [category, setCategory] = useState('');
  const [pilgrimageMode, setPilgrimageMode] = useState<'site' | 'issued'>('site');
  const [donationMode, setDonationMode] = useState<'issued' | 'app'>('issued');
  const [typingInvoice, setTypingInvoice] = useState(false);
  const [invoiceRef, setInvoiceRef] = useState('');
  const [invoiceAssessment, setInvoiceAssessment] = useState<InvoiceAssessment | null>(null);
  const [checkingInvoice, setCheckingInvoice] = useState(false);
  const [invoiceCheckError, setInvoiceCheckError] = useState<string | null>(null);
  const [acknowledgeNearby, setAcknowledgeNearby] = useState(false);
  const [notes, setNotes] = useState('');
  const [ignoring, setIgnoring] = useState(false);
  const [ignoreReason, setIgnoreReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  // Keep the last movement while the panel animates out.
  const [shown, setShown] = useState<LedgerMovement | null>(movement);
  const movementId = movement?.id;
  useEffect(() => { if (movement) setShown(movement); }, [movement]);

  useEffect(() => {
    if (!movement) return;
    setCategory(movement.categoryCode || movement.suggestedCategoryCode || '');
    setPilgrimageMode('site');
    setDonationMode('issued');
    setTypingInvoice(false);
    setInvoiceRef(manualInvoiceRef(movement, movement.categoryCode || movement.suggestedCategoryCode || ''));
    setAcknowledgeNearby(false);
    setNotes(movement.notes || '');
    setIgnoring(false);
    setIgnoreReason('');
    setError(null);
    // Reset only when another movement is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movement?.id]);

  useEffect(() => {
    setInvoiceRef(manualInvoiceRef(movement, category));
    setAcknowledgeNearby(false);
    setPilgrimageMode('site');
    setDonationMode('issued');
    setTypingInvoice(false);
    // Only a change of category clears what was typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  useEffect(() => {
    if (!movementId || !category || !requiresInvoice(category) || onLocalChange) {
      setInvoiceAssessment(null);
      setInvoiceCheckError(null);
      return;
    }
    let active = true;
    setCheckingInvoice(true);
    setInvoiceAssessment(null);
    setInvoiceCheckError(null);
    setAcknowledgeNearby(false);
    void adminFetch(`/api/admin/contabilidade/movimentos/${movementId}?category=${encodeURIComponent(category)}`)
      .then((result: InvoiceAssessment) => { if (active) { setInvoiceAssessment(result); if (result.linkedPaymentId && result.issued) setPilgrimageMode('issued'); } })
      .catch(checkError => { if (active) setInvoiceCheckError(checkError instanceof Error ? checkError.message : 'Falha na verificação da FR.'); })
      .finally(() => { if (active) setCheckingInvoice(false); });
    return () => { active = false; };
  }, [movementId, category, onLocalChange]);

  /** Words for the toast shown after each action. */
  const describe = (body: Record<string, unknown>, target: LedgerMovement) => {
    const who = `${movementTitle(target)} · ${formatEur(target.amount, { signed: true })}`;
    switch (body.action) {
      case 'approve': return { title: `Confirmado como ${categoryLabel(String(body.categoryCode))}`, description: who, undo: true };
      case 'ignore': return { title: 'Movimento ignorado', description: who, undo: true };
      case 'reopen': return { title: 'Movimento reaberto', description: who, undo: false };
      case 'paper_document': return { title: body.value ? 'Marcado como fatura em papel' : 'Fatura em papel desmarcada', description: undefined, undo: false };
      case 'attach': return { title: 'Documento anexado', description: who, undo: false };
      case 'note': return { title: 'Nota guardada', description: undefined, undo: false };
      default: return { title: 'Guardado', description: undefined, undo: false };
    }
  };

  const send = async (body: Record<string, unknown>, closeAfter = true) => {
    if (!movement) return;
    const target = movement;
    const words = describe(body, target);
    if (onLocalChange) {
      const before: Partial<LedgerMovement> = {
        status: target.status, categoryCode: target.categoryCode, needsDocument: target.needsDocument,
        invoiceRefs: target.invoiceRefs, ignoreReason: target.ignoreReason, reviewedBy: target.reviewedBy,
        reviewedAt: target.reviewedAt, paperDocument: target.paperDocument, documentCount: target.documentCount, notes: target.notes,
      };
      const stamp = { reviewedBy: 'você', reviewedAt: new Date().toISOString() };
      const code = body.categoryCode as LedgerMovement['categoryCode'];
      if (body.action === 'approve') {
        onLocalChange(target.id, {
          ...stamp,
          status: 'reconciled',
          categoryCode: code,
          needsDocument: requiresDocument(code),
          invoiceRefs: body.invoiceRef ? [String(body.invoiceRef).toUpperCase()] : invoiceAssessment?.issued?.number ? [invoiceAssessment.issued.number] : target.invoiceRefs,
        });
      } else if (body.action === 'ignore') onLocalChange(target.id, { ...stamp, status: 'ignored', ignoreReason: String(body.reason) });
      else if (body.action === 'reopen') onLocalChange(target.id, { status: target.categoryCode ? 'suggested' : 'unreviewed', ignoreReason: null });
      else if (body.action === 'paper_document') onLocalChange(target.id, { paperDocument: !!body.value });
      else if (body.action === 'attach') onLocalChange(target.id, { documentCount: target.documentCount + 1 });
      else if (body.action === 'note') onLocalChange(target.id, { notes: String(body.notes || '') || null });
      toast({
        title: words.title,
        description: words.description,
        action: words.undo ? { label: 'Desfazer', onClick: () => onLocalChange(target.id, before) } : undefined,
      });
      if (closeAfter) onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/contabilidade/movimentos/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onChanged();
      toast({
        title: words.title,
        description: words.description,
        action: words.undo ? {
          label: 'Desfazer',
          onClick: () => {
            void adminFetch(`/api/admin/contabilidade/movimentos/${target.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'reopen' }),
            })
              .then(() => { onChanged(); toast({ tone: 'info', title: 'Ação desfeita' }); })
              .catch(undoError => toast({ tone: 'error', title: 'Não foi possível desfazer', description: undoError instanceof Error ? undoError.message : undefined }));
          },
        } : undefined,
      });
      if (closeAfter) onClose();
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'Não foi possível guardar.';
      setError(message);
      toast({ tone: 'error', title: 'Não foi possível guardar', description: message });
    } finally {
      setBusy(false);
    }
  };

  const view = movement ?? shown;
  const open = !!view && isOpen(view);
  const offerDonationGate = open && category === 'doacao' && !onLocalChange && !view?.linkedPaymentId;
  const donationGate = useDonationGate(offerDonationGate && movementId ? movementId : null);
  const issuingDonation = category === 'doacao' && donationMode === 'app' && !!donationGate?.available;

  // With no FR found, issuing it is the normal path; typing a number is the exception.
  useEffect(() => {
    if (!donationGate?.available || !movement) return;
    const foundElsewhere = !!manualInvoiceRef(movement, 'doacao') || movement.suggestion?.confidence === 'ambiguous';
    if (!foundElsewhere) setDonationMode('app');
  }, [donationGate, movement]);
  const needsInvoice = !!view && view.amount > 0 && requiresInvoice(category);
  const needsDocument = !!view && view.amount < 0 && requiresDocument(category);
  const locked = !!readOnlyReason;
  const invoiceReady = !needsInvoice || (onLocalChange
    ? invoiceRef.trim().length > 0
    : !checkingInvoice && !invoiceCheckError && !invoiceAssessment?.pending && !invoiceAssessment?.ambiguous
      && (!!invoiceAssessment?.issued?.number || invoiceRef.trim().length > 0)
      && (!invoiceAssessment?.nearbyIssuedCount || !!invoiceAssessment.issued || acknowledgeNearby));
  const canApprove = open && !locked && !busy && !!category && invoiceReady && !issuingDonation
    && (category !== 'peregrinacao' || pilgrimageMode === 'issued');
  const visual = visualFor(category || null);
  const Icon = visual.icon;

  // Hotels and restaurants are paid in instalments of a proforma.
  const agreementField = view && view.amount < 0 && view.status !== 'ignored' && !onLocalChange ? (
    <Field label="Proforma do fornecedor">
      <AgreementField movementId={view.id} amount={view.amount} linkedAgreementId={view.agreementId ?? null} disabled={locked} onChanged={onChanged} />
    </Field>
  ) : null;

  // An approved expense can still be waiting for its invoice.
  const documentField = needsDocument && view ? (
    <Field label="Documento da despesa">
      {onLocalChange ? (
        <button
          type="button"
          disabled={locked || busy}
          onClick={() => void send({ action: 'attach' }, false)}
          className="flex w-full flex-col items-center gap-1.5 rounded-2xl border border-dashed border-zinc-300 px-4 py-6 text-center transition-colors hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <UploadCloud className="h-6 w-6 text-zinc-400" aria-hidden />
          <span className="text-sm font-medium text-zinc-800">{view.documentCount > 0 ? `${view.documentCount} documento(s) anexado(s)` : 'Anexar fatura'}</span>
          <span className="text-xs text-zinc-500">PDF ou fotografia, até 9 MB</span>
        </button>
      ) : (
        <ExpenseDocumentsField movementId={view.id} disabled={locked} onChanged={onChanged} />
      )}
      <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
        Fatura em papel, guardada no dossier
        <Toggle checked={view.paperDocument} disabled={locked || busy} onChange={value => void send({ action: 'paper_document', value }, false)} />
      </label>
    </Field>
  ) : null;

  return (
    <Dialog open={!!movement} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/55 transition-opacity duration-300 ease-out data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex justify-end p-0 sm:p-3">
        <DialogPanel
          transition
          className="lg-float flex h-full w-full max-w-[460px] flex-col overflow-hidden transition duration-[380ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-[closed]:translate-x-[105%] motion-reduce:data-[closed]:translate-x-0 motion-reduce:data-[closed]:opacity-0 sm:rounded-[24px] sm:shadow-[0_0_0_1px_rgba(9,9,11,0.05),0_24px_64px_-12px_rgba(9,9,11,0.25)]"
        >
          {view && (
            <>
              <div className="flex items-center justify-between px-6 pt-5">
                <button type="button" onClick={onClose} className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition-all duration-200 ease-out hover:rotate-90 hover:bg-zinc-100 hover:text-zinc-700 active:scale-90" aria-label="Fechar">
                  <X className="h-5 w-5" />
                </button>
                <StatePill movement={view} />
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-6">
                {/* Headline */}
                <div className="pt-4">
                  <div className="flex items-center gap-2.5">
                    <span className={cx('flex h-9 w-9 items-center justify-center rounded-xl', visual.tone.soft)} aria-hidden>
                      <Icon className={cx('h-[18px] w-[18px]', visual.tone.ink)} />
                    </span>
                    <span className="text-sm text-zinc-500">{KIND_LABELS[view.kind]}</span>
                  </div>
                  <p className={cx('mt-4 flex items-center gap-2 text-[36px] font-semibold leading-none tracking-[-0.035em] tabular-nums', view.amount > 0 ? 'text-emerald-600' : 'text-zinc-900')}>
                    {view.status === 'reconciled' && <CheckCircle2 className="h-7 w-7 text-emerald-500" aria-hidden />}
                    {formatEur(view.amount, { signed: true })}
                  </p>
                  <DialogTitle className="mt-3 text-xl font-semibold text-zinc-900">{movementTitle(view)}</DialogTitle>
                  <p className="mt-1 text-sm text-zinc-500">{formatDay(view.bookingDate, true)} · Montepio</p>
                </div>

                <dl className="mt-6 divide-y divide-zinc-100 border-y border-zinc-100">
                  <Line label="Descrição do banco"><span className="break-all font-mono text-[13px]">{view.description}</span></Line>
                  <Line label="Data valor">{formatDay(view.valueDate, true)}</Line>
                  <Line label="Saldo após">{formatEur(view.balanceAfter)}</Line>
                  {view.invoiceRefs.length > 0 && <Line label="Fatura-recibo">{view.invoiceRefs.join(', ')}{view.invoiceFromApp ? ' · emitida pela app' : ''}</Line>}
                  {view.linkedPaymentId && <Line label={view.linkedPaymentKind === 'donation' ? 'Doação' : 'Pagamento da reserva'}>{view.linkedPaymentLabel || `${view.linkedPaymentId.slice(0, 8)}…`}</Line>}
                  {view.status !== 'unreviewed' && view.status !== 'suggested' && (
                    <Line label={view.status === 'ignored' ? 'Ignorado' : 'Confirmado'}>
                      {view.reviewedBy || '—'}
                      {view.reviewedAt ? ` · ${formatDay(view.reviewedAt.slice(0, 10))} ${view.reviewedAt.slice(11, 16)}` : ''}
                    </Line>
                  )}
                  {view.status === 'ignored' && view.ignoreReason && <Line label="Motivo">{view.ignoreReason}</Line>}
                  {!open && view.notes && <Line label="Nota">{view.notes}</Line>}
                </dl>
                {view.status !== 'reconciled' && view.status !== 'ignored' && (view.appInvoiceRef || view.suggestion) && (
                  <div className={cx('mt-4 rounded-2xl px-4 py-3 text-sm',
                    view.appInvoiceRef || view.suggestion?.confidence === 'manual' ? 'bg-emerald-50 text-emerald-800'
                      : view.suggestion?.confidence === 'ambiguous' ? 'bg-orange-50 text-orange-800' : 'bg-sky-50 text-sky-800')}>
                    {view.appInvoiceRef ? (
                      <p><span className="font-semibold">Reconhecida automaticamente.</span> É o pagamento {view.linkedPaymentLabel ? `«${view.linkedPaymentLabel}»` : 'registado no site'}, com a {view.appInvoiceRef} já emitida pela app. Só falta confirmar.</p>
                    ) : view.suggestion?.confidence === 'ambiguous' ? (
                      <>
                        <p><span className="font-semibold">Várias faturas possíveis.</span> {category === 'peregrinacao' ? 'Escolha a reserva certa abaixo' : 'Escolha a certa'}; não emita uma FR nova.</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {view.suggestion.invoiceRefs.map(ref => category === 'peregrinacao'
                            ? <span key={ref} className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium">{ref}</span>
                            : <button key={ref} type="button" disabled={locked} onClick={() => setInvoiceRef(ref)}
                                className={cx('rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-200', invoiceRef === ref ? 'bg-zinc-900 text-white' : 'bg-white/70 hover:bg-white')}>{ref}</button>)}
                        </div>
                      </>
                    ) : view.suggestion?.confidence === 'learned' ? (
                      <p><span className="font-semibold">Pagador conhecido.</span> {view.suggestion.reason}.</p>
                    ) : view.suggestion?.confidence === 'manual' || view.suggestion?.confidence === 'manual_likely' ? (
                      <>
                        <p><span className="font-semibold">{view.suggestion.confidence === 'manual' ? 'Encontrada na FACT.pt:' : 'Possível na FACT.pt:'}</span> {view.suggestion.invoiceRef} — {view.suggestion.reason}. Não emita uma FR nova.</p>
                        {open && view.suggestion.invoiceRef && (
                          <Button
                            size="sm"
                            variant="primary"
                            className="mt-3"
                            disabled={locked || busy}
                            onClick={() => {
                              const ref = view.suggestion!.invoiceRef!;
                              // The series decides when the chosen category does not fit the FR (Q is a quota).
                              const fits = validateInvoiceRef(ref, category, view.bookingDate) ? category : categoryForInvoice(ref) || 'doacao';
                              void send({ action: 'approve', categoryCode: fits, invoiceRef: ref, acknowledgeNearby: true });
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4" aria-hidden />
                            É esta: confirmar com {view.suggestion.invoiceRef}
                          </Button>
                        )}
                      </>
                    ) : (
                      <p><span className="font-semibold">Provável:</span> {view.suggestion?.invoiceRef} — {view.suggestion?.reason}. Se for este o pagamento, escolha a reserva nas sugestões abaixo; não emita uma FR nova.</p>
                    )}
                  </div>
                )}

                {open && (
                  <div className="mt-6 space-y-6">
                    <Field label="O que é este movimento?" hint={!view.categoryCode && view.suggestedCategoryCode ? `Sugestão: ${categoryLabel(view.suggestedCategoryCode)}` : undefined}>
                      <div className="grid grid-cols-2 gap-2">
                        {categoriesFor(view.amount).map(option => {
                          const optionVisual = visualFor(option.code);
                          const OptionIcon = optionVisual.icon;
                          const selected = category === option.code;
                          return (
                            <button
                              key={option.code}
                              type="button"
                              disabled={locked || !!view.linkedPaymentId && option.code !== (view.linkedPaymentKind === 'donation' ? 'doacao' : 'peregrinacao')}
                              onClick={() => setCategory(option.code)}
                              className={cx(
                                'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium outline-none transition-all duration-200 ease-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-emerald-500/40',
                                selected
                                  ? 'bg-zinc-900 text-white shadow-md shadow-zinc-900/15'
                                  : 'bg-zinc-50 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900',
                              )}
                            >
                              <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', selected ? 'bg-white/15' : optionVisual.tone.soft)}>
                                <OptionIcon className={cx('h-3.5 w-3.5', selected ? 'text-white' : optionVisual.tone.ink)} />
                              </span>
                              <span className="leading-tight">{option.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      {view.linkedPaymentId && <p className="mt-2 text-xs text-blue-700">Este movimento já está ligado a um pagamento do site. A categoria fica fixa até resolver a FR.</p>}
                    </Field>

                    {category === 'peregrinacao' && <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <button type="button" onClick={() => setPilgrimageMode('site')}
                          className={cx('cursor-pointer rounded-xl px-3 py-2.5 font-medium transition', pilgrimageMode === 'site' ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200')}>
                          Pagamento da reserva
                        </button>
                        <button type="button" onClick={() => setPilgrimageMode('issued')}
                          className={cx('cursor-pointer rounded-xl px-3 py-2.5 font-medium transition', pilgrimageMode === 'issued' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200')}>
                          FR já emitida
                        </button>
                      </div>
                      {pilgrimageMode === 'site' && (invoiceAssessment?.linkedPaymentId
                        ? <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">Pagamento associado à reserva. {invoiceAssessment.ambiguous ? 'O valor do documento não coincide com o movimento. Reveja-o em Faturação antes de fechar.' : invoiceAssessment.issued ? 'A FR já foi emitida; escolha «FR já emitida» para fechar o movimento.' : <>A FR está a ser processada em <Link href="/admin/faturacao" className="font-semibold underline">Faturação</Link>. Este movimento não criará outro pagamento.</>}</p>
                        : onLocalChange
                        ? <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">A associação à reserva e a emissão da FR ficam disponíveis depois de os movimentos serem guardados na base de dados.</p>
                        : <PilgrimageTransferField movementId={view.id} amount={view.amount} disabled={locked || busy || checkingInvoice || !!invoiceCheckError || !!invoiceAssessment?.issued || !!invoiceAssessment?.ambiguous || invoiceAssessment?.pending?.type === 'factpt_document'} nearbyIssuedCount={invoiceAssessment?.nearbyIssuedCount || 0}
                            onRegistered={() => { onChanged(); onClose(); toast({ title: 'Movimento associado à reserva', description: 'A fatura-recibo fica ligada a este movimento.' }); }} />)}
                    </div>}

                    {category === 'doacao' && donationGate?.blockedReason && (
                      <p className="rounded-xl bg-zinc-50 px-3.5 py-3 text-sm text-zinc-700">{donationGate.blockedReason}</p>
                    )}

                    {issuingDonation && donationGate && (
                      <Field label="Emitir fatura-recibo">
                        <DonationInvoiceField
                          movementId={view.id}
                          amount={view.amount}
                          gate={donationGate}
                          disabled={locked}
                          onIssued={() => { onChanged(); onClose(); toast({ title: 'Doação registada', description: 'A fatura-recibo sai dentro de minutos e o movimento fecha sozinho.' }); }}
                        />
                      </Field>
                    )}

                    {needsInvoice && !issuingDonation && (category !== 'peregrinacao' || pilgrimageMode === 'issued') && (
                      <Field label="Fatura-recibo" hint={invoiceAssessment?.issued?.number || invoiceRef ? 'Confirmar liga esta FR ao movimento. Não emite nada.' : undefined}>
                        {checkingInvoice && <p className="mb-2 text-sm text-blue-700">A verificar documentos da app…</p>}
                        {invoiceCheckError && <p className="mb-2 text-sm text-rose-700">{invoiceCheckError}</p>}
                        {invoiceAssessment?.issued?.number && (
                          <p className="mb-3 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm font-medium text-emerald-800">
                            {invoiceAssessment.issued.number} · emitida pela app. Será associada automaticamente.
                          </p>
                        )}
                        {invoiceAssessment?.pending && (
                          <p className="mb-3 rounded-xl bg-blue-50 px-3.5 py-3 text-sm text-blue-800">
                            {invoiceAssessment.pending.type === 'factpt_document' ? 'A app já está a tratar esta FR. Reveja-a em ' : 'Há um pagamento pendente no site. Confirme-o em '}
                            <a className="font-semibold underline" href={invoiceAssessment.pending.type === 'donation' ? '/admin/doacoes' : invoiceAssessment.pending.type === 'factpt_document' ? '/admin/faturacao' : invoiceAssessment.pending.type === 'quota' ? '/admin/membros' : '/admin/peregrinacoes'}>
                              {invoiceAssessment.pending.type === 'factpt_document' ? 'Faturação' : 'Pagamentos do site'}
                            </a>{invoiceAssessment.pending.type === 'factpt_document' ? '.' : ' para emitir a FR uma só vez.'}
                          </p>
                        )}
                        {invoiceAssessment?.ambiguous && <p className="mb-3 text-sm text-orange-700">Há vários pagamentos ou documentos possíveis. Reveja a associação no site.</p>}
                        {!invoiceAssessment?.issued && invoiceAssessment?.nearbyIssuedCount ? (
                          <label className="mb-3 flex cursor-pointer items-start gap-2 text-sm text-orange-800">
                            <input type="checkbox" checked={acknowledgeNearby} onChange={event => setAcknowledgeNearby(event.target.checked)} className="mt-0.5" />
                            <span>Verifiquei que as FRs da app com valor e data próximos não pertencem a este movimento.</span>
                          </label>
                        ) : null}
                        {!invoiceAssessment?.issued && (invoiceRef || typingInvoice ? (
                        <div className="relative">
                          <FileText className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
                          <input
                            value={invoiceRef}
                            onChange={event => setInvoiceRef(event.target.value)}
                            placeholder="FR 2026D/1243"
                            disabled={locked}
                            className="h-11 w-full rounded-xl bg-zinc-50 pl-10 pr-3 text-sm text-zinc-900 ring-1 ring-transparent transition placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-zinc-300"
                          />
                        </div>
                        ) : (
                          <p className="rounded-xl bg-zinc-50 px-3.5 py-3 text-sm text-zinc-700">
                            {category === 'quota' || category === 'loja'
                              ? 'Ainda não há FR. Por agora emite-se na FACT.pt, e aparece aqui sozinha na atualização seguinte.'
                              : 'Ainda não há FR encontrada para este movimento.'}
                          </p>
                        ))}
                        {!invoiceAssessment?.issued && !invoiceRef && !typingInvoice && (
                          <button type="button" onClick={() => setTypingInvoice(true)} className="mt-2 text-[13px] text-zinc-500 underline underline-offset-2 transition-colors duration-200 hover:text-zinc-800">
                            Sei o número da FR
                          </button>
                        )}
                      </Field>
                    )}

                    {category === 'doacao' && donationGate?.available && (
                      <button type="button" onClick={() => setDonationMode(mode => (mode === 'app' ? 'issued' : 'app'))} className="text-[13px] text-zinc-500 underline underline-offset-2 transition-colors duration-200 hover:text-zinc-800">
                        {donationMode === 'app' ? 'Esta FR já foi emitida' : 'Emitir a FR aqui'}
                      </button>
                    )}

                    {agreementField}

                    {documentField}

                    <Field label="Nota interna">
                      <textarea
                        value={notes}
                        onChange={event => setNotes(event.target.value)}
                        onBlur={() => { if (!locked && notes !== (view.notes || '')) void send({ action: 'note', notes }, false); }}
                        rows={2}
                        disabled={locked}
                        placeholder="Opcional"
                        className="w-full resize-none rounded-xl bg-zinc-50 px-3.5 py-3 text-sm text-zinc-900 ring-1 ring-transparent transition placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-zinc-300"
                      />
                    </Field>

                    {ignoring && (
                      <Field label="Porque é que este movimento não conta?">
                        <input
                          autoFocus
                          value={ignoreReason}
                          onChange={event => setIgnoreReason(event.target.value)}
                          placeholder="Ex.: transferência entre contas da associação"
                          className="h-11 w-full rounded-xl bg-zinc-50 px-3.5 text-sm text-zinc-900 ring-1 ring-transparent transition placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-zinc-300"
                        />
                      </Field>
                    )}
                  </div>
                )}

                {!open && view.status === 'reconciled' && (agreementField || documentField) && (
                  <div className="mt-6 space-y-6">{agreementField}{documentField}</div>
                )}

                {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
              </div>

              <footer className="border-t border-zinc-100 bg-white px-6 py-4">
                {readOnlyReason && <p className="mb-3 text-sm text-zinc-500">{readOnlyReason}</p>}
                {open ? (
                  ignoring ? (
                    <div className="flex gap-2">
                      <Button variant="ghost" className="flex-1" onClick={() => setIgnoring(false)}>Cancelar</Button>
                      <Button variant="dark" className="flex-1" disabled={locked || busy || !ignoreReason.trim()} onClick={() => void send({ action: 'ignore', reason: ignoreReason })}>
                        Ignorar movimento
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="secondary" disabled={locked || busy || !!view.linkedPaymentId} onClick={() => setIgnoring(true)}>Ignorar</Button>
                      {!issuingDonation && (category !== 'peregrinacao' || pilgrimageMode === 'issued') && <Button
                        variant="primary"
                        size="lg"
                        className="flex-1"
                        disabled={!canApprove}
                        onClick={() => void send({ action: 'approve', categoryCode: category, invoiceRef: needsInvoice ? invoiceRef : null, acknowledgeNearby })}
                      >
                        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                        {category ? `Confirmar como ${categoryLabel(category)}` : 'Escolha o que é'}
                      </Button>}
                    </div>
                  )
                ) : (
                  <Button variant="secondary" className="w-full" disabled={locked || busy} onClick={() => void send({ action: 'reopen' })}>
                    <Undo2 className="h-4 w-4" aria-hidden /> Reabrir movimento
                  </Button>
                )}
              </footer>
            </>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3 text-sm">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-zinc-900">{children}</dd>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-zinc-900">{label}</p>
      {children}
      {hint && <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500"><CircleDashed className="h-3 w-3" aria-hidden />{hint}</p>}
    </div>
  );
}

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-emerald-500' : 'bg-zinc-300')}
    >
      <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
}
