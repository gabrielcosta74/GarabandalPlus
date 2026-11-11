"use client";

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, LoaderCircle, Search, X } from 'lucide-react';

import { formatEur } from '../../../lib/ledger/format';
import { ChoiceCard, Pill, Step, Steps, type StepState } from './Steps';
import { adminFetch } from './useLedger';
import { Button, cx } from './ui';

type Suggestion = {
  pilgrimageId: string; pilgrimageTitle: string; bookingId: string; holderName: string | null; pilgrims: string[];
  paymentId: string | null; paymentStatus: string | null; confidence: 'certain' | 'likely' | 'possible'; reason: string;
};
type SearchResult = {
  id: string; status: string; pilgrimageId: string; pilgrimageTitle: string; startDate: string | null;
  holderName: string | null; pilgrims: string[]; totalAmount: number; paidAmount: number;
};
/** What step 1 chose, shown folded while the admin works on the next steps. */
type Picked = { bookingId: string; pilgrimageId: string; pilgrimageTitle: string; name: string; pilgrims: string[] };
type Payment = { id: string; amount: number; method: string; status: string; createdAt: string; deleted: boolean; billingName: string | null; linkedToBankMovement: boolean };
type Booking = {
  id: string; status: string; holderName: string | null; totalAmount: number; paidAmount: number;
  pilgrims: { id: string; full_name: string }[]; payments: Payment[];
};
type HolderPreview = {
  holder: { name: string; email: string; nif: string | null; address: string | null; zip: string | null; city: string | null; country: string | null } | null;
  basis: 'payment' | 'account' | 'pilgrim' | 'none';
  problem: string | null;
  lastInvoice: { number: string | null; issuedAt: string | null; name: string | null; nif: string | null } | null;
  sameAsLast: boolean | null;
};
type Option = { id: string; kind: 'link' | 'confirm' | 'new'; title: string; detail: string; blocked: string | null; hint?: string };

const CANCELLED = ['canceled', 'cancelled'];
const day = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-PT') : '');
const tripLabel = (title: string, start: string | null) => `${title.replace(/\s+-\s+/g, ' – ').replace(/\s{2,}/g, ' ')}${start ? ` · ${day(start)}` : ''}`;

