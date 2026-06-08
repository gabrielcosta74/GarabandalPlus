"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, ArrowRight, HeartHandshake } from 'lucide-react';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { useLocale } from '../../contexts/LocaleContext';

type Donation = {
  id: string;
  amount_cents: number | null;
  created_at: string;
  description: string | null;
};

const fmtEUR = (cents: number, isEn: boolean) =>
  new Intl.NumberFormat(isEn ? 'en-GB' : 'pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100);

const fmtEURExact = (cents: number, isEn: boolean) =>
  new Intl.NumberFormat(isEn ? 'en-GB' : 'pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);

const fmtDay = (dateStr: string, isEn: boolean) =>
  new Date(dateStr).toLocaleDateString(isEn ? 'en-GB' : 'pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export default function ContributionsCard({ firstName }: { firstName?: string | null }) {
  const { locale } = useLocale();
  const isEn = locale === 'en';
  const [loading, setLoading] = useState(true);
  const [donations, setDonations] = useState<Donation[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        if (!supabaseBrowser) return;
        const { data: { user } } = await supabaseBrowser.auth.getUser();
        if (!user) return;

        const filters = [`user_id.eq.${user.id}`];
        if (user.email) filters.push(`donor_email.eq.${user.email}`);

        const { data } = await supabaseBrowser
          .from('donations')
          .select('id, amount_cents, created_at, description')
          .or(filters.join(','))
          .eq('status', 'succeeded')
          .order('created_at', { ascending: false });

        setDonations(data ?? []);
      } catch (err) {
        console.error('Error loading contributions:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const name = firstName || (isEn ? 'Member' : 'Membro');
  const donationsPath = isEn ? '/en/donations' : '/donations';
  const historyPath = isEn ? '/en/member/donations' : '/member/donativos';

  // --- Loading skeleton ---
  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/15 bg-slate-900/40 p-6 md:p-8 animate-pulse">
        <div className="h-4 w-32 bg-slate-700/50 rounded mb-4" />
        <div className="h-10 w-48 bg-slate-700/50 rounded mb-3" />
        <div className="h-4 w-40 bg-slate-700/40 rounded" />
      </div>
    );
  }

  // --- Empty state: warm invitation ---
  if (donations.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-transparent p-6 md:p-8">
        <div className="absolute -top-16 -right-10 w-56 h-56 bg-amber-500/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <HeartHandshake className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <h3 className="font-serif text-2xl font-bold text-white mb-1">
              {isEn ? 'Support the Garabandal apostolate' : 'Apoia o apostolado de Garabandal'}
            </h3>
            <p className="text-slate-400 text-sm max-w-lg">
              {isEn
                ? 'Your contribution helps sustain and grow the apostolate of Garabandal. Every gift leaves a lasting mark.'
                : 'O teu contributo ajuda a sustentar e expandir o apostolado de Garabandal. Cada donativo deixa uma marca para sempre.'}
            </p>
          </div>
          <Link
            href={donationsPath}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-sm hover:from-amber-400 hover:to-amber-500 transition-colors shadow-lg shadow-amber-900/30 shrink-0"
          >
            {isEn ? 'Make a donation' : 'Fazer um donativo'}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // --- Populated state ---
  const totalCents = donations.reduce((sum, d) => sum + (d.amount_cents || 0), 0);
  const count = donations.length;
  const recent = donations.slice(0, 2);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-transparent p-4 md:p-5">
      <div className="absolute -top-16 -right-12 w-48 h-48 bg-amber-500/20 rounded-full blur-[90px] pointer-events-none" />

      <div className="relative z-10">
        {/* Header row: thank you (left) + total (right) */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-md shrink-0">
              <Heart className="w-4 h-4 fill-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-serif text-base md:text-lg font-bold text-white leading-tight truncate">
                {isEn ? `Thank you, ${name}` : `Obrigado, ${name}`} 🤍
              </h3>
              <p className="text-amber-200/70 text-xs truncate">
                {isEn ? 'Supporting the Garabandal apostolate' : 'A apoiar o apostolado de Garabandal'}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-serif text-2xl md:text-3xl font-bold text-amber-400 leading-none">
              {fmtEUR(totalCents, isEn)}
            </div>
            <p className="text-slate-400 text-[11px] mt-1">
              {count} {isEn ? (count === 1 ? 'donation' : 'donations') : (count === 1 ? 'donativo' : 'donativos')}
            </p>
          </div>
        </div>

        {/* Recent timeline (compact, up to 2) */}
        <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
          {recent.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex items-baseline gap-2">
                <span className="text-xs text-slate-500 shrink-0">{fmtDay(d.created_at, isEn)}</span>
                <span className="text-sm text-slate-300 truncate">{d.description || (isEn ? 'Donation' : 'Donativo')}</span>
              </div>
              <span className="font-mono text-sm font-bold text-amber-300 shrink-0">
                {fmtEURExact(d.amount_cents || 0, isEn)}
              </span>
            </div>
          ))}
        </div>

        {/* Footer link as visible pill */}
        <Link
          href={historyPath}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-xs font-bold text-slate-900 shadow-sm hover:bg-amber-300 transition-colors"
        >
          {isEn ? 'View all donations' : 'Ver todos os donativos'}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
