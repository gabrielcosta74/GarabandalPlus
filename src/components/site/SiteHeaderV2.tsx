"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from '../../contexts/LocaleContext';
import { useAuth } from '../../contexts/AuthContext';
import { isActiveMember } from '../../lib/store-discounts';
import { loadCart } from '../../app/loja-online/data';
import { motion, AnimatePresence, useScroll } from 'framer-motion';
import {
  ShoppingBag, Menu, X, ChevronDown, User, LogOut, Heart, Home, MapPin, Check,
  ShieldCheck, BookOpen, CreditCard, LayoutDashboard, Ticket, Store, Compass,
  Scroll, MessageCircleHeart, Users, Sparkles, Info, Gavel,
} from 'lucide-react';
import MobileBottomNav from './MobileBottomNav';
import MobilePilgrimagePaymentCard from './MobilePilgrimagePaymentCard';
import { CATEGORIES, PUBLIC_NAV_ORDER, localePrefix as prefixFor, type CategoryKey } from '../../lib/cms/categories';
import { getPublicLocaleFromPathname } from '../../lib/locale-routing';
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

// Slugs de 1 nível dentro de /peregrinacoes e /en/pilgrimages que não são
// páginas de detalhe de uma peregrinação.
const CINEMA_RESERVED_SLUGS = new Set(['minhas-inscricoes', 'my-registrations', 'inscricao', 'registration']);

