"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../../lib/utils';
import {
    LayoutDashboard,
    Users,
    CreditCard,
    ShoppingBag,
    Settings,
    LogOut,
    FileText,
    TrendingUp,
    GraduationCap,
    BookOpen,
    Flame,
    Sparkles,
    Calendar,
    Home,
    Plane,
    Target,
    Video,
    Mail,
    Heart,
    Gavel,
    UserPlus,
    ChevronDown,
    ChevronRight,
    FolderLock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminNotifications } from '../../context/AdminNotificationContext';

export default function AdminSidebar({ onLogout, className }: { onLogout: () => void; className?: string }) {
    const pathname = usePathname();
    const { counts } = useAdminNotifications();
    const [openGroups, setOpenGroups] = useState<string[]>(['Visão Geral', 'Gestão Principal']);

    const toggleGroup = (label: string) => {
        setOpenGroups(prev =>
            prev.includes(label)
                ? prev.filter(g => g !== label)
                : [...prev, label]
        );
    };

    const navGroups = [
        {
            label: 'Visão Geral',
            items: [
                { label: 'Dashboard', icon: LayoutDashboard, href: '/admin/dashboard' }
            ]
        },
        {
            label: 'Gestão Principal',
            items: [
                { label: 'Peregrinações', icon: Plane, href: '/admin/peregrinacoes', badge: counts.bookings },
                { label: 'Encomendas', icon: FileText, href: '/admin/encomendas', badge: counts.orders },
                { label: 'Membros', icon: Users, href: '/admin/membros', badge: counts.members },
                { label: 'Loja & Stock', icon: ShoppingBag, href: '/admin/loja' },
                { label: 'Transações', icon: CreditCard, href: '/admin/transacoes' },
            ]
        },
        {
            label: 'Comunidade & Leads',
            items: [
                { label: 'Leads & Inscrições', icon: Target, href: '/admin/leads' },
                { label: 'Doações', icon: Heart, href: '/admin/doacoes' },
                { label: 'Convites de Membros', icon: UserPlus, href: '/admin/convites' },
                { label: 'Leilão', icon: Gavel, href: '/admin/leilao' },
                { label: 'Emails do Sistema', icon: Mail, href: '/admin/emails' },
            ]
        },
        {
            label: 'Conteúdo & Espiritualidade',
            items: [
                { label: 'Doc. Privada', icon: FolderLock, href: '/admin/membros/documentacao' },
                { label: 'Novenas', icon: Sparkles, href: '/admin/novenas' },
                { label: 'Intenções', icon: Flame, href: '/admin/intentions' },
                { label: 'Orações', icon: BookOpen, href: '/admin/prayers' },
                { label: 'Cursos & Vídeos', icon: GraduationCap, href: '/admin/academy' },
                { label: 'Eventos Online', icon: Video, href: '/admin/events' },
            ]
        },
        {
            label: 'Sistema & Configuração',
            items: [
                { label: 'Relatórios', icon: TrendingUp, href: '/admin/relatorios' },
                { label: 'Conteúdo Global', icon: Settings, href: '/admin/conteudo' },
                { label: 'Audit Logs', icon: FileText, href: '/admin/logs' },
                { label: 'Configurações', icon: Settings, href: '/admin/configuracoes' },
            ]
        }
    ];

    return (
        <aside className={cn("flex flex-col w-72 bg-garabandal-dark text-white h-screen sticky top-0 border-r border-white/10 flex-shrink-0", className)}>
            {/* Brand */}
            <div className="p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-garabandal-gold flex items-center justify-center text-garabandal-dark font-bold font-serif">
                        G
                    </div>
                    <div>
                        <h1 className="font-serif font-bold text-lg tracking-wide">Admin</h1>
                        <p className="text-xs text-white/50 uppercase tracking-wider">Garabandal</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">
                {navGroups.map((group, idx) => {
                    const isOpen = openGroups.includes(group.label);
                    return (
                        <div key={idx}>
                            <button
                                onClick={() => toggleGroup(group.label)}
                                className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-white/40 mb-3 px-3 hover:text-white transition-colors group/header"
                            >
                                {group.label}
                                {isOpen ? <ChevronDown className="w-3 h-3 text-white/30 group-hover/header:text-white" /> : <ChevronRight className="w-3 h-3 text-white/30 group-hover/header:text-white" />}
                            </button>

                            <AnimatePresence initial={false}>
                                {isOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2, ease: "easeInOut" }}
                                        className="space-y-1 overflow-hidden"
                                    >
                                        {group.items.map((item) => {
                                            const isActive = pathname === item.href;
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    className={`
                                                        flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
                                                        ${isActive
                                                            ? 'bg-garabandal-gold text-garabandal-dark font-medium shadow-lg shadow-garabandal-gold/20'
                                                            : 'text-white/70 hover:bg-white/5 hover:text-white'
                                                        }
                                                    `}
                                                >
                                                    <item.icon
                                                        className={`w-5 h-5 transition-colors ${isActive ? 'text-garabandal-dark' : 'text-white/50 group-hover:text-white'}`}
                                                    />
                                                    {item.label}
                                                    {(item as any).badge > 0 && (
                                                        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                                                            {(item as any).badge}
                                                        </span>
                                                    )}
                                                </Link>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-white/5 space-y-1">
                <Link
                    href="/"
                    className="flex items-center gap-3 px-3 py-2.5 text-white/60 hover:bg-white/5 hover:text-white rounded-xl w-full transition-all text-sm font-medium"
                >
                    <Home className="w-5 h-5" />
                    Voltar ao Site
                </Link>
                <button
                    onClick={onLogout}
                    className="flex items-center gap-3 px-3 py-2.5 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl w-full transition-all text-sm font-medium"
                >
                    <LogOut className="w-5 h-5" />
                    Terminar Sessão
                </button>
            </div>
        </aside>
    );
}
