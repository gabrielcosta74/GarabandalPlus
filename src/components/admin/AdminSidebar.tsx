"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
    FolderLock,
    Bot,
    Megaphone,
    Activity,
    Search,
    Star,
    ReceiptText,
    X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminNotifications } from '../../context/AdminNotificationContext';

type NavItem = {
    label: string;
    icon: LucideIcon;
    href: string;
    badge?: number;
    target?: string;
    /** Sub-itens: abrem indentados sob o item pai. */
    children?: NavItem[];
};

type NavGroup = {
    label: string;
    items: NavItem[];
};

const DEFAULT_OPEN_GROUPS = ['Gestão'];

/** Compara ignorando acentos e maiúsculas para o filtro rápido. */
const normalize = (value: string) =>
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function AdminSidebar({ onLogout, className, collapsed = false }: { onLogout: () => void; className?: string; collapsed?: boolean }) {
    const pathname = usePathname();
    const { counts } = useAdminNotifications();
    const [openGroups, setOpenGroups] = useState<string[]>(DEFAULT_OPEN_GROUPS);
    const [openItems, setOpenItems] = useState<string[]>([]);
    const [query, setQuery] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);

    // Tooltip da barra recolhida: posição fixa para não ser cortada pelo scroll.
    const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null);
    const showTip = (label: string, el: HTMLElement) => {
        const rect = el.getBoundingClientRect();
        setTip({ label, top: rect.top + rect.height / 2, left: rect.right + 10 });
    };
    const hideTip = () => setTip(null);

    const toggleItem = (href: string) => {
        setOpenItems(prev =>
            prev.includes(href) ? prev.filter(item => item !== href) : [...prev, href]
        );
    };

    const toggleGroup = (label: string) => {
        setOpenGroups(prev =>
            prev.includes(label)
                ? prev.filter(g => g !== label)
                : [...prev, label]
        );
    };

    const primaryItems: NavItem[] = [
        { label: 'Dashboard', icon: LayoutDashboard, href: '/admin/dashboard' },
    ];

    const navGroups: NavGroup[] = [
        {
            label: 'Gestão',
            items: [
                { label: 'Peregrinações', icon: Plane, href: '/admin/peregrinacoes', badge: counts.bookings },
                { label: 'Encomendas', icon: FileText, href: '/admin/encomendas', badge: counts.orders },
                {
                    label: 'Membros',
                    icon: Users,
                    href: '/admin/membros',
                    badge: counts.members,
                    children: [
                        { label: 'Lista de membros', icon: Users, href: '/admin/membros', badge: counts.members },
                        { label: 'Atividade', icon: Activity, href: '/admin/membros/atividade' },
                        { label: 'Voluntariado', icon: HeartHandshake, href: '/admin/membros/voluntariado' },
                    ],
                },
                { label: 'Loja & Stock', icon: ShoppingBag, href: '/admin/loja' },
                { label: 'Transações', icon: CreditCard, href: '/admin/transacoes' },
                { label: 'Faturação', icon: ReceiptText, href: '/admin/faturacao', badge: counts.factpt },
            ]
        },
        {
            label: 'Comunidade',
            items: [
                { label: 'Leads & Inscrições', icon: Target, href: '/admin/leads' },
                { label: 'Interessados (Novembro)', icon: Star, href: '/admin/leads/interessados' },
                { label: 'Acesso Antecipado (Out 2027)', icon: Sparkles, href: '/admin/leads/acesso-antecipado' },
                { label: 'Doações', icon: Heart, href: '/admin/doacoes' },
                { label: 'Convites de Membros', icon: UserPlus, href: '/admin/convites' },
                { label: 'Leilão', icon: Gavel, href: '/admin/leilao' },
                { label: 'Emails do Sistema', icon: Mail, href: '/admin/emails' },
                { label: 'Atividade Email', icon: Mail, href: '/admin/notificacoes-email' },
            ]
        },
        {
            label: 'Marketing',
            items: [
                { label: 'Marketing Platform', icon: Megaphone, href: '/admin/marketing', target: '_blank' },
                { label: 'Search Console', icon: Search, href: '/admin/search-console' },
            ]
        },
        {
            label: 'CMS · Site',
            items: [
                { label: 'Dashboard CMS', icon: BookOpen, href: '/admin/cms' },
                { label: 'Páginas', icon: FileText, href: '/admin/cms/pages' },
                { label: 'Artigos', icon: FileText, href: '/admin/cms/posts' },
                { label: 'Categorias', icon: Target, href: '/admin/cms/categories' },
            ]
        },
        {
            label: 'Espiritualidade',
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
            label: 'Sistema',
            items: [
                { label: 'Relatórios', icon: TrendingUp, href: '/admin/relatorios' },
                { label: 'Conteúdo Global', icon: Settings, href: '/admin/conteudo' },
                { label: 'Audit Logs', icon: FileText, href: '/admin/logs' },
                { label: 'Configurações', icon: Settings, href: '/admin/configuracoes' },
            ]
        }
    ];

    // O href activo é o mais específico que casa com a rota actual, para que
    // páginas de detalhe (/admin/cms/posts/123) continuem a marcar o menu.
    const activeHref = useMemo(() => {
        const hrefs = [...primaryItems, ...navGroups.flatMap(g => g.items)]
            .flatMap(item => [item.href, ...(item.children || []).map(child => child.href)]);
        return hrefs
            .filter(href => pathname === href || pathname?.startsWith(`${href}/`))
            .sort((a, b) => b.length - a.length)[0] ?? null;
    }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

    // Abre automaticamente o grupo (e o sub-menu) da página em que estamos.
    useEffect(() => {
        if (!activeHref) return;
        const owner = navGroups.find(group => group.items.some(item =>
            item.href === activeHref || (item.children || []).some(child => child.href === activeHref)
        ));
        if (owner) setOpenGroups(prev => (prev.includes(owner.label) ? prev : [...prev, owner.label]));

        const parent = navGroups
            .flatMap(group => group.items)
            .find(item => (item.children || []).some(child => child.href === activeHref));
        if (parent) setOpenItems(prev => (prev.includes(parent.href) ? prev : [...prev, parent.href]));
    }, [activeHref]); // eslint-disable-line react-hooks/exhaustive-deps

    // "/" foca o filtro rápido, Esc limpa.
    useEffect(() => {
        if (collapsed) return;
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
            if (event.key === '/' && !typing && !target?.isContentEditable) {
                event.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [collapsed]);

    const isFiltering = !collapsed && query.trim().length > 0;
    const needle = normalize(query.trim());
    const labelMatches = (item: NavItem) => normalize(item.label).includes(needle);

    /** A filtrar, um pai fica visível se ele ou algum filho casar com a procura. */
    const filterItem = (item: NavItem): NavItem | null => {
        if (!isFiltering) return item;
        const children = (item.children || []).filter(labelMatches);
        if (labelMatches(item)) return item;
        return children.length > 0 ? { ...item, children } : null;
    };

    const visibleItems = (items: NavItem[]) =>
        items.map(filterItem).filter((item): item is NavItem => item !== null);

    const visiblePrimary = visibleItems(primaryItems);
    const visibleGroups = navGroups
        .map(group => ({ ...group, items: visibleItems(group.items) }))
        .filter(group => group.items.length > 0);

    const renderItem = (item: NavItem): React.ReactNode => {
        // Item com sub-menu: o pai passa a ser o interruptor do grupo.
        if (item.children && item.children.length > 0 && !collapsed) {
            const isOpen = isFiltering || openItems.includes(item.href);
            const hasActiveChild = item.children.some(child => child.href === activeHref);
            const badge = item.badge || 0;
            return (
                <div key={item.href}>
                    <button
                        type="button"
                        onClick={() => toggleItem(item.href)}
                        aria-expanded={isOpen}
                        className={cn(
                            'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] leading-none transition-[background-color,color] duration-200',
                            hasActiveChild && !isOpen
                                ? 'bg-slate-900/[0.055] font-semibold text-slate-900'
                                : 'font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                        )}
                    >
                        <item.icon
                            strokeWidth={1.75}
                            className={cn(
                                'h-[19px] w-[19px] flex-shrink-0 transition-colors duration-200',
                                hasActiveChild ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-700'
                            )}
                        />
                        <span className="truncate">{item.label}</span>
                        {badge > 0 && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold leading-none text-white">
                                {badge > 99 ? '99+' : badge}
                            </span>
                        )}
                        <motion.span
                            animate={{ rotate: isOpen ? 0 : -90 }}
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            className="ml-auto flex text-slate-300 transition-colors group-hover:text-slate-500"
                        >
                            <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
                        </motion.span>
                    </button>

                    <AnimatePresence initial={false}>
                        {isOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                                className="overflow-hidden"
                            >
                                <div className="relative ml-[22px] mt-1 space-y-1 border-l border-slate-200 pl-3">
                                    {item.children.map(child => renderItem(child))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            );
        }

        const isActive = item.href === activeHref;
        const badge = item.badge || 0;
        return (
            <Link
                key={item.href}
                href={item.href}
                target={item.target || '_self'}
                aria-current={isActive ? 'page' : undefined}
                aria-label={collapsed ? item.label : undefined}
                onMouseEnter={collapsed ? (e) => showTip(item.label, e.currentTarget) : undefined}
                onMouseLeave={collapsed ? hideTip : undefined}
                onFocus={collapsed ? (e) => showTip(item.label, e.currentTarget) : undefined}
                onBlur={collapsed ? hideTip : undefined}
                className={cn(
                    'group relative flex items-center rounded-xl text-[15px] leading-none transition-[background-color,color,transform] duration-200 ease-out active:scale-[0.985]',
                    collapsed ? 'h-11 w-11 justify-center' : 'gap-3 px-3 py-2.5',
                    isActive
                        ? 'bg-slate-900/[0.055] font-semibold text-slate-900'
                        : cn(
                            'font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900',
                            !collapsed && 'hover:translate-x-[2px]'
                        )
                )}
            >
                {isActive && (
                    <span
                        aria-hidden
                        className={cn(
                            'absolute rounded-full bg-garabandal-gold',
                            collapsed
                                ? 'inset-x-3 bottom-1 h-[2.5px]'
                                : 'left-0 top-1/2 h-5 w-[3px] -translate-y-1/2'
                        )}
                    />
                )}
                <item.icon
                    strokeWidth={1.75}
                    className={cn(
                        'h-[19px] w-[19px] flex-shrink-0 transition-colors duration-200',
                        isActive ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-700'
                    )}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {badge > 0 && (collapsed ? (
                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                ) : (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold leading-none text-white">
                        {badge > 99 ? '99+' : badge}
                    </span>
                ))}
            </Link>
        );
    };

    return (
        <aside className={cn(
            "font-admin sticky top-0 flex h-screen flex-shrink-0 flex-col border-r border-slate-200/70 bg-white text-slate-900 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            collapsed ? "w-[76px]" : "w-[288px]",
            className
        )}>
            {/* Filtro rápido — substitui o antigo bloco de marca */}
            {collapsed ? (
                <div className="h-5" />
            ) : (
                <div className="px-4 pb-1 pt-5">
                    <div className="relative">
                        <Search
                            strokeWidth={1.75}
                            className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
                        />
                        <input
                            ref={searchRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    setQuery('');
                                    searchRef.current?.blur();
                                }
                            }}
                            placeholder="Procurar"
                            aria-label="Procurar no menu"
                            className="h-11 w-full rounded-xl bg-slate-100/80 pl-10 pr-9 text-[14.5px] font-medium text-slate-800 outline-none transition-all duration-200 placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
                        />
                        {query ? (
                            <button
                                type="button"
                                onClick={() => { setQuery(''); searchRef.current?.focus(); }}
                                aria-label="Limpar procura"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        ) : (
                            <kbd className="pointer-events-none absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md bg-white/80 text-[11px] font-semibold text-slate-400 ring-1 ring-slate-200">
                                /
                            </kbd>
                        )}
                    </div>
                </div>
            )}

            {/* Navegação */}
            <nav className={cn(
                "admin-nav-scroll flex-1 overflow-y-auto",
                collapsed ? "flex flex-col items-center gap-1 px-4 pb-3" : "px-4 pb-3"
            )}>
                {visiblePrimary.length > 0 && (
                    <div className={cn("space-y-1", !collapsed && "pt-3")}>
                        {visiblePrimary.map(renderItem)}
                    </div>
                )}

                {visibleGroups.map((group, idx) => {
                    // Recolhida ou a filtrar, os grupos ficam sempre abertos.
                    const isOpen = collapsed || isFiltering || openGroups.includes(group.label);
                    // Fechado, o cabeçalho resume os pendentes que estão lá dentro.
                    const groupBadge = group.items.reduce((sum, item) => sum + (item.badge || 0), 0);
                    return (
                        <div key={group.label} className={cn(!collapsed && (idx === 0 && visiblePrimary.length === 0 ? "pt-3" : "pt-5"))}>
                            {collapsed ? (
                                (idx > 0 || visiblePrimary.length > 0) && <div className="mx-auto my-2 h-px w-6 bg-slate-200" />
                            ) : (
                                <button
                                    onClick={() => toggleGroup(group.label)}
                                    aria-expanded={isOpen}
                                    className="group/header mb-1.5 flex w-full items-center gap-2 rounded-lg px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 transition-colors hover:text-slate-700"
                                >
                                    <span className="truncate">{group.label}</span>
                                    {!isOpen && groupBadge > 0 && (
                                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none tracking-normal text-white">
                                            {groupBadge > 99 ? '99+' : groupBadge}
                                        </span>
                                    )}
                                    <motion.span
                                        animate={{ rotate: isOpen ? 0 : -90 }}
                                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                        className="ml-auto flex text-slate-300 transition-colors group-hover/header:text-slate-500"
                                    >
                                        <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
                                    </motion.span>
                                </button>
                            )}

                            <AnimatePresence initial={false}>
                                {isOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                                        className="space-y-1 overflow-hidden"
                                    >
                                        {group.items.map(renderItem)}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}

                {isFiltering && visiblePrimary.length === 0 && visibleGroups.length === 0 && (
                    <p className="px-3 pt-8 text-[14px] text-slate-400">Sem resultados para “{query.trim()}”.</p>
                )}
            </nav>

            {/* Rodapé */}
            <div className={cn(
                "border-t border-slate-200/70",
                collapsed ? "flex flex-col items-center gap-1 px-4 py-3" : "space-y-1 px-4 py-3"
            )}>
                <Link
                    href="/"
                    aria-label={collapsed ? 'Voltar ao Site' : undefined}
                    onMouseEnter={collapsed ? (e) => showTip('Voltar ao Site', e.currentTarget) : undefined}
                    onMouseLeave={collapsed ? hideTip : undefined}
                    className={cn(
                        "group flex items-center rounded-xl text-[15px] font-medium leading-none text-slate-500 transition-[background-color,color,transform] duration-200 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.985]",
                        collapsed ? "h-11 w-11 justify-center" : "gap-3 px-3 py-2.5"
                    )}
                >
                    <Home strokeWidth={1.75} className="h-[19px] w-[19px] flex-shrink-0 text-slate-400 transition-colors group-hover:text-slate-700" />
                    {!collapsed && 'Voltar ao Site'}
                </Link>
                <button
                    onClick={onLogout}
                    aria-label={collapsed ? 'Terminar Sessão' : undefined}
                    onMouseEnter={collapsed ? (e) => showTip('Terminar Sessão', e.currentTarget) : undefined}
                    onMouseLeave={collapsed ? hideTip : undefined}
                    className={cn(
                        "group flex items-center rounded-xl text-[15px] font-medium leading-none text-slate-500 transition-[background-color,color,transform] duration-200 hover:bg-rose-50 hover:text-rose-600 active:scale-[0.985]",
                        collapsed ? "h-11 w-11 justify-center" : "w-full gap-3 px-3 py-2.5"
                    )}
                >
                    <LogOut strokeWidth={1.75} className="h-[19px] w-[19px] flex-shrink-0 text-slate-400 transition-colors group-hover:text-rose-500" />
                    {!collapsed && 'Terminar Sessão'}
                </button>
            </div>

            {/* Tooltip da barra recolhida (fixa, para escapar ao scroll da nav) */}
            <AnimatePresence>
                {collapsed && tip && (
                    <motion.span
                        role="tooltip"
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -4 }}
                        transition={{ duration: 0.14, ease: 'easeOut' }}
                        style={{ top: tip.top, left: tip.left }}
                        className="pointer-events-none fixed z-[60] -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[13px] font-medium text-white shadow-lg shadow-slate-900/15"
                    >
                        {tip.label}
                    </motion.span>
                )}
            </AnimatePresence>
        </aside>
    );
}
