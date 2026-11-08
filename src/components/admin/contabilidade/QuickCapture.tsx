"use client";

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useMemo, useRef, useState } from 'react';
import { Camera, Check, ChevronRight, FileUp, LoaderCircle, PartyPopper, X } from 'lucide-react';

import { type DocumentKind } from '../../../lib/ledger/document-rules';
import { formatDay, formatEur } from '../../../lib/ledger/format';
import { KindPicker, uploadExpenseFiles } from './ExpenseDocumentsField';
import { useToast } from './Toasts';
import type { LedgerMovement } from './types';
import { adminFetch } from './useLedger';
import { Button, movementTitle } from './ui';

/**
 * One expense at a time, phone in hand: photograph the paper invoice and the
 * next one comes up. Built for the pile of paper on the desk.
 */
export default function QuickCapture({
  open,
  movements,
  onClose,
  onChanged,
}: {
  open: boolean;
  movements: LedgerMovement[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const queue = useMemo(() => movements, [movements]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<DocumentKind>('fatura');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const current = queue.find(movement => !done.has(movement.id) && !skipped.has(movement.id)) || null;
  const position = current ? queue.indexOf(current) + 1 : queue.length;

  const finish = (movement: LedgerMovement, title: string) => {
    setDone(previous => new Set(previous).add(movement.id));
    setKind('fatura');
    setError(null);
    onChanged();
    toast({ title, description: `${movementTitle(movement)} · ${formatEur(movement.amount)}` });
  };

  const upload = async (files: FileList) => {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      await uploadExpenseFiles(current.id, files, kind);
      finish(current, 'Documento guardado');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Não foi possível guardar.');
    } finally {
      setBusy(false);
      if (camera.current) camera.current.value = '';
      if (picker.current) picker.current.value = '';
    }
  };

  const paper = async () => {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/contabilidade/movimentos/${current.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'paper_document', value: true }),
      });
      finish(current, 'Marcada como fatura em papel');
    } catch (paperError) {
      setError(paperError instanceof Error ? paperError.message : 'Não foi possível guardar.');
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setSkipped(new Set());
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} className="relative z-50">
      <DialogBackdrop transition className="fixed inset-0 bg-black/55 backdrop-blur-[3px] transition-opacity duration-300 data-[closed]:opacity-0" />
      <div className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <DialogPanel transition className="lg-float w-full max-w-md rounded-t-3xl p-6 transition duration-300 ease-out data-[closed]:translate-y-8 data-[closed]:opacity-0 sm:rounded-3xl">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[15px] font-semibold text-zinc-900">Fotografar faturas</DialogTitle>
            <button type="button" onClick={close} className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Fechar">
              <X className="h-5 w-5" />
            </button>
          </div>

          {current ? (
            <>
              <p className="mt-1 text-[13px] text-zinc-500">{position} de {queue.length} · {done.size} {done.size === 1 ? 'guardada' : 'guardadas'}</p>
              <div className="mt-4 rounded-2xl bg-zinc-50 p-4">
                <p className="text-2xl font-semibold tabular-nums text-zinc-900">{formatEur(current.amount)}</p>
                <p className="mt-1 font-medium text-zinc-900">{movementTitle(current)}</p>
                <p className="text-sm text-zinc-500">{formatDay(current.bookingDate, true)} · <span className="font-mono text-[12px]">{current.description}</span></p>
                {current.notes && <p className="mt-2 text-[13px] text-zinc-600">{current.notes}</p>}
              </div>

              <div className="mt-4"><KindPicker value={kind} onChange={setKind} disabled={busy} /></div>

              <div className="mt-4 grid gap-2">
                <Button variant="primary" size="lg" disabled={busy} onClick={() => camera.current?.click()}>
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
                  Tirar fotografia
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" disabled={busy} onClick={() => picker.current?.click()}>
                    <FileUp className="h-4 w-4" aria-hidden /> Ficheiro
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => void paper()}>
                    <Check className="h-4 w-4" aria-hidden /> Só em papel
                  </Button>
                </div>
                <Button variant="ghost" disabled={busy} onClick={() => { setSkipped(previous => new Set(previous).add(current.id)); setError(null); }}>
                  Saltar esta <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              {error && <p className="mt-3 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{error}</p>}
              <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={event => { if (event.target.files?.length) void upload(event.target.files); }} />
              <input ref={picker} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={event => { if (event.target.files?.length) void upload(event.target.files); }} />
            </>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><PartyPopper className="h-6 w-6" /></span>
              <p className="mt-4 font-semibold text-zinc-900">{skipped.size ? `Fim da lista · ${skipped.size} ${skipped.size === 1 ? 'saltada' : 'saltadas'}` : 'Todas as despesas deste mês têm documento'}</p>
              <p className="mt-1 text-sm text-zinc-500">{done.size} {done.size === 1 ? 'documento guardado' : 'documentos guardados'} agora.</p>
              <Button className="mt-5" onClick={close}>Fechar</Button>
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