export default function PilgrimageTransferField({ movementId, amount, disabled, blockedReason, expectedPaymentId, manualPendingPaymentIds, nearbyIssuedCount, onRegistered }: {
  movementId: string; amount: number; disabled: boolean; blockedReason: string | null;
  expectedPaymentId: string | null; manualPendingPaymentIds: string[]; nearbyIssuedCount: number;
  onRegistered: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [paymentId, setPaymentId] = useState('');
  const [holder, setHolder] = useState<HolderPreview | null>(null);
  const [holderLoading, setHolderLoading] = useState(false);
  const [holderError, setHolderError] = useState<string | null>(null);
  const [acknowledgeNearby, setAcknowledgeNearby] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** A suggestion may already name the payment: it is chosen once the booking loads. */
  const wantedPayment = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void adminFetch(`/api/admin/contabilidade/movimentos/${movementId}/sugestoes`)
      .then(body => { if (active) setSuggestions(body.suggestions || []); })
      .catch(() => { /* suggestions are optional; the search still works */ });
    return () => { active = false; };
  }, [movementId]);

  // Debounced search across every pilgrimage, by pilgrim or account holder name.
  useEffect(() => {
    const term = query.trim();
    setSearchError(null);
    if (term.length < 3) { setResults([]); setSearching(false); return; }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      void adminFetch(`/api/admin/contabilidade/peregrinacoes?procurar=${encodeURIComponent(term)}`)
        .then((body: { results?: SearchResult[] }) => { if (active) setResults(body.results || []); })
        .catch(cause => { if (active) setSearchError(cause instanceof Error ? cause.message : 'Falha ao procurar reservas.'); })
        .finally(() => { if (active) setSearching(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  // The chosen booking with its payments and which already have a bank movement.
  useEffect(() => {
    setBooking(null);
    if (!picked) return;
    let active = true;
    setBookingLoading(true);
    setError(null);
    void adminFetch(`/api/admin/contabilidade/peregrinacoes?reserva=${encodeURIComponent(picked.bookingId)}&amount=${encodeURIComponent(amount)}`)
      .then((body: { bookings?: Booking[] }) => { if (active) setBooking(body.bookings?.[0] || null); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Falha ao carregar a reserva.'); })
      .finally(() => { if (active) setBookingLoading(false); });
    return () => { active = false; };
  }, [picked, amount]);

  const sameAmount = (booking?.payments || []).filter(payment =>
    !payment.deleted && payment.method === 'bank_transfer' && Math.round(payment.amount * 100) === Math.round(amount * 100),
  );
  const unlinked = sameAmount.filter(payment => !payment.linkedToBankMovement);
  const pending = unlinked.filter(payment => ['pending', 'pending_verification', 'verifying'].includes(payment.status));
  // Registered on the pilgrimage page already (FR issued there): only link it.
  const registered = unlinked.filter(payment => ['verified', 'manual', 'succeeded', 'paid'].includes(payment.status));
  const linkedEarlier = sameAmount.filter(payment => payment.linkedToBankMovement);
  const unlinkedOther = unlinked.filter(payment => !pending.includes(payment) && !registered.includes(payment));
  const activeBooking = !!booking && !CANCELLED.includes(booking.status.toLowerCase());
  const overBalance = !!booking && booking.totalAmount > 0 && booking.paidAmount + amount > booking.totalAmount + 0.01;

  const options: Option[] = !booking ? [] : [
    ...registered.map(payment => ({
      id: payment.id, kind: 'link' as const,
      title: `Pagamento já registado de ${formatEur(payment.amount)}`,
      detail: `Registado a ${day(payment.createdAt)} na página da peregrinação, com FR emitida. Só liga este movimento — não cria nem emite nada.`,
      blocked: expectedPaymentId && expectedPaymentId !== payment.id ? 'Há outro pagamento mais provável para este movimento.'
        : manualPendingPaymentIds.length ? 'Há prestações pendentes semelhantes; escolha uma delas.' : null,
    })),
    ...pending.map(payment => ({
      id: payment.id, kind: 'confirm' as const,
      title: `Pagamento pendente de ${formatEur(payment.amount)}`,
      detail: `Criado a ${day(payment.createdAt)} à espera da transferência. Confirma-o e pede a FR à FACT.pt.`,
      hint: expectedPaymentId === payment.id ? 'Correspondência provável' : undefined,
      blocked: expectedPaymentId && expectedPaymentId !== payment.id ? 'Há outro pagamento mais provável para este movimento.'
        : manualPendingPaymentIds.length && !manualPendingPaymentIds.includes(payment.id) ? 'Não é uma das prestações candidatas.'
          : overBalance ? 'Excede o que falta pagar nesta reserva.' : null,
    })),
    {
      id: 'new', kind: 'new' as const,
      title: `Nova prestação de ${formatEur(amount)}`,
      detail: 'Cria o pagamento na reserva e pede a FR à FACT.pt.',
      blocked: unlinked.length ? 'Já existe um pagamento deste valor sem movimento — escolha-o acima.'
        : expectedPaymentId ? 'Há um pagamento provável para este movimento — escolha-o.'
          : manualPendingPaymentIds.length ? 'Há prestações pendentes semelhantes — escolha uma delas.'
            : overBalance ? 'Excede o que falta pagar nesta reserva.' : null,
    },
  ];
  const chosen = options.find(option => option.id === paymentId) || null;
  const usable = options.filter(option => !option.blocked);

  // A suggestion that names its payment goes straight to the last step. A new
  // payment is never chosen for the admin: that is always an explicit click.
  const usableIds = usable.map(option => option.id).join(',');
  useEffect(() => {
    const wanted = wantedPayment.current;
    if (!booking || !wanted) return;
    wantedPayment.current = null;
    if (activeBooking && usableIds.split(',').includes(wanted)) { setPaymentId(wanted); setStep(3); }
  }, [booking, activeBooking, usableIds]);

  // Who the FR goes to, read with the same rules as the FR itself. A pending
  // payment may carry billing data typed at checkout, so it is part of the key.
  const holderPaymentId = chosen?.kind === 'confirm' ? chosen.id : null;
  const holderBookingId = booking?.id || null;
  useEffect(() => {
    setHolder(null);
    setHolderError(null);
    if (!holderBookingId) return;
    let active = true;
    setHolderLoading(true);
    void adminFetch(`/api/admin/contabilidade/peregrinacoes?titular=${encodeURIComponent(holderBookingId)}${holderPaymentId ? `&paymentId=${encodeURIComponent(holderPaymentId)}` : ''}`)
      .then((body: HolderPreview) => { if (active) setHolder(body); })
      .catch(cause => { if (active) setHolderError(cause instanceof Error ? cause.message : 'Falha ao ler o titular da reserva.'); })
      .finally(() => { if (active) setHolderLoading(false); });
    return () => { active = false; };
  }, [holderBookingId, holderPaymentId]);

  const holderReady = !!holder?.holder && !holder.problem;
  const linking = chosen?.kind === 'link';
  const canSubmit = !!chosen && !chosen.blocked && activeBooking && !disabled && !saving
    && (linking || (holderReady && (!nearbyIssuedCount || acknowledgeNearby)));

  const choose = (next: Picked, payment: string | null) => {
    wantedPayment.current = payment;
    setPicked(next);
    setPaymentId('');
    setAcknowledgeNearby(false);
    setError(null);
    setStep(2);
  };

  const register = async () => {
    if (!canSubmit || !booking || !chosen) return;
    setSaving(true);
    setError(null);
    let done = false;
    try {
      await adminFetch(`/api/admin/contabilidade/movimentos/${movementId}/peregrinacao`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, paymentId: chosen.kind === 'new' ? null : chosen.id, acknowledgeNearby: linking || acknowledgeNearby }),
      });
      done = true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registar o pagamento.');
    } finally {
      setSaving(false);
    }
    if (done) onRegistered();
  };

  const stateOf = (n: 1 | 2 | 3): StepState => (step === n ? 'active' : step > n ? 'done' : 'todo');
  const remaining = booking ? Math.max(0, booking.totalAmount - booking.paidAmount) : 0;

  return (
    <div className="space-y-3 text-sm text-zinc-700">
      {blockedReason && <p className="rounded-xl bg-orange-50 px-3.5 py-3 text-sm text-orange-800">{blockedReason}</p>}
      <Steps>
        {/* 1 — which booking */}
        <Step
          n={1}
          title="De que reserva é este pagamento?"
          state={stateOf(1)}
          onEdit={() => setStep(1)}
          editDisabled={saving}
          summary={picked && <>
            <span className="font-medium text-zinc-900">{picked.name}</span>
            <span className="block text-xs text-zinc-500">{picked.pilgrimageTitle}</span>
          </>}
        >
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Sugestões</p>
              {suggestions.map(item => (
                <ChoiceCard
                  key={`${item.bookingId}-${item.paymentId || 'new'}`}
                  selected={picked?.bookingId === item.bookingId}
                  disabled={disabled}
                  onSelect={() => choose({
                    bookingId: item.bookingId, pilgrimageId: item.pilgrimageId, pilgrimageTitle: item.pilgrimageTitle,
                    name: item.holderName || item.pilgrims[0] || 'Reserva', pilgrims: item.pilgrims,
                  }, item.paymentId)}
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-zinc-900">{item.holderName || item.pilgrims[0] || 'Reserva'}</span>
                    <Pill tone={item.confidence === 'certain' ? 'good' : item.confidence === 'likely' ? 'info' : 'neutral'}>
                      {item.confidence === 'certain' ? 'Muito provável' : item.confidence === 'likely' ? 'Provável' : 'Possível'}
                    </Pill>
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">{item.pilgrimageTitle}</span>
                  {item.pilgrims.length > 1 && <span className="block text-xs text-zinc-500">Peregrinos: {item.pilgrims.join(', ')}</span>}
                  <span className="mt-0.5 block text-xs text-zinc-400">{item.reason}</span>
                </ChoiceCard>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {suggestions.length > 0 && <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Ou procure</p>}
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Nome do peregrino ou de quem fez a reserva"
                disabled={disabled}
                autoFocus={suggestions.length === 0}
                className="h-11 w-full rounded-xl bg-white pl-9 pr-9 text-sm text-zinc-900 ring-1 ring-zinc-200 transition placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
              />
              {searching
                ? <LoaderCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" aria-hidden />
                : query && <button type="button" onClick={() => setQuery('')} aria-label="Limpar pesquisa" className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"><X className="h-3.5 w-3.5" /></button>}
            </label>
            <p className="text-xs text-zinc-400">Procura em todas as peregrinações. O nome no extrato pode ser de outra pessoa da família.</p>
            {searchError && <p className="text-xs text-rose-700">{searchError}</p>}
            {!searching && query.trim().length >= 3 && !searchError && results.length === 0 && (
              <p className="rounded-xl bg-zinc-50 px-3.5 py-3 text-xs text-zinc-500">Nenhuma reserva com este nome. Experimente só o apelido ou o nome de outro peregrino.</p>
            )}
            {results.map(result => {
              const cancelled = CANCELLED.includes(result.status.toLowerCase());
              const name = result.holderName || result.pilgrims[0] || 'Sem nome';
              return (
                <ChoiceCard
                  key={result.id}
                  selected={picked?.bookingId === result.id}
                  disabled={disabled || cancelled}
                  onSelect={() => choose({
                    bookingId: result.id, pilgrimageId: result.pilgrimageId, pilgrimageTitle: tripLabel(result.pilgrimageTitle, result.startDate),
                    name, pilgrims: result.pilgrims,
                  }, null)}
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-zinc-900">{name}</span>
                    {cancelled && <Pill tone="attention">Cancelada</Pill>}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">{tripLabel(result.pilgrimageTitle, result.startDate)}</span>
                  <span className="block text-xs text-zinc-500">
                    {result.pilgrims.length ? `Peregrinos: ${result.pilgrims.join(', ')}` : 'Sem peregrinos'}
                    {result.totalAmount > 0 && ` · pago ${formatEur(result.paidAmount)} de ${formatEur(result.totalAmount)}`}
                  </span>
                </ChoiceCard>
              );
            })}
          </div>
        </Step>

        {/* 2 — which payment this transfer settles */}
        <Step
          n={2}
          title="Que pagamento é?"
          state={stateOf(2)}
          onEdit={() => setStep(2)}
          editDisabled={saving}
          summary={chosen && <span className="font-medium text-zinc-900">{chosen.title}</span>}
        >
          {bookingLoading && <p className="flex items-center gap-2 text-zinc-500"><LoaderCircle className="h-4 w-4 animate-spin" /> A carregar a reserva…</p>}
          {booking && <>
            <div className="rounded-xl bg-zinc-50 p-3">
              <div className="flex items-baseline justify-between gap-2 text-xs text-zinc-500">
                <span>Pago até agora</span>
                <span><span className="font-semibold text-zinc-900">{formatEur(booking.paidAmount)}</span>{booking.totalAmount > 0 && <> de {formatEur(booking.totalAmount)}</>}</span>
              </div>
              {booking.totalAmount > 0 && (
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-zinc-200" aria-hidden>
                  <span className="bg-emerald-600" style={{ width: `${Math.min(100, (booking.paidAmount / booking.totalAmount) * 100)}%` }} />
                  <span className={overBalance ? 'bg-orange-400' : 'bg-emerald-300'} style={{ width: `${Math.min(100 - Math.min(100, (booking.paidAmount / booking.totalAmount) * 100), (amount / booking.totalAmount) * 100)}%` }} />
                </div>
              )}
              <div className="mt-2 flex items-baseline justify-between gap-2 text-xs text-zinc-500">
                <span>Esta transferência</span>
                <span className="font-semibold text-emerald-700">+ {formatEur(amount)}</span>
              </div>
              {booking.totalAmount > 0 && (
                <p className={cx('mt-1 text-right text-xs', overBalance ? 'font-medium text-orange-700' : 'text-zinc-500')}>
                  {overBalance ? `Excede o que falta pagar (${formatEur(remaining)}).` : `Fica a faltar ${formatEur(Math.max(0, remaining - amount))}.`}
                </p>
              )}
            </div>

            {!activeBooking && <p className="rounded-xl bg-orange-50 px-3.5 py-3 text-orange-800">Esta reserva está cancelada. Escolha outra reserva.</p>}

            {activeBooking && <div className="space-y-2">
              {options.map(option => (
                <ChoiceCard
                  key={option.id}
                  selected={paymentId === option.id}
                  disabled={disabled || !!option.blocked}
                  onSelect={() => { setPaymentId(option.id); setAcknowledgeNearby(false); setError(null); setStep(3); }}
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-zinc-900">{option.title}</span>
                    {option.kind === 'link' && <Pill tone="good">FR já emitida</Pill>}
                    {option.hint && <Pill tone="info">{option.hint}</Pill>}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">{option.blocked || option.detail}</span>
                </ChoiceCard>
              ))}
              {linkedEarlier.length > 0 && <p className="text-xs text-zinc-500">{linkedEarlier.length === 1 ? 'Uma prestação' : `${linkedEarlier.length} prestações`} deste valor já {linkedEarlier.length === 1 ? 'está ligada' : 'estão ligadas'} a outros movimentos — pode ser uma prestação nova.</p>}
              {unlinkedOther.length > 0 && <p className="text-xs text-orange-700">Há outro registo deste valor ainda sem movimento bancário (estado {unlinkedOther.map(payment => payment.status).join(', ')}). Reveja-o na reserva antes de criar outro.</p>}
              {expectedPaymentId && !unlinked.some(payment => payment.id === expectedPaymentId) && <p className="text-xs text-orange-700">O pagamento provável para este movimento está noutra reserva. Confirme que escolheu a reserva certa.</p>}
            </div>}
          </>}
        </Step>

        {/* 3 — who the FR goes to, and confirm */}
        <Step n={3} title={linking ? 'Confirmar' : 'Fatura-recibo e confirmar'} state={stateOf(3)}>
          {chosen && booking && <>
            {linking ? (
              <p className="rounded-xl bg-emerald-50 px-3.5 py-3 text-emerald-800">A FR deste pagamento já foi emitida. Ao confirmar, este movimento fica ligado a ele — nada é criado nem emitido.</p>
            ) : (
              <div className="rounded-xl bg-zinc-50 p-3">
                <p className="text-xs font-medium text-zinc-500">A fatura-recibo sai em nome de</p>
                {holderLoading && <p className="mt-1 flex items-center gap-2 text-zinc-500"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> A ler os dados fiscais…</p>}
                {holderError && <p className="mt-1 text-rose-700">{holderError}</p>}
                {holder?.holder && !holder.problem && <>
                  <p className="mt-1 text-[15px] font-semibold text-zinc-900">{holder.holder.name}</p>
                  <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                    <dt className="text-zinc-400">NIF</dt><dd className="text-zinc-700">{holder.holder.nif || 'Sem NIF (consumidor final)'}</dd>
                    <dt className="text-zinc-400">Email</dt><dd className="truncate text-zinc-700">{holder.holder.email}</dd>
                    {(holder.holder.address || holder.holder.city) && <><dt className="text-zinc-400">Morada</dt><dd className="text-zinc-700">{[holder.holder.address, [holder.holder.zip, holder.holder.city].filter(Boolean).join(' '), holder.holder.country?.toUpperCase()].filter(Boolean).join(', ')}</dd></>}
                  </dl>
                  <p className="mt-2 text-[11px] text-zinc-400">
                    {holder.basis === 'payment' ? 'Dados de faturação indicados neste pagamento.'
                      : holder.basis === 'account' ? 'Do perfil da conta que fez a reserva.'
                        : 'Da ficha de peregrino de quem fez a reserva (a conta não tem nome no perfil).'}
                  </p>
                  {holder.lastInvoice && (holder.sameAsLast
                    ? <p className="mt-1 text-xs font-medium text-emerald-700">✓ Igual à última FR desta reserva ({holder.lastInvoice.number})</p>
                    : <p className="mt-1 rounded-lg bg-orange-50 px-2.5 py-2 text-xs text-orange-800">A última FR desta reserva ({holder.lastInvoice.number}) foi para {holder.lastInvoice.name}{holder.lastInvoice.nif ? ` (NIF ${holder.lastInvoice.nif})` : ''}. Confirme que é a pessoa certa.</p>)}
                </>}
                {holder?.problem && <div className="mt-1 space-y-1.5">
                  <p className="font-medium text-orange-800">{holder.problem}</p>
                  <p className="text-xs text-zinc-500">Corrija na reserva e volte aqui. Nada foi criado.</p>
                  <a href={`/admin/peregrinacoes/${picked?.pilgrimageId}?tab=bookings`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-900 underline-offset-2 hover:underline">
                    Abrir inscrições desta peregrinação <ExternalLink className="h-3 w-3" />
                  </a>
                </div>}
              </div>
            )}

            {!linking && !!nearbyIssuedCount && (
              <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-orange-50 p-3 text-xs text-orange-800">
                <input type="checkbox" className="mt-0.5" checked={acknowledgeNearby} onChange={event => setAcknowledgeNearby(event.target.checked)} />
                <span>
                  <span className="font-semibold">Já há {nearbyIssuedCount === 1 ? 'uma FR emitida pela app' : `${nearbyIssuedCount} FR emitidas pela app`} com este valor e data próxima.</span>{' '}
                  Confirmo que esta transferência é um pagamento diferente e precisa de uma FR nova.
                </span>
              </label>
            )}

            <p className="text-[13px] leading-relaxed text-zinc-600">
              {linking
                ? <>Liga <strong className="text-zinc-900">{formatEur(amount)}</strong> ao pagamento já registado de <strong className="text-zinc-900">{picked?.name}</strong>.</>
                : <>Regista <strong className="text-zinc-900">{formatEur(amount)}</strong> na reserva de <strong className="text-zinc-900">{picked?.name}</strong> e pede a FR à FACT.pt{holder?.holder && !holder.problem ? <> em nome de <strong className="text-zinc-900">{holder.holder.name}</strong></> : null}. Uma FR emitida não se apaga.</>}
            </p>
            {error && <p className="rounded-xl bg-rose-50 px-3.5 py-3 text-rose-700">{error}</p>}
            <Button variant="primary" size="lg" className="w-full" disabled={!canSubmit} onClick={() => void register()}>
              {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {linking ? 'Associar ao pagamento' : chosen.kind === 'new' ? 'Registar e emitir FR' : 'Confirmar pagamento e emitir FR'}
            </Button>
            {!linking && <p className="text-center text-[11px] text-zinc-400">Se a FACT.pt falhar, o pedido fica por resolver em Faturação.</p>}
          </>}
        </Step>
      </Steps>
    </div>
  );
}
