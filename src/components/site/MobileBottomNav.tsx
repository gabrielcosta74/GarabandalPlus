'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MapPin, Store, User, Menu } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useEffect, useState } from 'react';

interface MobileBottomNavProps {
    onOpenMenu: () => void;
    hasMembership: boolean;
}

export default function MobileBottomNav({ onOpenMenu, hasMembership }: MobileBottomNavProps) {
    const pathname = usePathname();
    const [isVisible, setIsVisible] = useState(true);

    // Smart Visibility Logic
    useEffect(() => {
        // Hide on specific routes that have sticky bottom actions
        const isConflictRoute =
            (pathname?.startsWith('/peregrinacoes/') && pathname.split('/').length > 2 && !pathname.includes('/minhas-inscricoes')) || // Pilgrimage Details (but not "My Bookings")
            pathname?.includes('/tornar-membro') || // Membership Signup
            pathname?.includes('/donations'); // Donations

        setIsVisible(!isConflictRoute);
    }, [pathname]);

    if (!isVisible) return null;

    const NavItem = ({ href, icon: Icon, label, onClick, isActiveOverride }: { href?: string; icon: any; label: string; onClick?: () => void; isActiveOverride?: boolean }) => {
        const isActive = isActiveOverride ?? (href ? (pathname === href || (href !== '/' && pathname?.startsWith(href))) : false);

        const content = (
            <div className={cn(
                "flex flex-col items-center justify-center gap-1 transition-all duration-300",
                isActive ? "text-yellow-600 transform scale-105" : "text-slate-400 hover:text-slate-600"
            )}>
                <Icon className={cn("w-6 h-6", isActive && "fill-current")} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-bold tracking-tight leading-none">{label}</span>
            </div>
        );

        if (onClick) {
            return (
                <button onClick={onClick} className="flex-1 flex items-center justify-center py-2 active:scale-95 transition-transform outline-none touch-manipulation">
                    {content}
                </button>
            );
        }

        return (
            <Link href={href!} className="flex-1 flex items-center justify-center py-2 active:scale-95 transition-transform outline-none touch-manipulation">
                {content}
            </Link>
        );
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[90] bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] lg:hidden safe-area-bottom pb-1">
            <div className="flex items-center justify-between px-2 h-16">
                <NavItem href="/" icon={Home} label="Início" />
                <NavItem href="/peregrinacoes" icon={MapPin} label="Viagens" />
                <NavItem href="/loja-online" icon={Store} label="Loja" />

                {/* Member/Profile Tab */}
                <NavItem
                    href={hasMembership ? "/member" : "/login"}
                    icon={User}
                    label={hasMembership ? "Membro" : "Entrar"}
                    isActiveOverride={pathname?.startsWith('/member') || pathname?.startsWith('/login') || pathname?.startsWith('/account')}
                />

                {/* Menu Tab */}
                <NavItem
                    icon={Menu}
                    label="Menu"
                    onClick={onOpenMenu}
                    isActiveOverride={false}
                />
            </div>
        </div>
    );
}
