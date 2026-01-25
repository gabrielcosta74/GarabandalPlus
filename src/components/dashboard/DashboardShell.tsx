"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User,
    CreditCard,
    Clock,
    ShoppingBag,
    BookOpen,
    Menu,
    X,
    LogOut,
    ShieldCheck,
    LayoutDashboard,
    Settings
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type DashboardShellProps = {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
};

export default function DashboardShell({ title, subtitle, children }: DashboardShellProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const { user, memberData, isMember, loading, isAuthenticated, signOut } = useAuth();

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            const next = pathname ? `?next=${encodeURIComponent(pathname)}` : '';
            router.replace(`/login${next}`);
        }
    }, [isAuthenticated, loading, pathname, router]);

    const handleLogout = async () => {
        await signOut();
        router.replace('/login');
    };

    const navItems = [
        {
            section: 'Conta', items: [
                { label: 'Perfil', href: '/account/profile', icon: User, hidden: false },
                { label: 'O Meu Histórico', href: '/member/history', icon: Clock, hidden: false }, // NOW VISIBLE TO ALL
            ]
        },
        {
            section: 'Membro', items: [
                { label: 'Resumo', href: '/member', icon: LayoutDashboard, hidden: !isMember },
                { label: 'Quota Anual', href: '/member/quota', icon: ShieldCheck, hidden: !isMember },
            ]
        },
        {
            section: 'Atividade', items: [
                { label: 'Encomendas', href: '/encomendas', icon: ShoppingBag, hidden: false },
                { label: 'Biblioteca', href: '/biblioteca', icon: BookOpen, hidden: false },
            ]
        }
    ];

    if (loading) {
        return (
            <div className="min-h-screen bg-garabandal-mist flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-garabandal-gold border-t-transparent rounded-full" />
            </div>
        );
    }
    if (!isAuthenticated) return null;

    return (
        <div className="min-h-screen bg-garabandal-mist pt-24 lg:pt-28">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-start gap-8">

                {/* Mobile Sidebar Overlay */}
                <AnimatePresence>
                    {isMobileOpen && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsMobileOpen(false)}
                                className="fixed inset-0 bg-black/20 z-40 lg:hidden backdrop-blur-sm"
                            />
                            <motion.aside
                                initial={{ x: '-100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '-100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="fixed inset-y-0 left-0 w-64 bg-white shadow-2xl z-50 lg:hidden flex flex-col pt-safe-top"
                            >
                                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                                    <h2 className="font-serif text-xl font-bold text-garabandal-dark">Menu</h2>
                                    <button onClick={() => setIsMobileOpen(false)} className="p-2 -mr-2 text-gray-400 hover:text-gray-600">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <nav className="flex-1 overflow-y-auto p-4 space-y-6">
                                    {navItems.map((group, idx) => {
                                        const visibleItems = group.items.filter(i => !i.hidden);
                                        if (visibleItems.length === 0) return null;
                                        return (
                                            <div key={idx}>
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 px-3">{group.section}</h3>
                                                <div className="space-y-1">
                                                    {visibleItems.map(item => (
                                                        <Link
                                                            key={item.href}
                                                            href={item.href}
                                                            onClick={() => setIsMobileOpen(false)}
                                                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${pathname === item.href ? 'bg-garabandal-gold/10 text-garabandal-dark font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                                                        >
                                                            <item.icon className={`w-5 h-5 ${pathname === item.href ? 'text-garabandal-gold' : 'text-gray-400'}`} />
                                                            {item.label}
                                                        </Link>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </nav>
                                <div className="p-4 border-t border-gray-100">
                                    <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-xl w-full transition-colors text-sm font-medium">
                                        <LogOut className="w-5 h-5" />
                                        Terminar Sessão
                                    </button>
                                </div>
                            </motion.aside>
                        </>
                    )}
                </AnimatePresence>

                {/* Desktop Sticky Sidebar */}
                <aside className="hidden lg:flex flex-col w-64 bg-white rounded-2xl shadow-sm border border-gray-100 sticky top-32 max-h-[calc(100vh-160px)] z-10 shrink-0">
                    <nav className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                        {navItems.map((group, idx) => {
                            const visibleItems = group.items.filter(i => !i.hidden);
                            if (visibleItems.length === 0) return null;
                            return (
                                <div key={idx}>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 px-3">{group.section}</h3>
                                    <div className="space-y-1">
                                        {visibleItems.map(item => (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${pathname === item.href ? 'bg-garabandal-gold/10 text-garabandal-dark font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                                            >
                                                <item.icon className={`w-5 h-5 transition-colors ${pathname === item.href ? 'text-garabandal-gold' : 'text-gray-400 group-hover:text-gray-500'}`} />
                                                {item.label}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </nav>
                    <div className="p-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
                        <div className="mb-3 px-2 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-garabandal-gold/20 flex items-center justify-center text-garabandal-dark shrink-0 overflow-hidden border border-garabandal-gold/30">
                                {memberData?.avatar_url ? (
                                    <img src={memberData.avatar_url} alt="User" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-5 h-5" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-500 mb-0.5">Iniciado como</p>
                                <p className="text-xs font-bold text-gray-900 truncate" title={user?.email || ''}>
                                    {isMember ? 'Membro' : 'Utilizador'} • {memberData?.nome?.split(' ')[0] || ''}
                                </p>
                            </div>
                        </div>
                        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl w-full transition-colors text-sm font-medium">
                            <LogOut className="w-5 h-5" />
                            Sair
                        </button>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 min-w-0 pb-12">
                    <div className="lg:hidden mb-6 flex items-center justify-between">
                        <h1 className="font-serif text-2xl font-bold text-garabandal-dark">{title}</h1>
                        <button
                            onClick={() => setIsMobileOpen(true)}
                            className="p-2 -mr-2 text-gray-500 hover:bg-white rounded-lg bg-white shadow-sm border border-gray-100"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="hidden lg:block mb-8">
                        <h1 className="font-serif text-3xl font-bold text-garabandal-dark mb-2">{title}</h1>
                        {subtitle && <p className="text-gray-500">{subtitle}</p>}
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        {children}
                    </motion.div>
                </main>
            </div>
        </div>
    );
}
