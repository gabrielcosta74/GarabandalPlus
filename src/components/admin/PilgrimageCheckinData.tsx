'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, ExternalLink, FileSpreadsheet, Loader2, Search, Users } from 'lucide-react';
import { getBrowserAccessToken } from '../../lib/supabase-browser';
import { documentTypeLabel } from '../../lib/pilgrimage-checkin';

type Submission = {
  id: number;
  full_name: string;
  nationality: string;
  document_type: string;
  document_number: string;
  document_issued_on: string;
  document_expires_on: string;
  birth_date: string;
  full_address: string;
  postal_code: string;
  city: string;
  phone: string;
  email: string;
  submitted_at: string;
};

type Pilgrimage = {
  title: string;
  slug: string;
  checkin_form_enabled: boolean;
};

function formatDate(value: string) {
  return civilDateFormatter.format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

const civilDateFormatter = new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC' });
const submittedAtFormatter = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' });

export default function PilgrimageCheckinData({ pilgrimageId, slug }: { pilgrimageId: string; slug: string }) {
  const [pilgrimage, setPilgrimage] = useState<Pilgrimage | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [publicUrl, setPublicUrl] = useState(`/dados-check-in/${slug}`);

  useEffect(() => {
    setPublicUrl(`${window.location.origin}/dados-check-in/${slug}`);
  }, [slug]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const token = await getBrowserAccessToken();
        const response = await fetch(`/api/admin/pilgrimages/${pilgrimageId}/checkin-data`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Erro ao carregar os dados.');
        if (active) {
          setPilgrimage(body.pilgrimage);
          setSubmissions(body.submissions || []);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar os dados.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [pilgrimageId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return submissions;
    return submissions.filter((item) => [item.full_name, item.email, item.document_number, item.nationality]
      .some((value) => value.toLowerCase().includes(needle)));
  }, [query, submissions]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const exportExcel = async () => {
    setDownloading(true);
    setError('');
    try {
      const token = await getBrowserAccessToken();
      const response = await fetch(`/api/admin/pilgrimages/${pilgrimageId}/checkin-data?format=xlsx`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Erro ao criar o Excel.');
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] || 'dados-check-in.xlsx';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Erro ao criar o Excel.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-indigo-950">Link do formulário</p>
            <p className="mt-1 text-xs leading-5 text-indigo-700">Copie este link e envie às pessoas desta peregrinação.</p>
            <input readOnly value={publicUrl} className="mt-3 w-full rounded-xl border border-indigo-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex">
            <button onClick={copyLink} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-indigo-700 shadow-sm ring-1 ring-indigo-200 hover:bg-indigo-100">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado' : 'Copiar link'}
            </button>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold !text-white hover:bg-indigo-700">
              <ExternalLink className="h-4 w-4" /> Abrir formulário
            </a>
          </div>
        </div>
        {pilgrimage && !pilgrimage.checkin_form_enabled && (
          <p className="mt-3 text-sm font-semibold text-amber-700">Este formulário está desativado.</p>
        )}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Users className="h-5 w-5" /></div>
          <div><p className="text-2xl font-bold text-slate-900">{submissions.length}</p><p className="text-xs text-slate-500">respostas recebidas</p></div>
        </div>
        <button
          onClick={exportExcel}
          disabled={downloading || submissions.length === 0}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-5 w-5" />}
          {downloading ? 'A preparar...' : 'Exportar para Excel'}
        </button>
      </div>

      {submissions.length > 0 && (
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <Search className="h-5 w-5 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar nome, email ou documento..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
      )}

      {submissions.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 px-5 py-14 text-center">
          <FileSpreadsheet className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-bold text-slate-700">Ainda não há respostas</p>
          <p className="mt-1 text-sm text-slate-500">Quando alguém preencher o formulário, os dados aparecem aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filtered.map((item, index) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Pessoa {index + 1}</p><h3 className="mt-1 break-words text-lg font-bold text-slate-900">{item.full_name}</h3></div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{item.nationality}</span>
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-x-5 gap-y-4 text-sm sm:grid-cols-2">
                <div><dt className="text-xs font-semibold text-slate-400">Documento</dt><dd className="mt-1 font-medium text-slate-800">{documentTypeLabel(item.document_type)} · {item.document_number}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-400">Nascimento</dt><dd className="mt-1 text-slate-700">{formatDate(item.birth_date)}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-400">Emissão</dt><dd className="mt-1 text-slate-700">{formatDate(item.document_issued_on)}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-400">Validade</dt><dd className="mt-1 text-slate-700">{formatDate(item.document_expires_on)}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs font-semibold text-slate-400">Morada</dt><dd className="mt-1 text-slate-700">{item.full_address}, {item.postal_code} {item.city}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-400">Telefone</dt><dd className="mt-1 break-all text-slate-700">{item.phone}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-400">Email</dt><dd className="mt-1 break-all text-slate-700">{item.email}</dd></div>
              </dl>
              <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">Recebido em {submittedAtFormatter.format(new Date(item.submitted_at))}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
