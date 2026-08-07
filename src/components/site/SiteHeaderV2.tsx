"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from '../../contexts/LocaleContext';
import { useAuth } from '../../contexts/AuthContext';
import { isActiveMember } from '../../lib/store-discounts';
import { loadCart } from '../../app/loja-online/data';
import { motion, AnimatePresence, useScroll } from 'framer-motion';
import {
  ShoppingBag, Menu, X, ChevronDown, User, LogOut, Heart, Home, MapPin,
  ShieldCheck, BookOpen, CreditCard, LayoutDashboard, Ticket, Store, Compass,
  Scroll, MessageCircleHeart, Users, Sparkles, Info, Gavel,
} from 'lucide-react';
import MobileBottomNav from './MobileBottomNav';
import MobilePilgrimagePaymentCard from './MobilePilgrimagePaymentCard';
import { CATEGORIES, PUBLIC_NAV_ORDER, type CategoryKey } from '../../lib/cms/categories';
import { isAdminEmail } from '../../lib/admin-emails';
import { localeSwitchHref } from '../../lib/i18n/locale-switch';

/**
 * SiteHeaderV2 — two-tier navigation for the merged content + transactional
 * site (post-Webnode migration). Structure:
 *
 *   Top row (transactional): Peregrinações · Loja · Doar · [Membro CTA] · cart · user · lang
 *   Main row (content):      Sobre · História · Ensinamentos · Mensagens · Testemunhos · Profecias
 *
 * Each content link is a direct anchor to /<slug> on mobile, or a hover
 * dropdown on desktop (mega-menu polish lands in Phase C; Phase A ships a
 * functional dropdown with the category tagline + "Ver tudo" link).
 *
 * Gated: rendered only when the V2 flag is on (env flag or admin-preview
 * cookie). Falls through to V1 SiteHeader otherwise.
 *
 * Gemini: visual styling is intentionally minimal here — restyle freely. Do
 * not change the data/structure of nav links (they're driven by CATEGORIES
 * and t.urls so editing here will desync from CMS).
 */

const ICONS: Record<CategoryKey, typeof Scroll> = {
  historia: Scroll,
  ensinamentos: BookOpen,
  mensagens: MessageCircleHeart,
  testemunhos: Users,
  profecias: Sparkles,
  noticias: Info,
};

type NavHighlights = Record<string, { href: string; items: { title: string; href: string }[] }>;

