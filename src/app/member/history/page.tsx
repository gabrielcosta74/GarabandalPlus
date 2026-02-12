"use client";

import { useEffect, useState } from 'react';
import DashboardShell from '../../../components/dashboard/DashboardShell';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { Clock, Download, CheckCircle2, AlertCircle, Calendar, MapPin, ChevronRight, User } from 'lucide-react';
import Link from 'next/link';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

import { useAuth } from '../../../contexts/AuthContext';

export default function MemberHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const [payments, setPayments] = useState<Array<Record<string, any>>>([]);
  const [bookings, setBookings] = useState<Array<Record<string, any>>>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      if (authLoading) return;
      if (!user?.id) {
        setDataLoading(false);
        return;
      }

      if (!supabaseBrowser) return;

      const [quotasRes, bookingsRes] = await Promise.all([
        supabaseBrowser
          .from('pagamentos_quotas')
          .select('*')
          .eq('user_id', user.id)
          .order('data_pagamento', { ascending: false }),

        supabaseBrowser
          .from('bookings')
          .select('*, pilgrimage:pilgrimages(title, cover_image, start_date)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      ]);

      setPayments(quotasRes.data ?? []);
      setBookings(bookingsRes.data ?? []);
      setDataLoading(false);
    };

    loadHistory();
  }, [user, authLoading]);

  const loading = authLoading || dataLoading;

  return (
    <DashboardShell
      title="O Meu Histórico"
      subtitle="Consulta as tuas viagens e pagamentos."
    >
      <div className="space-y-8">

        {/* SUBSCRIPTION STATUS CHECK */}
        <section className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Estado da Subscrição</h3>
              <p className="text-slate-500 text-sm max-w-xl">
                Consulta a validade da tua quota anual. Mantém a subscrição ativa para aceder a conteúdos exclusivos e descontos.
              </p>
            </div>
            <div>
              {/* We will need to fetch member status or pass it. Since we fetch payments, let's fetch member status too or use a derived state if feasible, but user data is loaded in useEffect. */}
              {/* Actually, let's just link to the quota page for simplicity and clarity as requested "directions clear" */}
              <Link href="/member/quota" className="inline-flex items-center gap-2 px-5 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors">
                <CheckCircle2 className="w-5 h-5" />
                Verificar Estado
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION: PILGRIMAGE BOOKINGS */}
        <section>
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">As Minhas Peregrinações</h3>
          </div>

          {loading ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-100 flex justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-slate-100 text-center shadow-sm">
              <p className="text-slate-500">Ainda não tens nenhuma peregrinação registada.</p>
              <Link href="/peregrinacoes" className="text-indigo-600 font-bold text-sm mt-2 hover:underline inline-block">Ver Peregrinações Disponíveis</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bookings.map((booking) => (
                <Link href={`/peregrinacoes/inscricao/${booking.id}`} key={booking.id} className="group block bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-xl hover:border-indigo-100 transition-all">
                  <div className="h-32 bg-slate-200 relative">
                    {booking.pilgrimage?.cover_image ? (
                      <img src={booking.pilgrimage.cover_image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold bg-slate-100">SEM FOTO</div>
                    )}
                    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm">
                      {booking.status === 'confirmed' ? <span className="text-green-600">Confirmado</span> : <span className="text-amber-600">Pendente</span>}
                    </div>
                  </div>
                  <div className="p-5">
                    <h4 className="font-bold text-slate-900 text-lg leading-tight mb-2 group-hover:text-indigo-700 transition-colors">{booking.pilgrimage?.title || 'Peregrinação'}</h4>
                    <div className="text-xs text-slate-500 flex flex-col gap-1 mb-4">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(booking.pilgrimage?.start_date)}</span>
                      <span className="flex items-center gap-1"><User className="w-3 h-3" /> Inscrito a {formatDate(booking.created_at)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                      <span className="text-xs font-bold text-slate-400">REF: {booking.id.slice(0, 6)}</span>
                      <span className="flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform">Ver Detalhes <ChevronRight className="w-3 h-3" /></span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* SECTION: QUOTAS (Existing Table) */}
        <section>
          <div className="flex items-center gap-3 mb-4 px-2 mt-12">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Histórico de Quotas</h3>
          </div>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            {/* ... Existing Quotas Table Code ... */}
            {loading ? (
              <div className="p-12 flex justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
              </div>
            ) : payments.length === 0 ? (
              <div className="p-12 text-center">
                <h4 className="font-bold text-gray-900 mb-1">Sem histórico</h4>
                <p className="text-gray-500 text-sm">Ainda não existem quotas registadas.</p>
              </div>
            ) : (
              /* Reuse existing table structure */
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/30 text-xs uppercase tracking-wider text-gray-400 font-bold">
                      <th className="py-4 px-6 md:pl-8">Data</th>
                      <th className="py-4 px-6">Tipo</th>
                      <th className="py-4 px-6">Valor</th>
                      <th className="py-4 px-6 md:pr-8 text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {payments.map((item) => (
                      <tr key={item.id || item.external_reference} className="group hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-6 md:pl-8">
                          <div className="font-bold text-gray-900">{formatDate(item.data_pagamento)}</div>
                          <div className="text-xs font-mono text-gray-400 mt-0.5">#{item.external_reference ? item.external_reference.slice(0, 8) : '---'}</div>
                        </td>
                        <td className="py-4 px-6 text-sm text-gray-700 font-medium">Quota Anual</td>
                        <td className="py-4 px-6 font-mono font-medium text-gray-900">{formatCurrency(item.valor || 0)}</td>
                        <td className="py-4 px-6 md:pr-8 text-right">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-green-50 text-green-700 border border-green-100">
                            Pago
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
