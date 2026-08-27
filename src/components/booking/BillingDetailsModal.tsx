"use client";

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Loader2, ReceiptText, X } from 'lucide-react';

import {
  fiscalBillingErrorMessage,
  fiscalBillingMissingFields,
  normalizeFiscalBilling,
  type FiscalBillingDetails,
} from '../../lib/fiscal-billing';
import {
  formatPostalCode,
  getPostalInputMode,
  listCountryOptions,
  resolveCountryMeta,
} from '../../lib/country-utils';

type BillingDetailsModalProps = {
  isOpen: boolean;
  isEnglish: boolean;
  initialValue: FiscalBillingDetails | null;
  submitting?: boolean;
  description?: string;
  /** Defaults to "Confirm and continue", which only fits the pay/upload flows. */
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (billing: FiscalBillingDetails) => void;
};

const EMPTY_BILLING: FiscalBillingDetails = {
  name: '',
  email: '',
  address: '',
  postalCode: '',
  city: '',
  country: '',
  taxIdRequested: false,
  nif: null,
};

export default function BillingDetailsModal({
  isOpen,
  isEnglish,
  initialValue,
  submitting = false,
  description,
  confirmLabel,
  onClose,
  onConfirm,
}: BillingDetailsModalProps) {
  const [form, setForm] = useState<FiscalBillingDetails>(EMPTY_BILLING);
  const [error, setError] = useState<string | null>(null);
  const countryOptions = useMemo(
    () => listCountryOptions(isEnglish ? 'en' : 'pt-PT'),
    [isEnglish],
  );
  const countryMeta = useMemo(
    () => resolveCountryMeta(form.country),
    [form.country],
  );
  const taxLabel = form.country === 'BR'
    ? 'CPF'
    : form.country === 'PT'
      ? 'NIF'
      : isEnglish ? 'Tax ID' : 'NIF/CPF';

  useEffect(() => {
    if (!isOpen) return;
    setForm(initialValue || EMPTY_BILLING);
    setError(null);
  }, [initialValue, isOpen]);

  const update = <K extends keyof FiscalBillingDetails>(
    key: K,
    value: FiscalBillingDetails[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const handleConfirm = () => {
    const normalized = normalizeFiscalBilling(form);
    const missing = fiscalBillingMissingFields(normalized);
    if (missing.length > 0) {
      setError(fiscalBillingErrorMessage(missing, isEnglish, normalized.country));
      return;
    }
    onConfirm(normalized);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button
            type="button"
            aria-label={isEnglish ? 'Close billing details' : 'Fechar dados da fatura'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[110] cursor-default bg-slate-950/80 backdrop-blur-sm"
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="billing-details-title"
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.98 }}
            className="fixed inset-x-0 bottom-0 z-[111] flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:inset-x-4 sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px]"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <ReceiptText className="h-5 w-5" />
                </span>
                <div>
                  <h2 id="billing-details-title" className="text-xl font-bold text-slate-950">
                    {isEnglish ? 'Invoice details' : 'Dados da fatura'}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    {description || (isEnglish
                      ? 'The invoice-receipt is always issued to the booking holder.'
                      : 'A Fatura‑Recibo é sempre emitida ao titular da reserva.')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="overflow-y-auto px-5 py-5 sm:px-7">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">
                    {isEnglish ? 'Full name' : 'Nome completo'}
                  </span>
                  <input
                    value={form.name}
                    onChange={(event) => update('name', event.target.value)}
                    autoComplete="name"
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100"
                  />
                </label>

                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => update('email', event.target.value)}
                    autoComplete="email"
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100"
                  />
                </label>

                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">
                    {isEnglish ? 'Billing address' : 'Morada'}
                  </span>
                  <input
                    value={form.address}
                    onChange={(event) => update('address', event.target.value)}
                    autoComplete="street-address"
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">
                    {isEnglish ? 'Postal code' : 'Código postal'}
                  </span>
                  <input
                    value={form.postalCode}
                    onChange={(event) => update(
                      'postalCode',
                      formatPostalCode(event.target.value, form.country),
                    )}
                    inputMode={getPostalInputMode(form.country)}
                    autoComplete="postal-code"
                    placeholder={countryMeta?.postalPlaceholder}
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">
                    {isEnglish ? 'City' : 'Cidade'}
                  </span>
                  <input
                    value={form.city}
                    onChange={(event) => update('city', event.target.value)}
                    autoComplete="address-level2"
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100"
                  />
                </label>

                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">
                    {isEnglish ? 'Country' : 'País'}
                  </span>
                  <select
                    value={form.country}
                    onChange={(event) => {
                      update('country', event.target.value);
                      update('postalCode', '');
                    }}
                    autoComplete="country"
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-950 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100"
                  >
                    <option value="">
                      {isEnglish ? 'Select country' : 'Seleciona o país'}
                    </option>
                    {countryOptions.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex cursor-pointer items-start justify-between gap-4">
                  <span>
                    <span className="block text-sm font-bold text-slate-900">
                      {isEnglish ? 'Include NIF/CPF on the invoice' : 'Incluir NIF/CPF na fatura'}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                      {isEnglish
                        ? 'Optional. Without it, the invoice-receipt is issued as Final Consumer.'
                        : 'Opcional. Sem contribuinte, a Fatura‑Recibo é emitida a Consumidor final.'}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.taxIdRequested}
                    onChange={(event) => update('taxIdRequested', event.target.checked)}
                    className="mt-1 h-5 w-5 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                  />
                </label>

                {form.taxIdRequested && (
                  <label className="mt-4 block space-y-1.5">
                    <span className="text-sm font-semibold text-slate-700">{taxLabel}</span>
                    <input
                      value={form.nif || ''}
                      onChange={(event) => update('nif', event.target.value)}
                      inputMode="numeric"
                      autoComplete="off"
                      className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                    />
                  </label>
                )}
              </div>

              {error && (
                <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </p>
              )}
            </div>

            <footer className="border-t border-slate-100 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-7 sm:pb-6">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting}
                className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-base font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Check className="h-5 w-5" />
                )}
                {confirmLabel || (isEnglish ? 'Confirm and continue' : 'Confirmar e continuar')}
              </button>
            </footer>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}
