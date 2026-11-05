"use client";

import { useEffect, useState } from 'react';
import { LoaderCircle, Send } from 'lucide-react';

import { missingDonorFields, type DonorIdentity } from '../../../lib/ledger/factpt-mirror-rules';
import { formatEur } from '../../../lib/ledger/format';
import { adminFetch } from './useLedger';
import { Button, cx } from './ui';

type Gate = {
  available: boolean;
  blockedReason: string | null;
  nearbyManual: string[];
  prefill: (Partial<DonorIdentity> & { source: 'donation' | 'factpt' | null }) | null;
};

const FIELDS: { key: keyof DonorIdentity; label: string; half?: boolean; placeholder?: string }[] = [
  { key: 'name', label: 'Nome' },
  { key: 'email', label: 'Email', placeholder: 'A fatura-recibo é enviada para aqui' },
  { key: 'nif', label: 'NIF (opcional)', half: true },
  { key: 'country', label: 'País', half: true, placeholder: 'PT' },
  { key: 'address', label: 'Morada' },
  { key: 'zip', label: 'Código postal', half: true },
  { key: 'city', label: 'Cidade', half: true },
];

/** Reports whether the app may issue, so the drawer only offers what will work. */
export function useDonationGate(movementId: string | null) {
  const [gate, setGate] = useState<Gate | null>(null);
  useEffect(() => {
    setGate(null);
    if (!movementId) return;
    let active = true;
    void adminFetch(`/api/admin/contabilidade/movimentos/${movementId}/doacao`)
      .then((result: Gate) => { if (active) setGate(result); })
      .catch(() => { if (active) setGate({ available: false, blockedReason: null, nearbyManual: [], prefill: null }); });
    return () => { active = false; };
  }, [movementId]);
  return gate;
}

export default function DonationInvoiceField({
  movementId,
  amount,
  gate,
  disabled,
  onIssued,
}: {
  movementId: string;
  amount: number;
  gate: Gate;
  disabled: boolean;
  onIssued: () => void;
}) {
  const [donor, setDonor] = useState<Partial<DonorIdentity>>({ country: 'PT', ...gate.prefill });
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = missingDonorFields(donor);
  const ready = missing.length === 0 && (gate.nearbyManual.length === 0 || acknowledged);

  const issue = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/contabilidade/movimentos/${movementId}/doacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donor, acknowledgeManual: acknowledged }),
      });
      onIssued();
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : 'Não foi possível registar a doação.');
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {gate.prefill?.source && (
        <p className="text-xs text-zinc-500">
          Dados de {gate.prefill.source === 'donation' ? 'uma doação anterior' : 'uma fatura anterior na FACT.pt'}. Confirme que continuam certos.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map(field => (
          <label key={field.key} className={cx('block', !field.half && 'col-span-2')}>
            <span className="mb-1 block text-xs font-medium text-zinc-600">{field.label}</span>
            <input
              value={donor[field.key] || ''}
              onChange={event => { setDonor(previous => ({ ...previous, [field.key]: event.target.value })); setConfirming(false); }}
              placeholder={field.placeholder}
              disabled={disabled || busy}
              className="h-10 w-full rounded-xl bg-zinc-50 px-3 text-sm text-zinc-900 ring-1 ring-transparent transition placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-zinc-300"
            />
          </label>
        ))}
      </div>

      {gate.nearbyManual.length > 0 && (
        <label className="flex cursor-pointer items-start gap-2 text-sm text-orange-800">
          <input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} className="mt-0.5" />
          <span>Verifiquei que {gate.nearbyManual.join(', ')} não pertence{gate.nearbyManual.length > 1 ? 'm' : ''} a esta transferência.</span>
        </label>
      )}

      {error && <p className="rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{error}</p>}

      {confirming ? (
        <div className="rounded-2xl bg-zinc-50 p-4">
          <p className="text-sm text-zinc-800">
            Vai ser emitida uma fatura-recibo da série 2026D para <span className="font-semibold">{donor.name}</span> de <span className="font-semibold">{formatEur(amount)}</span>, enviada para {donor.email}. Uma fatura emitida não se apaga.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" className="flex-1" disabled={busy} onClick={() => setConfirming(false)}>Voltar</Button>
            <Button variant="primary" className="flex-1" disabled={busy} onClick={() => void issue()}>
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              Emitir fatura-recibo
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="primary"
          className="w-full"
          disabled={disabled || !ready}
          title={missing.length ? `Falta: ${missing.join(', ')}` : undefined}
          onClick={() => setConfirming(true)}
        >
          <Send className="h-4 w-4" aria-hidden />
          Emitir pela app
        </Button>
      )}
    </div>
  );
}