export default function SiteHeaderV2() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale } = useLocale();
  const { user, isMember, memberData, loading, signOut } = useAuth();

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<CategoryKey | 'content' | null>(null);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [highlights, setHighlights] = useState<NavHighlights>({});
  const [openMobileCat, setOpenMobileCat] = useState<CategoryKey | null>(null);
  const lastScrollY = useRef(0);
  const isHeaderHidden = useRef(false);
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
    lastScrollY.current = scrollY.get();
    isHeaderHidden.current = false;

    return scrollY.on('change', (latest: number) => {
      setScrolled(latest > 20);

      const delta = latest - lastScrollY.current;
      lastScrollY.current = latest;

      // Ignore tiny scroll deltas (trackpads can emit many of them) so the
      // header never keeps restarting its transition. It hides while scrolling
      // down past the intro, then reveals immediately and smoothly on a clear
      // upward movement.
      if (latest <= 100) {
        if (isHeaderHidden.current) {
          isHeaderHidden.current = false;
          setHidden(false);
        }
      } else if (delta > 6 && !isHeaderHidden.current) {
        isHeaderHidden.current = true;
        setHidden(true);
      } else if (delta < -6 && isHeaderHidden.current) {
        isHeaderHidden.current = false;
        setHidden(false);
      }
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
  // Resolve the section from the URL, not from `locale` (which the i18n layer
  // only ever reports as 'pt' | 'en'). On /es, /fr and /it this used to fall
  // through to '/en', pointing the category menu at the wrong language.
  const navLocale = getPublicLocaleFromPathname(pathname);
  const localePrefix = prefixFor(navLocale);
  // "Sobre o Apostolado" points to the migrated Webnode about page at its
  // original (SEO-preserved) URL, rather than a new /sobre-o-apostolado slug.
  const aboutHref = navLocale === 'en' ? '/en/our-apostolate' : '/apostolado-garabandal';
  const homeHref = locale === 'pt' ? '/' : '/en';

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
  // Página de detalhe da peregrinação (PT e EN): versão escura e minimalista,
  // totalmente transparente no topo e em vidro escuro depois do scroll.
  const cinemaMatch = pathname?.match(/^\/(?:peregrinacoes|en\/pilgrimages)\/([^/]+)\/?$/);
  const cinema = !!cinemaMatch && !CINEMA_RESERVED_SLUGS.has(cinemaMatch[1]);

  // Shared styling for the circular cart and mobile-menu action buttons.
  // Dark text/icons on every state — the bar always sits on a light (glass) fill.
  const circleBtn = cinema
    ? 'bg-white/10 hover:bg-white/20 text-white border border-white/15 backdrop-blur-md'
    : transparent
    ? 'bg-white/50 hover:bg-white/70 text-slate-700 hover:text-garabandal-dark border border-white/50 backdrop-blur-md'
    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-garabandal-dark border border-slate-200 shadow-sm';

  return (
    <>
      <header
        className={`fixed left-0 right-0 z-[100] hidden lg:block will-change-transform transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] top-2 [&_a]:cursor-pointer [&_button]:cursor-pointer [body[data-modal-open]_&]:pointer-events-none [body[data-modal-open]_&]:opacity-0 ${hidden ? '-translate-y-[150%]' : 'translate-y-0'}`}
      >
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div
            className={`flex items-center justify-between transition-all duration-500 ease-in-out rounded-[2rem] ${cinema ? 'h-16' : 'h-[4.5rem]'} px-4 sm:px-6 ${scrolled ? 'py-1' : 'py-2'} ${cinema ? (scrolled ? 'bg-[rgb(12_12_12/0.55)] backdrop-blur-xl border border-white/10 shadow-[0_12px_40px_rgb(0,0,0,0.35)]' : 'bg-transparent border border-transparent shadow-none') : transparent ? 'bg-white/85 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-transparent' : 'bg-white/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-200/50'}`}
          >
            {/* 1. Navigation (Desktop). "Início" is the first pill, same style as the rest. */}
            <nav className="hidden lg:flex items-center justify-start flex-1 gap-0.5 xl:gap-1">
              <NavPill href={homeHref} label={locale === 'pt' ? 'Início' : 'Home'} active={pathname === '/' || pathname === '/en'} transparent={transparent} cinema={cinema} />
              <NavPill href={aboutHref} label={locale === 'pt' ? 'Apostolado' : 'Apostolate'} active={pathname === aboutHref} transparent={transparent} cinema={cinema} />

              {/* Mega Dropdown for Content Categories */}
              <div
                className="relative h-full flex items-center"
                onMouseEnter={() => setOpenDropdown('content')}
                onMouseLeave={() => setOpenDropdown(null)}
              >
                <button className={`cursor-pointer px-3.5 xl:px-4 py-2.5 rounded-full flex items-center gap-1.5 transition-colors duration-200 ${cinema ? (openDropdown === 'content' ? 'bg-white/10 text-white' : 'text-white/75 hover:text-white hover:bg-white/10') : openDropdown === 'content' ? 'bg-slate-100 text-garabandal-dark' : 'text-slate-700 hover:text-garabandal-dark hover:bg-slate-100/80'}`}>
                  {/* Text sizing lives on a span: the unlayered `button { font: inherit }` in globals.css beats utilities on the button itself. Keep in sync with NavPill. */}
                  <span className={`${cinema ? 'text-[14px] xl:text-[15px]' : 'text-[15px] xl:text-base'} font-medium`}>{locale === 'pt' ? 'História' : 'The Message'}</span>
                  <ChevronDown size={14} className={`transition-transform duration-300 opacity-50 ${openDropdown === 'content' ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {openDropdown === 'content' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className="absolute top-full left-0 pt-4 z-50 origin-top-left"
                    >
                      <div className="w-[600px] xl:w-[650px] bg-white rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] border border-slate-100 p-6 grid grid-cols-2 gap-x-6 gap-y-3 relative">
                        {/* Little triangle pointer, centred under the "História" button */}
                        <div className="absolute -top-2 left-12 -translate-x-1/2 w-4 h-4 bg-white border-t border-l border-slate-100 rotate-45" />

                        {PUBLIC_NAV_ORDER.map(key => {
                          const meta = CATEGORIES[key][navLocale];
                          const href = `${localePrefix}/${meta.slug}`;
                          const Icon = ICONS[key];
                          return (
                            <Link key={key} href={href} className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors group/item relative z-10">
                              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover/item:bg-brand-50 group-hover/item:text-brand-700 transition-colors shrink-0 shadow-sm">
                                <Icon size={20} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-base font-bold text-garabandal-dark mb-1">{meta.label}</p>
                                <p className="text-[13px] text-slate-500 line-clamp-2 leading-relaxed">{meta.tagline}</p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <NavPill href={t.urls.pilgrimages} label={t.nav.pilgrimages} active={pathname === t.urls.pilgrimages} transparent={transparent} cinema={cinema} />
              <NavPill href={t.urls.store} label={t.nav.store} active={pathname === t.urls.store} transparent={transparent} cinema={cinema} />
              <NavPill href={t.urls.donations} label={t.nav.donations} active={pathname === t.urls.donations} transparent={transparent} cinema={cinema} />

              {/* Primary call to action, always blue with a slow shimmer + glow (see .btn-member in globals.css). */}
              <Link href={membershipHref} className={cinema ? 'ml-2 px-4 xl:px-5 py-2 rounded-full border border-white/25 text-[14px] xl:text-[15px] font-medium whitespace-nowrap text-white transition-colors hover:bg-white/10 hover:border-white/40' : 'btn-member ml-2 px-5 xl:px-6 py-2.5 rounded-full text-[15px] xl:text-base font-semibold whitespace-nowrap text-white'}>
                <span>{hasMembership ? t.nav.memberArea : t.nav.becomeMember}</span>
              </Link>
            </nav>

            {/* 3. Actions (Right side) */}
            <div className="flex items-center gap-4 xl:gap-5">
              {/* Language — intentionally text-only, with the active language checked in a compact menu. */}
              <div className="relative hidden sm:block">
                {languageMenuOpen && <button aria-label="Close language menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setLanguageMenuOpen(false)} />}
                <button
                  type="button"
                  onClick={() => setLanguageMenuOpen((open) => !open)}
                  className={`relative z-50 inline-flex cursor-pointer items-center py-2 text-[13px] font-semibold transition-colors duration-200 ${cinema ? 'text-white/85 hover:text-white' : 'text-slate-900 hover:text-brand-700'} focus:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-brand/30`}
                  aria-label="Change language"
                  aria-expanded={languageMenuOpen}
                  aria-haspopup="menu"
                >
                  <span>{locale === 'pt' ? 'PT' : 'EN'}</span>
                  <ChevronDown size={13} strokeWidth={2.25} className={`${cinema ? 'text-white/70' : 'text-slate-700'} transition-transform duration-200 ${languageMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                <AnimatePresence>
                  {languageMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                      role="menu"
                      className="absolute right-0 top-full z-50 mt-3 w-40 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-[0_16px_38px_rgba(15,23,42,0.14)] backdrop-blur-xl"
                    >
                      {[
                        { code: 'pt' as const, label: 'Português' },
                        { code: 'en' as const, label: 'English' },
                      ].map((option) => {
                        const selected = locale === option.code;
                        return (
                          <button
                            key={option.code}
                            type="button"
                            role="menuitemradio"
                            aria-checked={selected}
                            onClick={() => {
                              setLanguageMenuOpen(false);
                              if (!selected) router.push(localeSwitchHref(pathname, option.code));
                            }}
                            className={`flex h-10 w-full cursor-pointer items-center justify-between rounded-xl px-3 text-left text-sm font-medium transition-colors ${selected ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}
                          >
                            <span>{option.label}</span>
                            {selected && <Check size={16} strokeWidth={2.5} aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Cart */}
              <Link href={t.urls.checkout} aria-label={t.nav.cart.label} className={`relative flex items-center justify-center w-11 h-11 rounded-full transition-all ${circleBtn}`}>
                <ShoppingBag size={20} />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center shadow-sm ring-2 ring-white">
                    {cartCount}
                  </span>
                )}
              </Link>

              {/* User/Auth */}
              {mounted && !loading && (
                user ? (
                  <UserPill user={user} memberData={memberData} isMember={isMember} open={userMenuOpen} setOpen={setUserMenuOpen} t={t} onLogout={handleLogout} cinema={cinema} />
                ) : (
                  <div className="hidden lg:flex items-center gap-2">
                    <Link href={t.urls.login} className={`px-4 xl:px-5 py-2.5 rounded-full font-medium whitespace-nowrap transition-colors ${cinema ? 'text-[14px] xl:text-[15px] text-white/80 hover:text-white hover:bg-white/10' : 'text-[15px] xl:text-base text-slate-700 hover:text-garabandal-dark hover:bg-slate-50'}`}>
                      {t.nav.signIn}
                    </Link>
                    <Link href={t.urls.register} className={cinema ? 'hidden' : 'hidden xl:inline-flex px-6 py-2.5 rounded-full text-base font-semibold whitespace-nowrap border border-slate-300 text-garabandal-dark hover:border-garabandal-dark hover:bg-slate-50 transition-colors'}>
                      {t.nav.createAccount}
                    </Link>
                  </div>
                )
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
                <span className="font-sans text-2xl font-bold text-garabandal-dark">
                  Menu
                </span>
                <button onClick={() => setIsMobileOpen(false)} aria-label="Close" className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-8">
                {/* Atalho para as inscrições: só para quem tem sessão iniciada.
                    Sem sessão não há inscrições para mostrar, e o cartão só
                    levava ao login. */}
                {user && (
                  <MobilePilgrimagePaymentCard
                    href={t.urls.myRegistrations}
                    isAuthenticated
                    isEnglish={locale === 'en'}
                    isActive={pathname === t.urls.myRegistrations}
                    onClick={() => setIsMobileOpen(false)}
                  />
                )}

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
                    <Link href={t.urls.register} onClick={() => setIsMobileOpen(false)} className="h-12 flex items-center justify-center rounded-xl bg-brand text-white font-bold text-sm shadow-md transition-all hover:bg-brand-700 hover:shadow-lg">
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
                  const meta = CATEGORIES[key][navLocale];
                  const href = `${localePrefix}/${meta.slug}`;
                  const Icon = ICONS[key];
                  const expanded = openMobileCat === key;
                  return (
                    <div key={key} className="mb-1">
                      <button
                        onClick={() => setOpenMobileCat(expanded ? null : key)}
                        className={`w-full h-14 px-4 rounded-2xl flex items-center gap-3 transition-colors ${expanded ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
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
                              <Link href={href} onClick={() => setIsMobileOpen(false)} className="py-2.5 px-3 text-sm font-bold text-brand inline-flex items-center gap-1.5 mt-1">
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
  href, label, active, cinema = false,
}: { href: string; label: string; active: boolean; transparent?: boolean; cinema?: boolean }) {
  const tone = cinema
    ? `text-[14px] xl:text-[15px] ${active ? 'bg-white/10 text-white' : 'text-white/75 hover:text-white hover:bg-white/10'}`
    : `text-[15px] xl:text-base ${active ? 'bg-slate-100 text-garabandal-dark' : 'text-slate-700 hover:text-garabandal-dark hover:bg-slate-100/80'}`;
  return (
    <Link
      href={href}
      className={`px-3.5 xl:px-4 py-2.5 rounded-full font-medium inline-flex items-center transition-colors duration-200 ${tone}`}
    >
      {label}
    </Link>
  );
}

function UserPill({
  user, memberData, isMember, open, setOpen, t, onLogout, cinema = false,
}: any) {
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`group flex h-11 min-w-[76px] cursor-pointer items-center justify-between gap-2 rounded-full py-1.5 pl-1.5 pr-3 transition-all duration-200 active:scale-[0.98] ${cinema ? 'border border-white/15 bg-white/10 text-white backdrop-blur-md hover:bg-white/20' : 'border border-slate-200/90 bg-white text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.06)] hover:-translate-y-px hover:border-brand-200 hover:shadow-[0_8px_20px_rgba(53,99,233,0.14)] active:translate-y-0'}`}
      >
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 font-sans text-sm font-bold text-garabandal-dark ring-1 ring-slate-200/80 ring-offset-1 ring-offset-white transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
          {memberData?.avatar_url ? (
            <img src={memberData.avatar_url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
          ) : (
            user.email?.[0]?.toUpperCase()
          )}
        </span>
        <ChevronDown size={15} strokeWidth={2.25} className={`shrink-0 ${cinema ? 'text-white/70' : 'text-slate-500'} transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
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
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-colors mt-1 ${isActiveMember(memberData) ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
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
      className={`flex items-center gap-3 px-4 h-14 rounded-2xl text-sm transition-all mb-1 font-bold ${active ? 'bg-brand text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
    >
      <Icon size={18} className={active ? 'opacity-90' : 'opacity-70'} />
      {children}
    </Link>
  );
}
