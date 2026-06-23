'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MapPin, Store, User, Menu } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
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
    const [hidden, setHidden] = useState(false);
    const lastScroll = useRef(0);
    const { t, locale } = useLocale();

    // Smart Visibility Logic — hide on routes with their own sticky bottom actions
    useEffect(() => {
        const isConflictRoute =
            (pathname?.startsWith('/peregrinacoes/') && pathname.split('/').length > 2 && !pathname.includes('/minhas-inscricoes')) ||
            (pathname?.startsWith('/en/pilgrimages/') && pathname.split('/').length > 3 && !pathname.includes('/my-registrations')) ||
            pathname?.includes('/portal-oracoes') ||
            pathname?.includes('/tornar-membro') ||
            pathname?.includes('/become-member') ||
            pathname?.includes('/donations');

        setIsVisible(!isConflictRoute);
    }, [pathname]);

    // Dynamic hide-on-scroll-down, reveal-on-scroll-up
    useEffect(() => {
        const onScroll = () => {
            const y = window.scrollY;
            const goingDown = y > lastScroll.current;
            // Only react to meaningful movement to avoid jitter
            if (Math.abs(y - lastScroll.current) > 6) {
                setHidden(goingDown && y > 320);
                lastScroll.current = y;
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

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
            <motion.div
                whileTap={{ scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                className={cn(
                    'flex flex-col items-center justify-center gap-1 transition-colors duration-300',
                    isActive ? 'text-garabandal-gold' : 'text-slate-700'
                )}
            >
                <Icon
                    className={cn('h-6 w-6', isActive && 'fill-current')}
                    strokeWidth={isActive ? 2.2 : 2}
                />
                <span className={cn(
                    'text-[10px] leading-none tracking-tight',
                    isActive ? 'font-bold text-garabandal-dark' : 'font-medium'
                )}>{label}</span>
            </motion.div>
        );

        if (onClick) {
            return (
                <button onClick={onClick} className="flex flex-1 items-center justify-center py-2 outline-none touch-manipulation">
                    {content}
                </button>
            );
        }

        return (
            <Link href={href!} className="flex flex-1 items-center justify-center py-2 outline-none touch-manipulation">
                {content}
            </Link>
        );
    };

    return (
        <motion.div
            initial={false}
            animate={{ y: hidden ? 160 : 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-0 left-0 right-0 z-[90] border-t border-white/40 bg-white/70 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/55 lg:hidden pb-[env(safe-area-inset-bottom,16px)]"
        >
            <div className="flex h-16 items-center justify-between px-2 pt-1">
                <NavItem href={t.urls.home} icon={Home} label={t.mobileNav.home} />
                <NavItem href={t.urls.pilgrimages} icon={MapPin} label={t.mobileNav.pilgrimages} />
                <NavItem href={t.urls.store} icon={Store} label={t.mobileNav.store} />
                <NavItem
                    href={profileHref}
                    icon={User}
                    label={profileLabel}
                    isActiveOverride={isUserAreaRoute}
                />
                <NavItem
                    icon={Menu}
                    label={t.mobileNav.menu}
                    onClick={onOpenMenu}
                    isActiveOverride={isMenuOpen}
                />
            </div>
        </motion.div>
    );
}
