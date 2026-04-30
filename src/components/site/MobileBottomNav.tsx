'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MapPin, Store, User, Menu } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useEffect, useState } from 'react';
import { useLocale } from '../../contexts/LocaleContext';

interface MobileBottomNavProps {
    onOpenMenu: () => void;
    hasMembership: boolean;
    isAuthenticated: boolean;
    isAuthLoading?: boolean;
    isMenuOpen?: boolean;
}

export default function MobileBottomNav({
    onOpenMenu,
    hasMembership,
    isAuthenticated,
    isAuthLoading = false,
    isMenuOpen = false,
}: MobileBottomNavProps) {
    const pathname = usePathname();
    const [isVisible, setIsVisible] = useState(true);
    const { t, locale } = useLocale();

    // Smart Visibility Logic
    useEffect(() => {
        // Hide on specific routes that have sticky bottom actions
        const isConflictRoute =
            (pathname?.startsWith('/peregrinacoes/') && pathname.split('/').length > 2 && !pathname.includes('/minhas-inscricoes')) ||
            (pathname?.startsWith('/en/pilgrimages/') && pathname.split('/').length > 3 && !pathname.includes('/my-registrations')) ||
            pathname?.includes('/portal-oracoes') ||
            pathname?.includes('/tornar-membro') ||
            pathname?.includes('/become-member') ||
            pathname?.includes('/donations');

        setIsVisible(!isConflictRoute);
    }, [pathname]);

    if (!isVisible) return null;

    const profileHref = hasMembership ? t.urls.member : (isAuthenticated ? t.urls.profile : t.urls.login);
    const profileLabel = isAuthLoading
        ? t.mobileNav.account
        : (hasMembership ? t.mobileNav.member : (isAuthenticated ? t.mobileNav.account : t.mobileNav.signIn));

    const isUserAreaRoute = locale === 'en'
        ? (pathname?.startsWith('/en/member') ||
           pathname?.startsWith('/en/account') ||
           pathname?.startsWith('/en/login') ||
           pathname?.startsWith('/en/register') ||
           pathname?.startsWith('/en/orders') ||
           pathname?.startsWith('/en/my-registrations'))
        : (pathname?.startsWith('/member') ||
           pathname?.startsWith('/account') ||
           pathname?.startsWith('/login') ||
           pathname?.startsWith('/register') ||
           pathname?.startsWith('/encomendas') ||
           pathname?.startsWith('/biblioteca') ||
           pathname?.startsWith('/peregrinacoes/minhas-inscricoes'));

    const NavItem = ({ href, icon: Icon, label, onClick, isActiveOverride }: { href?: string; icon: any; label: string; onClick?: () => void; isActiveOverride?: boolean }) => {
        const isActive = isActiveOverride ?? (href ? (pathname === href || (href !== '/' && href !== '/en' && pathname?.startsWith(href))) : false);

        const content = (
            <div className={cn(
                "flex flex-col items-center justify-center gap-1 transition-all duration-300 ease-out",
                isActive
                    ? "text-garabandal-gold drop-shadow-[0_0_8px_rgba(212,175,55,0.4)] transform scale-110"
                    : "text-slate-500 hover:text-slate-300"
            )}>
                <Icon className={cn("w-6 h-6", isActive && "fill-current")} strokeWidth={isActive ? 2 : 1.5} />
                <span className={cn(
                    "text-[10px] tracking-tight leading-none",
                    isActive ? "font-bold text-white drop-shadow-none" : "font-medium"
                )}>{label}</span>
            </div>
        );

        if (onClick) {
            return (
                <button onClick={onClick} className="flex-1 flex items-center justify-center py-2 active:scale-90 transition-transform outline-none touch-manipulation">
                    {content}
                </button>
            );
        }

        return (
            <Link href={href!} className="flex-1 flex items-center justify-center py-2 active:scale-90 transition-transform outline-none touch-manipulation">
                {content}
            </Link>
        );
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[90] bg-[#0B0F19]/85 backdrop-blur-xl border-t border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] lg:hidden pb-[env(safe-area-inset-bottom,16px)]">
            <div className="flex items-center justify-between px-2 h-16 pt-1">
                <NavItem href={t.urls.home} icon={Home} label={t.mobileNav.home} />
                <NavItem href={t.urls.pilgrimages} icon={MapPin} label={t.mobileNav.pilgrimages} />
                <NavItem href={t.urls.store} icon={Store} label={t.mobileNav.store} />

                {/* Member/Profile Tab */}
                <NavItem
                    href={profileHref}
                    icon={User}
                    label={profileLabel}
                    isActiveOverride={isUserAreaRoute}
                />

                {/* Menu Tab */}
                <NavItem
                    icon={Menu}
                    label={t.mobileNav.menu}
                    onClick={onOpenMenu}
                    isActiveOverride={isMenuOpen}
                />
            </div>
        </div>
    );
}
