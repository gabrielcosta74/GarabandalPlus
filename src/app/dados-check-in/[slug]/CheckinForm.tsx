'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, CheckCircle2, FileText, Loader2, LockKeyhole } from 'lucide-react';

type FormFields = {
  full_name: string;
  nationality: string;
  document_type: 'citizen_card' | 'passport';
  document_number: string;
  document_issued_on: string;
  document_expires_on: string;
  birth_date: string;
  full_address: string;
  postal_code: string;
  city: string;
  phone: string;
  email: string;
  privacy_consent: boolean;
  website: string;
};

const initialFields: FormFields = {
  full_name: '',
  nationality: '',
  document_type: 'citizen_card',
  document_number: '',
  document_issued_on: '',
  document_expires_on: '',
  birth_date: '',
  full_address: '',
  postal_code: '',
  city: '',
  phone: '',
  email: '',
  privacy_consent: false,
  website: '',
};

const inputClass = 'mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10';
const labelClass = 'block text-sm font-semibold text-slate-800';

export default function CheckinForm({ slug, title, englishTitle, dateLabel }: { slug: string; title: string; englishTitle: string; dateLabel: string }) {
  const [fields, setFields] = useState<FormFields>(initialFields);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);

  const update = <K extends keyof FormFields>(key: K, value: FormFields[K]) => {
    setFields((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch(`/api/checkin/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Não foi possível enviar os dados. / We could not submit your details.');
      setComplete(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Não foi possível enviar os dados. / We could not submit your details.');
    } finally {
      setSubmitting(false);
    }
  };

  if (complete) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 sm:py-16">
        <div className="mx-auto max-w-xl rounded-3xl border border-emerald-200 bg-white p-7 text-center shadow-sm sm:p-10">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" aria-hidden="true" />
          <h1 className="mt-5 font-serif text-3xl font-bold text-slate-900">Dados enviados / Details submitted</h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Recebemos os seus dados para <strong>{title}</strong>. Não precisa de voltar a preencher este formulário.
            <span className="mt-2 block">We have received your details for <strong>{englishTitle}</strong>. You do not need to complete this form again.</span>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <header className="rounded-3xl bg-slate-900 px-5 py-7 text-white shadow-lg sm:px-9 sm:py-9">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
            <FileText className="h-4 w-4" aria-hidden="true" />
            Dados para check-in nos hotéis / Hotel check-in details
          </div>
          <h1 className="mt-3 font-serif text-2xl font-bold leading-tight sm:text-4xl">{title} / {englishTitle}</h1>
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-300 sm:text-base">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
            {dateLabel}
          </p>
        </header>

        <form onSubmit={submit} className="mt-5 space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-9">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Dados pessoais / Personal details</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Preencha os dados exatamente como aparecem no documento de identificação. / Enter the details exactly as shown on your identification document.</p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className={`${labelClass} sm:col-span-2`}>
              Nome completo / Full Name
              <input className={inputClass} required autoComplete="name" value={fields.full_name} onChange={(event) => update('full_name', event.target.value)} />
            </label>

            <label className={labelClass}>
              Nacionalidade / Nationality
              <input className={inputClass} required autoComplete="country-name" value={fields.nationality} onChange={(event) => update('nationality', event.target.value)} />
            </label>

            <label className={labelClass}>
              Data de nascimento / Date of Birth
              <input className={inputClass} type="date" required autoComplete="bday" value={fields.birth_date} onChange={(event) => update('birth_date', event.target.value)} />
            </label>
          </div>

          <div className="border-t border-slate-200 pt-5">
            <h2 className="text-lg font-bold text-slate-900">Documento de identificação / Identification document</h2>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className={labelClass}>
              Tipo de documento / Document Type
              <select className={inputClass} required value={fields.document_type} onChange={(event) => update('document_type', event.target.value as FormFields['document_type'])}>
                <option value="citizen_card">Cartão de cidadão / Citizen Card</option>
                <option value="passport">Passaporte / Passport</option>
              </select>
            </label>

            <label className={labelClass}>
              Número do documento / Document Number
              <input className={inputClass} required autoComplete="off" value={fields.document_number} onChange={(event) => update('document_number', event.target.value)} />
            </label>

            <label className={labelClass}>
              Data de emissão / Date of Issue
              <input className={inputClass} type="date" required value={fields.document_issued_on} onChange={(event) => update('document_issued_on', event.target.value)} />
            </label>

            <label className={labelClass}>
              Data de validade / Expiry Date
              <input className={inputClass} type="date" required value={fields.document_expires_on} onChange={(event) => update('document_expires_on', event.target.value)} />
            </label>
          </div>

          <div className="border-t border-slate-200 pt-5">
            <h2 className="text-lg font-bold text-slate-900">Contacto e morada / Contact and address</h2>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className={`${labelClass} sm:col-span-2`}>
              Endereço completo / Full Address
              <input className={inputClass} required autoComplete="street-address" value={fields.full_address} onChange={(event) => update('full_address', event.target.value)} />
            </label>

            <label className={labelClass}>
              Código postal / Postal Code
              <input className={inputClass} required autoComplete="postal-code" value={fields.postal_code} onChange={(event) => update('postal_code', event.target.value)} />
            </label>

            <label className={labelClass}>
              Localidade / City
              <input className={inputClass} required autoComplete="address-level2" value={fields.city} onChange={(event) => update('city', event.target.value)} />
            </label>

            <label className={labelClass}>
              Número de telefone / Phone Number
              <input className={inputClass} type="tel" required autoComplete="tel" value={fields.phone} onChange={(event) => update('phone', event.target.value)} />
            </label>

            <label className={labelClass}>
              Email
              <input className={inputClass} type="email" required autoComplete="email" value={fields.email} onChange={(event) => update('email', event.target.value)} />
            </label>
          </div>

          <div className="hidden" aria-hidden="true">
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" value={fields.website} onChange={(event) => update('website', event.target.value)} />
            </label>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            <input
              type="checkbox"
              required
              checked={fields.privacy_consent}
              onChange={(event) => update('privacy_consent', event.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-slate-900"
            />
            <span>
              Confirmo que os dados estão corretos e autorizo a sua utilização para organizar a peregrinação e efetuar o check-in nos hotéis. / I confirm that the details are correct and consent to their use for organising the pilgrimage and hotel check-in. Consulte a / See the{' '}
              <Link href="/privacidade" target="_blank" className="font-semibold underline underline-offset-2">Política de Privacidade / Privacy Policy</Link>.
            </span>
          </label>

          {error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-4 text-base font-bold text-slate-950 shadow-sm transition hover:bg-amber-400 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
            {submitting ? 'A enviar... / Submitting...' : 'Enviar dados / Submit details'}
          </button>

          <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-500">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
            Os dados são enviados de forma segura e ficam acessíveis apenas à organização. / Your details are sent securely and are accessible only to the organisation.
          </p>
        </form>
      </div>
    </main>
  );
}
