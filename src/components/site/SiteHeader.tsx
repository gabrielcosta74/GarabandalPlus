"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { formatCurrency, loadCart } from '../../app/loja-online/data';
import { motion, AnimatePresence, useScroll } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { isActiveMember } from '../../lib/store-discounts';
import {
  ShoppingBag,
  Menu,
  X,
  User,
  ChevronDown,
  Package,
  LogOut,
  Heart,
  Store,
  Home,
  MapPin,
  ShieldCheck,
  BookOpen,
  CreditCard,
  LayoutDashboard,
  Settings,
  Ticket
} from 'lucide-react';
import MobileBottomNav from './MobileBottomNav';

type CartPreviewItem = {
  id: string;
  qty: number;
  name: string;
  price: number;
  currency: string;
  image: string;
  variantName?: string;
};

/* -------------------------------------------------------------------------- */
/*                                Component                                   */
/* -------------------------------------------------------------------------- */

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();

  // -- State --
  const { user, isMember, memberData, loading, signOut } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [cartPreview, setCartPreview] = useState<CartPreviewItem[]>([]);
  const [cartPreviewVisible, setCartPreviewVisible] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // -- Smart Navbar State --
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useEffect(() => {
    setMounted(true);
  }, []);

  // -- Scroll Logic --
  useEffect(() => {
    return scrollY.on("change", (latest: number) => {
      // Style logic: scrolled past top
      setScrolled(latest > 20);
    });
  }, [scrollY]);


  // -- Refs --
  const productsCache = useRef<CartPreviewItem[]>([]);
  const previewTimer = useRef<number | null>(null);

  // -- Computed --
  const hasMembership = !!memberData?.is_membro;
  const isAuthenticated = !!user;
  const membershipHref = hasMembership ? '/member' : '/tornar-membro';

  // Text Color Logic
  // Home Page has a Dark Hero -> White Text at top
  // Other Pages have Light Backgrounds -> Dark Text at top
  // Scrolled -> Dark Glass Background -> White Text always
  const isHomePage = pathname === '/';
  const isDarkText = !scrolled && !isHomePage && !isMobileOpen;

  const textColorClass = isDarkText ? 'text-slate-900' : 'text-white';
  const iconColorClass = isDarkText ? 'text-slate-600' : 'text-white';
  const hoverBgClass = isDarkText ? 'hover:bg-slate-100' : 'hover:bg-white/10';

  /* ------------------------------- Data Logic ------------------------------- */

  // 2. Cart Logic (Sync & Preview)
  useEffect(() => {
    const refreshCartCount = () => {
      const items = loadCart();
      const count = items.reduce((sum, item) => sum + item.qty, 0);
      try { setCartCount(count); } catch { }
    };

    const ensureProducts = async () => {
      if (productsCache.current.length > 0) return;
      try {
        const res = await fetch('/api/store/products?includeVariants=0');
        if (res.ok) {
          const data = await res.json();
          productsCache.current = (data.products || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            currency: p.currency,
            image: p.image,
            qty: 0,
          }));
        }
      } catch (err) {
        console.error('Cart products error:', err);
      }
    };

    const buildPreview = async () => {
      await ensureProducts();
      const items = loadCart();
      const preview = items.map(item => {
        const found = productsCache.current.find(p => p.id === item.id);
        if (!found) return null;
        return { ...found, qty: item.qty, variantName: item.variantName };
      }).filter(Boolean) as CartPreviewItem[];
      setCartPreview(preview.slice(0, 3));
    };

    const showPreview = async () => {
      await buildPreview();
      setCartPreviewVisible(true);
      if (previewTimer.current) clearTimeout(previewTimer.current);
      previewTimer.current = window.setTimeout(() => setCartPreviewVisible(false), 2400);
    };

    // Initial load
    refreshCartCount();
    void buildPreview();

    // Event Listeners
    const handleCartUpdate = () => {
      refreshCartCount();
      void showPreview();
    };
    const handleStorage = () => refreshCartCount();

    window.addEventListener('cart:updated', handleCartUpdate as EventListener);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('cart:updated', handleCartUpdate as EventListener);
      window.removeEventListener('storage', handleStorage);
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, []);

  // Logout Handler
  const handleLogout = async () => {
    await signOut();
    setIsMobileOpen(false);
    setUserMenuOpen(false);
    router.replace('/');
    router.refresh();
  };

  // 3. Scroll Lock for Mobile Menu
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileOpen]);

  /* ------------------------------- Renderers -------------------------------- */

  const NavLink = ({ href, icon: Icon, label, onClick }: { href: string; icon?: any; label: string; onClick?: () => void }) => {
    const isActive = pathname === href || (href !== '/' && pathname?.startsWith(href));

    return (
      <Link
        href={href}
        onClick={onClick}
        className={`
          group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
          ${isActive
            ? 'bg-yellow-50 text-yellow-700 font-semibold'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
          }
        `}
      >
        {Icon && <Icon className={`w-5 h-5 ${isActive ? 'text-yellow-600' : 'text-slate-400 group-hover:text-slate-600'}`} />}
        <span>{label}</span>
        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-yellow-600 lg:hidden" />}
      </Link>
    );
  };

  return (
    <>
      {/* 
        SMART HEADER 
        - Always Visible (scrolling doesn't hide)
        - Glassmorphism on scroll (always visible text)
        - Transparent at top
      */}
      <header
        className="fixed top-0 left-0 right-0 z-[100] h-20 flex items-center transition-all duration-500 bg-black/60 backdrop-blur-md shadow-lg shadow-black/10 border-b border-white/10"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">

          {/* 1. Logo Area */}
          <Link href="/" className="flex items-center gap-3 group z-50 focus:outline-none">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl font-serif font-bold text-xl shadow-lg transition-all duration-300 bg-white text-slate-900 shadow-white/10">
              G
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-xl font-bold tracking-tight leading-tight transition-colors duration-300 text-white drop-shadow-md">
                Garabandal
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] transition-colors duration-300 text-white/80 drop-shadow-md">
                Apostolado
              </span>
            </div>
          </Link>

          {/* 2. Desktop Navigation */}
          <div className={`hidden lg:flex items-center gap-1 p-1.5 rounded-full transition-all duration-300 ${scrolled ? 'bg-black/20 border border-white/10' : 'bg-white/10 backdrop-blur-sm border border-white/10'}`}>
            {[
              { href: '/', label: 'Início' },
              { href: '/peregrinacoes', label: 'Peregrinações' },
              { href: '/donations', label: 'Doações' },
              { href: '/loja-online', label: 'Loja' },
              ...(user ? [{ href: '/peregrinacoes/minhas-inscricoes', label: 'Minhas Inscrições' }] : []),
            ].map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`
                  relative group px-5 py-2 text-[14px] font-bold tracking-wide transition-colors duration-300 rounded-full
                  ${(pathname === link.href)
                    ? 'text-slate-900 bg-white shadow-lg shadow-white/20'
                    : '!text-white/90 hover:!text-white hover:!bg-white/10'
                  }
                `}
              >
                {link.label}
              </Link>
            ))}

            <Link
              href={membershipHref}
              className={`
                  ml-2 px-6 py-2 rounded-full text-[14px] font-bold tracking-wide transition-all duration-300 transform hover:scale-105 active:scale-95
                  ${hasMembership
                  ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 shadow-sm'
                  : 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-lg shadow-yellow-500/30'
                }
                `}
            >
              {hasMembership ? 'Área de Membro' : 'Ser Membro'}
            </Link>
          </div>

          {/* 3. Actions Area (Cart, User, Mobile Toggle) */}
          <div className="flex items-center gap-3">

            {/* Cart Button */}
            <div className="relative group">
              <Link
                href="/loja-online/checkout"
                className="relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 bg-white/10 text-white hover:bg-white/20 border border-white/10 backdrop-blur-md"
                aria-label="Ver Carrinho"
              >
                <ShoppingBag className="w-5 h-5 text-white" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-yellow-500 text-white text-[10px] font-bold rounded-full shadow-sm ring-2 ring-white">
                    {cartCount}
                  </span>
                )}
              </Link>
              {/* Cart Preview (Desktop Hover) */}
              <div className="absolute top-full right-0 pt-4 opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all duration-200 z-50 lg:block hidden">
                {/* ... Cart Preview implementation matches previous ... */}
                {cartCount > 0 && (
                  <div className="w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                      <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Seu Carrinho</span>
                      <span className="text-xs font-bold text-slate-900">{cartCount} items</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-2">
                      {cartPreview.map(item => (
                        <div key={item.id} className="flex gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                          <img src={item.image} alt="" className="w-12 h-12 object-cover rounded-lg border border-slate-200/50" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p>
                            {item.variantName && <p className="text-xs font-bold text-slate-600">{item.variantName}</p>}
                            <p className="text-xs text-slate-500">{item.qty}x {formatCurrency(item.price)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 border-t border-slate-100">
                      <Link href="/loja-online/checkout" className="flex w-full items-center justify-center py-2.5 px-4 bg-yellow-600 text-white text-sm font-bold rounded-xl hover:bg-yellow-700 transition-colors shadow-lg shadow-yellow-900/10">
                        Finalizar Compra
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* User Menu (Desktop) */}
            <div className="hidden lg:block">
              {mounted && (
                <>
                  {user ? (
                    <div className="relative">
                      <button
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                        className="flex items-center gap-3 pl-1 pr-4 py-1.5 rounded-full transition-all cursor-pointer group bg-white/10 border border-white/20 hover:bg-white/20 backdrop-blur-md !text-white"
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 text-yellow-500 flex items-center justify-center font-serif font-bold text-lg border-2 border-white shadow-sm">
                          {memberData?.avatar_url ? (
                            <img src={memberData.avatar_url} alt="Profile" className="w-full h-full object-cover rounded-full" />
                          ) : (
                            user.email?.[0].toUpperCase()
                          )}

                        </div>
                        <div className="flex flex-col items-start">
                          <span className="text-xs font-bold leading-none text-white">
                            Minha Conta
                          </span>
                        </div>
                        <motion.div
                          animate={{ rotate: userMenuOpen ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="w-4 h-4 text-white/60 group-hover:text-white" />
                        </motion.div>
                      </button>

                      {/* User Dropdown (Same as before) */}
                      <AnimatePresence>
                        {userMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                            <motion.div
                              initial={{ opacity: 0, y: 15, scale: 0.95, rotateX: -5 }}
                              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              transition={{ type: "spring", stiffness: 300, damping: 20 }}
                              className="absolute top-full right-0 mt-3 w-80 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 ring-1 ring-black/5 overflow-hidden z-50 origin-top-right"
                            >
                              {/* ... Dropdown Content reused ... */}
                              {/* Header */}
                              <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                  <div className="w-32 h-32 rounded-full bg-yellow-500 blur-3xl" />
                                </div>
                                <div className="relative z-10 flex items-center gap-4">
                                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center text-slate-900 font-serif font-bold text-2xl shadow-lg border-4 border-white/10">
                                    {memberData?.avatar_url ? (
                                      <img src={memberData.avatar_url} alt="Profile" className="w-full h-full object-cover rounded-full" />
                                    ) : (
                                      user.email?.[0].toUpperCase()
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-lg leading-tight truncate">{user.email?.split('@')[0]}</p>
                                    <p className="text-xs text-slate-400 truncate mb-2">{user.email}</p>
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isMember ? 'bg-yellow-500 text-slate-900' : 'bg-slate-700 text-slate-300'}`}>
                                      {isMember ? (
                                        <><span className="w-1.5 h-1.5 rounded-full bg-slate-900 animate-pulse" /> Membro Ativo</>
                                      ) : (
                                        'Visitante'
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Menu Items */}
                              <div className="p-2">
                                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  A Minha Atividade
                                </div>
                                <div className="space-y-1">
                                  <Link href="/peregrinacoes/minhas-inscricoes" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all group">
                                    <div className="w-8 h-8 rounded-lg bg-yellow-50 text-yellow-600 flex items-center justify-center group-hover:bg-yellow-100 transition-colors">
                                      <Ticket className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <p className="leading-none">Minhas Inscrições</p>
                                      <p className="text-[10px] text-slate-400 mt-0.5">Gerir peregrinações</p>
                                    </div>
                                  </Link>
                                  <Link href="/encomendas" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all group">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                                      <ShoppingBag className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <p className="leading-none">Minhas Compras</p>
                                      <p className="text-[10px] text-slate-400 mt-0.5">Histórico da loja</p>
                                    </div>
                                  </Link>
                                </div>

                                <div className="mt-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-t border-slate-100">
                                  Gestão de Conta
                                </div>
                                <div className="space-y-1">
                                  {/* QUOTA MANAGEMENT */}
                                  {(isMember || !!memberData?.numero_socio) && (() => {
                                    const active = isActiveMember(memberData);
                                    const isOverdue = !active && !!memberData?.numero_socio;

                                    return (
                                      <Link href="/member/quota" onClick={() => setUserMenuOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${isOverdue ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'}`}>
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isOverdue ? 'bg-white text-red-600' : 'bg-green-50 text-green-600 group-hover:bg-green-100'}`}>
                                          <ShieldCheck className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1">
                                          <div className="flex items-center justify-between">
                                            <p className="leading-none font-bold">Gerir Quota</p>
                                            {isOverdue && <span className="text-[10px] bg-red-200 text-red-800 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide animate-pulse">Atraso</span>}
                                          </div>
                                          <p className={`text-[10px] mt-0.5 ${isOverdue ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                                            {isOverdue ? 'Regularizar situação' : 'Verificar estado'}
                                          </p>
                                        </div>
                                      </Link>
                                    );
                                  })()}

                                  {isMember && (
                                    <Link href="/member" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all group">
                                      <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                                        <LayoutDashboard className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <p className="leading-none">Área de Membro</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Conteúdos exclusivos</p>
                                      </div>
                                    </Link>
                                  )}
                                  <Link href="/account/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all group">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                                      <User className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <p className="leading-none">Meu Perfil</p>
                                      <p className="text-[10px] text-slate-400 mt-0.5">Dados pessoais</p>
                                    </div>
                                  </Link>

                                  {/* ADMIN LINK */}
                                  {(user.email?.toLowerCase() === 'geral@apostoladodegarabandal.com' || user.email === 'Gabrielcosta2908@gmail.com') && (
                                    <Link href="/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-all group mt-1">
                                      <div className="w-8 h-8 rounded-lg bg-white/50 text-red-600 flex items-center justify-center">
                                        <LayoutDashboard className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <p className="leading-none font-bold">Painel de Administrador</p>
                                        <p className="text-[10px] text-red-400 mt-0.5">Acesso restrito</p>
                                      </div>
                                    </Link>
                                  )}
                                </div>

                                <div className="p-2 mt-1 border-t border-slate-100">
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleLogout();
                                    }}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                                  >
                                    <LogOut className="w-4 h-4" />
                                    Terminar Sessão
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : !loading && (
                    <div className="flex items-center gap-3">
                      <Link href="/login" className="text-sm font-bold transition-colors !text-white hover:text-white/80">
                        Entrar
                      </Link>
                      <Link
                        href="/register"
                        className="px-5 py-2.5 text-white text-sm font-bold rounded-full shadow-lg shadow-yellow-900/20 transition-all hover:scale-105"
                        style={{ backgroundColor: '#ca8a04' }}
                      >
                        Criar Conta
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl transition-colors focus:outline-none text-white hover:bg-white/10"
              aria-label="Abrir Menu"
            >
              <Menu className="w-7 h-7" />
            </button>
          </div>
        </div>
      </header>

      {/* 
        MOBILE MENU DRAWER 
        - Full screen overlay with z-index manipulation
        - Slide-in from right
      */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm lg:hidden"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-[160] w-[85vw] max-w-[340px] bg-white shadow-2xl lg:hidden flex flex-col"
            >
              {/* Drawer Header */}
              <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100 bg-white sticky top-0 z-10">
                <span className="font-serif text-xl font-bold text-slate-900">Menu</span>
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="p-2 -mr-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">

                {/* 1. User Context Section (Top Importance) */}
                {!loading && user && (
                  <div className="mb-8">
                    <div className="flex items-center gap-3 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold overflow-hidden border-2 border-white shadow-sm">
                        {memberData?.avatar_url ? (
                          <img src={memberData.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          user.email?.[0].toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 truncate">{memberData?.nome || user.email?.split('@')[0]}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-bold text-yellow-800 uppercase tracking-widest px-2 mb-2 flex items-center gap-2">
                        <User className="w-3 h-3" /> A Minha Conta
                      </p>
                      <NavLink href="/account/profile" icon={User} label="Meu Perfil" onClick={() => setIsMobileOpen(false)} />
                      <NavLink href="/peregrinacoes/minhas-inscricoes" icon={Ticket} label="Minhas Inscrições" onClick={() => setIsMobileOpen(false)} />
                      <NavLink href="/encomendas" icon={ShoppingBag} label="Minhas Compras" onClick={() => setIsMobileOpen(false)} />
                      {(hasMembership || !!memberData?.numero_socio) && (
                        <NavLink href="/member/quota" icon={ShieldCheck} label="Gerir Quota" onClick={() => setIsMobileOpen(false)} />
                      )}
                      {hasMembership ? (
                        <NavLink href="/member" icon={LayoutDashboard} label="Área de Membro" onClick={() => setIsMobileOpen(false)} />
                      ) : (
                        <NavLink href="/tornar-membro" icon={CreditCard} label="Tornar-se Membro" onClick={() => setIsMobileOpen(false)} />
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Main Navigation (Public) */}
                <div className="space-y-1 mb-8">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 mb-2 flex items-center gap-2">
                    <Store className="w-3 h-3" /> Navegação
                  </p>
                  <NavLink href="/" icon={Home} label="Início" onClick={() => setIsMobileOpen(false)} />
                  <NavLink href="/peregrinacoes" icon={MapPin} label="Peregrinações" onClick={() => setIsMobileOpen(false)} />
                  <NavLink href="/donations" icon={Heart} label="Doações" onClick={() => setIsMobileOpen(false)} />
                  <NavLink href="/loja-online" icon={Store} label="Loja Online" onClick={() => setIsMobileOpen(false)} />
                </div>

                {/* 3. Member Specifics (If Active) */}
                {hasMembership && (
                  <div className="space-y-1 mb-8">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 mb-2 flex items-center gap-2">
                      <ShieldCheck className="w-3 h-3" /> Conteúdos
                    </p>
                    <NavLink href="/member/prayers" icon={Heart} label="Orações e Novenas" onClick={() => setIsMobileOpen(false)} />
                    <NavLink href="/biblioteca" icon={BookOpen} label="Biblioteca" onClick={() => setIsMobileOpen(false)} />
                  </div>
                )}

                {/* 4. Action / Logout */}
                {!loading && !user ? (
                  <div className="mt-4 pt-6 border-t border-slate-100 grid grid-cols-2 gap-3">
                    <Link
                      href="/login"
                      onClick={() => setIsMobileOpen(false)}
                      className="flex justify-center py-3 rounded-xl border border-slate-200 font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Entrar
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setIsMobileOpen(false)}
                      className="flex justify-center py-3 rounded-xl font-bold text-white shadow-sm bg-yellow-600"
                    >
                      Criar Conta
                    </Link>
                  </div>
                ) : !loading && user ? (
                  <div className="mt-4 pt-6 border-t border-slate-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-colors"
                    >
                      <LogOut className="w-5 h-5" /> Terminar Sessão
                    </button>
                  </div>
                ) : null}

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence >

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        onOpenMenu={() => setIsMobileOpen(true)}
        hasMembership={hasMembership}
        isAuthenticated={isAuthenticated}
        isAuthLoading={loading}
        isMenuOpen={isMobileOpen}
      />
    </>
  );
}
