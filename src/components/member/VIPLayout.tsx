"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../lib/supabase-browser';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    BookOpen,
    Menu,
    MapPin,
    X,
    Flame,
    Calendar,
    Film,
    User,
    Clock,
    CreditCard,
    Sparkles,
    Video,
    Crown,
    LogOut
} from 'lucide-react';

type VIPLayoutProps = {
    children: React.ReactNode;
    allowPublic?: boolean;
};

export default function VIPLayout({ children, allowPublic }: VIPLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [ready, setReady] = useState(false);
    const [user, setUser] = useState<{ email?: string; isMember?: boolean; name?: string; avatarUrl?: string } | null>(null);

    useEffect(() => {
        let mounted = true;
        const checkSession = async () => {
            try {
                if (!supabaseBrowser) {
                    throw new Error("Supabase client not initialized");
                }

                // Race Promise: Auth check vs Timeout
                const sessionPromise = supabaseBrowser.auth.getSession();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Timeout")), 5000)
                );

                const { data } = await Promise.race([sessionPromise, timeoutPromise]) as any;

                if (!data.session?.user) {
                    if (allowPublic) {
                        setReady(true); // Public access allowed, just render content
                        return;
                    }
                    if (mounted) {
                        const next = pathname ? `?next=${encodeURIComponent(pathname)}` : '';
                        router.replace(`/login${next}`);
                    }
                    return;
                }

                const { data: member, error: memberError } = await supabaseBrowser
                    .from('membros')
                    .select('is_membro, nome, avatar_url')
                    .eq('id', data.session.user.id)
                    .maybeSingle();

                if (!mounted) return;

                if (memberError) console.error("Member fetch error:", memberError);

                if (!member?.is_membro) {
                    if (!allowPublic) {
                        router.replace('/tornar-membro');
                        return;
                    }
                    // If allowPublic is true, we allow them to proceed as "Guest/Partial Member"
                    // But we might want to ensure 'user.isMember' is false in state
                }

                setUser({
                    email: data.session.user.email,
                    isMember: !!member?.is_membro,
                    name: member?.nome || undefined,
                    avatarUrl: member?.avatar_url || undefined
                });
                setReady(true);

            } catch (error) {
                console.error("Session check failed:", error);
                if (allowPublic) {
                    setReady(true);
                } else if (mounted) {
                    router.replace('/login');
                }
            }
        };

        checkSession();

        return () => { mounted = false; };
    }, [pathname, router]);

    const handleLogout = async () => {
        if (supabaseBrowser) {
            await supabaseBrowser.auth.signOut();
            router.replace('/login');
        }
    };

    const navItems = [
        { icon: BookOpen, label: 'Sobre Garabandal', href: '/member/espiritualidade' },
        { icon: Film, label: 'Cursos de Aprendizagem', href: '/member/cursos' },
        { icon: Flame, label: 'Enviar Intenções', href: '/member/velas' },
        { icon: Calendar, label: 'Novenas', href: '/member/novenas' },
        { icon: Video, label: 'Ao Vivo', href: '/member/live' },
        { icon: MapPin, label: 'Peregrinações', href: '/peregrinacoes' },
        { icon: Sparkles, label: 'Orações', href: '/member/prayers' },
        { icon: CreditCard, label: 'Quotas', href: '/member/quotas' },
        { label: 'Histórico', href: '/member/history', icon: Clock },
        { label: 'Perfil', href: '/account/profile', icon: User },
    ];

    const isAdmin = user?.email?.toLowerCase() === 'geral@apostoladodegarabandal.com' || user?.email === 'Gabrielcosta2908@gmail.com';

    if (!ready) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-yellow-600 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-yellow-500/30">
            {/* Top Navigation Bar */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/5">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-20">
                        {/* Logo / Brand */}
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-yellow-600 to-yellow-800 rounded-lg shadow-lg shadow-yellow-900/20">
                                <Crown className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="font-serif text-lg font-bold tracking-wide text-white">Garabandal</h1>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-yellow-500/80 font-medium">Área Exclusiva</p>
                            </div>
                        </div>

                        {/* Desktop Nav */}
                        <div className="hidden md:flex items-center gap-1">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`px-2 lg:px-3 py-2 rounded-lg text-xs lg:text-sm font-medium transition-all duration-200 flex items-center gap-1.5 lg:gap-2
                                        ${pathname === item.href
                                            ? 'bg-white/10 text-white shadow-inner'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    <item.icon className={`w-4 h-4 ${pathname === item.href ? 'text-yellow-500' : 'opacity-70'}`} />
                                    {item.label}
                                </Link>
                            ))}
                        </div>

                        {/* User / Mobile Toggle */}
                        <div className="flex items-center gap-4">

                            {/* USER DROPDOWN (DESKTOP) */}
                            {/* USER DROPDOWN (DESKTOP) */}
                            <div className="hidden md:flex items-center gap-4">
                                {user ? (
                                    <>
                                        <span className="text-sm font-medium text-white text-right">
                                            <div className="leading-none">{user.name || 'Membro'}</div>
                                            <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-bold">
                                                {isAdmin ? 'Administrador' : 'Membro VIP'}
                                            </div>
                                        </span>

                                        <div className="relative">
                                            <button
                                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                                className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 p-[2px] shadow-lg shadow-yellow-900/20 transition-transform hover:scale-105 active:scale-95"
                                            >
                                                <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
                                                    {user.avatarUrl ? (
                                                        <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                                                    ) : user.name ? (
                                                        <span className="font-bold text-yellow-500 text-lg">{user.name.charAt(0).toUpperCase()}</span>
                                                    ) : (
                                                        <User className="w-5 h-5 text-yellow-500" />
                                                    )}
                                                </div>
                                            </button>

                                            {/* DROPDOWN MENU */}
                                            <AnimatePresence>
                                                {isDropdownOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                            className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                                                        >
                                                            <div className="p-2 space-y-1">
                                                                <Link
                                                                    href="/account/profile"
                                                                    onClick={() => setIsDropdownOpen(false)}
                                                                    className="flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors border-l-2 border-transparent hover:border-yellow-500"
                                                                >
                                                                    <User className="w-4 h-4 text-slate-400" />
                                                                    Meu Perfil
                                                                </Link>

                                                                {isAdmin && (
                                                                    <Link
                                                                        href="/admin"
                                                                        onClick={() => setIsDropdownOpen(false)}
                                                                        className="flex items-center gap-3 px-3 py-2 text-sm text-yellow-500 hover:bg-yellow-500/10 rounded-lg transition-colors font-bold border-l-2 border-transparent hover:border-yellow-500"
                                                                    >
                                                                        <LayoutDashboard className="w-4 h-4" />
                                                                        Painel Admin
                                                                    </Link>
                                                                )}
                                                            </div>
                                                            <div className="p-2 border-t border-white/10">
                                                                <button
                                                                    onClick={handleLogout}
                                                                    className="flex items-center gap-3 px-3 py-2 w-full text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border-l-2 border-transparent hover:border-red-500"
                                                                >
                                                                    <LogOut className="w-4 h-4" />
                                                                    Terminar Sessão
                                                                </button>
                                                            </div>
                                                        </motion.div>
                                                    </>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </>
                                ) : (
                                    <Link href="/login" className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-bold text-sm transition-all shadow-lg shadow-yellow-900/20">
                                        Entrar
                                    </Link>
                                )}
                            </div>

                            {/* MOBILE MENU BUTTON */}
                            <button
                                onClick={() => setIsMobileOpen(true)}
                                className="md:hidden p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <Menu className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Mobile Sidebar */}
            <AnimatePresence>
                {isMobileOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden"
                        />
                        <motion.aside
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed inset-y-0 right-0 w-72 bg-slate-900 shadow-2xl z-50 md:hidden border-l border-white/5 flex flex-col"
                        >
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <h2 className="font-serif text-xl font-medium text-white">Menu</h2>
                                <button onClick={() => setIsMobileOpen(false)} className="text-slate-400 hover:text-white">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="flex-1 p-4 space-y-2 overflow-y-auto">
                                {navItems.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setIsMobileOpen(false)}
                                        className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all
                                            ${pathname === item.href
                                                ? 'bg-yellow-600/10 text-yellow-500 border border-yellow-600/20'
                                                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                            }`}
                                    >
                                        <item.icon className="w-5 h-5" />
                                        <span className="font-medium">{item.label}</span>
                                    </Link>
                                ))}
                            </div>
                            <div className="p-4 border-t border-white/5 space-y-4">
                                <div className="flex items-center gap-3 px-2">
                                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 overflow-hidden flex items-center justify-center">
                                        {user?.avatarUrl ? (
                                            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="font-bold text-yellow-500">{user?.name?.charAt(0)}</span>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-white font-medium text-sm">{user?.name || 'Membro'}</p>
                                        <p className="text-white/40 text-xs">{user?.email}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-3 px-4 py-3 w-full text-red-400 hover:bg-red-500/10 rounded-xl transition-colors font-medium"
                                >
                                    <LogOut className="w-5 h-5" />
                                    Terminar Sessão
                                </button>
                                {isAdmin && (
                                    <Link
                                        href="/admin"
                                        className="flex items-center gap-3 px-4 py-3 w-full text-yellow-500 hover:bg-yellow-500/10 rounded-xl transition-colors font-medium mt-2"
                                    >
                                        <LayoutDashboard className="w-5 h-5" />
                                        Painel Admin
                                    </Link>
                                )}
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="pt-20 min-h-screen relative overflow-hidden">
                {/* Background ambient effects */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-blue-900/20 via-slate-900/0 to-transparent pointer-events-none" />
                <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-yellow-600/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        {children}
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
