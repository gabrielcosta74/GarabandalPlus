"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { BedDouble, FileText, Link2Off, LoaderCircle, Plus, Upload } from 'lucide-react';

import { agreementState, type AgreementSummary } from '../../../lib/ledger/agreement-rules';
import { formatEur } from '../../../lib/ledger/format';
import { shrinkPhoto } from './compress-image';
import { useToast } from './Toasts';
import { adminFetch } from './useLedger';
import { Button, cx } from './ui';

type Pilgrimage = { id: string; title: string; start_date: string | null };
type LogisticsLine = { type: 'stay' | 'cost'; id: string; label: string; supplier: string; taken: boolean };

const STATE_TEXT = {
  paying: 'A pagar',
  paid_waiting_invoice: 'Pago · falta a fatura final',
  done: 'Pago e faturado',
  cancelled: 'Cancelado',
} as const;

export function AgreementProgress({ agreement }: { agreement: AgreementSummary }) {
  const share = agreement.total ? Math.min(1, agreement.paid / agreement.total) : 0;
  const state = agreementState(agreement);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="text-zinc-600">Pago <span className="font-semibold tabular-nums text-zinc-900">{formatEur(agreement.paid)}</span> de {formatEur(agreement.total)}</span>
        <span className={cx('shrink-0 font-medium', state === 'paying' ? 'text-zinc-500' : state === 'done' ? 'text-emerald-600' : 'text-orange-600')}>
          {state === 'paying' ? `Falta ${formatEur(agreement.remaining)}` : STATE_TEXT[state]}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-200/70">
        <div className={cx('h-full rounded-full transition-[width] duration-500', state === 'paying' ? 'bg-zinc-900' : 'bg-emerald-500')} style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}

function AgreementCard({ agreement, action }: { agreement: AgreementSummary; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-600 ring-1 ring-zinc-200" aria-hidden><BedDouble className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900">{agreement.supplier}</p>
          <p className="truncate text-[13px] text-zinc-500">{agreement.pilgrimageTitle}{agreement.logisticsLabel ? ` · ${agreement.logisticsLabel}` : ''}</p>
        </div>
        {action}
      </div>
      <div className="mt-3"><AgreementProgress agreement={agreement} /></div>
      {!agreement.hasProforma && <p className="mt-2 text-xs text-orange-600">Falta anexar a proforma ao acordo.</p>}
    </div>
  );
}

