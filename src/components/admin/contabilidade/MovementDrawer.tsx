"use client";

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleDashed, FileText, LoaderCircle, Paperclip, Undo2, UploadCloud, X } from 'lucide-react';

import { KIND_LABELS, categoriesFor, categoryLabel, requiresDocument, requiresInvoice } from '../../../lib/ledger/categories';
import { formatDay, formatEur } from '../../../lib/ledger/format';
import { visualFor } from './theme';
import type { LedgerMovement } from './types';
import { adminFetch } from './useLedger';
import { useToast } from './Toasts';
import { Button, StatePill, cx, isOpen, movementTitle } from './ui';
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

export default function MovementDrawer({ movement, readOnlyReason, onClose, onChanged, onLocalChange }: Props) {
  const [category, setCategory] = useState('');
  const [pilgrimageMode, setPilgrimageMode] = useState<'site' | 'issued'>('site');
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
    setInvoiceRef('');
    setAcknowledgeNearby(false);
    setNotes(movement.notes || '');
    setIgnoring(false);
    setIgnoreReason('');
    setError(null);
    // Reset only when another movement is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movement?.id]);

  useEffect(() => {
    setInvoiceRef('');
    setAcknowledgeNearby(false);
    setPilgrimageMode('site');
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
  const needsInvoice = !!view && view.amount > 0 && requiresInvoice(category);
  const needsDocument = !!view && view.amount < 0 && requiresDocument(category);
  const locked = !!readOnlyReason;
  const invoiceReady = !needsInvoice || (onLocalChange
    ? invoiceRef.trim().length > 0
    : !checkingInvoice && !invoiceCheckError && !invoiceAssessment?.pending && !invoiceAssessment?.ambiguous
      && (!!invoiceAssessment?.issued?.number || invoiceRef.trim().length > 0)
      && (!invoiceAssessment?.nearbyIssuedCount || !!invoiceAssessment.issued || acknowledgeNearby));
  const canApprove = open && !locked && !busy && !!category && invoiceReady
    && (category !== 'peregrinacao' || pilgrimageMode === 'issued');
  const visual = visualFor(category || null);
  const Icon = visual.icon;

  return (
    <Dialog open={!!movement} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-zinc-950/20 backdrop-blur-[2px] transition-opacity duration-300 ease-out data-[closed]:opacity-0"
      />
      <div className="fixed inset-0 flex justify-end p-0 sm:p-3">
        <DialogPanel
          transition
          className="flex h-full w-full max-w-[440px] flex-col overflow-hidden bg-white transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-[closed]:translate-x-12 data-[closed]:opacity-0 sm:rounded-3xl sm:shadow-2xl sm:shadow-zinc-900/10 sm:ring-1 sm:ring-zinc-900/5"
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
                  <p className={cx('mt-4 flex items-center gap-2 text-[34px] font-semibold leading-none tracking-tight tabular-nums', view.amount > 0 ? 'text-emerald-600' : 'text-zinc-900')}>
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
                  {view.linkedPaymentId && <Line label="Pagamento da reserva">{view.linkedPaymentLabel || `${view.linkedPaymentId.slice(0, 8)}…`}</Line>}
                  {view.status !== 'unreviewed' && view.status !== 'suggested' && (
                    <Line label={view.status === 'ignored' ? 'Ignorado' : 'Confirmado'}>
                      {view.reviewedBy || '—'}
                      {view.reviewedAt ? ` · ${formatDay(view.reviewedAt.slice(0, 10))} ${view.reviewedAt.slice(11, 16)}` : ''}
                    </Line>
                  )}
                  {view.status === 'ignored' && view.ignoreReason && <Line label="Motivo">{view.ignoreReason}</Line>}
                </dl>

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
                              disabled={locked || !!view.linkedPaymentId && option.code !== 'peregrinacao'}
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
                      {view.linkedPaymentId && <p className="mt-2 text-xs text-blue-700">Este movimento já está ligado a um pagamento de peregrinação. A categoria fica fixa até resolver a FR.</p>}
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

                    {needsInvoice && (category !== 'peregrinacao' || pilgrimageMode === 'issued') && (
                      <Field label="Fatura-recibo" hint="Associe uma FR já emitida. Confirmar este movimento não emite nenhuma FR.">
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
                        {!invoiceAssessment?.issued && (
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
                        )}
                      </Field>
                    )}

                    {needsDocument && (
                      <Field label="Documento da despesa">
                        {view.documentCount > 0 ? (
                          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                            <Paperclip className="h-4 w-4" aria-hidden /> {view.documentCount} documento(s) anexado(s)
                          </p>
                        ) : (
                          <button
                            type="button"
                            disabled={locked || busy || !onLocalChange}
                            title={onLocalChange ? undefined : 'O carregamento de ficheiros chega na próxima fase.'}
                            onClick={() => void send({ action: 'attach' }, false)}
                            className="flex w-full flex-col items-center gap-1.5 rounded-2xl border border-dashed border-zinc-300 px-4 py-6 text-center transition-colors hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <UploadCloud className="h-6 w-6 text-zinc-400" aria-hidden />
                            <span className="text-sm font-medium text-zinc-800">Anexar fatura</span>
                            <span className="text-xs text-zinc-500">PDF ou fotografia, até 15 MB</span>
                          </button>
                        )}
                        <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                          Fatura em papel, guardada no dossier
                          <Toggle checked={view.paperDocument} disabled={locked || busy} onChange={value => void send({ action: 'paper_document', value }, false)} />
                        </label>
                      </Field>
                    )}

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
                      {(category !== 'peregrinacao' || pilgrimageMode === 'issued') && <Button
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
