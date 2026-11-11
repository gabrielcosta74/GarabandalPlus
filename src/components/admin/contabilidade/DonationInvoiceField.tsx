"use client";

import { useEffect, useState } from 'react';
import { LoaderCircle, Search, Send, UserPen, UserRound, X } from 'lucide-react';

import { missingDonorFields, type DonorCandidate, type DonorIdentity } from '../../../lib/ledger/factpt-mirror-rules';
import { formatEur } from '../../../lib/ledger/format';
import { ChoiceCard, Pill, Step, Steps, type StepState } from './Steps';
import { adminFetch } from './useLedger';
import { Button, cx } from './ui';

type Gate = {
  available: boolean;
  blockedReason: string | null;
  nearbyManual: string[];
  /** Up to the legal limit an FR can go to "Consumidor final", with no personal data. */
  genericAllowed?: boolean;
  /** Everyone the bank name may belong to, best first: FACT.pt clients, then site donations. */
  candidates?: DonorCandidate[];
  /** Pre-chosen only when exactly one person has every word of the bank name. */
  suggestedKey?: string | null;
  payerName?: string | null;
};

const MANUAL = 'manual';
const GENERIC = 'generic';

const FIELDS: { key: keyof DonorIdentity; label: string; half?: boolean; placeholder?: string }[] = [
  { key: 'name', label: 'Nome' },
  { key: 'email', label: 'Email', placeholder: 'A fatura-recibo é enviada para aqui' },
  { key: 'nif', label: 'NIF (opcional)', half: true },
  { key: 'country', label: 'País', half: true, placeholder: 'PT' },
  { key: 'address', label: 'Morada' },
  { key: 'zip', label: 'Código postal', half: true },
  { key: 'city', label: 'Cidade', half: true },
];

const identityOf = (candidate: DonorCandidate): Partial<DonorIdentity> => ({
  name: candidate.name, email: candidate.email, nif: candidate.nif, address: candidate.address,
  zip: candidate.zip, city: candidate.city, country: candidate.country || 'PT',
});

const formatDay = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-PT') : null);

