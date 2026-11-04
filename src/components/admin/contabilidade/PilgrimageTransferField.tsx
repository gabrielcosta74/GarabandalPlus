"use client";

import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { formatEur } from '../../../lib/ledger/format';
import { normalizeForMatch } from '../../../lib/ledger/classify';
import { adminFetch } from './useLedger';

type Pilgrimage = { id: string; title: string; start_date: string | null };
type Suggestion = {
  pilgrimageId: string; pilgrimageTitle: string; bookingId: string; holderName: string | null; pilgrims: string[];
  paymentId: string | null; paymentStatus: string | null; confidence: 'certain' | 'likely' | 'possible'; reason: string;
};
type Payment = { id: string; amount: number; method: string; status: string; createdAt: string; deleted: boolean; billingName: string | null };
type Booking = {
  id: string; status: string; holderName: string | null; totalAmount: number; paidAmount: number;
  pilgrims: { id: string; full_name: string }[]; payments: Payment[];
};

export default function PilgrimageTransferField({ movementId, amount, disabled, nearbyIssuedCount, onRegistered }: {
  movementId: string; amount: number; disabled: boolean; nearbyIssuedCount: number;
  onRegistered: () => void;
}) {
  const [pilgrimages, setPilgrimages] = useState<Pilgrimage[]>([]);
  const [pilgrimageId, setPilgrimageId] = useState('');
  const [pilgrimageSearch, setPilgrimageSearch] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingId, setBookingId] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [search, setSearch] = useState('');
  const [acknowledgeNearby, setAcknowledgeNearby] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [pick, setPick] = useState<Suggestion | null>(null);

  useEffect(() => {
    let active = true;
    void adminFetch(`/api/admin/contabilidade/movimentos/${movementId}/sugestoes`)
      .then(body => { if (active) setSuggestions(body.suggestions || []); })
      .catch(() => { /* suggestions are optional; the manual search still works */ });
    return () => { active = false; };
  }, [movementId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void adminFetch('/api/admin/contabilidade/peregrinacoes')
      .then(body => { if (active) setPilgrimages(body.pilgrimages || []); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Falha ao carregar peregrinações.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setBookings([]);
    setBookingId('');
    setPaymentId('');
    setSearch('');
    if (!pilgrimageId) return;
    let active = true;
    setLoading(true);
    setError(null);
    void adminFetch(`/api/admin/contabilidade/peregrinacoes?pilgrimageId=${encodeURIComponent(pilgrimageId)}`)
      .then(body => {
        if (!active) return;
        setBookings(body.bookings || []);
        // A suggestion was clicked: select its booking and payment once loaded.
        if (pick && pick.pilgrimageId === pilgrimageId) {
          setBookingId(pick.bookingId);
          setPaymentId(pick.paymentId || 'new');
          setPick(null);
        }
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Falha ao carregar reservas.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [pilgrimageId]);

  const visiblePilgrimages = useMemo(() => pilgrimages.filter(item =>
    normalizeForMatch(item.title).includes(normalizeForMatch(pilgrimageSearch)),
  ), [pilgrimages, pilgrimageSearch]);
  const visible = useMemo(() => bookings.filter(booking =>
    normalizeForMatch(`${booking.holderName || ''} ${booking.pilgrims.map(person => person.full_name).join(' ')} ${booking.id}`)
      .includes(normalizeForMatch(search)),
  ), [bookings, search]);
  const booking = bookings.find(row => row.id === bookingId);
  const sameAmount = (booking?.payments || []).filter(payment =>
    !payment.deleted && payment.method === 'bank_transfer' && Math.round(payment.amount * 100) === Math.round(amount * 100),
  );
  const pending = sameAmount.filter(payment => ['pending', 'pending_verification', 'verifying'].includes(payment.status));
  // Registered on the pilgrimage page already (FR issued there): only link it.
  const registered = sameAmount.filter(payment => ['verified', 'manual', 'succeeded', 'paid'].includes(payment.status));
  const selectedRegistered = registered.find(payment => payment.id === paymentId);
  const selectedPending = pending.find(payment => payment.id === paymentId);
  const fiscalName = selectedPending?.billingName || booking?.holderName;
  const canLink = !!booking && !!selectedRegistered && !disabled && !saving;
  const canRegister = canLink || (!!booking && booking.status !== 'canceled'
    && !!fiscalName
    && (booking.totalAmount <= 0 || booking.paidAmount + amount <= booking.totalAmount + 0.01)
    && (paymentId === 'new' ? sameAmount.length === 0 : pending.some(payment => payment.id === paymentId))
    && (!nearbyIssuedCount || acknowledgeNearby) && !disabled && !saving);

  const register = async () => {
    if (!canRegister || !booking) return;
    setSaving(true);
    setError(null);
    let registered = false;
    try {
      await adminFetch(`/api/admin/contabilidade/movimentos/${movementId}/peregrinacao`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, paymentId: paymentId === 'new' ? null : paymentId, acknowledgeNearby: canLink || acknowledgeNearby }),
      });
      registered = true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registar o pagamento.');
    } finally {
      setSaving(false);
    }
    if (registered) onRegistered();
  };

  return (
    <div className="space-y-3 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-700">
      <p className="font-semibold text-zinc-900">Associar à reserva</p>
      {suggestions.length > 0 && <div className="space-y-2">
        <p className="text-xs font-medium text-zinc-500">Sugestões</p>
        {suggestions.map(item => (
          <button key={`${item.bookingId}-${item.paymentId || 'new'}`} type="button" disabled={disabled}
            onClick={() => { setPick(item); setPilgrimageSearch(''); setSearch(''); setPilgrimageId(item.pilgrimageId); if (item.pilgrimageId === pilgrimageId) { setBookingId(item.bookingId); setPaymentId(item.paymentId || 'new'); } }}
            className="flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-xl bg-white p-3 text-left ring-1 ring-zinc-200 transition-all duration-200 hover:ring-emerald-300 hover:shadow-sm active:scale-[0.99]">
            <span className="flex w-full items-center justify-between gap-2">
              <span className="font-medium text-zinc-900">{item.holderName || item.pilgrims[0] || 'Reserva'}</span>
              <span className={item.confidence === 'certain' ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700'
                : item.confidence === 'likely' ? 'rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700'
                  : 'rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600'}>
                {item.confidence === 'certain' ? 'Muito provável' : item.confidence === 'likely' ? 'Provável' : 'Possível'}
              </span>
            </span>
            <span className="text-xs text-zinc-500">{item.pilgrimageTitle}{item.pilgrims.length ? ` · ${item.pilgrims.join(', ')}` : ''}</span>
            <span className="text-xs text-zinc-400">{item.reason}</span>
          </button>
        ))}
        <p className="pt-1 text-xs text-zinc-400">Ou procure manualmente:</p>
      </div>}
      <p className="text-xs leading-relaxed text-zinc-500">Escolha a peregrinação e a reserva. A FR fica em nome do titular fiscal da reserva; o pagador no banco pode ser outra pessoa.</p>
      <input value={pilgrimageSearch} onChange={event => { setPilgrimageSearch(event.target.value); setPilgrimageId(''); }}
        placeholder="Procurar peregrinação" className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
      <select value={pilgrimageId} onChange={event => setPilgrimageId(event.target.value)} disabled={disabled || loading}
        className="w-full cursor-pointer rounded-xl border border-zinc-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
        <option value="">Escolher peregrinação</option>
        {visiblePilgrimages.map(item => <option key={item.id} value={item.id}>{item.title}{item.start_date ? ` · ${item.start_date.slice(0, 10)}` : ''}</option>)}
      </select>
      {pilgrimageId && <>
        <input value={search} onChange={event => { setSearch(event.target.value); setBookingId(''); setPaymentId(''); }} placeholder="Procurar titular ou peregrino"
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
        <select value={bookingId} onChange={event => { setBookingId(event.target.value); setPaymentId(''); }} disabled={disabled || loading}
          className="w-full cursor-pointer rounded-xl border border-zinc-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
          <option value="">Escolher reserva ({visible.length})</option>
          {visible.map(row => <option key={row.id} value={row.id}>{row.holderName || row.pilgrims[0]?.full_name || 'Sem nome'} · {row.pilgrims.map(person => person.full_name).join(', ') || row.id.slice(0, 8)}</option>)}
        </select>
      </>}
      {booking && <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3">
        <p><strong>Titular fiscal da FR:</strong> {fiscalName || 'Falta nome no perfil da reserva'}</p>
        {!fiscalName && <p className="text-xs text-orange-700">Complete a identificação fiscal do titular na reserva antes de criar o pagamento.</p>}
        <p><strong>Peregrinos:</strong> {booking.pilgrims.map(person => person.full_name).join(', ') || '—'}</p>
        <p><strong>Pago:</strong> {formatEur(booking.paidAmount)} de {formatEur(booking.totalAmount)}</p>
        <p className="text-xs text-zinc-500">Escolha o pagamento que esta transferência liquida. A opção de criar novo exige uma escolha explícita.</p>
        {booking.totalAmount > 0 && booking.paidAmount + amount > booking.totalAmount + 0.01 &&
          <p className="text-xs text-orange-700">Este movimento excede o saldo da reserva. Reveja o valor antes de faturar.</p>}
        {registered.map(payment => <label key={payment.id} className="flex cursor-pointer items-start gap-2 rounded-lg bg-emerald-50 p-2.5 text-emerald-800">
          <input type="radio" name={`payment-${movementId}`} checked={paymentId === payment.id} onChange={() => setPaymentId(payment.id)} />
          <span>Associar ao pagamento já registado de {formatEur(payment.amount)} · {payment.createdAt.slice(0, 10)} <span className="text-emerald-700/80">(FR emitida pela página da peregrinação; não cria nada novo)</span></span>
        </label>)}
        {pending.map(payment => <label key={payment.id} className="flex cursor-pointer items-start gap-2 rounded-lg bg-blue-50 p-2.5 text-blue-800">
          <input type="radio" name={`payment-${movementId}`} checked={paymentId === payment.id} onChange={() => setPaymentId(payment.id)} />
          <span>Verificar pagamento pendente de {formatEur(payment.amount)} · {payment.createdAt.slice(0, 10)}</span>
        </label>)}
        <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-zinc-50 p-2.5">
          <input type="radio" name={`payment-${movementId}`} checked={paymentId === 'new'} onChange={() => setPaymentId('new')} disabled={sameAmount.length > 0} />
          <span>Novo pagamento por transferência{sameAmount.length ? ' · já existe um pagamento igual nesta reserva' : ''}</span>
        </label>

      </div>}
      {!!nearbyIssuedCount && <label className="flex cursor-pointer items-start gap-2 text-xs text-orange-800">
        <input type="checkbox" checked={acknowledgeNearby} onChange={event => setAcknowledgeNearby(event.target.checked)} />
        Confirmei que as FRs da app com valor e data próximos não correspondem a esta transferência.
      </label>}
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <button type="button" disabled={!canRegister} onClick={() => void register()}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
        {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
        {selectedRegistered ? 'Associar ao pagamento' : paymentId === 'new' ? 'Registar pagamento e iniciar FR' : paymentId ? 'Verificar pagamento e iniciar FR' : 'Escolha o pagamento'}
      </button>
      <p className="text-xs text-zinc-500">A FR é processada pelo fluxo FACT.pt do site. Se falhar, ficará por resolver em Faturação.</p>
    </div>
  );
}
