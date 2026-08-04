"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, LayoutDashboard, BedDouble, Hotel, Utensils, Wallet, HandCoins, FlaskConical,
} from 'lucide-react';
import AdminLayout from '../../../../../components/admin/AdminLayout';
import { supabaseBrowser } from '../../../../../lib/supabase-browser';
import type { LogisticsAccounts } from '../../../../../lib/logistics-accounts';

import OverviewTab from './components/OverviewTab';
import CollectionsTab from './components/CollectionsTab';
import RoomsTab from './components/RoomsTab';
import HotelsTab from './components/HotelsTab';
import ServicesTab from './components/ServicesTab';
import AccountsTab from './components/AccountsTab';

const TABS = [
    { id: 'overview', label: 'Painel', icon: LayoutDashboard, hint: 'Estado geral e alertas' },
    { id: 'collections', label: 'Cobranças', icon: HandCoins, hint: 'Quem falta pagar e notas' },
    { id: 'rooms', label: 'Quartos', icon: BedDouble, hint: 'Quem fica com quem' },
    { id: 'hotels', label: 'Hotéis', icon: Hotel, hint: 'Estadias, preços e orçamentos' },
    { id: 'services', label: 'Serviços', icon: Utensils, hint: 'Restaurantes, autocarros, voos' },
    { id: 'accounts', label: 'Contas', icon: Wallet, hint: 'Receita, despesa e saldo' },
];

export default function PilgrimageLogisticsPage() {
    const params = useParams();
    const id = params.id as string;

    const [activeTab, setActiveTab] = useState('overview');
    const [title, setTitle] = useState<string | null>(null);
    const [dates, setDates] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<LogisticsAccounts | null>(null);
    const [accountsError, setAccountsError] = useState<string | null>(null);

    /** Relê contas, inscrições, cortesias e estadias. Chamado após cada gravação. */
    const reload = useCallback(async () => {
        if (!supabaseBrowser) return;
        try {
            const { data: session } = await supabaseBrowser.auth.getSession();
            const token = session.session?.access_token;
            const res = await fetch(`/api/admin/logistics/${id}/accounts`, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                cache: 'no-store',
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body?.error || 'Erro ao carregar contas');
            setAccounts(body);
            setAccountsError(null);
        } catch (err: any) {
            setAccountsError(err?.message || 'Erro ao carregar contas');
        }
    }, [id]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!supabaseBrowser) { setLoading(false); return; }

            const { data } = await supabaseBrowser
                .from('pilgrimages')
                .select('title,start_date,end_date')
                .eq('id', id)
                .maybeSingle();
            if (!cancelled) {
                setTitle(data?.title ?? null);
                setDates({ start: data?.start_date ?? null, end: data?.end_date ?? null });
            }

            await reload();
            if (!cancelled) setLoading(false);
        };
        load();
        return () => { cancelled = true; };
    }, [id, reload]);

    const active = TABS.find(t => t.id === activeTab)!;

    const fmt = (iso: string) =>
        new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
    const nights = dates.start && dates.end
        ? Math.round((new Date(dates.end).getTime() - new Date(dates.start).getTime()) / 86_400_000)
        : null;
    const subtitle = [
        dates.start && dates.end ? `${fmt(dates.start)} a ${fmt(dates.end)}` : null,
        nights ? `${nights + 1} dias` : null,
        accounts ? `${accounts.revenue.beds} de ${accounts.pilgrimage.totalVacancies} lugares` : null,
    ].filter(Boolean).join(' · ');

    return (
        <AdminLayout hideHeader isLoading={loading}>
            <div className="-m-6 md:-m-8">

                {/* Cabeçalho do modo operação — deliberadamente escuro para se ler
                    de imediato que esta é uma área diferente do editor público. */}
                <div className="bg-slate-900 text-white">
                    <div className="max-w-7xl mx-auto px-6 md:px-8 pt-6 pb-0">
                        <Link
                            href={`/admin/peregrinacoes/${id}`}
                            className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Voltar à peregrinação
                        </Link>

                        <div className="mt-3 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-garabandal-gold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-garabandal-gold" />
                                    Logística &amp; Contas
                                </div>
                                <h1 className="text-2xl md:text-3xl font-serif font-bold mt-1.5">
                                    {title || 'Peregrinação'}
                                </h1>
                                <p className="text-slate-400 text-sm mt-1">
                                    {subtitle}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-300">
                                <FlaskConical className="h-4 w-4 flex-shrink-0" />
                                <span>
                                    <strong className="font-bold text-white">Tudo gravado na base de dados.</strong>{' '}
                                    Inscrições e pagamentos são leitura apenas.
                                </span>
                            </div>
                        </div>

                        {/* Tabs */}
                        <nav className="flex gap-1 mt-6 overflow-x-auto scrollbar-none">
                            {TABS.map(tab => {
                                const Icon = tab.icon;
                                const isActive = tab.id === activeTab;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`relative flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors rounded-t-lg ${isActive
                                            ? 'text-slate-900 bg-gray-50'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                </div>

                {/* Conteúdo */}
                <div className="max-w-7xl mx-auto px-6 md:px-8 py-6 md:py-8">
                    <div className="mb-6">
                        <h2 className="text-lg font-bold text-slate-900">{active.label}</h2>
                        <p className="text-sm text-slate-500">{active.hint}</p>
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.18 }}
                        >
                            {activeTab === 'overview' && (
                                <OverviewTab accounts={accounts} onNavigate={setActiveTab} error={accountsError} />
                            )}
                            {activeTab === 'collections' && <CollectionsTab accounts={accounts} pilgrimageId={id} onChanged={reload} error={accountsError} />}
                            {activeTab === 'rooms' && (
                                <RoomsTab accounts={accounts} pilgrimageId={id} onChanged={reload} error={accountsError} />
                            )}
                            {activeTab === 'hotels' && (
                                <HotelsTab
                                    accounts={accounts}
                                    pilgrimageId={id}
                                    onChanged={reload}
                                    error={accountsError}
                                />
                            )}
                            {activeTab === 'services' && (
                                <ServicesTab accounts={accounts} pilgrimageId={id} onChanged={reload} error={accountsError} />
                            )}
                            {activeTab === 'accounts' && <AccountsTab accounts={accounts} error={accountsError} />}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </AdminLayout>
    );
}