function CandidateBody({ candidate }: { candidate: DonorCandidate }) {
  const details = [candidate.nif ? `NIF ${candidate.nif}` : 'Sem NIF', candidate.email, [candidate.city, candidate.country].filter(Boolean).join(', ')].filter(Boolean);
  return <>
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="font-semibold text-zinc-900">{candidate.name || 'Sem nome'}</span>
      <Pill tone={candidate.source === 'factpt' ? 'info' : 'neutral'}>
        {candidate.source === 'factpt' ? `Cliente FACT.pt${candidate.factptClientId ? ` #${candidate.factptClientId}` : ''}` : 'Doação no site'}
      </Pill>
      {candidate.match === 'partial' && <Pill tone="attention">Só parte do nome coincide</Pill>}
    </span>
    <span className="mt-0.5 block truncate text-xs text-zinc-500">{details.join(' · ')}</span>
    {(candidate.lastInvoice || candidate.lastDate) && (
      <span className="block text-xs text-zinc-400">
        {candidate.lastInvoice ? `Última ${candidate.lastInvoice}` : 'Última doação'}{candidate.lastDate ? ` · ${formatDay(candidate.lastDate)}` : ''}
      </span>
    )}
  </>;
}

/** Reports whether the app may issue, so the drawer only offers what will work. */
export function useDonationGate(movementId: string | null) {
  const [gate, setGate] = useState<Gate | null>(null);
  useEffect(() => {
    setGate(null);
    if (!movementId) return;
    let active = true;
    void adminFetch(`/api/admin/contabilidade/movimentos/${movementId}/doacao`)
      .then((result: Gate) => { if (active) setGate(result); })
      .catch(checkError => {
        if (!active) return;
        const reason = checkError instanceof Error ? checkError.message : 'erro desconhecido';
        setGate({ available: false, blockedReason: `Não foi possível verificar se a app pode emitir (${reason}). Não emita à mão sem confirmar.`, nearbyManual: [] });
      });
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
  const candidates = gate.candidates || [];
  const suggested = candidates.find(candidate => candidate.key === gate.suggestedKey) || null;
  // With one clear match the first step is already answered; the admin can still change it.
  const [step, setStep] = useState<1 | 2 | 3>(suggested ? 2 : 1);
  const [selectedKey, setSelectedKey] = useState<string | null>(suggested?.key || null);
  const [donor, setDonor] = useState<Partial<DonorIdentity>>(suggested ? identityOf(suggested) : { country: 'PT' });
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<DonorCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Partial<DonorIdentity> | null>(null);

  // Debounced, read-only lookup in FACT.pt itself.
  useEffect(() => {
    const term = searchTerm.trim();
    setSearchError(null);
    if (term.length < 3) { setSearchResults([]); setSearching(false); return; }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      void adminFetch(`/api/admin/contabilidade/movimentos/${movementId}/doacao?procurar=${encodeURIComponent(term)}`)
        .then((body: { results?: DonorCandidate[] }) => { if (active) setSearchResults(body.results || []); })
        .catch(cause => { if (active) setSearchError(cause instanceof Error ? cause.message : 'Falha ao procurar na FACT.pt.'); })
        .finally(() => { if (active) setSearching(false); });
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [searchTerm, movementId]);

  const extraResults = searchResults.filter(result => !candidates.some(candidate => candidate.key === result.key));
  const selected = [...candidates, ...searchResults].find(candidate => candidate.key === selectedKey) || null;
  const generic = selectedKey === GENERIC;
  const missing = missingDonorFields(donor);
  const manualRuledOut = gate.nearbyManual.length === 0 || acknowledged;

  const reset = () => { setConflict(null); setError(null); };
  const choose = (candidate: DonorCandidate) => { setSelectedKey(candidate.key); setDonor(identityOf(candidate)); reset(); setStep(2); };
  const chooseManual = () => { setSelectedKey(MANUAL); setDonor({ country: 'PT' }); reset(); setStep(2); };
  const chooseGeneric = () => { setSelectedKey(GENERIC); reset(); setStep(3); };

  const issue = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/contabilidade/movimentos/${movementId}/doacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generic ? { generic: true, acknowledgeManual: acknowledged } : { donor, acknowledgeManual: acknowledged }),
      });
      onIssued();
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : 'Não foi possível registar a doação.');
      const found = (issueError as { body?: { conflict?: Partial<DonorIdentity> } }).body?.conflict ?? null;
      setConflict(found);
      // A name clash is fixed in the details, so take the admin back there.
      if (found) setStep(2);
    } finally {
      setBusy(false);
    }
  };

  const stateOf = (n: 1 | 2 | 3): StepState => {
    if (n === 2 && generic) return step === 3 ? 'done' : 'todo';
    return step === n ? 'active' : step > n ? 'done' : 'todo';
  };
  const whoSummary = generic ? 'Consumidor final (sem dados pessoais)'
    : selectedKey === MANUAL ? 'Pessoa nova'
      : selected ? <><span className="font-medium text-zinc-900">{selected.name}</span>{' '}<span className="text-xs text-zinc-500">· {selected.source === 'factpt' ? `cliente FACT.pt${selected.factptClientId ? ` #${selected.factptClientId}` : ''}` : 'doação no site'}</span></> : null;

  return (
    <Steps>
      {/* 1 — who */}
      <Step n={1} title="Quem fez esta doação?" state={stateOf(1)} onEdit={() => setStep(1)} editDisabled={busy} summary={whoSummary}>
        {gate.payerName && (
          <p className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
            <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>No extrato: <span className="font-semibold text-zinc-800">{gate.payerName}</span> <span className="text-zinc-400">(o banco pode cortar o nome)</span></span>
          </p>
        )}
        {candidates.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Pessoas com este nome</p>
            {candidates.map(candidate => (
              <ChoiceCard key={candidate.key} selected={selectedKey === candidate.key} disabled={disabled || busy}
                tone={candidate.match === 'partial' ? 'attention' : 'neutral'} onSelect={() => choose(candidate)}>
                <CandidateBody candidate={candidate} />
              </ChoiceCard>
            ))}
            {!suggested && <p className="text-xs text-orange-700">Nenhuma pessoa tem o nome completo do extrato, por isso nada foi escolhido por si.</p>}
          </div>
        ) : (
          <p className="rounded-xl bg-zinc-50 px-3.5 py-3 text-xs text-zinc-500">Ninguém com este nome na FACT.pt nem nas doações do site. Procure ou crie uma pessoa nova.</p>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Procurar na FACT.pt</p>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
            <input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Nome, email ou NIF do cliente"
              disabled={disabled || busy}
              className="h-11 w-full rounded-xl bg-white pl-9 pr-9 text-sm text-zinc-900 ring-1 ring-zinc-200 transition placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
            />
            {searching
              ? <LoaderCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" aria-hidden />
              : searchTerm && <button type="button" onClick={() => setSearchTerm('')} aria-label="Limpar pesquisa" className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"><X className="h-3.5 w-3.5" /></button>}
          </label>
          {searchError && <p className="text-xs text-rose-700">{searchError}</p>}
          {!searching && searchTerm.trim().length >= 3 && !searchError && searchResults.length === 0 && (
            <p className="text-xs text-zinc-500">Nenhum cliente encontrado na FACT.pt.</p>
          )}
          {extraResults.map(result => (
            <ChoiceCard key={result.key} selected={selectedKey === result.key} disabled={disabled || busy} onSelect={() => choose(result)}>
              <CandidateBody candidate={result} />
            </ChoiceCard>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={chooseManual} disabled={disabled || busy}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-white p-3 text-left text-sm border border-dashed border-zinc-300 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50">
            <UserPen className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
            <span><span className="block font-medium text-zinc-900">Pessoa nova</span><span className="text-xs text-zinc-500">Preencher os dados à mão</span></span>
          </button>
          {gate.genericAllowed && (
            <button type="button" onClick={chooseGeneric} disabled={disabled || busy}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-white p-3 text-left text-sm ring-1 ring-zinc-200 transition hover:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50">
              <UserRound className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
              <span><span className="block font-medium text-zinc-900">Não sabemos quem é</span><span className="text-xs text-zinc-500">FR para Consumidor final, sem dados</span></span>
            </button>
          )}
        </div>
        {!gate.genericAllowed && <p className="text-xs text-zinc-400">Acima de 100 € a lei exige nome e morada: sem estes dados, peça-os à pessoa antes de emitir.</p>}
      </Step>

      {/* 2 — the details printed on the FR */}
      <Step
        n={2}
        title="Dados na fatura-recibo"
        state={stateOf(2)}
        onEdit={() => setStep(2)}
        editDisabled={busy}
        summary={generic ? 'Sem dados pessoais' : <span className="text-xs text-zinc-500">{[donor.nif ? `NIF ${donor.nif}` : 'Sem NIF', donor.email, [donor.city, donor.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</span>}
      >
        {selected?.match === 'partial' && (
          <p className="rounded-xl bg-orange-50 px-3.5 py-3 text-xs text-orange-800">
            Só parte do nome coincide com o extrato ({gate.payerName}). Confirme que é a mesma pessoa.
          </p>
        )}
        {selected?.source === 'factpt' && (
          <p className="text-xs text-zinc-500">
            {selected.nif
              ? `Dados da ficha FACT.pt. Com NIF, a FACT.pt usa sempre a ficha do cliente com o NIF ${selected.nif}.`
              : 'Dados da ficha FACT.pt deste cliente. Se mudar o nome ou o email, a FACT.pt pode criar outro cliente.'}
          </p>
        )}
        {selected?.source === 'donation' && <p className="text-xs text-zinc-500">Dados de uma doação feita no site. Confirme que continuam certos.</p>}
        {selectedKey === MANUAL && <p className="text-xs text-zinc-500">Será criado um cliente novo na FACT.pt com estes dados.</p>}

        <div className="grid grid-cols-2 gap-2">
          {FIELDS.map(field => (
            <label key={field.key} className={cx('block', !field.half && 'col-span-2')}>
              <span className="mb-1 block text-xs font-medium text-zinc-600">{field.label}</span>
              <input
                value={donor[field.key] || ''}
                onChange={event => { setDonor(previous => ({ ...previous, [field.key]: event.target.value })); setConflict(null); }}
                placeholder={field.placeholder}
                disabled={disabled || busy}
                className="h-10 w-full rounded-xl bg-zinc-50 px-3 text-sm text-zinc-900 ring-1 ring-transparent transition placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-zinc-300"
              />
            </label>
          ))}
        </div>

        {conflict && (
          <div className="rounded-xl bg-orange-50 p-3 text-sm text-zinc-800">
            <p className="text-xs font-medium text-orange-800">Já existe na FACT.pt um cliente com este nome e outros dados:</p>
            <p className="mt-1 font-semibold">{conflict.name}</p>
            <p className="mt-0.5 text-xs text-zinc-600">{[conflict.email, conflict.address, conflict.zip, conflict.city, conflict.country].filter(Boolean).join(' · ')}</p>
            <p className="mt-2 text-xs text-zinc-500">Se for outra pessoa com o mesmo nome, emita esta FR diretamente na FACT.pt.</p>
            <Button
              variant="secondary"
              className="mt-2 w-full"
              onClick={() => {
                // Blanks in FACT.pt never erase what was typed.
                const known = Object.fromEntries(Object.entries(conflict).filter(([, value]) => value));
                setDonor(previous => ({ ...previous, ...known }));
                reset();
              }}
            >
              É a mesma pessoa: usar estes dados
            </Button>
          </div>
        )}

        {missing.length > 0 && <p className="text-xs text-zinc-500">Falta: {missing.join(', ')}.</p>}
        <Button variant="primary" className="w-full" disabled={disabled || busy || missing.length > 0 || !!conflict} onClick={() => { setError(null); setStep(3); }}>
          Continuar
        </Button>
      </Step>

      {/* 3 — confirm */}
      <Step n={3} title="Confirmar e emitir" state={stateOf(3)}>
        {gate.nearbyManual.length > 0 && (
          <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-orange-50 p-3 text-xs text-orange-800">
            <input type="checkbox" className="mt-0.5" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />
            <span>Há FR emitidas à mão com este valor e data próxima ({gate.nearbyManual.join(', ')}). Verifiquei que não {gate.nearbyManual.length > 1 ? 'pertencem' : 'pertence'} a esta transferência.</span>
          </label>
        )}
        <div className="rounded-xl bg-zinc-50 p-3 text-[13px] leading-relaxed text-zinc-700">
          {generic ? (
            <>Fatura-recibo da série 2026D de <strong className="text-zinc-900">{formatEur(amount)}</strong> para <strong className="text-zinc-900">Consumidor final</strong>, sem dados da pessoa. Não segue por email: fica guardada em Faturação.</>
          ) : (
            <>Fatura-recibo da série 2026D de <strong className="text-zinc-900">{formatEur(amount)}</strong> para <strong className="text-zinc-900">{donor.name}</strong>{donor.nif ? ` (NIF ${donor.nif})` : ''}, enviada para <strong className="text-zinc-900">{donor.email}</strong>.</>
          )}
          <span className="mt-1 block text-xs text-zinc-500">Uma fatura emitida não se apaga.</span>
        </div>
        {error && !conflict && <p className="rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{error}</p>}
        <Button variant="primary" size="lg" className="w-full" disabled={disabled || busy || !manualRuledOut || (!generic && missing.length > 0)} onClick={() => void issue()}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          {busy ? 'A emitir…' : 'Emitir FR'}
        </Button>
      </Step>
    </Steps>
  );
}
