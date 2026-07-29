"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../../lib/utils';
import {
    type LucideIcon,
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
    Home,
    Plane,
    Target,
    Video,
    Mail,
    Heart,
    HeartHandshake,
    Gavel,
    UserPlus,
    ChevronDown,
    ChevronRight,
    FolderLock,
    Bot,
    Megaphone,
    Activity,
    Search,
    Star,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminNotifications } from '../../context/AdminNotificationContext';

type NavItem = {
    label: string;
    icon: LucideIcon;
    href: string;
    badge?: number;
    target?: string;
};

type NavGroup = {
    label: string;
    items: NavItem[];
};

export default function AdminSidebar({ onLogout, className, collapsed = false }: { onLogout: () => void; className?: string; collapsed?: boolean }) {
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

    const navGroups: NavGroup[] = [
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
                { label: 'Atividade dos Membros', icon: Activity, href: '/admin/membros/atividade' },
                { label: 'Voluntariado em Garabandal', icon: HeartHandshake, href: '/admin/membros/voluntariado' },
                { label: 'Loja & Stock', icon: ShoppingBag, href: '/admin/loja' },
                { label: 'Transações', icon: CreditCard, href: '/admin/transacoes' },
            ]
        },
        {
            label: 'Comunidade & Leads',
            items: [
                { label: 'Leads & Inscrições', icon: Target, href: '/admin/leads' },
                { label: 'Interessados (Novembro)', icon: Star, href: '/admin/leads/interessados' },
                { label: 'Doações', icon: Heart, href: '/admin/doacoes' },
                { label: 'Convites de Membros', icon: UserPlus, href: '/admin/convites' },
                { label: 'Leilão', icon: Gavel, href: '/admin/leilao' },
                { label: 'Emails do Sistema', icon: Mail, href: '/admin/emails' },
                { label: 'Atividade Email', icon: Mail, href: '/admin/notificacoes-email' },
            ]
        },
        {
            label: 'Marketing & Growth',
            items: [
                { label: 'Marketing Platform', icon: Megaphone, href: '/admin/marketing', target: '_blank' },
                { label: 'Search Console', icon: Search, href: '/admin/search-console' },
            ]
        },
        {
            label: 'CMS · Conteúdo do site',
            items: [
                { label: 'Dashboard CMS', icon: BookOpen, href: '/admin/cms' },
                { label: 'Páginas', icon: FileText, href: '/admin/cms/pages' },
                { label: 'Artigos', icon: FileText, href: '/admin/cms/posts' },
                { label: 'Categorias', icon: Target, href: '/admin/cms/categories' },
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
            label: 'Assistente IA',
            items: [
                { label: 'Base de Conhecimento', icon: Bot, href: '/admin/chat-kb' },
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
        <aside className={cn(
            "flex flex-col bg-garabandal-dark text-white h-screen sticky top-0 border-r border-white/10 flex-shrink-0 transition-[width] duration-200 ease-out",
            collapsed ? "w-[68px]" : "w-72",
            className
        )}>
            {/* Brand */}
            <div className={cn("border-b border-white/10", collapsed ? "p-4" : "p-6")}>
                <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
                    <div className="w-9 h-9 rounded-lg bg-garabandal-gold flex items-center justify-center text-garabandal-dark font-bold font-serif flex-shrink-0">
                        G
                    </div>
                    {!collapsed && (
                        <div className="min-w-0">
                            <h1 className="font-serif font-bold text-lg tracking-wide">Admin</h1>
                            <p className="text-xs text-white/50 uppercase tracking-wider">Garabandal</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <nav className={cn("flex-1 overflow-y-auto custom-scrollbar", collapsed ? "p-2 space-y-2" : "p-4 space-y-8")}>
                {navGroups.map((group, idx) => {
                    // Recolhida, os grupos ficam sempre abertos: só há ícones para mostrar.
                    const isOpen = collapsed || openGroups.includes(group.label);
                    return (
                        <div key={idx}>
                            {collapsed ? (
                                idx > 0 && <div className="mx-auto my-2 h-px w-6 bg-white/10" />
                            ) : (
                                <button
                                    onClick={() => toggleGroup(group.label)}
                                    className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-white/40 mb-3 px-3 hover:text-white transition-colors group/header"
                                >
                                    {group.label}
                                    {isOpen ? <ChevronDown className="w-3 h-3 text-white/30 group-hover/header:text-white" /> : <ChevronRight className="w-3 h-3 text-white/30 group-hover/header:text-white" />}
                                </button>
                            )}

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
                                            const badge = item.badge || 0;
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    target={item.target || '_self'}
                                                    title={collapsed ? item.label : undefined}
                                                    className={cn(
                                                        'relative flex items-center rounded-xl transition-all duration-200 group',
                                                        collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
                                                        isActive
                                                            ? 'bg-garabandal-gold text-garabandal-dark font-medium shadow-lg shadow-garabandal-gold/20'
                                                            : 'text-white/70 hover:bg-white/5 hover:text-white'
                                                    )}
                                                >
                                                    <item.icon
                                                        className={`w-5 h-5 flex-shrink-0 transition-colors ${isActive ? 'text-garabandal-dark' : 'text-white/50 group-hover:text-white'}`}
                                                    />
                                                    {!collapsed && item.label}
                                                    {badge > 0 && (collapsed ? (
                                                        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-garabandal-dark" />
                                                    ) : (
                                                        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                                                            {badge}
                                                        </span>
                                                    ))}
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
            <div className={cn("border-t border-white/10 bg-white/5 space-y-1", collapsed ? "p-2" : "p-4")}>
                <Link
                    href="/"
                    title={collapsed ? 'Voltar ao Site' : undefined}
                    className={cn(
                        "flex items-center text-white/60 hover:bg-white/5 hover:text-white rounded-xl w-full transition-all text-sm font-medium",
                        collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
                    )}
                >
                    <Home className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && 'Voltar ao Site'}
                </Link>
                <button
                    onClick={onLogout}
                    title={collapsed ? 'Terminar Sessão' : undefined}
                    className={cn(
                        "flex items-center text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl w-full transition-all text-sm font-medium",
                        collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
                    )}
                >
                    <LogOut className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && 'Terminar Sessão'}
                </button>
            </div>
        </aside>
    );
}
