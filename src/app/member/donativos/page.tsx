"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardShell from '../../../components/dashboard/DashboardShell';
import { supabaseBrowser } from '../../../lib/supabase-browser';
import { useLocale } from '../../../contexts/LocaleContext';
import { useAuth } from '../../../contexts/AuthContext';
import { Heart, HeartHandshake, ArrowRight } from 'lucide-react';

type Donation = {
  id: string;
  amount_cents: number | null;
  created_at: string;
  description: string | null;
  status: string | null;
  method: string | null;
};

const formatCurrency = (cents: number, isEn: boolean) =>
  new Intl.NumberFormat(isEn ? 'en-GB' : 'pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100);

const formatDate = (dateStr: string, isEn: boolean) =>
  new Date(dateStr).toLocaleDateString(isEn ? 'en-GB' : 'pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

const methodLabel = (method: string | null, isEn: boolean) => {
  switch (method) {
    case 'bank_transfer': return isEn ? 'Bank transfer' : 'Transferência bancária';
    case 'card': return isEn ? 'Card' : 'Cartão';
    case 'mbway': return 'MB WAY';
    case 'multibanco': return 'Multibanco';
    default: return isEn ? 'Online' : 'Online';
  }
};

const statusBadge = (status: string | null, isEn: boolean) => {
  if (status === 'succeeded') {
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-green-50 text-green-700 border border-green-100">{isEn ? 'Paid' : 'Pago'}</span>;
  }
  if (status === 'pending' || status === 'pending_verification') {
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-100">{isEn ? 'Pending' : 'Em verificação'}</span>;
  }
  return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-50 text-slate-500 border border-slate-100">{status || '—'}</span>;
};

export default function MemberDonationsPage() {
  const { locale } = useLocale();
  const isEn = locale === 'en';
  const { user, loading: authLoading } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (authLoading) return;
      if (!user?.id || !supabaseBrowser) {
        setDataLoading(false);
        return;
      }

      const filters = [`user_id.eq.${user.id}`];
      if (user.email) filters.push(`donor_email.eq.${user.email}`);

      const { data } = await supabaseBrowser
        .from('donations')
        .select('id, amount_cents, created_at, description, status, method')
        .or(filters.join(','))
        .neq('status', 'failed')
        .order('created_at', { ascending: false });

      setDonations(data ?? []);
      setDataLoading(false);
    };
    load();
  }, [user, authLoading]);

  const loading = authLoading || dataLoading;
  const donationsPath = isEn ? '/en/donations' : '/donations';

  const succeeded = donations.filter((d) => d.status === 'succeeded');
  const totalCents = succeeded.reduce((sum, d) => sum + (d.amount_cents || 0), 0);

  return (
    <DashboardShell
      title={isEn ? 'My Donations' : 'Os Meus Donativos'}
      subtitle={isEn ? 'Thank you for supporting the apostolate of Garabandal.' : 'Obrigado por apoiares o apostolado de Garabandal.'}
    >
      <div className="space-y-8">
        {/* Summary */}
        {!loading && succeeded.length > 0 && (
          <section className="rounded-3xl p-8 bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-lg shadow-amber-900/10 relative overflow-hidden">
            <Heart className="absolute -top-4 -right-4 w-32 h-32 text-white/10 fill-white/10" />
            <div className="relative z-10">
              <p className="text-white/80 text-sm font-medium uppercase tracking-wider mb-1">{isEn ? 'Total contributed' : 'Total contribuído'}</p>
              <div className="font-serif text-4xl md:text-5xl font-bold leading-none">{formatCurrency(totalCents, isEn)}</div>
              <p className="text-white/80 text-sm mt-2">
                {succeeded.length} {isEn ? (succeeded.length === 1 ? 'donation' : 'donations') : (succeeded.length === 1 ? 'donativo' : 'donativos')}
              </p>
            </div>
          </section>
        )}

        {/* List */}
        <section>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 flex justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
              </div>
            ) : donations.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-4">
                  <HeartHandshake className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-gray-900 mb-1">{isEn ? 'No donations yet' : 'Ainda sem donativos'}</h4>
                <p className="text-gray-500 text-sm mb-5 max-w-sm mx-auto">
                  {isEn ? 'Support the apostolate of Garabandal. Every gift makes a difference.' : 'Apoia o apostolado de Garabandal. Cada donativo faz a diferença.'}
                </p>
                <Link href={donationsPath} className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold rounded-xl hover:from-amber-400 hover:to-amber-500 transition-colors">
                  {isEn ? 'Make a donation' : 'Fazer um donativo'}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/30 text-xs uppercase tracking-wider text-gray-400 font-bold">
                      <th className="py-4 px-6 md:pl-8">{isEn ? 'Date' : 'Data'}</th>
                      <th className="py-4 px-6">{isEn ? 'Description' : 'Descrição'}</th>
                      <th className="py-4 px-6">{isEn ? 'Amount' : 'Valor'}</th>
                      <th className="py-4 px-6 md:pr-8 text-right">{isEn ? 'Status' : 'Estado'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {donations.map((d) => (
                      <tr key={d.id} className="group hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-6 md:pl-8">
                          <div className="font-bold text-gray-900">{formatDate(d.created_at, isEn)}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{methodLabel(d.method, isEn)}</div>
                        </td>
                        <td className="py-4 px-6 text-sm text-gray-700 font-medium max-w-xs">
                          <span className="line-clamp-2">{d.description || (isEn ? 'Donation' : 'Donativo')}</span>
                        </td>
                        <td className="py-4 px-6 font-mono font-medium text-gray-900">{formatCurrency(d.amount_cents || 0, isEn)}</td>
                        <td className="py-4 px-6 md:pr-8 text-right">{statusBadge(d.status, isEn)}</td>
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