export default function SiteHeaderV2() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale } = useLocale();
  const { user, isMember, memberData, loading, signOut } = useAuth();

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<CategoryKey | 'content' | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [highlights, setHighlights] = useState<NavHighlights>({});
  const [openMobileCat, setOpenMobileCat] = useState<CategoryKey | null>(null);
  const { scrollY } = useScroll();

  useEffect(() => { setMounted(true); }, []);

  // Mega-menu article links per category (preview-aware via cookie on the API).
  useEffect(() => {
    let active = true;
    fetch(`/api/nav/highlights?locale=${locale}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => { if (active) setHighlights(d as NavHighlights); })
      .catch(() => { /* nav still works via the category link */ });
    return () => { active = false; };
  }, [locale]);

  useEffect(() => {
    return scrollY.on('change', (latest: number) => {
      setScrolled(latest > 20);
      const prev = scrollY.getPrevious() ?? 0;
      if (latest > prev && latest > 100) setHidden(true);
      else setHidden(false);
    });
  }, [scrollY]);

  useEffect(() => {
    const refresh = () => {
      try { setCartCount(loadCart().reduce((s, i) => s + i.qty, 0)); } catch { /* noop */ }
    };
    refresh();
    window.addEventListener('cart:updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('cart:updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileOpen]);

  const hasMembership = !!memberData?.is_membro;
  const membershipHref = hasMembership ? t.urls.member : t.urls.becomeMember;
  const localePrefix = locale === 'pt' ? '' : '/en';
  // "Sobre o Apostolado" points to the migrated Webnode about page at its
  // original (SEO-preserved) URL, rather than a new /sobre-o-apostolado slug.
  const aboutHref = locale === 'pt' ? '/apostolado-garabandal' : '/en/our-apostolate';

  const handleLogout = async () => {
    await signOut();
    setUserMenuOpen(false);
    setIsMobileOpen(false);
    router.replace('/');
    router.refresh();
  };

  const isHomePage = pathname === '/' || pathname === '/en';
  // Transparent over the dark Hero only at the top of the homepage; turns into
  // the solid white glass bar once scrolled (or on any other page).
  const transparent = isHomePage && !scrolled;

  // Shared styling for the circular action buttons (language / cart / menu).
  // Dark text/icons on every state — the bar always sits on a light (glass) fill.
  const circleBtn = transparent
    ? 'bg-white/50 hover:bg-white/70 text-slate-700 hover:text-garabandal-dark border border-white/50 backdrop-blur-md'
    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-garabandal-dark border border-slate-200 shadow-sm';

  return (
    <>
      <header
        className={`fixed left-0 right-0 z-[100] hidden lg:block transition-transform duration-500 ease-in-out top-3 sm:top-5 ${hidden ? '-translate-y-[150%]' : 'translate-y-0'}`}
      >
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div
            className={`flex items-center justify-between transition-all duration-500 ease-in-out rounded-[2rem] h-[4.5rem] px-4 sm:px-6 ${scrolled ? 'py-1' : 'py-2'} ${transparent ? 'bg-white/40 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-transparent' : 'bg-white/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-200/50'}`}
          >
            {/* 1. Brand Logo */}
            <Link href={locale === 'pt' ? '/' : '/en'} className="flex items-center gap-3 sm:gap-4 group focus:outline-none">
              <div className="relative w-11 h-11 overflow-hidden rounded-2xl shadow-md transition-transform duration-300 group-hover:scale-105 group-active:scale-95">
                <Image
                  src="/apple-touch-icon.png"
                  alt="Nossa Senhora de Garabandal"
                  fill
                  sizes="44px"
                  className="object-cover"
                />
              </div>
              <div className="hidden lg:flex flex-col justify-center">
                <span className="font-serif text-lg xl:text-xl font-bold tracking-tight leading-none text-garabandal-dark">
                  Apostolado
                </span>
              </div>
            </Link>

            {/* 2. Central Navigation (Desktop) */}
            <nav className="hidden lg:flex items-center justify-center flex-1 mx-4 xl:mx-8 gap-1">
              <NavPill href={aboutHref} label={locale === 'pt' ? 'Apostolado' : 'Apostolate'} active={pathname === aboutHref} icon={Compass} transparent={transparent} />

              {/* Mega Dropdown for Content Categories */}
              <div
                className="relative h-full flex items-center"
                onMouseEnter={() => setOpenDropdown('content')}
                onMouseLeave={() => setOpenDropdown(null)}
              >
                <button className={`px-4 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all duration-300 hover:scale-[1.04] ${openDropdown === 'content' ? 'bg-slate-100 text-garabandal-dark' : 'text-slate-700 hover:text-garabandal-dark hover:bg-slate-100/80'}`}>
                  <BookOpen size={16} className="opacity-70" />
                  {locale === 'pt' ? 'História' : 'The Message'}
                  <ChevronDown size={14} className={`transition-transform duration-300 opacity-50 ${openDropdown === 'content' ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {openDropdown === 'content' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className="absolute top-full left-1/2 -translate-x-1/2 pt-4 z-50 origin-top"
                    >
                      <div className="w-[600px] xl:w-[650px] bg-white rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] border border-slate-100 p-6 grid grid-cols-2 gap-x-6 gap-y-3 relative">
                        {/* Little triangle pointer */}
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-t border-l border-slate-100 rotate-45" />

                        {PUBLIC_NAV_ORDER.map(key => {
                          const meta = CATEGORIES[key][locale];
                          const href = `${localePrefix}/${meta.slug}`;
                          const Icon = ICONS[key];
                          return (
                            <Link key={key} href={href} className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors group/item relative z-10">
                              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover/item:bg-garabandal-gold/20 group-hover/item:text-garabandal-dark transition-colors shrink-0 shadow-sm">
                                <Icon size={20} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-garabandal-dark mb-1">{meta.label}</p>
                                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{meta.tagline}</p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <NavPill href={t.urls.pilgrimages} label={t.nav.pilgrimages} active={pathname === t.urls.pilgrimages} icon={MapPin} transparent={transparent} />
              <NavPill href={t.urls.store} label={t.nav.store} active={pathname === t.urls.store} icon={Store} transparent={transparent} />
              <NavPill href={t.urls.donations} label={t.nav.donations} active={pathname === t.urls.donations} icon={Heart} transparent={transparent} />
            </nav>

            {/* 3. Actions (Right side) */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Language */}
              <button
                onClick={() => {
                  router.push(localeSwitchHref(pathname, locale === 'pt' ? 'en' : 'pt'));
                }}
                className={`hidden sm:flex items-center justify-center w-11 h-11 rounded-full transition-all text-xs font-bold ${circleBtn}`}
                aria-label="Switch language"
              >
                {locale === 'pt' ? 'EN' : 'PT'}
              </button>

              {/* Cart */}
              <Link href={t.urls.checkout} aria-label={t.nav.cart.label} className={`relative flex items-center justify-center w-11 h-11 rounded-full transition-all ${circleBtn}`}>
                <ShoppingBag size={20} />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-garabandal-gold text-garabandal-dark text-[10px] font-bold flex items-center justify-center shadow-sm ring-2 ring-white">
                    {cartCount}
                  </span>
                )}
              </Link>

              {/* User/Auth */}
              {mounted && !loading && (
                user ? (
                  <UserPill user={user} memberData={memberData} isMember={isMember} open={userMenuOpen} setOpen={setUserMenuOpen} t={t} onLogout={handleLogout} />
                ) : (
                  <div className="hidden lg:flex items-center gap-2">
                    <Link href={t.urls.login} className="px-5 py-2.5 rounded-full text-sm font-bold transition-colors text-slate-700 hover:text-garabandal-dark hover:bg-slate-50">
                      {t.nav.signIn}
                    </Link>
                    <Link href={t.urls.register} className="px-6 py-2.5 rounded-full text-sm font-bold bg-garabandal-gold text-garabandal-dark shadow-md hover:shadow-lg hover:scale-105 transition-all">
                      {t.nav.createAccount}
                    </Link>
                  </div>
                )
              )}

              {/* CTA for Mobile/Member */}
              {mounted && !loading && user && (
                <Link
                  href={membershipHref}
                  className={`hidden xl:flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all ${hasMembership ? 'bg-garabandal-gold/20 text-garabandal-dark' : 'bg-garabandal-gold text-garabandal-dark'}`}
                >
                  <CreditCard size={16} className="opacity-70" />
                  {hasMembership ? t.nav.memberArea : t.nav.becomeMember}
                </Link>
              )}

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsMobileOpen(true)}
                className={`lg:hidden flex items-center justify-center w-11 h-11 rounded-full transition-all ${circleBtn}`}
                aria-label={t.nav.openMenu}
              >
                <Menu size={22} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE DRAWER — Refined aesthetics */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 z-[150] bg-slate-900/40 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 250 }}
              className="fixed inset-y-0 right-0 z-[160] w-full max-w-sm bg-white shadow-2xl lg:hidden flex flex-col rounded-l-3xl"
            >
              <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100/50">
                <span className="font-serif text-2xl font-bold text-garabandal-dark">
                  Menu
                </span>
                <button onClick={() => setIsMobileOpen(false)} aria-label="Close" className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-8">
                <MobilePilgrimagePaymentCard
                  href={user
                    ? t.urls.myRegistrations
                    : `${t.urls.login}?next=${encodeURIComponent(t.urls.myRegistrations)}`}
                  isAuthenticated={!!user}
                  isEnglish={locale === 'en'}
                  isActive={pathname === t.urls.myRegistrations}
                  onClick={() => setIsMobileOpen(false)}
                />

                {/* Account / auth — kept near the highlighted registrations shortcut */}
                <SectionLabel>{t.mobileNav.myAccount}</SectionLabel>
                {user ? (
                  <>
                    <Drawer href={t.urls.profile} icon={User} onClick={() => setIsMobileOpen(false)}>{t.nav.userMenu.myProfile}</Drawer>
                    <Drawer href={t.urls.orders} icon={ShoppingBag} onClick={() => setIsMobileOpen(false)}>{t.nav.userMenu.myPurchases}</Drawer>
                    <Drawer href={membershipHref} icon={CreditCard} onClick={() => setIsMobileOpen(false)} active={pathname === membershipHref}>
                      {hasMembership ? t.nav.memberArea : t.nav.becomeMember}
                    </Drawer>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-3 mb-8">
                    <Link href={t.urls.login} onClick={() => setIsMobileOpen(false)} className="h-12 flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-colors">
                      {t.nav.signIn}
                    </Link>
                    <Link href={t.urls.register} onClick={() => setIsMobileOpen(false)} className="h-12 flex items-center justify-center rounded-xl bg-garabandal-gold text-garabandal-dark font-bold text-sm shadow-md hover:shadow-lg transition-all">
                      {t.nav.createAccount}
                    </Link>
                  </div>
                )}

                {/* Content categories */}
                <SectionLabel className="mt-8">{locale === 'pt' ? 'História' : 'The Message'}</SectionLabel>
                <Drawer href={aboutHref} icon={Compass} onClick={() => setIsMobileOpen(false)} active={pathname === aboutHref}>
                  {locale === 'pt' ? 'Sobre o Apostolado' : 'About the Apostolate'}
                </Drawer>
                {PUBLIC_NAV_ORDER.map((key) => {
                  const meta = CATEGORIES[key][locale];
                  const href = `${localePrefix}/${meta.slug}`;
                  const Icon = ICONS[key];
                  const expanded = openMobileCat === key;
                  return (
                    <div key={key} className="mb-1">
                      <button
                        onClick={() => setOpenMobileCat(expanded ? null : key)}
                        className={`w-full h-14 px-4 rounded-2xl flex items-center gap-3 transition-colors ${expanded ? 'bg-garabandal-gold/10 text-garabandal-dark' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${expanded ? 'bg-white shadow-sm text-garabandal-dark' : 'bg-slate-100 text-slate-500'}`}>
                          <Icon size={16} />
                        </div>
                        <span className="flex-1 text-left font-bold text-sm">{meta.label}</span>
                        <ChevronDown size={18} className={`transition-transform duration-300 opacity-50 ${expanded ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence initial={false}>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pl-[3.25rem] pr-2 pb-2 pt-1 flex flex-col gap-1">
                              {highlights[key]?.items?.map((it) => (
                                <Link key={it.href} href={it.href} onClick={() => setIsMobileOpen(false)} className="py-2.5 px-3 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-garabandal-dark transition-colors">
                                  {it.title}
                                </Link>
                              ))}
                              <Link href={href} onClick={() => setIsMobileOpen(false)} className="py-2.5 px-3 text-sm font-bold text-garabandal-gold inline-flex items-center gap-1.5 mt-1">
                                {locale === 'pt' ? 'Ver tudo' : 'See all'} <span aria-hidden="true">&rarr;</span>
                              </Link>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                {/* Participar */}
                <SectionLabel className="mt-8">{locale === 'pt' ? 'Participar' : 'Get involved'}</SectionLabel>
                <Drawer href={t.urls.pilgrimages} icon={MapPin} onClick={() => setIsMobileOpen(false)} active={pathname === t.urls.pilgrimages}>{t.nav.pilgrimages}</Drawer>
                <Drawer href={t.urls.auction} icon={Gavel} onClick={() => setIsMobileOpen(false)} active={pathname === t.urls.auction}>{t.nav.auction}</Drawer>
                <Drawer href={t.urls.donations} icon={Heart} onClick={() => setIsMobileOpen(false)} active={pathname === t.urls.donations}>{t.nav.donations}</Drawer>
                <Drawer href={t.urls.store} icon={Store} onClick={() => setIsMobileOpen(false)} active={pathname === t.urls.store}>{t.nav.store}</Drawer>

                {user && (
                  <button onClick={handleLogout} className="w-full mt-8 h-14 rounded-2xl bg-red-50 text-red-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-colors">
                    <LogOut size={18} /> {t.nav.userMenu.signOut}
                  </button>
                )}

                {/* Language */}
                <div className="mt-8 flex gap-3 p-1.5 bg-slate-100 rounded-2xl">
                  <button
                    onClick={() => {
                      router.push(localeSwitchHref(pathname, 'pt'));
                      setIsMobileOpen(false);
                    }}
                    className={`flex-1 h-11 rounded-xl text-sm font-bold transition-all ${locale === 'pt' ? 'bg-white text-garabandal-dark shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >🇵🇹 PT</button>
                  <button
                    onClick={() => {
                      router.push(localeSwitchHref(pathname, 'en'));
                      setIsMobileOpen(false);
                    }}
                    className={`flex-1 h-11 rounded-xl text-sm font-bold transition-all ${locale === 'en' ? 'bg-white text-garabandal-dark shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >🇬🇧 EN</button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <MobileBottomNav
        onOpenMenu={() => setIsMobileOpen(true)}
        hasMembership={hasMembership}
        isAuthenticated={!!user}
        isAuthLoading={loading}
        isMenuOpen={isMobileOpen}
      />
    </>
  );
}

function NavPill({
  href, label, active, icon: Icon,
}: { href: string; label: string; active: boolean; icon: typeof Heart; transparent?: boolean }) {
  return (
    <Link
      href={href}
      className={`group relative px-4 py-2.5 rounded-full text-sm font-bold inline-flex items-center gap-2 transition-all duration-300 hover:scale-[1.04] ${active ? 'bg-garabandal-gold/10 text-garabandal-dark' : 'text-slate-700 hover:text-garabandal-dark hover:bg-slate-100/80'}`}
    >
      <Icon size={16} className={`transition-all duration-300 group-hover:scale-110 ${active ? '' : 'opacity-70 group-hover:opacity-100'}`} />
      {label}
      {/* Animated gold underline that grows under the cursor on hover */}
      <span
        className={`pointer-events-none absolute bottom-1 left-1/2 h-0.5 -translate-x-1/2 rounded-full bg-garabandal-gold transition-all duration-300 ${active ? 'w-5 opacity-100' : 'w-0 opacity-0 group-hover:w-5 group-hover:opacity-100'}`}
      />
    </Link>
  );
}

function UserPill({
  user, memberData, isMember, open, setOpen, t, onLogout,
}: any) {
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full transition-all h-11 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 hover:text-garabandal-dark shadow-sm"
      >
        <span className="w-8 h-8 rounded-full bg-white text-garabandal-dark flex items-center justify-center font-serif font-bold text-sm border border-slate-200 shadow-sm">
          {user.email?.[0]?.toUpperCase()}
        </span>
        <ChevronDown size={14} className="opacity-60" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-full right-0 mt-3 min-w-[260px] bg-white rounded-3xl p-3 shadow-2xl border border-slate-100 z-50 origin-top-right"
            >
              <div className="px-3 py-2 mb-2">
                <p className="text-sm font-bold text-garabandal-dark truncate">{memberData?.nome || user.email?.split('@')[0]}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
              <Link href={t.urls.profile} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-garabandal-dark transition-colors">
                <User size={16} className="opacity-70" /> {t.nav.userMenu.myProfile}
              </Link>
              <Link href={t.urls.myRegistrations} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-garabandal-dark transition-colors">
                <Ticket size={16} className="opacity-70" /> {t.nav.userMenu.myRegistrations}
              </Link>
              <Link href={t.urls.orders} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-garabandal-dark transition-colors">
                <ShoppingBag size={16} className="opacity-70" /> {t.nav.userMenu.myPurchases}
              </Link>
              {(isMember || !!memberData?.numero_socio) && (
                <Link
                  href={t.urls.memberQuota}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-colors mt-1 ${isActiveMember(memberData) ? 'bg-garabandal-gold/10 text-garabandal-dark' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                >
                  <ShieldCheck size={16} className="opacity-70" /> {t.nav.userMenu.manageQuota}
                </Link>
              )}
              {isMember && (
                <Link href={t.urls.member} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-garabandal-dark transition-colors mt-1">
                  <LayoutDashboard size={16} className="opacity-70" /> {t.nav.memberArea}
                </Link>
              )}
              {isAdminEmail(user.email) && (
                <Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors mt-1">
                  <ShieldCheck size={16} className="opacity-80" /> {t.nav.userMenu.adminPanel}
                </Link>
              )}
              <div className="border-t border-slate-100 my-2" />
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-red-600 hover:bg-red-50 transition-colors text-left"
              >
                <LogOut size={16} /> {t.nav.userMenu.signOut}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 px-1 ${className}`}>
      {children}
    </p>
  );
}

function Drawer({
  href, icon: Icon, onClick, active, children,
}: { href: string; icon: typeof Heart; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 h-14 rounded-2xl text-sm transition-all mb-1 font-bold ${active ? 'bg-garabandal-gold text-garabandal-dark shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
    >
      <Icon size={18} className={active ? 'opacity-90' : 'opacity-70'} />
      {children}
    </Link>
  );
}
