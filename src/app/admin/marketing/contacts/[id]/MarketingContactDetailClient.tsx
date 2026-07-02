"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminLayout from '../../../../../components/admin/AdminLayout';
import { supabaseBrowser } from '../../../../../lib/supabase-browser';
import { ArrowLeft, Clock, Link2, Mail, Target } from 'lucide-react';
import { Toaster, toast } from 'sonner';

async function getToken() {
  if (!supabaseBrowser) throw new Error('Supabase não disponível.');
  const { data } = await supabaseBrowser.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão expirada.');
  return token;
}

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value || 0);

export default function MarketingContactDetailClient({ id }: { id: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const token = await getToken();
        const res = await fetch(`/api/admin/marketing/contacts/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || 'Erro ao carregar contacto.');
        setData(body);
      } catch (error: any) {
        toast.error(error?.message || 'Erro ao carregar contacto.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const contact = data?.contact;

  return (
    <AdminLayout title={contact?.display_name || 'Contacto Marketing'} isLoading={false}>
      <Toaster richColors position="bottom-right" />
      <div className="space-y-6">
        <Link href="/admin/marketing/contacts" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Voltar aos contactos
        </Link>

        {loading && <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-500">A carregar...</div>}

        {!loading && contact && (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
                <div>
                  <h1 className="text-2xl font-black text-slate-900">{contact.display_name}</h1>
                  <p className="mt-1 text-sm text-slate-500">{contact.normalized_email || contact.normalized_phone || 'Sem contacto direto'}</p>
                  <p className="mt-4 text-sm font-medium text-slate-700">{contact.recommendation}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(contact.segments || []).map((segment: string) => (
                      <span key={segment} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{segment.replace(/-/g, ' ')}</span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Score</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{contact.lead_score}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Valor</p>
                    <p className="mt-2 text-xl font-black text-slate-900">{formatCurrency(contact.value_total)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Stage</p>
                    <p className="mt-2 font-black text-slate-900">{contact.lifecycle_stage}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">País</p>
                    <p className="mt-2 font-black text-slate-900">{contact.country || '—'}</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-500">Idioma</p>
                    <p className="mt-2 font-black text-blue-900">{contact.language === 'en' ? 'English' : 'Português'}</p>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
                  <Clock className="h-5 w-5" />
                  Timeline
                </h2>
                <div className="space-y-3">
                  {(contact.events || []).map((event: any) => (
                    <div key={`${event.source_table}-${event.source_id}-${event.event_type}`} className="rounded-lg border border-slate-100 p-3">
                      <p className="font-bold text-slate-900">{event.title}</p>
                      <p className="text-sm text-slate-500">{event.event_type} · {formatDate(event.occurred_at)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <aside className="space-y-6">
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
                    <Target className="h-5 w-5" />
                    Intelligence
                  </h2>
                  <dl className="space-y-2 text-sm">
                    {Object.entries(contact.source_summary || {}).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2">
                        <dt className="text-slate-500">{key.replace(/_/g, ' ')}</dt>
                        <dd className="font-bold text-slate-900">{String(value ?? '—')}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
                    <Link2 className="h-5 w-5" />
                    Fontes
                  </h2>
                  <div className="space-y-2">
                    {(contact.links || []).map((link: any) => (
                      <div key={`${link.source_table}-${link.source_id}`} className="rounded-lg bg-slate-50 p-3 text-sm">
                        <p className="font-bold text-slate-900">{link.source_label || link.source_table}</p>
                        <p className="text-slate-500">{link.source_table}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
                    <Mail className="h-5 w-5" />
                    Marketing
                  </h2>
                  <div className="space-y-2 text-sm text-slate-600">
                    <p>Mensagens: {(data.messages || []).length}</p>
                    <p>Consentimento: {contact.consent_state}</p>
                  </div>
                </section>
              </aside>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