/** Which hotel or restaurant proforma this payment pays off. */
export default function AgreementField({
  movementId,
  amount,
  linkedAgreementId,
  disabled,
  onChanged,
}: {
  movementId: string;
  amount: number;
  linkedAgreementId: string | null;
  disabled: boolean;
  onChanged: () => void;
}) {
  const [data, setData] = useState<{ ready: boolean; agreements: AgreementSummary[]; suggested: string[]; pilgrimages: Pilgrimage[] } | null>(null);
  const [linked, setLinked] = useState<AgreementSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setError(null);
    if (linkedAgreementId) {
      const result = await adminFetch(`/api/admin/contabilidade/acordos/${linkedAgreementId}`);
      setLinked(result.agreement);
      return;
    }
    setLinked(null);
    setData(await adminFetch(`/api/admin/contabilidade/acordos?movementId=${movementId}`));
  }, [linkedAgreementId, movementId]);

  useEffect(() => {
    setCreating(false);
    setPicking(false);
    load().catch(loadError => setError(loadError instanceof Error ? loadError.message : 'Não foi possível ler os acordos.'));
  }, [load]);

  const link = async (agreementId: string) => {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/contabilidade/movimentos/${movementId}/acordo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agreementId }),
      });
      toast({ title: 'Pagamento ligado ao acordo', description: 'O «já pago» da logística foi atualizado.' });
      onChanged();
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : 'Não foi possível ligar.');
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/contabilidade/movimentos/${movementId}/acordo`, { method: 'DELETE' });
      toast({ tone: 'info', title: 'Pagamento desligado do acordo' });
      onChanged();
    } catch (unlinkError) {
      setError(unlinkError instanceof Error ? unlinkError.message : 'Não foi possível desligar.');
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{error}</p>;

  if (linkedAgreementId) {
    if (!linked) return <p className="flex items-center gap-2 text-sm text-zinc-500"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> A ler o acordo…</p>;
    return (
      <AgreementCard
        agreement={linked}
        action={(
          <button type="button" disabled={disabled || busy} onClick={() => void unlink()} className="rounded-lg p-1.5 text-zinc-400 transition-colors duration-200 hover:bg-white hover:text-zinc-700 disabled:opacity-50" aria-label="Desligar deste acordo" title="Desligar deste acordo">
            <Link2Off className="h-4 w-4" aria-hidden />
          </button>
        )}
      />
    );
  }

  if (!data) return <p className="flex items-center gap-2 text-sm text-zinc-500"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> A procurar proformas…</p>;
  if (!data.ready) return <p className="text-sm text-zinc-500">Os acordos com fornecedores ainda não estão ativos.</p>;

  const open = data.agreements.filter(agreement => agreement.status === 'open' && agreement.remaining > 0);
  const suggested = data.suggested.map(id => open.find(agreement => agreement.id === id)).filter(Boolean) as AgreementSummary[];

  if (creating) {
    return (
      <NewAgreementForm
        pilgrimages={data.pilgrimages}
        amount={amount}
        disabled={disabled}
        onCancel={() => setCreating(false)}
        onCreated={async id => { setCreating(false); await link(id); }}
      />
    );
  }

  return (
    <div className="space-y-2">
      {suggested.length > 0 && <p className="text-[13px] text-zinc-500">Parece ser um pagamento de:</p>}
      {suggested.map(agreement => (
        <AgreementCard key={agreement.id} agreement={agreement}
          action={<Button size="sm" variant="primary" disabled={disabled || busy} onClick={() => void link(agreement.id)}>Ligar</Button>} />
      ))}

      {picking ? (
        <select
          autoFocus
          defaultValue=""
          disabled={disabled || busy}
          onChange={event => { if (event.target.value) void link(event.target.value); }}
          className="h-11 w-full rounded-xl bg-zinc-50 px-3 text-sm text-zinc-900 outline-none ring-1 ring-transparent focus:bg-white focus:ring-zinc-300"
        >
          <option value="" disabled>Escolha o acordo…</option>
          {open.map(agreement => (
            <option key={agreement.id} value={agreement.id}>
              {agreement.supplier} · {agreement.pilgrimageTitle} · falta {formatEur(agreement.remaining)}
            </option>
          ))}
        </select>
      ) : (
        <div className="flex flex-wrap gap-2">
          {open.length > suggested.length && (
            <Button size="sm" disabled={disabled || busy} onClick={() => setPicking(true)}>Escolher outro acordo</Button>
          )}
          <Button size="sm" disabled={disabled || busy} onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> Nova proforma
          </Button>
        </div>
      )}
      {busy && <p className="flex items-center gap-2 text-[13px] text-zinc-500"><LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> A ligar…</p>}
    </div>
  );
}

function NewAgreementForm({
  pilgrimages, amount, disabled, onCancel, onCreated,
}: {
  pilgrimages: Pilgrimage[];
  amount: number;
  disabled: boolean;
  onCancel: () => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const [pilgrimageId, setPilgrimageId] = useState('');
  const [lines, setLines] = useState<LogisticsLine[] | null>(null);
  const [lineKey, setLineKey] = useState('');
  const [supplier, setSupplier] = useState('');
  const [total, setTotal] = useState('');
  const [outside, setOutside] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLines(null);
    setLineKey('');
    if (!pilgrimageId) return;
    adminFetch(`/api/admin/contabilidade/acordos/logistica?pilgrimageId=${pilgrimageId}`)
      .then(result => setLines(result.lines))
      .catch(() => setLines([]));
  }, [pilgrimageId]);

  const number = (value: string) => Number(value.replace(/\./g, '').replace(',', '.'));
  const totalValue = number(total);
  const ready = pilgrimageId && supplier.trim() && totalValue > 0 && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const [type, id] = lineKey.split(':');
      const created = await adminFetch('/api/admin/contabilidade/acordos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pilgrimageId, supplier: supplier.trim(), totalAmount: totalValue,
          paidOutsideBank: outside ? number(outside) : 0,
          hotelStayId: type === 'stay' ? id : null, costId: type === 'cost' ? id : null,
        }),
      });
      if (file) {
        const form = new FormData();
        form.append('file', await shrinkPhoto(file));
        form.append('kind', 'proforma');
        await adminFetch(`/api/admin/contabilidade/acordos/${created.id}/documentos`, { method: 'POST', body: form });
      }
      await onCreated(created.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível criar o acordo.');
      setBusy(false);
    }
  };

  const input = 'h-10 w-full rounded-xl bg-zinc-50 px-3 text-sm text-zinc-900 outline-none ring-1 ring-transparent transition placeholder:text-zinc-400 focus:bg-white focus:ring-zinc-300';
  return (
    <div className="space-y-3 rounded-2xl bg-zinc-50 p-4">
      <p className="text-sm font-semibold text-zinc-900">Nova proforma</p>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-zinc-600">Peregrinação</span>
        <select value={pilgrimageId} onChange={event => setPilgrimageId(event.target.value)} className={cx(input, 'bg-white')} disabled={disabled || busy}>
          <option value="">Escolha…</option>
          {pilgrimages.map(pilgrimage => <option key={pilgrimage.id} value={pilgrimage.id}>{pilgrimage.title}</option>)}
        </select>
      </label>
      {pilgrimageId && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Hotel ou serviço na logística (opcional)</span>
          <select
            value={lineKey}
            onChange={event => {
              setLineKey(event.target.value);
              const line = lines?.find(item => `${item.type}:${item.id}` === event.target.value);
              if (line && !supplier) setSupplier(line.supplier);
            }}
            className={cx(input, 'bg-white')}
            disabled={disabled || busy || !lines}
          >
            <option value="">{lines === null ? 'A ler…' : lines.length ? 'Sem ligação à logística' : 'Esta peregrinação ainda não tem hotéis na logística'}</option>
            {lines?.map(line => <option key={line.id} value={`${line.type}:${line.id}`} disabled={line.taken}>{line.label}{line.taken ? ' (já tem acordo)' : ''}</option>)}
          </select>
        </label>
      )}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-zinc-600">Fornecedor</span>
        <input value={supplier} onChange={event => setSupplier(event.target.value)} placeholder="Ex.: Hotel Évreux" className={cx(input, 'bg-white')} disabled={disabled || busy} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Total da proforma (€)</span>
          <input inputMode="decimal" value={total} onChange={event => setTotal(event.target.value)} placeholder="24.828,30" className={cx(input, 'bg-white tabular-nums')} disabled={disabled || busy} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Já pago antes (€)</span>
          <input inputMode="decimal" value={outside} onChange={event => setOutside(event.target.value)} placeholder="0" className={cx(input, 'bg-white tabular-nums')} disabled={disabled || busy} />
        </label>
      </div>
      <p className="text-xs text-zinc-500">«Já pago antes» é o que foi pago antes de agosto ou fora desta conta. Este pagamento ({formatEur(Math.abs(amount))}) liga-se a seguir.</p>
      <button type="button" onClick={() => picker.current?.click()} disabled={disabled || busy}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white px-3 py-2.5 text-left text-sm text-zinc-700 transition-colors duration-200 hover:border-zinc-400">
        {file ? <FileText className="h-4 w-4 text-emerald-600" aria-hidden /> : <Upload className="h-4 w-4 text-zinc-400" aria-hidden />}
        <span className="truncate">{file ? file.name : 'Anexar a proforma (PDF ou fotografia)'}</span>
      </button>
      <input ref={picker} type="file" accept="application/pdf,image/*" className="hidden" onChange={event => setFile(event.target.files?.[0] || null)} />
      {error && <p className="rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{error}</p>}
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" disabled={busy} onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" className="flex-1" disabled={!ready} onClick={() => void submit()}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
          Criar e ligar
        </Button>
      </div>
    </div>
  );
}
